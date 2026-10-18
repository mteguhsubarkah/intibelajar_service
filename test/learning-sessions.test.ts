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
import { expireSessions } from '../src/learning/service.js';
import { transition, type Command, type Context } from '../src/learning/machine.js';
import type { Manifest } from '../src/catalog/manifest.js';
import { rollbackTo } from './fixtures/db.js';
import { reviewedFixture } from './fixtures/catalog.js';
import { client, consentedLearner } from './fixtures/learner.js';
// Slice 1 M6: PRACTICE sessions over HTTP and PostgreSQL. Every 2xx body is contract-validated by the route
// wrapper. Transition IDs (05 §4.2) and invariants (03 §8) are named where they are tested.

const CANARY = 'canary-7f3a9';
test('Slice 1 practice sessions over the API', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  let logs = '';
  const { app } = await buildApp(config, { db, logStream: new Writable({ write(chunk, _e, done) { logs += chunk.toString(); done(); } }) });
  // The reviewed fixture, plus one hint on a practice item so E-23 can be exercised.
  const fixture: Manifest = reviewedFixture();
  const tan = fixture.questions.find(q => q.code === 'MAT.TRI.Q.TAN60_SIN30')!;
  tan.body.hints = [{ step: 1, conceptCode: 'MAT.TRI.SUDUT_ISTIMEWA', lead: 'Ingat nilai tan 60° dan sin 30°.' }];
  const learnerTables = ['learning_session', 'session_item', 'lesson_assignment', 'question_attempt', 'assistance_event', 'diagnosis_run', 'concept_evidence', 'idempotency_record'];
  // Row count and content digest of everything a learner command can write, so "zero writes" includes updates.
  const state = async () => {
    const out: Record<string, string> = {};
    for (const table of learnerTables) out[table] = (await sql<{ d: string }>`select count(*) || ':' || coalesce(md5(string_agg(t::text, ',' order by t::text)), '') d from ${sql.table(table)} t`.execute(db)).rows[0]!.d;
    return out;
  };
  const ids = async () => {
    const q = async (code: string) => (await sql<{ id: string }>`select id from question where code = ${code}`.execute(db)).rows[0]!.id;
    const concept = async (code: string) => (await sql<{ id: string }>`select id from concept where code = ${code}`.execute(db)).rows[0]!.id;
    return { tan: await q('MAT.TRI.Q.TAN60_SIN30'), tangga: await q('MAT.TRI.Q.TANGGA_6M'), menara: await q('MAT.TRI.Q.SOAL_MENARA'), numeric: await q('MAT.TRI.Q.TRIG_DEPRESSION_01'),
      specialAngles: await concept('MAT.TRI.SUDUT_ISTIMEWA') };
  };
  // Option ids by legacy index, and the key, straight from the fixture (the client sees option ids in QuestionView).
  const keyOf = (code: string) => fixture.questions.find(q => q.code === code)!.rubric.answer.optionId!;
  const wrongOf = (code: string) => fixture.questions.find(q => q.code === code)!.body.options!.find(o => o.id !== keyOf(code))!.id;
  const codeOfRevision = async (revisionId: string) => (await sql<{ code: string }>`select q.code from question_revision r join question q on q.id = r.question_id where r.id = ${revisionId}`.execute(db)).rows[0]!.code;
  const codeOfQuestion = async (questionId: string) => (await sql<{ code: string }>`select code from question where id = ${questionId}`.execute(db)).rows[0]!.code;
  const option = (optionId: string) => ({ responseType: 'OPTION', optionId });
  let c: Awaited<ReturnType<typeof ids>>;

  try {
    await t.test('setup: migrations, reviewed catalog with one hint', async () => {
      await migrate(db); await rollbackTo(db, '0001_slice0.up.sql'); await migrate(db);
      await publish(db, fixture);
      c = await ids();
    });

    await t.test('E-02 creation guards: consent, feature, content and ownership', async () => {
      const pending = await consentedLearner(db, config, { consent: false }), call = client(app, config, pending);
      const before = await state();
      const refused = await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'BANK', withLesson: false, spec: { questionIds: [c.tan] } });
      assert.equal(refused.status, 403); assert.equal(refused.body.code, 'CONSENT_REQUIRED');
      assert.deepEqual(await state(), before, 'INV-02.1: zero rows without consent');
      const learner = await consentedLearner(db, config), post = client(app, config, learner);
      const create = (spec: object, withLesson = false, origin = 'BANK') => post('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin, withLesson, spec });
      assert.equal((await post('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: c.menara })).body.code, 'FEATURE_DISABLED');
      assert.equal((await create({ questionIds: [c.menara] })).body.code, 'CONTENT_UNAVAILABLE', 'a tower-v1 item is not deterministically gradable yet');
      assert.equal((await create({ questionIds: ['0192f6b0-1111-7222-8333-944455556666'] })).status, 404);
      assert.equal((await create({ setCode: 'NOPE' })).status, 404);
      assert.equal((await create({ questionIds: [c.tan] }, true)).body.code, 'CONTENT_UNAVAILABLE', 'no lesson can be derived from item ids');
      assert.equal((await create({ questionIds: [c.tan], conceptId: c.specialAngles })).status, 400, 'exactly one spec');
      assert.equal((await post('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'BANK', withLesson: false, spec: { questionIds: [c.tan] }, state: 'COMPLETED' })).status, 400,
        'clients never send state (05 §4.1)');
      const s = await create({ questionIds: [c.tan, c.tangga] });
      assert.equal(s.status, 201);
      assert.deepEqual([s.body.state, s.body.stateVersion, s.body.items.length, s.body.allowedActions], ['PRACTICING', 1, 2, ['SUBMIT_ATTEMPT', 'SKIP_ITEM', 'REQUEST_HINT', 'ABANDON', 'UPDATE_CHECKPOINT']]);
      // INV-01: another learner sees 404 for every learner-scoped id.
      const other = client(app, config, await consentedLearner(db, config));
      for (const url of [`/v1/learning-sessions/${s.body.id}`]) assert.equal((await other('GET', url)).status, 404);
      assert.equal((await other('POST', `/v1/learning-sessions/${s.body.id}/actions`, { type: 'ABANDON', expectedStateVersion: 1 })).status, 404);
      assert.deepEqual((await other('GET', '/v1/learning-sessions')).body.items, []);
    });

    await t.test('E-02, E-12–E-15: a lesson with quick checks, then practice; formative evidence never counts', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const s = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'CONCEPT_LESSON', withLesson: true, spec: { setCode: 'MAT.TRI.S.SUDUT_ISTIMEWA' } })).body;
      assert.deepEqual([s.state, s.lesson.slideIndex, s.lesson.slideCount, s.lesson.checks.length, s.items.length], ['MICROLEARNING', 0, 3, 3, 4]);
      assert.equal(s.focusConceptId, c.specialAngles);
      assert.equal(s.checkpoint.route, '/core/sudut-istimewa');
      const roles = (await sql<{ role: string }>`select role from session_item where session_id = ${s.id} order by ordinal`.execute(db)).rows.map(r => r.role);
      assert.ok(roles.every(r => r === 'TRANSFER'), 'fresh families that assess the focus concept are transfer items (06 §5.2)');
      const action = (body: object) => call('POST', `/v1/learning-sessions/${s.id}/actions`, body);
      const answer = (version: number, check: { microAssessmentId: string; questionId: string }, correct: boolean) => codeOfQuestion(check.questionId).then(code =>
        call('POST', `/v1/learning-sessions/${s.id}/quick-check-answers`, { expectedStateVersion: version, microAssessmentId: check.microAssessmentId, response: option(correct ? keyOf(code) : wrongOf(code)) }));
      const before = await state();
      const early = await action({ type: 'FINISH_LESSON', expectedStateVersion: 1 });
      assert.deepEqual([early.status, early.body.code, early.body.details.state], [409, 'INVALID_STATE_TRANSITION', 'MICROLEARNING']);
      assert.deepEqual(await state(), before, 'an illegal command writes nothing');
      let v = (await action({ type: 'ADVANCE_LESSON', expectedStateVersion: 1, slideIndex: 0 })).body.session;
      assert.deepEqual([v.state, v.stateVersion, v.allowedActions], ['QUICK_CHECK', 2, ['ANSWER_QUICK_CHECK', 'SKIP_LESSON', 'ABANDON', 'UPDATE_CHECKPOINT']]);
      assert.equal((await action({ type: 'ADVANCE_LESSON', expectedStateVersion: 2, slideIndex: 1 })).status, 409, 'no advancing past a due check (05 §4.5)');
      const unreadable = await call('POST', `/v1/learning-sessions/${s.id}/quick-check-answers`, { expectedStateVersion: 2, microAssessmentId: s.lesson.checks[0].microAssessmentId, response: option('zz') });
      assert.deepEqual([unreadable.status, unreadable.body.attempt.verdict, unreadable.body.session.state, unreadable.body.session.stateVersion], [201, 'UNREADABLE', 'QUICK_CHECK', 3],
        'an unreadable check answer is stored (version +1) but leaves the check due');
      const wrong = await answer(3, s.lesson.checks[0], false);
      assert.deepEqual([wrong.body.attempt.kind, wrong.body.attempt.verdict, wrong.body.session.state, wrong.body.session.stateVersion], ['QUICK_CHECK', 'INCORRECT', 'MICROLEARNING', 4]);
      assert.ok(wrong.body.diagnosisRun.evidence.every((e: { eligibility: { mastery: boolean; reasons: string[] } }) => !e.eligibility.mastery && e.eligibility.reasons.includes('FORMATIVE_CHECK')));
      assert.equal(wrong.body.diagnosisRun.revealedAnswer.optionId, keyOf(await codeOfQuestion(s.lesson.checks[0].questionId)));
      assert.equal((await answer(4, s.lesson.checks[0], true)).status, 409, '"sekali jawab, terkunci"');
      v = (await action({ type: 'ADVANCE_LESSON', expectedStateVersion: 4, slideIndex: 1 })).body.session;
      v = (await answer(v.stateVersion, s.lesson.checks[1], true)).body.session;
      v = (await action({ type: 'ADVANCE_LESSON', expectedStateVersion: v.stateVersion, slideIndex: 2 })).body.session;
      v = (await answer(v.stateVersion, s.lesson.checks[2], true)).body.session;
      assert.ok(v.allowedActions.includes('FINISH_LESSON'));
      v = (await action({ type: 'FINISH_LESSON', expectedStateVersion: v.stateVersion })).body.session;
      assert.deepEqual([v.state, v.lesson.status, v.lesson.checks.map((x: { answered: boolean }) => x.answered)], ['PRACTICING', 'COMPLETED', [true, true, true]]);
    });

    await t.test('E-22: items in order; grading, evidence, eligibility and exposure; completion', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      let s = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'CONCEPT_LESSON', withLesson: false, spec: { conceptId: c.specialAngles } })).body;
      assert.ok(s.items.length >= 3);
      const submit = async (body: object) => call('POST', `/v1/learning-sessions/${s.id}/attempts`, body);
      const before = await state();
      const outOfOrder = await submit({ expectedStateVersion: 1, sessionItemId: s.items[1].id, response: option('a') });
      assert.deepEqual([outOfOrder.status, outOfOrder.body.code], [409, 'INVALID_STATE_TRANSITION']);
      assert.deepEqual(await state(), before);
      const first = await codeOfQuestion(s.items[0].questionId);
      const graded = await submit({ expectedStateVersion: 1, sessionItemId: s.items[0].id, response: option(keyOf(first)) });
      assert.equal(graded.status, 201);
      const { attempt, diagnosisRun: run, session } = graded.body;
      assert.deepEqual([attempt.kind, attempt.verdict, attempt.assistance, run.status, run.engine, run.purpose, run.verdict, run.evidenceStatus, session.stateVersion, session.items[0].status],
        ['TRANSFER', 'CORRECT', 'NONE', 'COMPLETED', 'DETERMINISTIC', 'GRADING', 'CORRECT', 'SUPPORTED', 2, 'ANSWERED']);
      const demonstrated = run.evidence.filter((e: { classification: string }) => e.classification === 'UNDERSTANDING_DEMONSTRATED');
      assert.ok(demonstrated.length > 0 && demonstrated.every((e: { eligibility: { mastery: boolean; transfer: boolean } }) => e.eligibility.mastery && e.eligibility.transfer),
        'live, fresh, unassisted transfer evidence is mastery- and transfer-eligible');
      assert.deepEqual(run.revealedAnswer, { optionId: keyOf(first) });
      const exposure = await sql<{ type: string }>`select type from assistance_event where learner_id = ${learner.learnerId}`.execute(db);
      assert.deepEqual(exposure.rows.map(r => r.type), ['FINAL_ANSWER_SHOWN'], 'showing the key is recorded once (06 §5.3)');
      // INV-16: unreadable keeps the item pending but stores the attempt (version +1).
      const second = await codeOfQuestion(s.items[1].questionId);
      const bad = await submit({ expectedStateVersion: 2, response: { responseType: 'TEXT', text: 'gatau' } });
      assert.deepEqual([bad.body.attempt.verdict, bad.body.session.items[1].status, bad.body.session.stateVersion, bad.body.diagnosisRun.evidence.length], ['UNREADABLE', 'PENDING', 3, 0]);
      const wrong = await submit({ expectedStateVersion: 3, response: option(wrongOf(second)) });
      assert.deepEqual([wrong.body.attempt.verdict, wrong.body.diagnosisRun.evidenceStatus], ['INCORRECT', 'INSUFFICIENT_EVIDENCE']);
      assert.ok(wrong.body.diagnosisRun.clarificationPrompt, 'an unexplained wrong answer asks to check the work, and claims no gap');
      // Skip and finish: the last item completes the session.
      s = wrong.body.session;
      while (s.state === 'PRACTICING') {
        const next = s.items.find((i: { status: string }) => i.status === 'PENDING');
        s = s.items.indexOf(next) % 2 ? (await call('POST', `/v1/learning-sessions/${s.id}/actions`, { type: 'SKIP_ITEM', expectedStateVersion: s.stateVersion, sessionItemId: next.id })).body.session
          : (await submit({ expectedStateVersion: s.stateVersion, response: option(keyOf(await codeOfQuestion(next.questionId))) })).body.session;
      }
      assert.deepEqual([s.state, s.outcome, s.allowedActions], ['COMPLETED', 'PRACTICE_FINISHED', []]);
      assert.ok(s.completedAt);
      assert.equal((await call('POST', `/v1/learning-sessions/${s.id}/actions`, { type: 'ABANDON', expectedStateVersion: s.stateVersion })).status, 409);
      // Reads: the attempt and its run, owner only.
      assert.equal((await call('GET', `/v1/attempts/${attempt.id}`)).body.id, attempt.id);
      const read = await call('GET', `/v1/diagnosis-runs/${run.id}`);
      assert.deepEqual([read.status, read.body.session.state], [200, 'COMPLETED']);
      const other = client(app, config, await consentedLearner(db, config));
      assert.equal((await other('GET', `/v1/attempts/${attempt.id}`)).status, 404);
      assert.equal((await other('GET', `/v1/diagnosis-runs/${run.id}`)).status, 404);
      for (const [method, url] of [['POST', `/v1/learning-sessions/${s.id}/solution`], ['GET', `/v1/learning-sessions/${s.id}/solution`], ['POST', `/v1/attempts/${attempt.id}/diagnosis`]] as const)
        assert.equal((await call(method, url, method === 'POST' && url.endsWith('solution') ? { expectedStateVersion: 1, reason: 'max_tries' } : undefined)).body?.code ?? 'FEATURE_DISABLED', 'FEATURE_DISABLED');
    });

    await t.test('E-23 hints: idempotent per step, no version bump, and they block transfer (INV-12)', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const s = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'CONCEPT_LESSON', withLesson: false, spec: { questionIds: [c.tan] } })).body;
      const hint = await call('POST', `/v1/learning-sessions/${s.id}/hints`, { step: 1 });
      assert.deepEqual([hint.status, hint.body.totalSteps, hint.body.session.stateVersion], [200, 1, 1]);
      await call('POST', `/v1/learning-sessions/${s.id}/hints`, { step: 1 });
      assert.equal((await sql<{ n: string }>`select count(*) n from assistance_event where learner_id = ${learner.learnerId} and type = 'HINT_SHOWN'`.execute(db)).rows[0]!.n, '1');
      assert.equal((await call('POST', `/v1/learning-sessions/${s.id}/hints`, { step: 2 })).status, 409);
      const graded = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: 1, response: option(keyOf('MAT.TRI.Q.TAN60_SIN30')) });
      // INV-12: the verdict is unchanged by the hint; only eligibility differs.
      assert.deepEqual([graded.body.attempt.verdict, graded.body.attempt.assistance], ['CORRECT', 'HINT']);
      for (const e of graded.body.diagnosisRun.evidence.filter((x: { classification: string }) => x.classification === 'UNDERSTANDING_DEMONSTRATED'))
        assert.ok(e.eligibility.mastery && !e.eligibility.transfer && e.eligibility.reasons.includes('HINT_USED'));
    });

    await t.test('INV-14 idempotency and the stale second tab', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const s = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'BANK', withLesson: false, spec: { questionIds: [c.tan, c.tangga] } })).body;
      const body = { expectedStateVersion: 1, response: option(keyOf('MAT.TRI.Q.TAN60_SIN30')) };
      const key = { 'idempotency-key': 'retry-key-000001' };
      const first = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, body, key);
      const replay = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, body, key);
      assert.deepEqual([replay.status, replay.headers['idempotency-replayed'], replay.body], [201, 'true', first.body], 'a lost response is recovered by replay');
      const before = await state();
      const reused = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { ...body, response: option('b') }, key);
      assert.deepEqual([reused.status, reused.body.code], [409, 'IDEMPOTENCY_KEY_REUSED']);
      const stale = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, body);
      assert.deepEqual([stale.status, stale.body.code, stale.body.details.currentStateVersion], [409, 'STALE_STATE_VERSION', 2], 'the second tab must reload');
      assert.deepEqual(await state(), before);
      const missing = await app.inject({ method: 'POST', url: `/v1/learning-sessions/${s.id}/attempts`, payload: JSON.stringify({ ...body, expectedStateVersion: 2 }),
        headers: { ...learner.headers, origin: config.origin, 'content-type': 'application/json' } });
      assert.equal(missing.statusCode, 400);
      const noCsrf = await app.inject({ method: 'POST', url: `/v1/learning-sessions/${s.id}/attempts`, payload: JSON.stringify({ ...body, expectedStateVersion: 2 }),
        headers: { cookie: learner.headers.cookie, origin: config.origin, 'content-type': 'application/json', 'idempotency-key': 'no-csrf-000001' } });
      assert.equal(noCsrf.statusCode, 403);
    });

    await t.test('resume after refresh (T02), checkpoint without a version bump, and the resume list', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const made = [];
      for (let i = 0; i < 3; i++) made.push((await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'CONCEPT_LESSON', withLesson: true, spec: { setCode: 'MAT.TRI.S.PERBANDINGAN_TRIG' } })).body);
      const s = made[2];
      await call('POST', `/v1/learning-sessions/${s.id}/actions`, { type: 'ADVANCE_LESSON', expectedStateVersion: 1, slideIndex: 0 });
      const put = await call('PUT', `/v1/learning-sessions/${s.id}/checkpoint`, { route: '/core/perbandingan-trig', sessionId: s.id, lessonStep: 1 });
      assert.equal(put.status, 204);
      assert.equal((await call('PUT', `/v1/learning-sessions/${s.id}/checkpoint`, { route: '/core/perbandingan-trig', sessionId: made[0].id })).status, 400);
      assert.equal((await call('PUT', `/v1/learning-sessions/${s.id}/checkpoint`, { route: 'https://example.com' })).status, 400, 'never an arbitrary URL');
      // A refresh: the client knows nothing and asks the server.
      const active = await call('GET', '/v1/learning-sessions?status=active&limit=2');
      assert.equal(active.body.items.length, 2);
      assert.equal(active.body.items[0].id, s.id, 'most recent activity first');
      const rest = await call('GET', `/v1/learning-sessions?status=active&limit=2&cursor=${encodeURIComponent(active.body.nextCursor)}`);
      assert.deepEqual([rest.body.items.length, rest.body.nextCursor], [1, null]);
      assert.equal((await call('GET', `/v1/learning-sessions?status=all&limit=2&cursor=${encodeURIComponent(active.body.nextCursor)}`)).status, 400, 'a cursor is bound to its filter');
      assert.equal((await call('GET', `/v1/learning-sessions?status=active&cursor=${encodeURIComponent(active.body.nextCursor.slice(0, -2) + 'xx')}`)).status, 400);
      const resumed = (await call('GET', `/v1/learning-sessions/${s.id}`)).body;
      assert.deepEqual([resumed.state, resumed.stateVersion, resumed.lesson.slideIndex, resumed.checkpoint.lessonStep], ['QUICK_CHECK', 2, 0, 1]);
    });

    await t.test('consent revocation and erasure stop processing; expiry gives 410 (E-25)', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const s = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'BANK', withLesson: false, spec: { questionIds: [c.tan, c.tangga] } })).body;
      await sql`update consent_record set status = 'REVOKED', revoked_at = now() where learner_id = ${learner.learnerId}`.execute(db);
      const before = await state();
      const refused = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: 1, response: option('a') });
      assert.deepEqual([refused.status, refused.body.code], [403, 'CONSENT_REQUIRED']);
      assert.equal((await call('PUT', `/v1/learning-sessions/${s.id}/checkpoint`, { route: '/latihan/soal' })).status, 403);
      assert.deepEqual(await state(), before, 'INV-02.3: zero rows after revocation');
      const fresh = await consentedLearner(db, config), other = client(app, config, fresh);
      const e = (await other('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'BANK', withLesson: false, spec: { questionIds: [c.tan] } })).body;
      await sql`update learning_session set expires_at = now() - interval '1 second' where id = ${e.id}`.execute(db);
      const late = await other('POST', `/v1/learning-sessions/${e.id}/actions`, { type: 'ABANDON', expectedStateVersion: 1 });
      assert.deepEqual([late.status, late.body.code], [410, 'SESSION_EXPIRED']);
      assert.ok(await expireSessions(db) >= 1);
      const expired = (await other('GET', `/v1/learning-sessions/${e.id}`)).body;
      assert.deepEqual([expired.state, expired.stateVersion, expired.allowedActions], ['EXPIRED', 2, []]);
      assert.equal(await expireSessions(db), 0, 'the sweeper is idempotent');
    });

    await t.test('INV-05 and log canaries: no keys before grading, no answer text in logs', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const s = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'BANK', withLesson: false, spec: { questionIds: [c.numeric, c.tan] } })).body;
      const secrets = fixture.questions.flatMap(q => [q.rubric.feedback?.correct, q.rubric.feedback?.incorrect, ...q.rubric.misconceptionMap.map(m => m.explanation)]).filter((x): x is string => !!x && x.length >= 12);
      const ungraded = JSON.stringify([s, (await call('GET', `/v1/learning-sessions/${s.id}`)).body, (await call('GET', '/v1/learning-sessions')).body]);
      for (const secret of secrets) assert.ok(!ungraded.includes(secret), secret);
      assert.ok(!/"(rubric|acceptedForms|misconceptionMap|revealedAnswer)"/.test(ungraded));
      const graded = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: 1, response: { responseType: 'TEXT', text: `17,32 ${CANARY}` } });
      assert.equal(graded.body.attempt.verdict, 'UNREADABLE');
      const misread = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: 2, response: { responseType: 'TEXT', text: '17,32' } });
      const miss = misread.body.diagnosisRun.evidence.find((e: { classification: string }) => e.classification === 'MISCONCEPTION_EVIDENCED');
      assert.deepEqual([misread.body.attempt.verdict, miss.misconception.code, miss.refs[0].quote], ['INCORRECT', 'MEMAKAI_COS', '17,32']);
      assert.ok(!logs.includes(CANARY), 'answer text never reaches logs');
    });

    await t.test('INV-06.1 model-based: random command sequences over HTTP agree with the machine; illegal ones write nothing', async () => {
      const learner = await consentedLearner(db, config), call = client(app, config, learner);
      const toContext = (v: { state: Context['state']; stateVersion: number; outcome?: 'PRACTICE_FINISHED'; lesson?: { status: never; slideIndex: number; slideCount: number;
        checks: { microAssessmentId: string; slideIndex: number; required: boolean; answered: boolean; verdict?: never }[] }; items: { id: string; ordinal: number; status: never; questionId: string }[] },
        hints: Map<string, number>): Context => ({
        state: v.state, version: v.stateVersion, outcome: v.outcome ?? null, items: v.items.map(i => ({ id: i.id, ordinal: i.ordinal, status: i.status, hintCount: hints.get(i.questionId) ?? 0 })),
        lesson: v.lesson ? { status: v.lesson.status, slide: v.lesson.slideIndex, slideCount: v.lesson.slideCount,
          checks: v.lesson.checks.map(x => ({ id: x.microAssessmentId, slide: x.slideIndex, required: x.required, verdict: x.verdict ?? null })) } : null,
      });
      const hints = new Map([[c.tan, 1]]);
      type Step = { kind: number; arg: number; answer: number; stale: boolean };
      const step = fc.record({ kind: fc.integer({ min: 0, max: 9 }), arg: fc.integer({ min: -1, max: 4 }), answer: fc.integer({ min: 0, max: 2 }), stale: fc.boolean() });
      let runs = 0, legalSteps = 0, illegalSteps = 0;
      await fc.assert(fc.asyncProperty(fc.boolean(), fc.array(step, { minLength: 4, maxLength: 12 }), async (withLesson, steps: Step[]) => {
        runs++;
        let view = (await call('POST', '/v1/learning-sessions', { kind: 'PRACTICE', origin: 'CONCEPT_LESSON', withLesson, spec: { setCode: 'MAT.TRI.S.SUDUT_ISTIMEWA' } })).body;
        for (const s of steps) {
          const ctx = toContext(view, hints), version = s.stale && ctx.version > 1 ? ctx.version - 1 : ctx.version;
          const pending = view.items.find((i: { status: string }) => i.status === 'PENDING'), check = view.lesson?.checks[(s.arg + 4) % Math.max(1, view.lesson.checks.length)];
          const pick = async (code: string) => s.answer === 0 ? keyOf(code) : s.answer === 1 ? wrongOf(code) : 'zz';
          let request: [string, object] | undefined, model: Command;
          switch (s.kind) {
            case 0: case 1: { // submit, to the next item or a wrong one
              const item = s.kind === 1 ? view.items[(s.arg + 4) % view.items.length] : pending;
              const code = item ? await codeOfQuestion(item.questionId) : 'MAT.TRI.Q.TAN60_SIN30';
              request = ['attempts', { expectedStateVersion: version, ...(item ? { sessionItemId: item.id } : {}), response: option(await pick(code)) }];
              model = { type: 'SUBMIT_ATTEMPT', itemId: item?.id, verdict: 'CORRECT' }; break;
            }
            case 2: request = ['actions', { type: 'ADVANCE_LESSON', expectedStateVersion: version, slideIndex: Math.max(0, s.arg) }]; model = { type: 'ADVANCE_LESSON', slideIndex: Math.max(0, s.arg) }; break;
            case 3: if (!check) { request = ['actions', { type: 'SKIP_LESSON', expectedStateVersion: version }]; model = { type: 'SKIP_LESSON' }; break; }
              request = ['quick-check-answers', { expectedStateVersion: version, microAssessmentId: check.microAssessmentId, response: option(await pick(await codeOfQuestion(check.questionId))) }];
              model = { type: 'ANSWER_QUICK_CHECK', checkId: check.microAssessmentId, verdict: 'CORRECT' }; break;
            case 4: request = ['actions', { type: 'FINISH_LESSON', expectedStateVersion: version }]; model = { type: 'FINISH_LESSON' }; break;
            case 5: request = ['actions', { type: 'SKIP_LESSON', expectedStateVersion: version }]; model = { type: 'SKIP_LESSON' }; break;
            case 6: request = ['actions', { type: 'SKIP_ITEM', expectedStateVersion: version, sessionItemId: (s.arg < 0 ? view.items[0] : pending ?? view.items[0]).id }];
              model = { type: 'SKIP_ITEM', itemId: (s.arg < 0 ? view.items[0] : pending ?? view.items[0]).id }; break;
            case 7: request = ['actions', { type: 'START_RETRY', expectedStateVersion: version }]; model = { type: 'START_RETRY' }; break;
            case 8: request = ['actions', { type: s.arg === 4 ? 'ABANDON' : 'ADVANCE_LESSON', expectedStateVersion: version, ...(s.arg === 4 ? {} : { slideIndex: 0 }) }];
              model = s.arg === 4 ? { type: 'ABANDON' } : { type: 'ADVANCE_LESSON', slideIndex: 0 }; break;
            default: request = ['actions', { type: 'SKIP_ITEM', expectedStateVersion: version, sessionItemId: pending?.id ?? view.items[0].id }]; model = { type: 'SKIP_ITEM', itemId: pending?.id ?? view.items[0].id };
          }
          const before = await state();
          const r = await call('POST', `/v1/learning-sessions/${view.id}/${request![0]}`, request![1]);
          if (version !== ctx.version) {
            assert.deepEqual([r.status, r.body.code], [409, 'STALE_STATE_VERSION']); assert.deepEqual(await state(), before); illegalSteps++; continue;
          }
          const expectedLegal = transition(ctx, model!).ok;
          if (!expectedLegal) {
            assert.equal(r.status, 409, `${JSON.stringify(model!)} in ${ctx.state} should be refused`); assert.deepEqual(await state(), before, 'illegal → zero writes'); illegalSteps++; continue;
          }
          assert.ok(r.status === 200 || r.status === 201, `${JSON.stringify(model!)} in ${ctx.state}: ${r.status} ${JSON.stringify(r.body)}`);
          legalSteps++;
          const graded = r.body.attempt?.verdict;
          const expected = transition(ctx, 'verdict' in model! ? { ...model!, verdict: graded } as Command : model!);
          assert.ok(expected.ok);
          view = r.body.session;
          const actual = toContext(view, hints);
          assert.deepEqual(actual, expected.next, 'the server agrees with the model');
          // INV-06: +1 exactly when the state changed or an attempt was stored.
          assert.equal(actual.version, ctx.version + (actual.state !== ctx.state || expected.attemptStored ? 1 : 0));
        }
      }), { numRuns: 15, seed: 20261018 });
      assert.ok(runs === 15 && legalSteps > 20 && illegalSteps > 20, `exercised: ${legalSteps} legal, ${illegalSteps} refused`);
    });
  } finally { await app.close(); await db.destroy(); }
});
