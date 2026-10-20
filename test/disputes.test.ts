import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { sql } from 'kysely';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { buildApp } from '../src/app.js';
import { publish } from '../src/catalog/publisher.js';
import type { DiagnosisEngine } from '../src/assessment/diagnosis.js';
import { rollbackTo } from './fixtures/db.js';
import { reviewedFixture } from './fixtures/catalog.js';
import { client, consentedLearner } from './fixtures/learner.js';
// Slice 2 M6, learner side: "Hasil keliru? Laporkan" (06 §9.3). Staff resolution and the EDUCATOR regrade wait for D7.
// The catalog is the reviewed fixture (synthetic review marks in test memory only).

/** A test-only engine that never answers: it only lets a run stay QUEUED. */
const idleEngine: DiagnosisEngine = { testOnly: true, name: 'idle (tests only)', diagnose: async () => { throw new Error('not used'); } };

test('Slice 2 disputes (learner side) over the API', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  let logs = '';
  const { app } = await buildApp(config, { db, diagnosisEngine: idleEngine, logStream: new Writable({ write(chunk, _e, done) { logs += chunk.toString(); done(); } }) });
  const tables = ['diagnosis_report', 'diagnosis_run', 'concept_evidence', 'idempotency_record', 'learning_session', 'question_attempt'];
  const state = async () => {
    const out: Record<string, string> = {};
    for (const table of tables) out[table] = (await sql<{ d: string }>`select count(*) || ':' || coalesce(md5(string_agg(t::text, ',' order by t::text)), '') d from ${sql.table(table)} t`.execute(db)).rows[0]!.d;
    return out;
  };
  const NOTE = 'canary-note-71c4: menurut saya jawabanku benar';
  let menara = '', tan = '', tanKey = '';
  type Call = ReturnType<typeof client>;
  const loopRun = async (call: Call, working = 'sin 30 = 20/x') => {
    const s = (await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: menara })).body;
    return (await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: s.stateVersion, response: { responseType: 'TEXT', text: working } })).body;
  };
  const report = (call: Call, runId: string, body: object, key?: string) => call('POST', `/v1/diagnosis-runs/${runId}/reports`, body, key ? { 'idempotency-key': key } : {});

  try {
    await t.test('setup: migrations and the reviewed catalog', async () => {
      await migrate(db); await rollbackTo(db, '0001_slice0.up.sql'); await migrate(db);
      await publish(db, reviewedFixture());
      menara = (await sql<{ id: string }>`select id from question where code = 'MAT.TRI.Q.SOAL_MENARA'`.execute(db)).rows[0]!.id;
      tan = (await sql<{ id: string }>`select id from question where code = 'MAT.TRI.Q.TAN60_SIN30'`.execute(db)).rows[0]!.id;
      tanKey = reviewedFixture().questions.find(q => q.code === 'MAT.TRI.Q.TAN60_SIN30')!.rubric.answer.optionId!;
    });

    await t.test('06 §9.3 rule 1: one OPEN report per completed run, idempotent, with Location to the run (09 §1); the run shows it', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const r = await loopRun(call);
      const filed = await report(call, r.diagnosisRun.id, { reason: 'ANSWER_WAS_CORRECT', note: NOTE }, 'kreport000001');
      assert.equal(filed.status, 201, JSON.stringify(filed.body));
      assert.deepEqual([filed.body.diagnosisRunId, filed.body.reason, filed.body.status, filed.body.resolvedAt], [r.diagnosisRun.id, 'ANSWER_WAS_CORRECT', 'OPEN', undefined]);
      assert.equal(filed.body.note, undefined, 'the note is never returned');
      assert.equal(filed.headers.location, `/v1/diagnosis-runs/${r.diagnosisRun.id}`);
      const replay = await report(call, r.diagnosisRun.id, { reason: 'ANSWER_WAS_CORRECT', note: NOTE }, 'kreport000001');
      assert.deepEqual([replay.status, replay.headers['idempotency-replayed'], replay.body, replay.headers.location], [201, 'true', filed.body, filed.headers.location]);
      const run = (await call('GET', `/v1/diagnosis-runs/${r.diagnosisRun.id}`)).body;
      assert.deepEqual(run.report, { id: filed.body.id, status: 'OPEN' });
      // A second report (another key, another reason) is refused and writes nothing.
      const before = await state();
      const again = await report(call, r.diagnosisRun.id, { reason: 'OTHER' });
      assert.deepEqual([again.status, again.body.code, again.body.details.report], [409, 'ALREADY_REPORTED', { id: filed.body.id, status: 'OPEN' }]);
      assert.deepEqual(await state(), before);
      // Stored as filed; the note is C3 text and never reaches the logs.
      const row = (await sql<{ note: string; status: string }>`select note, status from diagnosis_report where id = ${filed.body.id}`.execute(db)).rows[0]!;
      assert.deepEqual([row.note, row.status], [NOTE, 'OPEN']);
      assert.ok(!logs.includes('canary-note-71c4'), 'the note never reaches the logs');
    });

    await t.test('guards: consent, ownership, strict schema, and only a completed run can be reported; refusals write nothing', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const r = await loopRun(call);
      const other = client(app, config, await consentedLearner(db, config));
      let before = await state();
      const foreign = await report(other, r.diagnosisRun.id, { reason: 'OTHER' });
      assert.deepEqual([foreign.status, foreign.body.code], [404, 'NOT_FOUND'], 'INV-01: another learner cannot see the run');
      assert.equal((await report(call, '01920000-0000-7000-8000-000000000000', { reason: 'OTHER' })).status, 404);
      for (const bad of [{ reason: 'BECAUSE' }, { reason: 'OTHER', note: 'x'.repeat(501) }, { reason: 'OTHER', status: 'UPHELD' }, {}])
        assert.equal((await report(call, r.diagnosisRun.id, bad)).body.code, 'VALIDATION_FAILED', JSON.stringify(bad).slice(0, 60));
      assert.deepEqual(await state(), before);
      // A queued run has no diagnosis yet.
      const ai = await consentedLearner(db, config, { purposes: ['LEARNING_DATA', 'AI_PROCESSING'] }), aiCall = client(app, config, ai);
      const queued = await loopRun(aiCall, 'pakai perbandingan saja');
      assert.equal(queued.diagnosisRun.status, 'QUEUED');
      before = await state();
      const waiting = await report(aiCall, queued.diagnosisRun.id, { reason: 'OTHER' });
      assert.deepEqual([waiting.status, waiting.body.code, waiting.body.details.runStatus], [409, 'INVALID_STATE_TRANSITION', 'QUEUED']);
      assert.deepEqual(await state(), before);
      // Consent revoked: refused, nothing written.
      await sql`update consent_record set status = 'REVOKED', revoked_at = now() where learner_id = ${learner.learnerId} and purpose = 'LEARNING_DATA'`.execute(db);
      before = await state();
      const revoked = await report(call, r.diagnosisRun.id, { reason: 'OTHER' });
      assert.deepEqual([revoked.status, revoked.body.code], [403, 'CONSENT_REQUIRED']);
      assert.deepEqual(await state(), before, 'INV-02.1');
      await sql`update diagnosis_run set status = 'CANCELLED' where id = ${queued.diagnosisRun.id}`.execute(db);
    });

    await t.test('06 §9.3 rule 5: an OPEN report changes no evidence or eligibility; practice gradings can be reported too', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const p = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'BANK', withLesson: false, spec: { questionIds: [tan] } })).body;
      const graded = (await call('POST', `/v1/learning-sessions/${p.id}/attempts`, { expectedStateVersion: p.stateVersion, response: { responseType: 'OPTION', optionId: tanKey } })).body;
      const runId = graded.diagnosisRun.id;
      const evidence = async () => (await sql<{ d: string }>`select coalesce(md5(string_agg(t::text, ',' order by t::text)), '') d from concept_evidence t where diagnosis_run_id = ${runId}`.execute(db)).rows[0]!.d;
      // The run must carry evidence that counts, or "unchanged" would prove nothing.
      assert.equal(graded.diagnosisRun.verdict, 'CORRECT');
      assert.ok((await sql<{ n: string }>`select count(*) n from concept_evidence where diagnosis_run_id = ${runId} and mastery_eligible`.execute(db)).rows[0]!.n !== '0', 'mastery-eligible evidence exists');
      const before = await evidence(), runBefore = (await call('GET', `/v1/diagnosis-runs/${runId}`)).body;
      const filed = await report(call, runId, { reason: 'UNCLEAR_EXPLANATION' });
      assert.equal(filed.status, 201);
      assert.equal(await evidence(), before, 'evidence rows, eligibility included, are untouched');
      const runAfter = (await call('GET', `/v1/diagnosis-runs/${runId}`)).body;
      assert.deepEqual({ ...runAfter, report: undefined, session: undefined }, { ...runBefore, report: undefined, session: undefined }, 'only the report field is new');
      assert.deepEqual(runAfter.report, { id: filed.body.id, status: 'OPEN' });
    });
  } finally { await app.close(); await db.destroy(); }
});
