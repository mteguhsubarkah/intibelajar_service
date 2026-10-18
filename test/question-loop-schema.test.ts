import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql, type RawBuilder } from 'kysely';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate, verifyMigrations } from '../src/migrate.js';
import { uuid } from '../src/platform/crypto.js';
import { publish } from '../src/catalog/publisher.js';
import { cancelRunJobs, completeLease, enqueueDiagnosis, heartbeat, lease, recoverLeases, retryLease, validLease } from '../src/platform/jobs.js';
import { rollbackTo } from './fixtures/db.js';
import { reviewedFixture } from './fixtures/catalog.js';
// Slice 2 M3: migration 0004 (diagnosis_report, job.diagnosis_run_id), the report resolution guard (06 §9.3)
// and the generalised job queue (04 §7: lease, heartbeat, backoff, recovery, deadline, cancel, fenced adoption).

test('Slice 2 question-loop schema and diagnosis queue on PostgreSQL', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  const one = async <T>(q: RawBuilder<T>) => (await q.execute(db)).rows[0]!;
  let releaseId: string, mcq: string;

  // A learner with one graded attempt and one completed run on it.
  const seed = async () => {
    const id = uuid(), session = uuid(), attempt = uuid(), run = uuid();
    await db.transaction().execute(async tx => {
      await sql`insert into learner(id, status, age_band, age_band_source) values (${id}, 'ACTIVE', 'UNKNOWN', 'SELF_DECLARED')`.execute(tx);
      await sql`insert into learning_session(id, learner_id, kind, origin, release_id, state, expires_at) values
        (${session}, ${id}, 'PRACTICE', 'BANK', ${releaseId}, 'PRACTICING', now() + interval '1 day')`.execute(tx);
      await sql`insert into question_attempt(id, session_id, learner_id, question_revision_id, kind, ordinal, response, assistance, verdict, source, graded_at)
        values (${attempt}, ${session}, ${id}, ${mcq}, 'PRACTICE', 1, '{"schemaVersion":1,"responseType":"OPTION","optionId":"a","inputMode":"TYPED"}', 'NONE', 'CORRECT', 'LIVE', now())`.execute(tx);
      await sql`insert into diagnosis_run(id, attempt_id, learner_id, generation, purpose, engine, status, evidence_status, verdict, rubric_version, policy_version, deadline_at, completed_at)
        values (${run}, ${attempt}, ${id}, 1, 'GRADING', 'DETERMINISTIC', 'COMPLETED', 'SUPPORTED', 'CORRECT', 'option-v1', 'mastery-v1', now(), now())`.execute(tx);
    });
    return { id, attempt, run };
  };
  const jobOf = (run: string) => one(sql<{ status: string; attempts: number; available_at: Date; lease_token: string | null; last_error_code: string | null }>`
    select status, attempts, available_at, lease_token, last_error_code from job where diagnosis_run_id = ${run}`);
  const enqueue = (run: string, deadline = new Date(Date.now() + 60_000), max = 3) => db.transaction().execute(tx => enqueueDiagnosis(tx, run, deadline, max));

  try {
    await t.test('0004 applies, rolls back to the Slice 0 job check, and re-applies', async () => {
      await migrate(db); await rollbackTo(db, '0003_learning.up.sql');
      assert.equal((await one(sql<{ t: string | null }>`select to_regclass('diagnosis_report')::text t`)).t, null);
      const checks = async () => (await sql<{ d: string }>`select pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'job'::regclass and contype = 'c' order by 1`.execute(db)).rows.map(r => r.d);
      assert.ok((await checks()).includes('CHECK ((deletion_request_id IS NOT NULL))'), 'down restores the deletion-only check');
      await migrate(db); await migrate(db);
      assert.ok((await checks()).includes('CHECK ((num_nonnulls(diagnosis_run_id, deletion_request_id) = 1))'));
      assert.ok(!(await checks()).includes('CHECK ((deletion_request_id IS NOT NULL))'), 'the Slice 0 check is replaced, not kept beside');
      assert.equal(await verifyMigrations(db), true);
      await rollbackTo(db, '0001_slice0.up.sql'); await migrate(db);
      releaseId = (await publish(db, reviewedFixture())).releaseId;
      mcq = (await one(sql<{ id: string }>`select r.id from question_revision r join question q on q.id = r.question_id where q.code = 'MAT.TRI.Q.TAN60_SIN30' and r.status = 'PUBLISHED'`)).id;
    });

    await t.test('04 §9: a job references exactly one target; one job per run', async () => {
      const s = await seed();
      await assert.rejects(sql`insert into job(id, queue, status, deadline_at) values (${uuid()}, 'diagnosis', 'QUEUED', now() + interval '1 minute')`.execute(db), /job_one_target/);
      // The check fires before the foreign keys, so an unknown request id still shows the rule.
      await assert.rejects(sql`insert into job(id, queue, diagnosis_run_id, deletion_request_id, status, deadline_at)
        values (${uuid()}, 'diagnosis', ${s.run}, ${uuid()}, 'QUEUED', now() + interval '1 minute')`.execute(db), /job_one_target/);
      await enqueue(s.run); await enqueue(s.run);
      assert.equal((await one(sql<{ n: string }>`select count(*) n from job where diagnosis_run_id = ${s.run}`)).n, '1', 'enqueue is idempotent per run');
      await assert.rejects(sql`insert into job(id, queue, diagnosis_run_id, status, deadline_at) values (${uuid()}, 'diagnosis', ${uuid()}, 'QUEUED', now() + interval '1 minute')`.execute(db), /foreign key/);
      await sql`delete from job where diagnosis_run_id = ${s.run}`.execute(db);
    });

    await t.test('diagnosis_report: one per run, owner-bound, resolved once, note purgeable', async () => {
      const s = await seed(), other = await seed(), report = uuid();
      const insert = (id: string, run: string, learner: string) => sql`insert into diagnosis_report(id, diagnosis_run_id, learner_id, reason, note, status)
        values (${id}, ${run}, ${learner}, 'ANSWER_WAS_CORRECT', 'menurut saya benar', 'OPEN')`.execute(db);
      await insert(report, s.run, s.id);
      await assert.rejects(insert(uuid(), s.run, s.id), /unique/, 'one report per run');
      await assert.rejects(insert(uuid(), s.run, other.id), /foreign key/, 'a learner reports only their own run');
      await assert.rejects(sql`insert into diagnosis_report(id, diagnosis_run_id, learner_id, reason, status) values (${uuid()}, ${other.run}, ${other.id}, 'OTHER', 'UPHELD')`.execute(db), /check/, 'resolved implies resolved_at');
      await assert.rejects(sql`insert into diagnosis_report(id, diagnosis_run_id, learner_id, reason, status, resolved_at, resolution_run_id)
        values (${uuid()}, ${other.run}, ${other.id}, 'OTHER', 'REJECTED', now(), ${other.run})`.execute(db), /check/, 'a regrade run only on UPHELD');
      await assert.rejects(sql`insert into diagnosis_report(id, diagnosis_run_id, learner_id, reason, status) values (${uuid()}, ${other.run}, ${other.id}, 'BECAUSE', 'OPEN')`.execute(db), /check/);
      // While OPEN the report is frozen apart from clearing the note.
      await assert.rejects(sql`update diagnosis_report set reason = 'OTHER' where id = ${report}`.execute(db), /resolved once/);
      await assert.rejects(sql`update diagnosis_report set note = 'diubah' where id = ${report}`.execute(db), /resolved once/);
      await assert.rejects(sql`update diagnosis_report set status = 'UPHELD', resolved_at = now(), note = 'x' where id = ${report}`.execute(db), /resolved once/, 'resolution leaves the note alone');
      await sql`update diagnosis_report set status = 'UPHELD', resolution_code = 'KEY_ERROR', resolved_at = now() where id = ${report}`.execute(db);
      for (const change of [sql`status = 'REJECTED'`, sql`resolution_code = 'OTHER'`, sql`resolved_at = now() - interval '1 day'`, sql`status = 'OPEN', resolved_at = null`])
        await assert.rejects(sql`update diagnosis_report set ${change} where id = ${report}`.execute(db), /resolved once/);
      // 04 §8 retention: the note is cleared after resolution; clearing is the only later change.
      await sql`update diagnosis_report set note = null where id = ${report}`.execute(db);
      const row = await one(sql<{ status: string; note: string | null; resolution_code: string }>`select status, note, resolution_code from diagnosis_report where id = ${report}`);
      assert.deepEqual(row, { status: 'UPHELD', note: null, resolution_code: 'KEY_ERROR' });
      await sql`delete from diagnosis_report where id = ${report}`.execute(db);
    });

    await t.test('diagnosis queue: lease, heartbeat, backoff, recovery, max attempts, deadline', async () => {
      await sql`delete from job where queue = 'diagnosis'`.execute(db);
      const s = await seed();
      await enqueue(s.run);
      assert.equal(await lease(db, 'deletion').then(l => l?.diagnosis_run_id ?? null), null, 'queues are separate');
      const first = (await lease(db, 'diagnosis'))!;
      assert.equal(first.diagnosis_run_id, s.run); assert.equal(first.queue, 'diagnosis'); assert.equal(first.attempts, 1);
      assert.equal(await lease(db, 'diagnosis'), undefined, 'a running job is not leased twice');
      assert.equal(await heartbeat(db, first), true);
      assert.equal(await heartbeat(db, { id: first.id, lease_token: uuid() }), false, 'a stranger cannot extend the lease');
      // Backoff with full jitter: attempt 1 waits at most 2 s, and the job is not leasable before then unless due.
      await retryLease(db, first);
      let job = await jobOf(s.run);
      assert.equal(job.status, 'QUEUED'); assert.equal(job.last_error_code, 'JOB_FAILED'); assert.equal(job.lease_token, null);
      const wait = (await one(sql<{ s: number }>`select extract(epoch from available_at - now())::float8 s from job where diagnosis_run_id = ${s.run}`)).s;
      assert.ok(wait <= 2.01, `backoff ${wait}s within 2^1 s`);
      await sql`update job set available_at = now() where diagnosis_run_id = ${s.run}`.execute(db);
      const second = (await lease(db, 'diagnosis'))!;
      assert.equal(second.attempts, 2); assert.notEqual(second.lease_token, first.lease_token);
      assert.equal(await heartbeat(db, first), false, 'the first holder learns it lost the job');
      // A crashed worker: its lease expires and recovery requeues the job.
      await sql`update job set lease_until = now() - interval '1 second' where id = ${second.id}`.execute(db);
      assert.equal(await heartbeat(db, second), false, 'an expired lease cannot be revived');
      await recoverLeases(db);
      job = await jobOf(s.run);
      assert.equal(job.status, 'QUEUED'); assert.equal(job.last_error_code, 'LEASE_EXPIRED');
      await sql`update job set available_at = now() where diagnosis_run_id = ${s.run}`.execute(db);
      const third = (await lease(db, 'diagnosis'))!;
      assert.equal(third.attempts, 3);
      await retryLease(db, third);
      assert.equal((await jobOf(s.run)).status, 'FAILED', 'max_attempts reached');
      // A job past its deadline is never leased; if one was running, recovery fails it rather than requeueing.
      const late = await seed();
      await enqueue(late.run);
      await sql`update job set deadline_at = now() - interval '1 second' where diagnosis_run_id = ${late.run}`.execute(db);
      assert.equal(await lease(db, 'diagnosis'), undefined);
      const lapsing = await seed();
      await enqueue(lapsing.run);
      const held = (await lease(db, 'diagnosis'))!;
      await sql`update job set deadline_at = now() - interval '1 second', lease_until = now() - interval '1 second' where id = ${held.id}`.execute(db);
      await recoverLeases(db);
      assert.equal((await jobOf(lapsing.run)).status, 'FAILED');
    });

    await t.test('adoption is fenced: complete once under a valid lease; cancellation fences out late results', async () => {
      await sql`delete from job where queue = 'diagnosis'`.execute(db);
      const done = await seed();
      await enqueue(done.run);
      const held = (await lease(db, 'diagnosis'))!;
      assert.equal(await db.transaction().execute(async tx => await validLease(tx, held) && await completeLease(tx, held)), true);
      assert.equal((await jobOf(done.run)).status, 'DONE');
      assert.equal(await db.transaction().execute(tx => completeLease(tx, held)), false, 'a duplicate delivery adopts nothing');
      // E-24/E-25: the session is abandoned while the run is queued or running.
      const queued = await seed(), running = await seed();
      await enqueue(queued.run); await enqueue(running.run);
      const worker = (await lease(db, 'diagnosis'))!;
      const leasedRun = worker.diagnosis_run_id!, waitingRun = leasedRun === queued.run ? running.run : queued.run;
      await db.transaction().execute(tx => cancelRunJobs(tx, [queued.run, running.run]));
      assert.equal((await jobOf(leasedRun)).status, 'CANCELLED'); assert.equal((await jobOf(waitingRun)).status, 'CANCELLED');
      assert.equal(await heartbeat(db, worker), false);
      assert.equal(await db.transaction().execute(tx => validLease(tx, worker)), false, 'the late result is not adopted');
      assert.equal(await db.transaction().execute(tx => completeLease(tx, worker)), false);
      assert.equal(await lease(db, 'diagnosis'), undefined, 'cancelled work is not leased again');
      await recoverLeases(db);
      assert.equal((await jobOf(leasedRun)).status, 'CANCELLED', 'recovery does not resurrect cancelled jobs');
      // Cancelling a finished job changes nothing.
      await db.transaction().execute(tx => cancelRunJobs(tx, [done.run]));
      assert.equal((await jobOf(done.run)).status, 'DONE');
    });
  } finally { await db.destroy(); }
});
