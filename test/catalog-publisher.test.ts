import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from 'kysely';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { aliasIndex, type Manifest } from '../src/catalog/manifest.js';
import { publish, PublishError, snapshotOf } from '../src/catalog/publisher.js';
import { draftManifest, reviewedFixture } from './fixtures/catalog.js';
// Slice 1 M2: 0002_catalog and the publisher against real PostgreSQL. Uses the reviewed fixture;
// the committed draft must be refused because its D3–D6 decisions are still open.

const CATALOG_TABLES = ['curriculum_release', 'subject', 'topic', 'topic_relation', 'concept', 'concept_prerequisite', 'question', 'question_revision',
  'question_concept', 'micro_lesson', 'micro_lesson_revision', 'lesson_concept', 'micro_assessment', 'catalog_alias'];

test('Slice 1 catalog migration and publisher on PostgreSQL', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  const count = async (table: string) => Number((await sql<{ n: string }>`select count(*) n from ${sql.table(table)}`.execute(db)).rows[0]!.n);
  // Every table's row count plus its content digest, so "zero writes" also covers updates.
  const state = async () => {
    const out: Record<string, string> = {};
    for (const table of [...CATALOG_TABLES, 'audit_event']) out[table] = (await sql<{ d: string }>`select count(*) || ':' || coalesce(md5(string_agg(t::text, ',' order by t::text)), '') d from ${sql.table(table)} t`.execute(db)).rows[0]!.d;
    return out;
  };
  const rejects = async (m: Manifest, code: PublishError['code']) => {
    const before = await state();
    await assert.rejects(publish(db, m), (e: unknown) => e instanceof PublishError && e.code === code);
    assert.deepEqual(await state(), before, `${code} must leave zero writes`);
  };
  const triggerRejects = (query: Promise<unknown>) => assert.rejects(query, /INV-04|append-only|cannot move|are fixed/);
  const fixture = reviewedFixture();
  const withVersion = (m: Manifest, version: number) => { const c = structuredClone(m); c.release.version = version; return c; };
  const q = (m: Manifest, code: string) => m.questions.find(x => x.code === code)!;
  try {
    await t.test('0002 applies on top of 0001, rolls back alone and reapplies', async () => {
      await migrate(db);
      await migrate(db, 'down');
      assert.equal((await sql<{ t: string | null }>`select to_regclass('curriculum_release')::text t`.execute(db)).rows[0]!.t, null);
      assert.notEqual((await sql<{ t: string | null }>`select to_regclass('learner')::text t`.execute(db)).rows[0]!.t, null, 'rolling back 0002 keeps Slice 0');
      await migrate(db); await migrate(db);
      for (const table of CATALOG_TABLES) assert.equal(await count(table), 0, table);
    });

    await t.test('the committed draft is refused because its review decisions are open', async () => {
      const before = await state();
      await assert.rejects(publish(db, draftManifest()), (e: unknown) =>
        e instanceof PublishError && e.code === 'MANIFEST_INVALID' && e.findings.length > 0 && e.findings.every(f => f.rule === 'UNREVIEWED'));
      assert.deepEqual(await state(), before);
    });

    await t.test('lint failures publish nothing: cycle, ambiguous alias, unmapped step concept, unknown misconception, oversized rubric', async () => {
      const mutate = (fn: (m: Manifest) => void) => { const m = structuredClone(fixture); fn(m); return m; };
      for (const m of [
        mutate(m => m.topics.find(x => x.code === 'MAT.TRI')!.prerequisites.push({ concept: 'MAT.TRI.SEGITIGA_SIKU_SIKU', requires: 'MAT.TRI.DEFINISI_SIN_COS_TAN', kind: 'HARD' })),
        mutate(m => m.topics.find(x => x.code === 'MAT.TRI')!.concepts.find(c => c.code === 'MAT.TRI.RADIAN')!.aliases.push({ ns: 'MAP', value: 'tri-c' })),
        mutate(m => { q(m, 'MAT.TRI.Q.SOAL_MENARA').rubric.solutionPaths[0]!.steps[0]!.concepts[0]!.code = 'MAT.TRI.RADIAN'; }),
        mutate(m => { q(m, 'MAT.TRI.Q.TRIG_DEPRESSION_01').rubric.misconceptionMap[0]!.misconceptionCode = 'TIDAK_ADA'; }),
        mutate(m => { q(m, 'MAT.TRI.Q.TAN60_SIN30').rubric.acceptedForms = Array.from({ length: 400 }, (_, i) => `${i}`.padEnd(200, 'x')); }),
      ]) await rejects(m, 'MANIFEST_INVALID');
    });

    let release1 = '';
    await t.test('publishing the reviewed fixture writes the whole catalog, frozen and current', async () => {
      const r = await publish(db, fixture);
      release1 = r.releaseId;
      assert.equal(r.status, 'PUBLISHED');
      assert.deepEqual(r.questions, { created: fixture.questions.length, reused: 0, retired: 0 });
      assert.deepEqual(r.lessons, { created: fixture.lessons.length, reused: 0, retired: 0 });
      assert.equal(r.aliases, aliasIndex(fixture).length);
      assert.equal(await count('catalog_alias'), aliasIndex(fixture).length);
      const rel = await db.selectFrom('curriculum_release').selectAll().executeTakeFirstOrThrow();
      assert.deepEqual([rel.status, rel.is_current, rel.version], ['PUBLISHED', true, 1]);
      assert.ok(rel.snapshot_sha256!.equals(snapshotOf(fixture).sha256));
      assert.equal(await count('concept'), fixture.topics.reduce((n, x) => n + x.concepts.length, 0));
      assert.equal(await count('question_concept'), fixture.questions.reduce((n, x) => n + x.concepts.length, 0));
      assert.equal(await count('micro_assessment'), fixture.lessons.reduce((n, x) => n + x.checks.length, 0));
      assert.equal(await count('concept_prerequisite'), fixture.topics.reduce((n, x) => n + x.prerequisites.length, 0));
      const statuses = await sql<{ s: string }>`select distinct status s from question_revision union select distinct status from micro_lesson_revision`.execute(db);
      assert.deepEqual(statuses.rows.map(r => r.s), ['PUBLISHED']);
      // Legacy alias columns are filled from catalog_alias; the T04 typed alias resolves to the same concept as tri-c.
      const triC = await db.selectFrom('concept').select(['id', 'legacy_map_id']).where('code', '=', 'MAT.TRI.SEGITIGA_SIKU_SIKU').executeTakeFirstOrThrow();
      assert.equal(triC.legacy_map_id, 'tri-c');
      const t04 = await db.selectFrom('catalog_alias').select('concept_id').where('namespace', '=', 'TYPED_MAP').where('alias', '=', 'T04').executeTakeFirstOrThrow();
      assert.equal(t04.concept_id, triC.id);
      assert.equal((await db.selectFrom('micro_lesson').select('route_slug').where('code', '=', 'MAT.TRI.L.PERBANDINGAN_TRIG').executeTakeFirstOrThrow()).route_slug, 'perbandingan-trig');
      // audit_event belongs to 0001 and outlives the 0002 rollback above, so scope to this publish.
      const audit = await sql<{ detail: { version: number; sha256: string } }>`select detail from audit_event where action = 'CATALOG_PUBLISHED' and detail ->> 'sha256' = ${r.sha256}`.execute(db);
      assert.deepEqual(audit.rows.map(a => a.detail), [{ version: 1, sha256: r.sha256 }]);
    });

    await t.test('re-publishing the identical manifest is a no-op', async () => {
      const before = await state();
      assert.equal((await publish(db, structuredClone(fixture))).status, 'UNCHANGED');
      assert.deepEqual(await state(), before);
    });

    await t.test('changed content becomes a new revision; the old one is retired and still readable', async () => {
      const current = (await db.selectFrom('curriculum_release').select('version').where('is_current', '=', true).executeTakeFirstOrThrow()).version;
      const m = withVersion(fixture, current + 1);
      q(m, 'MAT.TRI.Q.TAN60_SIN30').body.prompt = 'Tanpa kalkulator: berapa tan 60° × sin 30°?';
      const lesson = m.lessons.find(l => l.code === 'MAT.TRI.L.SUDUT_ISTIMEWA')!;
      lesson.blocks.push({ type: 'tip', slide: 0, text: 'Sisi terpendek berhadapan dengan sudut terkecil.' });
      const r = await publish(db, m);
      assert.deepEqual(r.questions, { created: 1, reused: m.questions.length - 1, retired: 1 });
      assert.deepEqual(r.lessons, { created: 1, reused: m.lessons.length - 1, retired: 1 });
      const revisions = await sql<{ revision: number; status: string; prompt: string; release_version: number }>`
        select r.revision, r.status, r.body ->> 'prompt' as prompt, c.version as release_version from question_revision r
        join question q on q.id = r.question_id join curriculum_release c on c.id = r.release_id where q.code = 'MAT.TRI.Q.TAN60_SIN30' order by r.revision`.execute(db);
      assert.deepEqual(revisions.rows.map(x => [x.revision, x.status]), [[1, 'RETIRED'], [2, 'PUBLISHED']]);
      assert.equal(revisions.rows[0]!.prompt, q(fixture, 'MAT.TRI.Q.TAN60_SIN30').body.prompt, 'the retired revision keeps its original content');
      const lessonRevisions = await sql<{ revision: number; status: string; checks: string }>`
        select r.revision, r.status, (select count(*) from micro_assessment a where a.lesson_revision_id = r.id)::text checks from micro_lesson_revision r
        join micro_lesson l on l.id = r.lesson_id where l.code = 'MAT.TRI.L.SUDUT_ISTIMEWA' order by r.revision`.execute(db);
      assert.deepEqual(lessonRevisions.rows.map(x => [x.revision, x.status, x.checks]), [[1, 'RETIRED', '3'], [2, 'PUBLISHED', '3']]);
      const releases = await db.selectFrom('curriculum_release').select(['id', 'is_current', 'status']).orderBy('version').execute();
      assert.ok(releases.find(x => x.id === release1)!.status === 'PUBLISHED' && !releases.find(x => x.id === release1)!.is_current);
      assert.equal(releases.filter(x => x.is_current).length, 1);
    });

    await t.test('version and identity rules publish nothing', async () => {
      const current = (await db.selectFrom('curriculum_release').select('version').where('is_current', '=', true).executeTakeFirstOrThrow()).version;
      const same = withVersion(fixture, current);
      q(same, 'MAT.TRI.Q.TANGGA_6M').difficulty = 3;
      await rejects(same, 'RELEASE_VERSION_NOT_INCREMENTED');
      const family = withVersion(fixture, current + 1);
      q(family, 'MAT.TRI.Q.TANGGA_6M').familyCode = 'MAT.TRI.F.SOMETHING_ELSE';
      await rejects(family, 'QUESTION_IDENTITY_CHANGED');
      const moved = withVersion(fixture, current + 1);
      const tri = moved.topics.find(x => x.code === 'MAT.TRI')!, eks = moved.topics.find(x => x.code === 'MAT.EKS')!;
      const radian = tri.concepts.splice(tri.concepts.findIndex(c => c.code === 'MAT.TRI.RADIAN'), 1)[0]!;
      delete radian.unit; eks.concepts.push(radian);
      await rejects(moved, 'CONCEPT_TOPIC_CHANGED');
      const dropped = withVersion(fixture, current + 1);
      const ratio = dropped.topics.find(x => x.code === 'MAT.TRI')!.concepts.find(c => c.code === 'MAT.TRI.DEFINISI_SIN_COS_TAN')!;
      ratio.misconceptions = ratio.misconceptions.filter(x => x.code !== 'MEMAKAI_COS');
      for (const x of dropped.questions) x.rubric.misconceptionMap = x.rubric.misconceptionMap.filter(e => e.misconceptionCode !== 'MEMAKAI_COS');
      await rejects(dropped, 'MISCONCEPTION_REMOVED');
    });

    await t.test('an alias may move to another entity in a later release; earlier releases keep their mapping', async () => {
      const current = (await db.selectFrom('curriculum_release').select(['id', 'version']).where('is_current', '=', true).executeTakeFirstOrThrow());
      const m = withVersion(fixture, current.version + 1);
      const c1 = q(m, 'MAT.TRI.Q.FUNNEL_C1'), c3 = q(m, 'MAT.TRI.Q.FUNNEL_C3');
      c1.aliases = []; c3.aliases.push({ ns: 'ITEM', value: 'c1' });
      const r = await publish(db, m);
      const item = (release: string) => sql<{ code: string }>`select q.code from catalog_alias a join question q on q.id = a.question_id
        where a.release_id = ${release} and a.namespace = 'ITEM' and a.alias = 'c1'`.execute(db).then(x => x.rows[0]?.code);
      assert.equal(await item(current.id), 'MAT.TRI.Q.FUNNEL_C1');
      assert.equal(await item(r.releaseId), 'MAT.TRI.Q.FUNNEL_C3');
      assert.equal((await db.selectFrom('question').select('legacy_item_id').where('code', '=', 'MAT.TRI.Q.FUNNEL_C1').executeTakeFirstOrThrow()).legacy_item_id, null);
      assert.equal((await db.selectFrom('question').select('legacy_item_id').where('code', '=', 'MAT.TRI.Q.FUNNEL_C3').executeTakeFirstOrThrow()).legacy_item_id, 'c3');
    });

    await t.test('concurrent publishes of one manifest serialise: one publishes, the other sees it unchanged', async () => {
      const current = (await db.selectFrom('curriculum_release').select('version').where('is_current', '=', true).executeTakeFirstOrThrow()).version;
      const m = withVersion(fixture, current + 1);
      q(m, 'MAT.TRI.Q.TANGGA_6M').estimatedMinutes = 3;
      const other = connect(config.databaseUrl);
      try {
        const results = await Promise.all([publish(db, m), publish(other, m)]);
        assert.deepEqual(results.map(r => r.status).sort(), ['PUBLISHED', 'UNCHANGED']);
        assert.equal(results[0]!.releaseId, results[1]!.releaseId);
      } finally { await other.destroy(); }
    });

    await t.test('INV-04.2: the database rejects in-place edits of published content', async () => {
      const rev = await sql<{ id: string; question_revision_id: string }>`select r.id, qc.question_revision_id from question_revision r
        join question_concept qc on qc.question_revision_id = r.id where r.status = 'PUBLISHED' limit 1`.execute(db).then(x => x.rows[0]!);
      const lessonRev = await sql<{ id: string }>`select id from micro_lesson_revision where status = 'PUBLISHED' limit 1`.execute(db).then(x => x.rows[0]!);
      const anyQuestion = await sql<{ id: string }>`select id from question limit 1`.execute(db).then(x => x.rows[0]!);
      const before = await state();
      await triggerRejects(sql`update question_revision set body = jsonb_set(body, '{prompt}', '"diubah"') where id = ${rev.id}`.execute(db));
      await triggerRejects(sql`update question_revision set status = 'DRAFT' where id = ${rev.id}`.execute(db));
      await triggerRejects(sql`delete from question_revision where id = ${rev.id}`.execute(db));
      await triggerRejects(sql`update question_concept set assessable = not assessable where question_revision_id = ${rev.id}`.execute(db));
      await triggerRejects(sql`delete from question_concept where question_revision_id = ${rev.id}`.execute(db));
      await triggerRejects(sql`update micro_lesson_revision set blocks = '[]' where id = ${lessonRev.id}`.execute(db));
      await triggerRejects(sql`insert into micro_assessment(id, lesson_revision_id, question_id, ordinal, slide_index) values (gen_random_uuid(), ${lessonRev.id}, ${anyQuestion.id}, 99, 0)`.execute(db));
      await triggerRejects(sql`update curriculum_release set snapshot = '{}' where is_current`.execute(db));
      await triggerRejects(sql`delete from curriculum_release where is_current`.execute(db));
      await triggerRejects(sql`delete from catalog_alias where release_id = (select id from curriculum_release where is_current)`.execute(db));
      await triggerRejects(sql`update concept set misconceptions = '[]' where code = 'MAT.TRI.DEFINISI_SIN_COS_TAN'`.execute(db));
      await triggerRejects(sql`update question set family_code = 'X' where code = 'MAT.TRI.Q.TANGGA_6M'`.execute(db));
      assert.deepEqual(await state(), before);
    });
  } finally { await db.destroy(); }
});
