import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from 'kysely';
import { readConfig } from '../src/config.js';
import { connect, type DB } from '../src/db.js';
import { migrate, verifyMigrations } from '../src/migrate.js';
import { hmac, uuid } from '../src/platform/crypto.js';
import { deletion } from '../src/privacy/service.js';
import { workerTick } from '../src/privacy/erasure.js';
import { restoredSubjects } from '../src/privacy/recovery.js';
import { publish } from '../src/catalog/publisher.js';
import { rollbackTo } from './fixtures/db.js';
import { reviewedFixture } from './fixtures/catalog.js';
// Slice 1 M4: learning and assessment tables, their database guards (INV-07, INV-08, append-only evidence)
// and complete erasure (INV-19) of every learner-owned row, including after a restore.

// Every table holding learner data, and where this suite proves it is erased. A new table with a
// learner column fails the coverage test below until it is added here (and to the erasure).
const LEARNER_TABLES: Record<string, string> = {
  learner: 'seeded here', student_profile: 'Slice 0 suite', consent_record: 'Slice 0 suite', deletion_request: 'seeded here (erasure request)', app_user: 'Slice 0 suite',
  learning_session: 'seeded here', session_item: 'seeded here (via session)', lesson_assignment: 'seeded here (via session)', question_attempt: 'seeded here',
  assistance_event: 'seeded here', diagnosis_run: 'seeded here', concept_evidence: 'seeded here', diagnosis_report: 'seeded here (Slice 2)',
  question: 'deferred to Slice 6: private intake questions (owner_learner_id); none can exist before intake, asserted below',
};
const SEEDED = ['learning_session', 'session_item', 'lesson_assignment', 'question_attempt', 'assistance_event', 'diagnosis_run', 'concept_evidence', 'diagnosis_report'] as const;

test('Slice 1 learning schema, guards and erasure on PostgreSQL', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  const guard = (query: Promise<unknown>, pattern: RegExp) => assert.rejects(query, pattern);
  let catalog: { releaseId: string; mcq: string; check: string; lesson: string; lessonRevision: string; concept: string };

  // One learner with a row in every learning and assessment table, including self-references.
  const seed = async (database: DB = db) => {
    const id = uuid(), session = uuid(), item = uuid(), assignment = uuid(), a1 = uuid(), a2 = uuid(), a3 = uuid(), run1 = uuid(), run2 = uuid(), ev1 = uuid(), ev2 = uuid();
    const response = (optionId: string) => JSON.stringify({ schemaVersion: 1, responseType: 'OPTION', optionId, inputMode: 'TYPED' });
    await database.transaction().execute(async tx => {
      await sql`insert into learner(id, status, age_band, age_band_source) values (${id}, 'ACTIVE', 'UNKNOWN', 'SELF_DECLARED')`.execute(tx);
      await sql`insert into learning_session(id, learner_id, kind, origin, release_id, state, expires_at) values
        (${session}, ${id}, 'PRACTICE', 'CONCEPT_LESSON', ${catalog.releaseId}, 'PRACTICING', now() + interval '1 day')`.execute(tx);
      await sql`insert into session_item(id, session_id, ordinal, question_revision_id, role, status) values (${item}, ${session}, 1, ${catalog.mcq}, 'PRACTICE', 'ANSWERED')`.execute(tx);
      await sql`insert into lesson_assignment(id, session_id, lesson_id, lesson_revision_id, concept_id, status, pinned_checks) values
        (${assignment}, ${session}, ${catalog.lesson}, ${catalog.lessonRevision}, ${catalog.concept}, 'COMPLETED', '[]')`.execute(tx);
      const qa = (attempt: string, kind: string, ordinal: number, extra: { item?: string; assignment?: string; check?: string; parent?: string }) => sql`
        insert into question_attempt(id, session_id, learner_id, question_revision_id, kind, ordinal, session_item_id, assignment_id, micro_assessment_id, parent_attempt_id,
          response, assistance, verdict, source, graded_at)
        values (${attempt}, ${session}, ${id}, ${catalog.mcq}, ${kind}, ${ordinal}, ${extra.item ?? null}, ${extra.assignment ?? null}, ${extra.check ?? null}, ${extra.parent ?? null},
          ${response('a')}::jsonb, 'NONE', 'CORRECT', 'LIVE', now())`.execute(tx);
      await qa(a1, 'PRACTICE', 1, { item });
      await qa(a2, 'QUICK_CHECK', 2, { assignment, check: catalog.check });
      await qa(a3, 'RETRY', 3, { parent: a1 });
      await sql`update learning_session set active_attempt_id = ${a1} where id = ${session}`.execute(tx);
      await sql`insert into assistance_event(id, learner_id, session_id, question_family_code, type, source, dedupe_key) values
        (${uuid()}, ${id}, ${session}, 'MAT.TRI.F.TAN60_SIN30', 'HINT_SHOWN', 'SERVER_DELIVERED', ${'hint:' + session + ':1'})`.execute(tx);
      const run = (runId: string, generation: number, engine: string) => sql`insert into diagnosis_run(id, attempt_id, learner_id, generation, purpose, engine, status,
          evidence_status, verdict, rubric_version, policy_version, deadline_at, completed_at)
        values (${runId}, ${a1}, ${id}, ${generation}, 'GRADING', ${engine}, 'COMPLETED', 'SUPPORTED', 'CORRECT', 'option-v1', 'mastery-v1', now(), now())`.execute(tx);
      await run(run1, 1, 'DETERMINISTIC'); await run(run2, 2, 'EDUCATOR');
      const evidence = (evId: string, runId: string, source: string, supersedes: string | null) => sql`insert into concept_evidence(id, diagnosis_run_id, attempt_id, learner_id, concept_id,
          classification, source, refs, question_family_code, context_tag, transfer_eligible, mastery_eligible, supersedes_id)
        values (${evId}, ${runId}, ${a1}, ${id}, ${catalog.concept}, 'UNDERSTANDING_DEMONSTRATED', ${source}, ${JSON.stringify([{ kind: 'OPTION', optionId: 'a' }])}::jsonb,
          'MAT.TRI.F.TAN60_SIN30', 'BARE_VALUE', false, true, ${supersedes})`.execute(tx);
      await evidence(ev1, run1, 'DETERMINISTIC', null);
      // Slice 2: a dispute report on the run and the run's job; both reference the run, so erasure removes them first.
      await sql`insert into diagnosis_report(id, diagnosis_run_id, learner_id, reason, note, status) values (${uuid()}, ${run1}, ${id}, 'OTHER', ${'canary 5521'}, 'OPEN')`.execute(tx);
      await sql`insert into job(id, queue, diagnosis_run_id, status, deadline_at) values (${uuid()}, 'diagnosis', ${run1}, 'DONE', now() + interval '1 minute')`.execute(tx);
      await evidence(ev2, run2, 'EDUCATOR', ev1);
      // The one permitted evidence update: mark the older row superseded (06 §5.1 rule 7).
      await sql`update concept_evidence set mastery_eligible = false, transfer_eligible = false, eligibility_reasons = array_append(eligibility_reasons, 'SUPERSEDED') where id = ${ev1}`.execute(tx);
    });
    return { id, session, a1, a2, a3, run1, run2, ev1 };
  };
  const rowsOf = async (learner: string, sessions: string[]): Promise<Record<string, number>> => Object.fromEntries(await Promise.all(SEEDED.map(async table => {
    const where = ['session_item', 'lesson_assignment'].includes(table)
      ? sql`session_id = any(${sessions}::uuid[])` : sql`learner_id = ${learner}`;
    return [table, Number((await sql<{ n: string }>`select count(*) n from ${sql.table(table)} where ${where}`.execute(db)).rows[0]!.n)];
  })));
  const eraseCompletely = async (learner: string) => {
    await db.transaction().execute(tx => deletion(tx, config, learner, 'SYSTEM', 'OTHER'));
    for (let i = 0; i < 20 && await sql`select 1 from learner where id = ${learner}`.execute(db).then(r => r.rows.length); i++) await workerTick(db, config);
  };

  try {
    await t.test('0003 and 0004 apply on top of the catalog; rolling back to 0002 keeps it; checksums ignore line endings', async () => {
      await migrate(db);
      await rollbackTo(db, '0001_slice0.up.sql');
      await migrate(db);
      await rollbackTo(db, '0002_catalog.up.sql');
      assert.equal((await sql<{ t: string | null }>`select to_regclass('learning_session')::text t`.execute(db)).rows[0]!.t, null);
      assert.notEqual((await sql<{ t: string | null }>`select to_regclass('question_revision')::text t`.execute(db)).rows[0]!.t, null);
      await migrate(db); await migrate(db);
      const recorded = (await sql<{ name: string; sha256: string }>`select name, sha256 from schema_migration order by name`.execute(db)).rows;
      assert.deepEqual(recorded.map(r => r.name), ['0001_slice0.up.sql', '0002_catalog.up.sql', '0003_learning.up.sql', '0004_question_loop.up.sql']);
      // A CRLF checkout of the same migration must verify against the recorded checksum.
      const { createHash } = await import('node:crypto');
      const digest = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
      for (const r of recorded) {
        const raw = readFileSync(`migrations/${r.name}`), lf = raw.toString('utf8').replaceAll('\r\n', '\n');
        if (r.name === '0001_slice0.up.sql') {
          // Applied before this rule and not re-applied here: its raw-bytes hash is accepted as legacy.
          assert.ok(r.sha256 === digest(lf) || r.sha256 === digest(raw));
          continue;
        }
        assert.equal(r.sha256, digest(lf), `${r.name} is recorded with the line-ending-neutral checksum`);
        assert.notEqual(digest(lf.replaceAll('\n', '\r\n')), r.sha256, 'raw CRLF bytes would hash differently');
      }
      assert.equal(await verifyMigrations(db), true);
      const r = await publish(db, reviewedFixture());
      const ids = (await sql<{ mcq: string; check: string; lesson: string; lesson_revision: string; concept: string }>`
        select (select r.id from question_revision r join question q on q.id = r.question_id where q.code = 'MAT.TRI.Q.TAN60_SIN30' and r.status = 'PUBLISHED') as mcq,
          a.id as check, l.id as lesson, lr.id as lesson_revision, (select id from concept where code = 'MAT.TRI.SUDUT_ISTIMEWA') as concept
        from micro_lesson l join micro_lesson_revision lr on lr.lesson_id = l.id and lr.status = 'PUBLISHED'
        join micro_assessment a on a.lesson_revision_id = lr.id where l.code = 'MAT.TRI.L.SUDUT_ISTIMEWA' order by a.ordinal limit 1`.execute(db)).rows[0]!;
      catalog = { releaseId: r.releaseId, mcq: ids.mcq, check: ids.check, lesson: ids.lesson, lessonRevision: ids.lesson_revision, concept: ids.concept };
    });

    await t.test('INV-19 coverage: every table with a learner column is accounted for', async () => {
      const tables = (await sql<{ table_name: string }>`select distinct table_name from information_schema.columns
        where table_schema = 'public' and column_name in ('learner_id', 'owner_learner_id')`.execute(db)).rows.map(r => r.table_name);
      const sessionScoped = (await sql<{ table_name: string }>`select distinct table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'session_id' and table_name not in (select table_name from information_schema.columns where column_name = 'learner_id')
        and table_name not in ('auth_transaction')`.execute(db)).rows.map(r => r.table_name);
      const uncovered = [...tables, ...sessionScoped].filter(name => !LEARNER_TABLES[name]);
      assert.deepEqual(uncovered.sort(), [], 'add each new learner-owned table to the erasure and to LEARNER_TABLES');
      assert.equal((await sql<{ n: string }>`select count(*) n from question where owner_learner_id is not null`.execute(db)).rows[0]!.n, '0');
    });

    await t.test('INV-19: erasure removes every learning and assessment row, leaves a receipt and the catalog', async () => {
      const a = await seed(), b = await seed();
      assert.ok(Object.values(await rowsOf(a.id, [a.session])).every(n => n > 0), 'the seed reaches every learning table');
      const catalogBefore = (await sql<{ n: string }>`select (select count(*) from question_revision) + (select count(*) from micro_assessment) + (select count(*) from concept) n`.execute(db)).rows[0]!.n;
      await eraseCompletely(a.id);
      assert.deepEqual(await rowsOf(a.id, [a.session]), Object.fromEntries(SEEDED.map(t => [t, 0])));
      assert.equal((await sql<{ n: string }>`select count(*) n from job where diagnosis_run_id = any(${[a.run1, a.run2]}::uuid[])`.execute(db)).rows[0]!.n, '0', 'jobs of the runs');
      // Tables keyed by learner; session_item and lesson_assignment are checked through their session above.
      for (const table of Object.keys(LEARNER_TABLES).filter(t => !['question', 'session_item', 'lesson_assignment'].includes(t))) {
        const column = table === 'learner' ? 'id' : 'learner_id';
        assert.equal((await sql<{ n: string }>`select count(*) n from ${sql.table(table)} where ${sql.ref(column)} = ${a.id}`.execute(db)).rows[0]!.n, '0', table);
      }
      assert.equal((await sql<{ n: string }>`select count(*) n from erasure_receipt where subject_digest = ${hmac(config.key, 'erasure:' + a.id)}`.execute(db)).rows[0]!.n, '1');
      assert.ok(Object.values(await rowsOf(b.id, [b.session])).every(n => n > 0), 'another learner is untouched');
      assert.equal((await sql<{ n: string }>`select (select count(*) from question_revision) + (select count(*) from micro_assessment) + (select count(*) from concept) n`.execute(db)).rows[0]!.n, catalogBefore);
      await eraseCompletely(b.id);
    });

    await t.test('restore replay: learning rows that come back with an erased learner are erased again', async () => {
      const a = await seed();
      await eraseCompletely(a.id);
      // Simulate a backup restore: the learner and some learning rows reappear, the receipt ledger survives.
      await sql`insert into learner(id, status, age_band, age_band_source) values (${a.id}, 'ACTIVE', 'UNKNOWN', 'SELF_DECLARED')`.execute(db);
      await sql`insert into learning_session(id, learner_id, kind, origin, release_id, state, expires_at) values
        (${a.session}, ${a.id}, 'PRACTICE', 'CONCEPT_LESSON', ${catalog.releaseId}, 'PRACTICING', now() + interval '1 day')`.execute(db);
      await sql`insert into assistance_event(id, learner_id, session_id, question_family_code, type, source, dedupe_key) values
        (${uuid()}, ${a.id}, ${a.session}, 'MAT.TRI.F.TAN60_SIN30', 'HINT_SHOWN', 'SERVER_DELIVERED', 'restored')`.execute(db);
      assert.deepEqual(await restoredSubjects(db, config), [a.id]);
      for (let i = 0; i < 20 && (await restoredSubjects(db, config)).length; i++) await workerTick(db, config);
      assert.deepEqual(await restoredSubjects(db, config), []);
      assert.deepEqual(await rowsOf(a.id, [a.session]), Object.fromEntries(SEEDED.map(t => [t, 0])));
    });

    await t.test('INV-07: a stored attempt is immutable apart from grading once and the retention purge', async () => {
      const s = await seed();
      for (const change of [sql`kind = 'TRANSFER'`, sql`question_revision_id = ${catalog.mcq}::uuid, ordinal = 9`, sql`assistance = 'SOLUTION'`,
        sql`response = '{"schemaVersion":1,"responseType":"OPTION","optionId":"b","inputMode":"TYPED"}'`, sql`verdict = 'INCORRECT'`, sql`submitted_at = now() - interval '1 day'`])
        await guard(sql`update question_attempt set ${change} where id = ${s.a1}`.execute(db), /INV-07/);
      // Grading happens once: PENDING → verdict with graded_at.
      const pending = uuid();
      await sql`insert into question_attempt(id, session_id, learner_id, question_revision_id, kind, ordinal, response, assistance, source)
        values (${pending}, ${s.session}, ${s.id}, ${catalog.mcq}, 'PRACTICE', 4, '{"schemaVersion":1,"responseType":"TEXT","text":"canary 7731","inputMode":"TYPED"}', 'HINT', 'LIVE')`.execute(db);
      await sql`update question_attempt set verdict = 'INCORRECT', graded_at = now() where id = ${pending}`.execute(db);
      await guard(sql`update question_attempt set verdict = 'CORRECT', graded_at = now() where id = ${pending}`.execute(db), /INV-07/);
      // Retention purge: only the exact purged shape is accepted, once.
      await guard(sql`update question_attempt set response = '{"schemaVersion":1,"responseType":"TEXT","text":"edited"}', response_purged_at = now() where id = ${pending}`.execute(db), /INV-07/);
      await sql`update question_attempt set response = '{"schemaVersion":1,"responseType":"TEXT","purged":true}', response_purged_at = now() where id = ${pending}`.execute(db);
      const purged = (await sql<{ response: unknown }>`select response from question_attempt where id = ${pending}`.execute(db)).rows[0]!.response;
      assert.deepEqual(purged, { schemaVersion: 1, responseType: 'TEXT', purged: true });
      // INV-01 at the database: an attempt cannot claim another learner's session.
      const other = await seed();
      await assert.rejects(sql`insert into question_attempt(id, session_id, learner_id, question_revision_id, kind, ordinal, response, assistance, source)
        values (${uuid()}, ${s.session}, ${other.id}, ${catalog.mcq}, 'PRACTICE', 5, '{"schemaVersion":1,"responseType":"OPTION","optionId":"a","inputMode":"TYPED"}', 'NONE', 'LIVE')`.execute(db), /foreign key/);
      await eraseCompletely(s.id); await eraseCompletely(other.id);
    });

    await t.test('INV-08 and append-only evidence', async () => {
      const s = await seed();
      await guard(sql`update diagnosis_run set headline = 'diubah' where id = ${s.run1}`.execute(db), /INV-08/);
      const queued = uuid();
      await sql`insert into diagnosis_run(id, attempt_id, learner_id, generation, purpose, engine, status, rubric_version, policy_version, deadline_at)
        values (${queued}, ${s.a3}, ${s.id}, 1, 'VERIFICATION', 'DETERMINISTIC', 'QUEUED', 'option-v1', 'mastery-v1', now() + interval '1 minute')`.execute(db);
      await assert.rejects(sql`insert into diagnosis_run(id, attempt_id, learner_id, generation, purpose, engine, status, rubric_version, policy_version, deadline_at)
        values (${uuid()}, ${s.a3}, ${s.id}, 2, 'VERIFICATION', 'DETERMINISTIC', 'QUEUED', 'option-v1', 'mastery-v1', now() + interval '1 minute')`.execute(db), /diagnosis_one_active_per_attempt/);
      await sql`update diagnosis_run set status = 'RUNNING', started_at = now() where id = ${queued}`.execute(db);
      for (const change of [sql`classification = 'MISCONCEPTION_EVIDENCED', rationale = 'x'`, sql`concept_id = ${catalog.concept}::uuid, refs = '[]'`,
        sql`mastery_eligible = true, transfer_eligible = false`, sql`eligibility_reasons = '{}'`])
        await guard(sql`update concept_evidence set ${change} where id = ${s.ev1}`.execute(db), /append-only/);
      await eraseCompletely(s.id);
    });
  } finally { await db.destroy(); }
});
