import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { sql } from 'kysely';
import fc from 'fast-check';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { buildApp } from '../src/app.js';
import { publish } from '../src/catalog/publisher.js';
import { expireSessions, adoptionTarget, applyRunResult, runOutcome } from '../src/learning/service.js';
import { diagnosisTick } from '../src/learning/diagnosis-worker.js';
import { failRun, type DiagnosisEngine, type EngineInput } from '../src/assessment/diagnosis.js';
import { deletion } from '../src/privacy/service.js';
import { workerTick } from '../src/privacy/erasure.js';
import { lease, validLease } from '../src/platform/jobs.js';
import { transition, type Command, type Context, type Lesson } from '../src/learning/machine.js';
import { rollbackTo } from './fixtures/db.js';
import { reviewedFixture } from './fixtures/catalog.js';
import { client, consentedLearner } from './fixtures/learner.js';
// Slice 2 M5: QUESTION_LOOP sessions over HTTP and PostgreSQL. Transition IDs (05 §4.2), invariants (03 §8) and T01
// scenarios (11 §3.1) are named where they are tested. The catalog is the reviewed fixture (synthetic review marks in
// test memory only); the committed draft stays PROPOSED. The queued engine is a test-only fake (plan 05 D4).

/** Scripted fake engine: each call takes the next step. Never reachable from a request. */
class FakeEngine implements DiagnosisEngine {
  readonly testOnly = true as const; readonly name = 'fake (tests only)';
  steps: ((input: EngineInput, signal: AbortSignal) => Promise<unknown>)[] = [];
  calls = 0; inputs: EngineInput[] = [];
  async diagnose(input: EngineInput, signal: AbortSignal) {
    this.calls++; this.inputs.push(input);
    const step = this.steps.shift();
    if (!step) throw new Error('no scripted step');
    return step(input, signal);
  }
}
const span = (text: string, quote: string) => { const start = text.indexOf(quote); return { kind: 'SPAN', start, end: start + quote.length, quote }; };

test('Slice 2 question loops over the API', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  const engine = new FakeEngine();
  let logs = '';
  const { app } = await buildApp(config, { db, diagnosisEngine: engine, logStream: new Writable({ write(chunk, _e, done) { logs += chunk.toString(); done(); } }) });
  const fixture = reviewedFixture();
  const tables = ['learning_session', 'session_item', 'lesson_assignment', 'question_attempt', 'assistance_event', 'diagnosis_run', 'concept_evidence', 'idempotency_record', 'job'];
  // Row count and content digest of everything a learner command can write, so "zero writes" includes updates.
  const state = async () => {
    const out: Record<string, string> = {};
    for (const table of tables) out[table] = (await sql<{ d: string }>`select count(*) || ':' || coalesce(md5(string_agg(t::text, ',' order by t::text)), '') d from ${sql.table(table)} t`.execute(db)).rows[0]!.d;
    return out;
  };
  // The same digest restricted to one learner's rows: everything a command of that learner can write.
  const learnerState = async (learnerId: string) => {
    const scoped: Record<string, ReturnType<typeof sql>> = {
      learning_session: sql`learner_id = ${learnerId}`, question_attempt: sql`learner_id = ${learnerId}`, assistance_event: sql`learner_id = ${learnerId}`,
      diagnosis_run: sql`learner_id = ${learnerId}`, concept_evidence: sql`learner_id = ${learnerId}`, idempotency_record: sql`scope_id = ${learnerId}`,
      session_item: sql`session_id in (select id from learning_session where learner_id = ${learnerId})`,
      lesson_assignment: sql`session_id in (select id from learning_session where learner_id = ${learnerId})`,
      job: sql`diagnosis_run_id in (select id from diagnosis_run where learner_id = ${learnerId})`,
    };
    const out: Record<string, string> = {};
    for (const [table, where] of Object.entries(scoped)) out[table] = (await sql<{ d: string }>`select count(*) || ':' || coalesce(md5(string_agg(t::text, ',' order by t::text)), '') d
      from ${sql.table(table)} t where ${where}`.execute(db)).rows[0]!.d;
    return out;
  };
  const one = async <T>(q: ReturnType<typeof sql<T>>) => (await q.execute(db)).rows[0]!;
  let c: { menara: string; tangga: string; depression: string; sides: string; ratio: string; special: string; radian: string; ratioLesson: string; checkKey: Map<string, { right: string; wrong: string }> };
  const text = (t: string) => ({ responseType: 'TEXT', text: t });
  const self = (s: 'KNOW' | 'DONT_KNOW') => ({ responseType: 'SELF_REPORT', selfReport: s });
  type Call = ReturnType<typeof client>;
  const loop = async (call: Call, origin = 'FUNNEL') => {
    const r = await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin, questionId: c.menara });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body;
  };
  const submit = async (call: Call, s: { id: string; stateVersion: number }, response: object, key?: string) =>
    call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: s.stateVersion, response }, key ? { 'idempotency-key': key } : {});
  const act = async (call: Call, s: { id: string; stateVersion: number }, type: string, extra: object = {}) =>
    call('POST', `/v1/learning-sessions/${s.id}/actions`, { type, expectedStateVersion: s.stateVersion, ...extra });
  const evidenceOf = async (runId: string) => (await sql<{ code: string; classification: string; misconception_code: string | null; source: string; mastery_eligible: boolean;
      transfer_eligible: boolean; eligibility_reasons: string[] }>`select c.code, e.classification, e.misconception_code, e.source, e.mastery_eligible, e.transfer_eligible, e.eligibility_reasons
    from concept_evidence e join concept c on c.id = e.concept_id where e.diagnosis_run_id = ${runId} order by c.code`.execute(db)).rows;
  // Make every waiting diagnosis job due now (retry backoff is real time).
  const due = () => sql`update job set available_at = now() where queue = 'diagnosis' and status = 'QUEUED'`.execute(db);
  const runs: string[] = [];

  try {
    await t.test('setup: migrations, reviewed catalog with the authored tower rubric', async () => {
      await migrate(db); await rollbackTo(db, '0001_slice0.up.sql'); await migrate(db);
      await publish(db, fixture);
      const q = async (code: string) => (await one(sql<{ id: string }>`select id from question where code = ${code}`)).id;
      const concept = async (code: string) => (await one(sql<{ id: string }>`select id from concept where code = ${code}`)).id;
      const checks = (await sql<{ id: string; code: string }>`select a.id, q.code from micro_assessment a join question q on q.id = a.question_id`.execute(db)).rows;
      const checkKey = new Map(checks.map(x => {
        const fq = fixture.questions.find(y => y.code === x.code)!;
        return [x.id, { right: fq.rubric.answer.optionId!, wrong: fq.body.options!.find(o => o.id !== fq.rubric.answer.optionId)!.id }];
      }));
      c = { menara: await q('MAT.TRI.Q.SOAL_MENARA'), tangga: await q('MAT.TRI.Q.TANGGA_6M'), depression: await q('MAT.TRI.Q.TRIG_DEPRESSION_01'),
        sides: await concept('MAT.TRI.SEGITIGA_SIKU_SIKU'), ratio: await concept('MAT.TRI.DEFINISI_SIN_COS_TAN'), special: await concept('MAT.TRI.SUDUT_ISTIMEWA'),
        radian: await concept('MAT.TRI.RADIAN'), ratioLesson: (await one(sql<{ id: string }>`select id from micro_lesson where code = 'MAT.TRI.L.FUNNEL_RATIO_CHOICE'`)).id, checkKey };
      // The fixture's review marks exist only in memory: the committed draft still refuses to publish.
      assert.ok(fixture.authored!.every(a => a.review.status === 'REVIEWED'));
    });

    await t.test('E-01 creation guards: consent, feature, content, strict schemas and replay', async () => {
      const pending = await consentedLearner(db, config, { consent: false }), refusedCall = client(app, config, pending);
      const before = await state();
      const refused = await refusedCall('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: c.menara });
      assert.deepEqual([refused.status, refused.body.code], [403, 'CONSENT_REQUIRED']);
      assert.deepEqual(await state(), before, 'INV-02.1: zero writes without consent');
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      assert.equal((await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'INTAKE', questionId: c.menara })).body.code, 'FEATURE_DISABLED');
      assert.equal((await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: '01920000-0000-7000-8000-000000000000' })).status, 404);
      // T01-7: clients never send state, verdicts or kinds.
      for (const extra of [{ state: 'COMPLETED' }, { verdict: 'CORRECT' }, { outcome: 'SOLVED_FIRST_TRY' }])
        assert.equal((await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: c.menara, ...extra })).body.code, 'VALIDATION_FAILED');
      const key = 'kloopcreate0001';
      const first = await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'CHALLENGE', questionId: c.menara }, { 'idempotency-key': key });
      const replay = await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'CHALLENGE', questionId: c.menara }, { 'idempotency-key': key });
      assert.deepEqual([first.status, replay.status, replay.headers['idempotency-replayed'], replay.body.id], [201, 201, 'true', first.body.id]);
      const s = first.body;
      assert.deepEqual([s.kind, s.origin, s.state, s.stateVersion, s.unsuccessfulRetries, s.checkpoint.route], ['QUESTION_LOOP', 'CHALLENGE', 'QUESTION', 1, 0, '/challenge']);
      assert.deepEqual(s.allowedActions, ['SUBMIT_ATTEMPT', 'REQUEST_HINT', 'ABANDON', 'UPDATE_CHECKPOINT']);
      // E-25: a loop lives 14 days after its last activity.
      const days = (Date.parse(s.expiresAt) - Date.parse(s.lastActivityAt)) / 86400000;
      assert.ok(days > 13.99 && days < 14.01, `${days} days`);
      // Ownership (INV-01): another learner sees nothing.
      const other = client(app, config, await consentedLearner(db, config));
      assert.equal((await other('GET', `/v1/learning-sessions/${s.id}`)).status, 404);
      assert.equal((await submit(other, s, text('34,6'))).status, 404);
    });

    await t.test('09 §1: every 201 carries Location to a resource that reads back, also on replay; a 200 carries none', async () => {
      const learner = await consentedLearner(db, config, { purposes: ['LEARNING_DATA', 'AI_PROCESSING'] }), call = client(app, config, learner);
      const reads = async (location: string | undefined, id: string) => {
        assert.ok(location, 'Location is present');
        const r = await call('GET', location!);
        assert.deepEqual([r.status, r.body.id], [200, id], location);
      };
      const created = await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: c.menara }, { 'idempotency-key': 'klocation0001' });
      const again = await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: c.menara }, { 'idempotency-key': 'klocation0001' });
      assert.deepEqual([created.headers.location, again.headers.location], [`/v1/learning-sessions/${created.body.id}`, `/v1/learning-sessions/${created.body.id}`]);
      await reads(created.headers.location as string, created.body.id);
      // An attempt: inline (40 → clarification), then a queued one.
      const inline = await submit(call, created.body, text('40'), 'klocation0002');
      const inlineAgain = await submit(call, created.body, text('40'), 'klocation0002');
      assert.deepEqual([inline.headers.location, inlineAgain.headers.location], [`/v1/attempts/${inline.body.attempt.id}`, `/v1/attempts/${inline.body.attempt.id}`]);
      await reads(inline.headers.location as string, inline.body.attempt.id);
      const queued = await submit(call, inline.body.session, text('pakai perbandingan saja'));
      await reads(queued.headers.location as string, queued.body.attempt.id);
      // E-10: a new generation is 201 with the run's Location; the unchanged run is 200 without one.
      await sql`update diagnosis_run set deadline_at = now() - interval '1 second' where id = ${queued.body.diagnosisRun.id}`.execute(db);
      assert.equal(await diagnosisTick(db, engine), 'exhausted');
      const regenerated = await call('POST', `/v1/attempts/${queued.body.attempt.id}/diagnosis`);
      assert.deepEqual([regenerated.status, regenerated.headers.location], [201, `/v1/diagnosis-runs/${regenerated.body.id}`]);
      await reads(regenerated.headers.location as string, regenerated.body.id);
      const unchanged = await call('POST', `/v1/attempts/${queued.body.attempt.id}/diagnosis`);
      assert.deepEqual([unchanged.status, unchanged.headers.location], [200, undefined]);
      const s = (await call('GET', `/v1/learning-sessions/${created.body.id}`)).body;
      const abandoned = await act(call, s, 'ABANDON');
      assert.deepEqual([abandoned.status, abandoned.headers.location], [200, undefined]);
    });

    await t.test('E-03 + E-08 inline (T01-1, T01-5, INV-04, INV-13): a correct first try completes; the solution stays locked until reviewed', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const s = await loop(call);
      const key = 'kloopattempt0001';
      const r = await submit(call, s, text('tan 30 = 20/x, x = 20√3'), key);
      const again = await submit(call, s, text('tan 30 = 20/x, x = 20√3'), key);
      assert.deepEqual([r.status, again.status, again.body.attempt.id], [201, 201, r.body.attempt.id], 'T01-5: the same key is one attempt');
      const { attempt, diagnosisRun: run, session } = r.body;
      runs.push(run.id);
      const anchor = (await one(sql<{ r: string }>`select anchor_question_revision_id as r from learning_session where id = ${s.id}`)).r;
      assert.deepEqual([attempt.kind, attempt.questionRevisionId, attempt.verdict, attempt.parentAttemptId], ['INITIAL', anchor, 'CORRECT', undefined]);
      assert.deepEqual([run.purpose, run.engine, run.status, run.verdict, run.evidenceStatus, run.aiAssisted, run.generation], ['DIAGNOSIS', 'DETERMINISTIC', 'COMPLETED', 'CORRECT', 'SUPPORTED', false, 1]);
      assert.equal(run.revealedAnswer, undefined, '06 §2.4 rule 7: a loop never reveals the key in the run');
      assert.deepEqual([session.state, session.outcome, session.stateVersion, session.activeAttemptId, session.activeDiagnosisRunId], ['COMPLETED', 'SOLVED_FIRST_TRY', 2, attempt.id, run.id]);
      assert.deepEqual(session.allowedActions, ['REVIEW_SOLUTION']);
      const ev = await evidenceOf(run.id);
      assert.ok(ev.every(e => e.classification === 'UNDERSTANDING_DEMONSTRATED' && e.source === 'DETERMINISTIC' && !e.transfer_eligible && e.eligibility_reasons.includes('ANCHOR_OR_RETRY')), 'INV-13');
      assert.deepEqual(run.evidence.map((e: { refs: { quote: string }[] }) => e.refs[0]!.quote).sort(), ['20/x', '20√3', 'tan 30']);
      // E-21 from COMPLETED: readable, no state change, no version step; recorded once.
      assert.deepEqual([(await call('GET', `/v1/learning-sessions/${s.id}/solution`)).body.code], ['SOLUTION_LOCKED']);
      const solved = await call('POST', `/v1/learning-sessions/${s.id}/solution`, { expectedStateVersion: 2 });
      assert.deepEqual([solved.status, solved.body.session.state, solved.body.session.stateVersion, solved.body.session.outcome], [200, 'COMPLETED', 2, 'SOLVED_FIRST_TRY']);
      assert.ok(solved.body.solution.steps.length >= 1);
      await call('POST', `/v1/learning-sessions/${s.id}/solution`, { expectedStateVersion: 2 });
      assert.equal((await call('GET', `/v1/learning-sessions/${s.id}/solution`)).status, 200);
      assert.equal((await one(sql<{ n: string }>`select count(*) n from assistance_event where session_id = ${s.id} and type = 'FULL_SOLUTION_SHOWN'`)).n, '1');
      // Terminal: nothing else is accepted.
      assert.equal((await submit(call, { id: s.id, stateVersion: 2 }, text('34,6'))).body.code, 'INVALID_STATE_TRANSITION');
    });

    await t.test('E-07 with recommendations: a catalogued misconception points to its authored lesson and key formula', async () => {
      const call = client(app, config, await consentedLearner(db, config));
      const s = await loop(call);
      const r = (await submit(call, s, text('sin 30 = 20/x'))).body;
      runs.push(r.diagnosisRun.id);
      assert.deepEqual([r.session.state, r.attempt.verdict, r.diagnosisRun.verdict, r.diagnosisRun.evidenceStatus], ['DIAGNOSIS_READY', 'INCORRECT', 'INCORRECT', 'SUPPORTED']);
      assert.deepEqual(r.session.allowedActions, ['START_LESSON', 'START_RETRY', 'ABANDON', 'UPDATE_CHECKPOINT']);
      const miss = r.diagnosisRun.evidence.find((e: { classification: string }) => e.classification === 'MISCONCEPTION_EVIDENCED');
      assert.deepEqual([miss.conceptCode, miss.legacyMapId, miss.misconception.code, miss.refs[0].quote], ['MAT.TRI.DEFINISI_SIN_COS_TAN', 'tri-d', 'MEMAKAI_SIN', 'sin 30']);
      assert.equal(r.diagnosisRun.evidence.find((e: { conceptCode: string }) => e.conceptCode === 'MAT.TRI.SUDUT_ISTIMEWA').classification, 'NOT_ASSESSED');
      const [rec] = r.diagnosisRun.recommendations;
      assert.deepEqual([rec.conceptId, rec.action, rec.lessonId, rec.lessonRouteSlug, rec.keyFormula], [c.ratio, 'LEARN', c.ratioLesson, undefined, 'tan 30° = 20 / x']);
      assert.ok(r.diagnosisRun.lede && !r.diagnosisRun.lede.includes('20√3') && !r.diagnosisRun.lede.includes('34'), 'no final answer before the retry phase');
      assert.equal(r.diagnosisRun.revealedAnswer, undefined);
    });

    await t.test('T01-3 with E-05, E-04 and E-06: a bare wrong value asks for working; two clarifications, then the learner chooses', async () => {
      const call = client(app, config, await consentedLearner(db, config));
      let s = await loop(call);
      const first = (await submit(call, s, text('40'))).body;
      runs.push(first.diagnosisRun.id);
      assert.deepEqual([first.session.state, first.attempt.verdict, first.diagnosisRun.evidenceStatus], ['CLARIFICATION_NEEDED', 'INCORRECT', 'INSUFFICIENT_EVIDENCE']);
      assert.ok(first.diagnosisRun.evidence.every((e: { classification: string }) => e.classification === 'INSUFFICIENT_EVIDENCE'), 'T01-3: no concept is blamed');
      assert.ok(first.diagnosisRun.clarificationPrompt);
      s = first.session;
      const c1 = (await submit(call, s, text('saya bingung'))).body;
      assert.deepEqual([c1.attempt.kind, c1.attempt.parentAttemptId, c1.session.state], ['CLARIFICATION', first.attempt.id, 'CLARIFICATION_NEEDED']);
      const c2 = (await submit(call, c1.session, text('tan x'))).body;
      runs.push(c1.diagnosisRun.id, c2.diagnosisRun.id);
      assert.deepEqual([c2.attempt.kind, c2.attempt.parentAttemptId, c2.session.state], ['CLARIFICATION', first.attempt.id, 'DIAGNOSIS_READY'], 'E-06 after two rounds');
      assert.equal((await submit(call, c2.session, text('tan 30 = 20/x'))).body.code, 'INVALID_STATE_TRANSITION', 'no third clarification');
      // E-06: the primary concepts, most basic first; INV-16.3: no negative evidence along the way.
      assert.deepEqual(c2.diagnosisRun.recommendations.map((x: { conceptId: string }) => x.conceptId), [c.sides, c.ratio, c.special]);
      for (const run of [first, c1, c2]) assert.ok(!(await evidenceOf(run.diagnosisRun.id)).some(e => e.classification === 'MISCONCEPTION_EVIDENCED'));
    });

    await t.test('05 §4.4 self-reports: "Saya tahu caranya" asks for proof, "belum tahu" starts from the basics; neither is graded', async () => {
      const call = client(app, config, await consentedLearner(db, config));
      const know = (await submit(call, await loop(call), self('KNOW'))).body;
      assert.deepEqual([know.session.state, know.attempt.verdict, know.diagnosisRun.verdict, know.diagnosisRun.clarificationPrompt], ['CLARIFICATION_NEEDED', 'NOT_GRADED', 'NOT_GRADED', 'Tulis rumus atau langkah pertamamu.']);
      assert.deepEqual(await evidenceOf(know.diagnosisRun.id), [], 'a claim is never evidence');
      const dont = (await submit(call, await loop(call), self('DONT_KNOW'))).body;
      runs.push(know.diagnosisRun.id, dont.diagnosisRun.id);
      assert.deepEqual([dont.session.state, dont.attempt.verdict], ['DIAGNOSIS_READY', 'NOT_GRADED']);
      assert.deepEqual(await evidenceOf(dont.diagnosisRun.id), [], 'not knowing is not a misconception');
      assert.deepEqual(dont.diagnosisRun.recommendations.map((x: { conceptId: string }) => x.conceptId), [c.sides, c.ratio, c.special]);
    });

    await t.test('E-11 to E-14 and E-16 + E-17 (T01-6): a lesson from a recommendation, its checks, then a correct retry', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      let s = (await submit(call, await loop(call), text('sin 30 = 20/x'))).body.session;
      const before = await state();
      const unmapped = await act(call, s, 'START_LESSON', { conceptId: c.radian });
      assert.deepEqual([unmapped.status, unmapped.body.code], [409, 'CONTENT_UNAVAILABLE']);
      assert.deepEqual(await state(), before, 'a refused lesson writes nothing');
      s = (await act(call, s, 'START_LESSON', { conceptId: c.ratio })).body.session;
      assert.deepEqual([s.state, s.lesson.lessonId, s.lesson.conceptId, s.lesson.status, s.lesson.slideIndex], ['MICROLEARNING', c.ratioLesson, c.ratio, 'ASSIGNED', 0]);
      assert.equal((await one(sql<{ n: string }>`select count(*) n from assistance_event where session_id = ${s.id} and type = 'LESSON_VIEWED'`)).n, '1');
      for (const check of s.lesson.checks) {
        s = (await act(call, s, 'ADVANCE_LESSON', { slideIndex: check.slideIndex })).body.session;
        assert.equal(s.state, 'QUICK_CHECK');
        // T01-6: a refresh sees the slide.
        assert.equal((await call('GET', `/v1/learning-sessions/${s.id}`)).body.lesson.slideIndex, check.slideIndex);
        const answered = (await call('POST', `/v1/learning-sessions/${s.id}/quick-check-answers`, { expectedStateVersion: s.stateVersion, microAssessmentId: check.microAssessmentId,
          response: { responseType: 'OPTION', optionId: c.checkKey.get(check.microAssessmentId)!.wrong } })).body;
        s = answered.session;
      }
      s = (await act(call, s, 'FINISH_LESSON')).body.session;
      assert.deepEqual([s.state, s.lesson.status], ['RETRY', 'COMPLETED'], 'E-14 leads back to the anchor');
      const retry = (await submit(call, s, text('tan 30 = 20/x, x = 20√3'))).body;
      runs.push(retry.diagnosisRun.id);
      const initial = (await one(sql<{ id: string }>`select id from question_attempt where session_id = ${s.id} and kind = 'INITIAL'`)).id;
      assert.deepEqual([retry.attempt.kind, retry.attempt.parentAttemptId, retry.attempt.assistance, retry.diagnosisRun.purpose], ['RETRY', initial, 'LESSON', 'VERIFICATION']);
      assert.deepEqual([retry.session.state, retry.session.outcome], ['COMPLETED', 'SOLVED_AFTER_LEARNING']);
      assert.ok((await evidenceOf(retry.diagnosisRun.id)).every(e => !e.transfer_eligible && e.eligibility_reasons.includes('ANCHOR_OR_RETRY')), 'INV-13: retry evidence never transfers');
    });

    await t.test('E-15, E-18, E-20, E-19 (INV-16.1): only an incorrect retry uses an allowance; the second ends with the solution', async () => {
      const call = client(app, config, await consentedLearner(db, config));
      let s = (await submit(call, await loop(call), text('cos 30 = 20/x'))).body.session;
      s = (await act(call, s, 'START_RETRY')).body.session;
      assert.equal(s.state, 'RETRY');
      const wrong = (await submit(call, s, text('40'))).body;
      assert.deepEqual([wrong.session.state, wrong.session.unsuccessfulRetries, wrong.attempt.verdict], ['RETRY', 1, 'INCORRECT'], 'E-18');
      const unreadable = (await submit(call, wrong.session, text('saya bingung'))).body;
      assert.deepEqual([unreadable.session.state, unreadable.session.unsuccessfulRetries, unreadable.attempt.verdict], ['RETRY', 1, 'UNREADABLE'], 'E-20: no allowance used');
      const last = (await submit(call, unreadable.session, text('tan 30 = x/20'))).body;
      runs.push(wrong.diagnosisRun.id, unreadable.diagnosisRun.id, last.diagnosisRun.id);
      assert.deepEqual([last.session.state, last.session.outcome, last.session.unsuccessfulRetries], ['COMPLETED', 'SOLUTION_REVIEWED', 2], 'E-19');
      assert.equal((await call('GET', `/v1/learning-sessions/${s.id}/solution`)).status, 200, 'the solution becomes readable');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from assistance_event where session_id = ${s.id} and type = 'FULL_SOLUTION_SHOWN'`)).n, '1');
    });

    await t.test('E-21 from RETRY and its illegal forms; T01-9: a family attempt after the solution is not independent', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const fresh = await loop(call), before = await state();
      const early = await call('POST', `/v1/learning-sessions/${fresh.id}/solution`, { expectedStateVersion: 1 });
      assert.deepEqual([early.status, early.body.code], [409, 'INVALID_STATE_TRANSITION'], '05 §4.5: not before the retry phase');
      assert.deepEqual(await state(), before);
      let s = (await submit(call, fresh, text('sin 30 = 20/x'))).body.session;
      s = (await act(call, s, 'START_LESSON', { conceptId: c.ratio })).body.session;
      s = (await act(call, s, 'SKIP_LESSON')).body.session;
      assert.deepEqual([s.state, s.lesson.status], ['RETRY', 'SKIPPED']);
      const reviewed = await call('POST', `/v1/learning-sessions/${s.id}/solution`, { expectedStateVersion: s.stateVersion });
      assert.deepEqual([reviewed.body.session.state, reviewed.body.session.outcome], ['COMPLETED', 'SOLUTION_REVIEWED']);
      // T01-9: the same family in practice is graded, but not mastery-eligible (SOLUTION_SEEN).
      const p = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'BANK', withLesson: false, spec: { questionIds: [c.depression] } })).body;
      const graded = (await call('POST', `/v1/learning-sessions/${p.id}/attempts`, { expectedStateVersion: p.stateVersion, response: { responseType: 'TEXT', text: '20√3' } })).body;
      assert.equal(graded.attempt.assistance, 'SOLUTION');
      assert.ok((await evidenceOf(graded.diagnosisRun.id)).every(e => !e.mastery_eligible && e.eligibility_reasons.includes('SOLUTION_SEEN')));
    });

    await t.test('E-23 on the anchor: hints are idempotent, change no state and mark the next attempt', async () => {
      const call = client(app, config, await consentedLearner(db, config));
      const s = await loop(call);
      const h1 = (await call('POST', `/v1/learning-sessions/${s.id}/hints`, { step: 1 })).body;
      const h1again = (await call('POST', `/v1/learning-sessions/${s.id}/hints`, { step: 1 })).body;
      assert.deepEqual([h1.step, h1.totalSteps, h1.session.stateVersion, h1again.session.stateVersion], [1, 3, 1, 1]);
      assert.equal((await call('POST', `/v1/learning-sessions/${s.id}/hints`, { step: 4 })).body.code, 'INVALID_STATE_TRANSITION');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from assistance_event where session_id = ${s.id} and type = 'HINT_SHOWN'`)).n, '1');
      const r = (await submit(call, s, text('sin 30 = 20/x'))).body;
      assert.equal(r.attempt.assistance, 'HINT');
      assert.ok((await evidenceOf(r.diagnosisRun.id)).every(e => !e.transfer_eligible));
    });

    await t.test('T01-11 and INV-22: two tabs on one version get one 201 and one 409; client timestamps and verdicts are refused', async () => {
      const call = client(app, config, await consentedLearner(db, config));
      const s = await loop(call);
      const [a, b] = await Promise.all([submit(call, s, text('sin 30 = 20/x')), submit(call, s, text('34,6'))]);
      assert.deepEqual([a.status, b.status].sort(), [201, 409]);
      assert.equal([a, b].find(x => x.status === 409)!.body.code, 'STALE_STATE_VERSION');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from question_attempt where session_id = ${s.id}`)).n, '1');
      for (const extra of [{ submittedAt: '2020-01-01T00:00:00Z' }, { verdict: 'CORRECT' }, { kind: 'RETRY' }])
        assert.equal((await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: 2, response: text('34,6'), ...extra })).body.code, 'VALIDATION_FAILED');
    });

    await t.test('queued path (D4 fake engine): no AI consent → inline insufficient; with consent → queued, polled, adopted as AI evidence', async () => {
      const plain = client(app, config, await consentedLearner(db, config));
      const inline = (await submit(plain, await loop(plain), text('tan itu samping dibagi depan'))).body;
      assert.deepEqual([inline.diagnosisRun.status, inline.session.state, engine.calls], ['COMPLETED', 'CLARIFICATION_NEEDED', 0], '06 §2.3 step 3 without AI_PROCESSING');
      const learner = await consentedLearner(db, config, { purposes: ['LEARNING_DATA', 'AI_PROCESSING'] }), call = client(app, config, learner);
      const s = await loop(call), working = 'tan itu samping dibagi depan';
      const r = await submit(call, s, text(working));
      assert.deepEqual([r.status, r.headers['retry-after'], r.body.diagnosisRun.status, r.body.diagnosisRun.engine, r.body.attempt.verdict, r.body.session.state, r.body.session.stateVersion],
        [201, '2', 'QUEUED', 'AI_ASSISTED', 'PENDING', 'DIAGNOSING', 2]);
      assert.deepEqual(r.body.session.allowedActions, ['ABANDON', 'UPDATE_CHECKPOINT']);
      const poll = await call('GET', `/v1/diagnosis-runs/${r.body.diagnosisRun.id}`);
      assert.deepEqual([poll.headers['retry-after'], poll.body.status], ['2', 'QUEUED']);
      engine.steps.push(async input => ({ schemaVersion: 1, verdict: 'INCORRECT', concepts: [
        { conceptCode: 'MAT.TRI.DEFINISI_SIN_COS_TAN', classification: 'MISCONCEPTION_EVIDENCED', misconceptionCode: 'PERSAMAAN_TERBALIK', rationale: 'Perbandingannya terbalik.',
          refs: [span(working, 'samping dibagi depan')], confidence: 0.9 },
        { conceptCode: 'MAT.TRI.RADIAN', classification: 'UNDERSTANDING_DEMONSTRATED', refs: [span(working, 'tan')], confidence: 0.9 },            // unmapped: dropped
        { conceptCode: 'MAT.TRI.SEGITIGA_SIKU_SIKU', classification: 'UNDERSTANDING_DEMONSTRATED', refs: [{ kind: 'SPAN', start: 0, end: 3, quote: 'sin' }], confidence: 0.9 }, // wrong quote: dropped
        { conceptCode: 'MAT.TRI.SUDUT_ISTIMEWA', classification: 'UNDERSTANDING_DEMONSTRATED', refs: [span(working, 'tan')], confidence: 0.4 },    // low confidence
      ], ignored: input.concepts.length }));
      assert.equal(await diagnosisTick(db, engine), 'adopted');
      assert.ok(!JSON.stringify(engine.inputs.at(-1)).includes(learner.learnerId), '06 §2.1: the engine never sees the learner');
      const after = (await call('GET', `/v1/diagnosis-runs/${r.body.diagnosisRun.id}`)).body;
      runs.push(after.id);
      assert.deepEqual([after.status, after.verdict, after.evidenceStatus, after.aiAssisted, after.session.state], ['COMPLETED', 'INCORRECT', 'SUPPORTED', true, 'DIAGNOSIS_READY']);
      assert.equal(after.headers, undefined);
      const ev = await evidenceOf(after.id);
      assert.deepEqual(ev.map(e => [e.code, e.classification, e.source, e.mastery_eligible]), [
        ['MAT.TRI.DEFINISI_SIN_COS_TAN', 'MISCONCEPTION_EVIDENCED', 'AI', false], ['MAT.TRI.SEGITIGA_SIKU_SIKU', 'NOT_ASSESSED', 'AI', false], ['MAT.TRI.SUDUT_ISTIMEWA', 'INSUFFICIENT_EVIDENCE', 'AI', false]]);
      assert.ok(ev[0]!.eligibility_reasons.includes('AI_ONLY'), 'INV-10');
      assert.equal((await call('GET', `/v1/attempts/${r.body.attempt.id}`)).body.verdict, 'INCORRECT');
      assert.equal((await one(sql<{ s: string }>`select status s from job where diagnosis_run_id = ${after.id}`)).s, 'DONE');
      assert.equal(await diagnosisTick(db, engine), 'idle', 'adopted once');
    });

    await t.test('T01-4 and E-09/E-10: failures produce no diagnosis; the loop resumes by generation, at most three', async () => {
      const learner = await consentedLearner(db, config, { purposes: ['LEARNING_DATA', 'AI_PROCESSING'] }), call = client(app, config, learner);
      const s = await loop(call);
      const r = (await submit(call, s, text('saya rasa pakai perbandingan'))).body;
      // Three calls fail (provider down): the job gives up and the run fails with no evidence.
      for (let i = 0; i < 3; i++) { engine.steps.push(async () => { throw new Error('upstream 529'); }); await due(); assert.equal(await diagnosisTick(db, engine), 'retried'); }
      let session = (await call('GET', `/v1/learning-sessions/${s.id}`)).body;
      assert.deepEqual([session.state, session.resumeState, session.allowedActions], ['EVALUATION_FAILED', 'DIAGNOSING', ['REVIEW_SOLUTION', 'REQUEST_DIAGNOSIS', 'ABANDON', 'UPDATE_CHECKPOINT']]);
      const failed = (await call('GET', `/v1/diagnosis-runs/${r.diagnosisRun.id}`)).body;
      assert.deepEqual([failed.status, failed.failureCode, failed.evidence], ['FAILED', 'DEPENDENCY_UNAVAILABLE', []]);
      assert.equal((await call('GET', `/v1/attempts/${r.attempt.id}`)).body.verdict, 'PENDING', 'no fake verdict');
      // E-10: generation 2, then two invalid outputs and a third → FAILED INVALID_OUTPUT.
      const g2 = await call('POST', `/v1/attempts/${r.attempt.id}/diagnosis`);
      assert.deepEqual([g2.status, g2.body.generation, g2.body.status, g2.body.session.state], [201, 2, 'QUEUED', 'DIAGNOSING']);
      for (let i = 0; i < 3; i++) { engine.steps.push(async () => ({ schemaVersion: 2, verdict: 'MAYBE' })); await due(); await diagnosisTick(db, engine); }
      const g2run = (await call('GET', `/v1/diagnosis-runs/${g2.body.id}`)).body;
      assert.deepEqual([g2run.status, g2run.failureCode, g2run.evidence], ['FAILED', 'INVALID_OUTPUT', []]);
      // Generation 3 runs out of time.
      const g3 = (await call('POST', `/v1/attempts/${r.attempt.id}/diagnosis`)).body;
      await sql`update diagnosis_run set deadline_at = now() - interval '1 second' where id = ${g3.id}`.execute(db);
      await sql`update job set deadline_at = now() - interval '1 second' where diagnosis_run_id = ${g3.id}`.execute(db);
      assert.equal(await diagnosisTick(db, engine), 'exhausted');
      assert.equal((await call('GET', `/v1/diagnosis-runs/${g3.id}`)).body.failureCode, 'DEADLINE_EXCEEDED');
      session = (await call('GET', `/v1/learning-sessions/${s.id}`)).body;
      assert.deepEqual([session.state, session.allowedActions.includes('REQUEST_DIAGNOSIS')], ['EVALUATION_FAILED', false]);
      const capped = await call('POST', `/v1/attempts/${r.attempt.id}/diagnosis`);
      assert.deepEqual([capped.status, capped.body.id], [200, g3.id], 'the existing run, unchanged');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from concept_evidence where attempt_id = ${r.attempt.id}`)).n, '0', 'T01-4: no evidence from failures');
      const end = await call('POST', `/v1/learning-sessions/${s.id}/solution`, { expectedStateVersion: session.stateVersion });
      assert.deepEqual([end.body.session.state, end.body.session.outcome], ['COMPLETED', 'SOLUTION_REVIEWED'], 'E-21 from EVALUATION_FAILED');
      runs.push(r.diagnosisRun.id, g2.body.id, g3.id);
    });

    await t.test('INV-08.1: concurrent REQUEST_DIAGNOSIS creates one new generation', async () => {
      const learner = await consentedLearner(db, config, { purposes: ['LEARNING_DATA', 'AI_PROCESSING'] }), call = client(app, config, learner);
      const s = await loop(call);
      const r = (await submit(call, s, text('saya rasa pakai perbandingan'))).body;
      await sql`update diagnosis_run set deadline_at = now() - interval '1 second' where id = ${r.diagnosisRun.id}`.execute(db);
      assert.equal(await diagnosisTick(db, engine), 'exhausted');
      const answers = await Promise.all([1, 2, 3].map(() => call('POST', `/v1/attempts/${r.attempt.id}/diagnosis`)));
      assert.deepEqual(answers.map(a => a.status).sort(), [200, 200, 201]);
      assert.equal((await one(sql<{ n: string }>`select count(*) n from diagnosis_run where attempt_id = ${r.attempt.id} and generation = 2`)).n, '1');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from diagnosis_run where attempt_id = ${r.attempt.id} and status in ('QUEUED', 'RUNNING')`)).n, '1');
      await call('POST', `/v1/learning-sessions/${s.id}/actions`, { type: 'ABANDON', expectedStateVersion: (await call('GET', `/v1/learning-sessions/${s.id}`)).body.stateVersion });
    });

    await t.test('fencing: lease recovery adopts once; late results after abandon, expiry, a new generation, revocation and deletion are discarded', async () => {
      engine.steps = [];
      const queued = async (purposes = ['LEARNING_DATA', 'AI_PROCESSING']) => {
        const learner = await consentedLearner(db, config, { purposes }), call = client(app, config, learner);
        const s = await loop(call), working = 'pakai perbandingan depan dan samping';
        const r = (await submit(call, s, text(working))).body;
        assert.equal(r.diagnosisRun.status, 'QUEUED');
        return { learner, call, s: r.session, attemptId: r.attempt.id, runId: r.diagnosisRun.id, working };
      };
      const good = (working: string) => async () => ({ schemaVersion: 1, verdict: 'UNREADABLE', concepts: [
        { conceptCode: 'MAT.TRI.SEGITIGA_SIKU_SIKU', classification: 'UNDERSTANDING_DEMONSTRATED', refs: [span(working, 'depan dan samping')], confidence: 0.95 }] });
      const discarded = async (runId: string, sessionId: string, call: Call, state: string) => {
        assert.equal((await one(sql<{ n: string }>`select count(*) n from concept_evidence where diagnosis_run_id = ${runId}`)).n, '0', 'no evidence from a late result');
        assert.equal((await one(sql<{ s: string }>`select status s from diagnosis_run where id = ${runId}`)).s, 'CANCELLED');
        assert.equal((await call('GET', `/v1/learning-sessions/${sessionId}`)).body.state, state);
      };

      // Lease expiry: a crashed worker's lease is recovered and the job is adopted exactly once; the old holder is fenced out.
      const a = await queued();
      const stale = (await lease(db, 'diagnosis'))!;
      await sql`update job set lease_until = now() - interval '1 second' where id = ${stale.id}`.execute(db);
      assert.equal(await diagnosisTick(db, engine), 'idle', 'recovered, and due again after the recovery delay');
      await due();
      engine.steps.push(good(a.working));
      assert.equal(await diagnosisTick(db, engine), 'adopted');
      assert.equal(await db.transaction().execute(tx => validLease(tx, stale)), false);
      assert.equal((await a.call('GET', `/v1/learning-sessions/${a.s.id}`)).body.state, 'CLARIFICATION_NEEDED');
      runs.push(a.runId);

      // E-24: abandoned while the engine works.
      const b = await queued();
      engine.steps.push(async input => { await b.call('POST', `/v1/learning-sessions/${b.s.id}/actions`, { type: 'ABANDON', expectedStateVersion: b.s.stateVersion }); return good(b.working)(); });
      assert.equal(await diagnosisTick(db, engine), 'discarded');
      await discarded(b.runId, b.s.id, b.call, 'ABANDONED');
      assert.equal((await one(sql<{ s: string }>`select status s from job where diagnosis_run_id = ${b.runId}`)).s, 'CANCELLED');

      // E-25: expired while the engine works.
      const e = await queued();
      engine.steps.push(async () => { await sql`update learning_session set expires_at = now() - interval '1 second' where id = ${e.s.id}`.execute(db); await expireSessions(db); return good(e.working)(); });
      assert.equal(await diagnosisTick(db, engine), 'discarded');
      await discarded(e.runId, e.s.id, e.call, 'EXPIRED');
      assert.equal((await e.call('POST', `/v1/learning-sessions/${e.s.id}/attempts`, { expectedStateVersion: e.s.stateVersion + 1, response: text('34,6') })).status, 410);

      // A new generation replaced the run while the engine worked (E-09 then E-10).
      const g = await queued();
      engine.steps.push(async () => {
        await db.transaction().execute(async tx => {
          const target = (await adoptionTarget(tx, g.learner.learnerId, g.attemptId, 1))!;
          await failRun(tx, g.runId, 'INTERNAL');
          await applyRunResult(tx, target, 1, 'EXHAUSTED');
        });
        assert.equal((await g.call('POST', `/v1/attempts/${g.attemptId}/diagnosis`)).status, 201);
        return good(g.working)();
      });
      assert.equal(await diagnosisTick(db, engine), 'discarded');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from concept_evidence where attempt_id = ${g.attemptId}`)).n, '0');
      const gs = (await g.call('GET', `/v1/learning-sessions/${g.s.id}`)).body;
      assert.deepEqual([gs.state, (await g.call('GET', `/v1/diagnosis-runs/${gs.activeDiagnosisRunId}`)).body.generation], ['DIAGNOSING', 2], 'generation 2 still waits');
      // E-24 cancels generation 2 and its job, so the next scenarios lease only their own jobs.
      await g.call('POST', `/v1/learning-sessions/${g.s.id}/actions`, { type: 'ABANDON', expectedStateVersion: gs.stateVersion });
      assert.equal((await one(sql<{ s: string }>`select status s from job where diagnosis_run_id = ${gs.activeDiagnosisRunId}`)).s, 'CANCELLED');

      // AI_PROCESSING revoked while the engine works: the result is not used (E-09, CONSENT_REVOKED); the loop can resume.
      const v = await queued();
      engine.steps.push(async () => { await sql`update consent_record set status = 'REVOKED', revoked_at = now() where learner_id = ${v.learner.learnerId} and purpose = 'AI_PROCESSING'`.execute(db); return good(v.working)(); });
      assert.equal(await diagnosisTick(db, engine), 'exhausted');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from concept_evidence where diagnosis_run_id = ${v.runId}`)).n, '0');
      assert.deepEqual([(await v.call('GET', `/v1/diagnosis-runs/${v.runId}`)).body.failureCode, (await v.call('GET', `/v1/learning-sessions/${v.s.id}`)).body.state], ['CONSENT_REVOKED', 'EVALUATION_FAILED']);
      // Resuming without AI consent completes inline as insufficient evidence (no queue).
      const resumed = (await v.call('POST', `/v1/attempts/${v.attemptId}/diagnosis`)).body;
      assert.deepEqual([resumed.status, resumed.engine, resumed.session.state], ['COMPLETED', 'DETERMINISTIC', 'CLARIFICATION_NEEDED']);
      runs.push(resumed.id);

      // Deletion requested while the engine works: the result is dropped, then erasure removes everything.
      const d = await queued();
      engine.steps.push(async () => { await db.transaction().execute(tx => deletion(tx, config, d.learner.learnerId, 'SYSTEM', 'OTHER')); return good(d.working)(); });
      assert.equal(await diagnosisTick(db, engine), 'discarded');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from concept_evidence where attempt_id = ${d.attemptId}`)).n, '0');
      for (let i = 0; i < 20 && (await sql`select 1 from learner where id = ${d.learner.learnerId}`.execute(db)).rows.length; i++) await workerTick(db, config);
      assert.equal((await one(sql<{ n: string }>`select count(*) n from diagnosis_run where learner_id = ${d.learner.learnerId}`)).n, '0', 'INV-19');
    });

    await t.test('04 §7 fences one at a time: a stale lease holder, an attempt that is not the active one, another generation', async () => {
      engine.steps = [];
      const learner = await consentedLearner(db, config, { purposes: ['LEARNING_DATA', 'AI_PROCESSING'] }), call = client(app, config, learner);
      // Lease: the first worker's lease expires and a second worker takes the job while the first is still computing.
      const working = 'pakai perbandingan depan dan samping';
      let s = (await submit(call, await loop(call), text('40'))).body.session;                   // covered inline: CLARIFICATION_NEEDED (T01-3)
      const queuedRun = (await submit(call, s, text(working))).body;
      assert.deepEqual([queuedRun.diagnosisRun.status, queuedRun.attempt.kind], ['QUEUED', 'CLARIFICATION']);
      let second: Awaited<ReturnType<typeof lease>>;
      engine.steps.push(async () => {
        await sql`update job set lease_until = now() - interval '1 second' where diagnosis_run_id = ${queuedRun.diagnosisRun.id}`.execute(db);
        await sql`update job set status = 'QUEUED', lease_token = null, lease_until = null, available_at = now() where diagnosis_run_id = ${queuedRun.diagnosisRun.id}`.execute(db);
        second = await lease(db, 'diagnosis');
        assert.ok(second);
        return { schemaVersion: 1, verdict: 'UNREADABLE', concepts: [{ conceptCode: 'MAT.TRI.SEGITIGA_SIKU_SIKU', classification: 'UNDERSTANDING_DEMONSTRATED',
          refs: [span(working, 'depan dan samping')], confidence: 0.95 }] };
      });
      assert.equal(await diagnosisTick(db, engine), 'discarded', 'the stale holder adopts nothing');
      assert.equal((await one(sql<{ n: string }>`select count(*) n from concept_evidence where diagnosis_run_id = ${queuedRun.diagnosisRun.id}`)).n, '0');
      assert.deepEqual([(await one(sql<{ s: string; t: string }>`select status s, lease_token t from job where diagnosis_run_id = ${queuedRun.diagnosisRun.id}`)).t,
        (await one(sql<{ s: string }>`select status s from diagnosis_run where id = ${queuedRun.diagnosisRun.id}`)).s], [second!.lease_token, 'RUNNING'], 'the current holder keeps the job');
      // Active attempt: the run of the session's INITIAL attempt is not the one the session waits for.
      const initial = (await one(sql<{ id: string }>`select id from question_attempt where session_id = ${s.id} and kind = 'INITIAL'`)).id;
      await db.transaction().execute(async tx => {
        assert.equal(await adoptionTarget(tx, learner.learnerId, initial, 1), null, 'an attempt that is not active is fenced out');
        // Generation: the session waits for generation 1 of its active attempt, not 2.
        assert.equal(await adoptionTarget(tx, learner.learnerId, queuedRun.attempt.id, 2), null, 'another generation is fenced out');
        assert.ok(await adoptionTarget(tx, learner.learnerId, queuedRun.attempt.id, 1), 'the waiting run itself passes');
      });
      s = (await call('GET', `/v1/learning-sessions/${s.id}`)).body;
      await act(call, s, 'ABANDON');
    });

    await t.test('E-25 expiry of a waiting loop cancels its run and job; later commands are 410', async () => {
      engine.steps = [];
      const learner = await consentedLearner(db, config, { purposes: ['LEARNING_DATA', 'AI_PROCESSING'] }), call = client(app, config, learner);
      const s = (await submit(call, await loop(call), text('pakai perbandingan saja'))).body;
      await sql`update learning_session set expires_at = now() - interval '1 second' where id = ${s.session.id}`.execute(db);
      assert.ok(await expireSessions(db) >= 1);
      assert.deepEqual([(await one(sql<{ s: string }>`select status s from diagnosis_run where id = ${s.diagnosisRun.id}`)).s, (await one(sql<{ s: string }>`select status s from job where diagnosis_run_id = ${s.diagnosisRun.id}`)).s], ['CANCELLED', 'CANCELLED']);
      assert.equal((await call('POST', `/v1/learning-sessions/${s.session.id}/hints`, { step: 1 })).status, 410);
      // E-24: abandoning a waiting loop cancels its run and job at once, before any worker runs.
      const w = (await submit(call, await loop(call), text('pakai perbandingan saja'))).body;
      await act(call, w.session, 'ABANDON');
      assert.deepEqual([(await one(sql<{ s: string }>`select status s from diagnosis_run where id = ${w.diagnosisRun.id}`)).s, (await one(sql<{ s: string }>`select status s from job where diagnosis_run_id = ${w.diagnosisRun.id}`)).s], ['CANCELLED', 'CANCELLED']);
      assert.equal(await diagnosisTick(db, engine), 'idle', 'nothing left to lease');
    });

    await t.test('model-based (INV-06, 05 §1.5): random command sequences agree with the pure machine, and refusals write nothing', async () => {
      const responses = [text('34,6'), text('sin 30 = 20/x'), text('40'), text('saya bingung'), text('tan 30 = 20/x'), text('tan 30 = x/20'), self('KNOW'), self('DONT_KNOW'), text('tan 30 = 1/2')];
      const command = fc.oneof(
        { arbitrary: fc.integer({ min: 0, max: responses.length - 1 }).map(i => ({ kind: 'submit' as const, i })), weight: 5 },
        { arbitrary: fc.constantFrom('sides' as const, 'ratio' as const, 'special' as const, 'radian' as const).map(k => ({ kind: 'lesson' as const, k })), weight: 2 },
        { arbitrary: fc.integer({ min: -1, max: 2 }).map(slide => ({ kind: 'advance' as const, slide })), weight: 2 },
        { arbitrary: fc.boolean().map(right => ({ kind: 'check' as const, right })), weight: 2 },
        { arbitrary: fc.constantFrom('FINISH_LESSON', 'SKIP_LESSON', 'START_RETRY', 'ABANDON').map(type => ({ kind: 'action' as const, type })), weight: 3 },
        { arbitrary: fc.constant({ kind: 'solution' as const }), weight: 1 },
        { arbitrary: fc.integer({ min: 1, max: 4 }).map(step => ({ kind: 'hint' as const, step })), weight: 1 },
        { arbitrary: fc.constant({ kind: 'stale' as const }), weight: 1 },
      );
      await fc.assert(fc.asyncProperty(fc.array(command, { minLength: 4, maxLength: 12 }), async commands => {
        // One learner per run: the per-learner rate limit (120 requests a minute) stays out of the property.
        const learner = await consentedLearner(db, config), call = client(app, config, learner), state = () => learnerState(learner.learnerId);
        let s = await loop(call);
        let model: Context = { state: 'QUESTION', version: 1, outcome: null, lesson: null, items: [],
          loop: { clarificationRounds: 0, unsuccessfulRetries: 0, attempt: null, run: null, resumeState: null, hintCount: 3, solutionRevealed: false } };
        for (const cmd of commands) {
          const before = await state();
          let r: Awaited<ReturnType<Call>>, expected: Command | null;
          if (cmd.kind === 'submit') {
            const response = responses[cmd.i]!;
            r = await submit(call, s, response);
            const sr = 'selfReport' in response ? response.selfReport as 'KNOW' | 'DONT_KNOW' : undefined;
            expected = r.status === 201
              ? { type: 'SUBMIT_ATTEMPT', ...(sr ? { selfReport: sr } : {}), inline: runOutcome(model.state === 'RETRY' ? 'VERIFYING' : 'DIAGNOSING', r.body.diagnosisRun.verdict, r.body.diagnosisRun.evidenceStatus) }
              : { type: 'SUBMIT_ATTEMPT', ...(sr ? { selfReport: sr } : {}) };
          } else if (cmd.kind === 'lesson') {
            r = await act(call, s, 'START_LESSON', { conceptId: c[cmd.k] });
            const lesson: Lesson = r.status === 200
              ? { status: 'ASSIGNED', slide: 0, slideCount: r.body.session.lesson.slideCount, checks: r.body.session.lesson.checks.map((x: { microAssessmentId: string; slideIndex: number; required: boolean }) => ({ id: x.microAssessmentId, slide: x.slideIndex, required: x.required, verdict: null })) }
              : { status: 'ASSIGNED', slide: 0, slideCount: 1, checks: [] };
            expected = { type: 'START_LESSON', lesson };
            if (r.body.code === 'CONTENT_UNAVAILABLE') { assert.ok(cmd.k === 'radian' && transition(model, expected).ok); expected = null; }
          } else if (cmd.kind === 'advance') {
            r = await act(call, s, 'ADVANCE_LESSON', { slideIndex: Math.max(cmd.slide, 0) });
            expected = { type: 'ADVANCE_LESSON', slideIndex: Math.max(cmd.slide, 0) };
          } else if (cmd.kind === 'check') {
            const lesson = (await call('GET', `/v1/learning-sessions/${s.id}`)).body.lesson;
            const check = lesson?.checks.find((x: { slideIndex: number; answered: boolean }) => x.slideIndex === lesson.slideIndex && !x.answered) ?? lesson?.checks[0];
            const id = check?.microAssessmentId ?? '01920000-0000-7000-8000-000000000000', key = c.checkKey.get(id);
            r = await call('POST', `/v1/learning-sessions/${s.id}/quick-check-answers`, { expectedStateVersion: s.stateVersion, microAssessmentId: id,
              response: { responseType: 'OPTION', optionId: key ? (cmd.right ? key.right : key.wrong) : 'a' } });
            expected = { type: 'ANSWER_QUICK_CHECK', checkId: id, verdict: r.status === 201 ? r.body.attempt.verdict : 'CORRECT' };
          } else if (cmd.kind === 'action') {
            r = await act(call, s, cmd.type); expected = { type: cmd.type } as Command;
          } else if (cmd.kind === 'solution') {
            r = await call('POST', `/v1/learning-sessions/${s.id}/solution`, { expectedStateVersion: s.stateVersion }); expected = { type: 'REVIEW_SOLUTION' };
          } else if (cmd.kind === 'hint') {
            r = await call('POST', `/v1/learning-sessions/${s.id}/hints`, { step: cmd.step }); expected = { type: 'REQUEST_HINT', step: cmd.step };
          } else {
            r = await act(call, { id: s.id, stateVersion: s.stateVersion + 7 }, 'ABANDON');
            assert.equal(r.body.code, model.state === 'COMPLETED' || model.state === 'ABANDONED' ? r.body.code : 'STALE_STATE_VERSION');
            assert.deepEqual(await state(), before, 'a stale version writes nothing'); continue;
          }
          const step = expected ? transition(model, expected) : null;
          if (step?.ok) {
            assert.ok(r.status < 300, `${JSON.stringify(cmd)} accepted by the machine in ${model.state} but ${r.status} ${r.body?.code}`);
            model = step.next;
          } else {
            assert.ok(r.status === 409 || r.status === 410, `${JSON.stringify(cmd)} refused by the machine in ${model.state} but ${r.status}`);
            assert.deepEqual(await state(), before, 'a refused command writes nothing');
          }
          const now = (await call('GET', `/v1/learning-sessions/${s.id}`)).body;
          assert.deepEqual([now.state, now.stateVersion, now.unsuccessfulRetries, now.outcome ?? null], [model.state, model.version, model.loop!.unsuccessfulRetries, model.outcome]);
          s = now;
        }
      }), { numRuns: 25 });
    });

    await t.test('T01-GO: every loop run links attempt → run → evidence references → pinned revision', async () => {
      for (const runId of runs) {
        const row = await one(sql<{ attempt_id: string; revision: string; text: string | null; kind: string }>`select d.attempt_id, a.question_revision_id as revision, a.response ->> 'text' as text, a.kind
          from diagnosis_run d join question_attempt a on a.id = d.attempt_id where d.id = ${runId}`);
        assert.ok(['INITIAL', 'CLARIFICATION', 'RETRY'].includes(row.kind));
        assert.equal((await one(sql<{ n: string }>`select count(*) n from question_revision where id = ${row.revision} and status = 'PUBLISHED'`)).n, '1');
        for (const e of (await sql<{ refs: { kind: string; start: number; end: number; quote: string }[] }>`select refs from concept_evidence where diagnosis_run_id = ${runId}`.execute(db)).rows)
          for (const ref of e.refs) assert.ok(ref.kind === 'SPAN' && row.text !== null && row.text.slice(ref.start, ref.end) === ref.quote, `run ${runId}`);
      }
      assert.ok(runs.length >= 15);
      assert.doesNotMatch(logs, /sin 30|samping dibagi depan|saya bingung/, 'responses never reach the logs');
    });
  } finally { await app.close(); await db.destroy(); }
});
