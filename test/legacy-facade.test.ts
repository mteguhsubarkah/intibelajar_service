import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Writable } from 'node:stream';
import { build } from 'esbuild';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { buildApp } from '../src/app.js';
import { publish } from '../src/catalog/publisher.js';
import { rollbackTo } from './fixtures/db.js';
import { reviewedFixture } from './fixtures/catalog.js';
import { consentedLearner, type Learner } from './fixtures/learner.js';
// Slice 1 M7: legacy facade L3. The oracle is the shipped frontend adapter itself: its checkWithBackend is
// bundled from the Vue checkout and pointed at this app, so its own isCheck validator judges every response
// (fallback is off outside demo mode, so a rejected shape throws).

const FRONTEND = resolve(process.env.FRONTEND_DIR ?? '../mockup/intibelajar');
const URL_PATH = '/v1/learning/answers/check';
type CheckWithBackend = (context: object, attemptId: string, kind: string, itemId: string, answer: string | number, fallback: () => unknown) =>
  Promise<{ data: { correct: boolean | null; feedback?: string; correctOptionIndex?: number; unreadable?: boolean }; source: string }>;

async function loadAdapter(): Promise<CheckWithBackend | null> {
  if (!existsSync(join(FRONTEND, 'src/services/learningBackend.ts'))) return null;
  const out = await build({ entryPoints: [join(FRONTEND, 'src/services/learningBackend.ts')], bundle: true, platform: 'node', format: 'esm', write: false,
    alias: { '@': join(FRONTEND, 'src') }, logLevel: 'silent' });
  const dir = mkdtempSync(join(tmpdir(), 'ib-adapter-'));
  try { const file = join(dir, 'adapter.mjs'); writeFileSync(file, out.outputFiles[0]!.text); return (await import(pathToFileURL(file).href)).checkWithBackend; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('Slice 1 legacy facade L3 over the M6 engine', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig({ ...env, FEATURE_LEGACY_FACADE: 'true' });
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl), quiet = { logStream: new Writable({ write(_c, _e, done) { done(); } }) };
  const { app } = await buildApp(config, { db, ...quiet });
  const { app: off } = await buildApp(readConfig(env), { db, ...quiet });
  const fixture = reviewedFixture();
  const order = (code: string) => fixture.questions.find(q => q.code === code)!.legacyOptionOrder!;
  const keyIndex = (code: string) => order(code).indexOf(fixture.questions.find(q => q.code === code)!.rubric.answer.optionId!);
  const feedback = (code: string, ok: boolean) => fixture.questions.find(q => q.code === code)!.rubric.feedback?.[ok ? 'correct' : 'incorrect'];
  // The shipped client's request: FlowContext spread in, a fresh attemptId each time, no CSRF token, no Idempotency-Key.
  const raw = (target: FastifyInstance, learner: Learner | null, body: object, headers: Record<string, string> = {}) => target.inject({ method: 'POST', url: URL_PATH,
    payload: JSON.stringify({ questionId: 'soal-menara', topicId: 'trigonometri', hintOpened: false, diagnosisRunId: null, attemptId: `x-${Date.now()}-${Math.random()}`, ...body }),
    headers: { 'content-type': 'application/json', origin: config.origin, 'sec-fetch-site': 'same-origin', ...(learner ? { cookie: learner.headers.cookie } : {}), ...headers } });
  const learnerTables = ['learning_session', 'session_item', 'lesson_assignment', 'question_attempt', 'assistance_event', 'diagnosis_run', 'concept_evidence', 'idempotency_record'];
  const state = async () => Object.fromEntries(await Promise.all(learnerTables.map(async table =>
    [table, (await sql<{ d: string }>`select count(*) || ':' || coalesce(md5(string_agg(t::text, ',' order by t::text)), '') d from ${sql.table(table)} t`.execute(db)).rows[0]!.d])));
  const adapter = await loadAdapter();
  // Route the adapter's fetch into the app, as the browser would: same origin, the learner's cookie.
  const viaAdapter = async (learner: Learner, sessionId: string, kind: string, itemId: string, answer: number | string) => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const r = await app.inject({ method: init.method as 'POST', url: new URL(url).pathname, payload: init.body as string,
        headers: { ...(init.headers as Record<string, string>), origin: config.origin, 'sec-fetch-site': 'same-origin', cookie: learner.headers.cookie } });
      return new Response(r.body, { status: r.statusCode, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      const context = { sessionId, questionId: 'soal-menara', topicId: 'trigonometri', hintOpened: false, diagnosisRunId: null };
      const result = await adapter!(context, `${itemId}-${Date.now()}`, kind, itemId, answer, () => { throw new Error('fallback must not be used'); });
      assert.equal(result.source, 'backend', 'the frontend validator accepted the facade response');
      return result.data;
    } finally { globalThis.fetch = original; }
  };
  const oracle = { skip: !adapter && `no Vue checkout at ${FRONTEND} (set FRONTEND_DIR); the frontend validator oracle cannot run` };

  try {
    await t.test('setup: catalog', async () => {
      await migrate(db); await rollbackTo(db, '0001_slice0.up.sql'); await migrate(db);
      await publish(db, fixture);
    });

    await t.test('off by default; only FEATURE_LEGACY_FACADE can be enabled; guests and unconsented learners are not served', async () => {
      const learner = await consentedLearner(db, config);
      const disabled = await raw(off, learner, { sessionId: 's1', kind: 'practice', itemId: 'tan60-sin30', answer: 0 });
      assert.deepEqual([disabled.statusCode, disabled.json().code], [403, 'FEATURE_DISABLED']);
      assert.throws(() => readConfig({ ...env, FEATURE_AI_DIAGNOSIS: 'true' }));
      assert.equal(readConfig({ ...env, FEATURE_LEGACY_FACADE: 'true' }).features.legacyFacade, true);
      assert.equal((await app.inject({ method: 'GET', url: '/health/ready' })).json().features.legacyFacade, true);
      const before = await state();
      for (const who of [null, await consentedLearner(db, config, { consent: false })]) {
        const r = await raw(app, who, { sessionId: 's1', kind: 'practice', itemId: 'tan60-sin30', answer: 0 });
        assert.deepEqual([r.statusCode, r.json().code, r.headers.deprecation], [403, 'FEATURE_DISABLED', 'true'], 'CONSENT_FIRST (09 §6.1 rule 4)');
      }
      // Compensating CSRF checks (rule 3): exact Origin and same-origin fetch metadata, JSON only.
      assert.equal((await raw(app, learner, { sessionId: 's1', kind: 'practice', itemId: 'tan60-sin30', answer: 0 }, { origin: 'https://evil.example' })).json().code, 'CSRF_FAILED');
      assert.equal((await raw(app, learner, { sessionId: 's1', kind: 'practice', itemId: 'tan60-sin30', answer: 0 }, { 'sec-fetch-site': 'cross-site' })).json().code, 'CSRF_FAILED');
      assert.deepEqual(await state(), before, 'nothing written for refused callers');
    });

    await t.test('practice (PracticeRunView, StepLatihan): graded on the server, judged by the frontend validator', oracle, async () => {
      const learner = await consentedLearner(db, config);
      const first = await viaAdapter(learner, 'client-1', 'practice', 'tan60-sin30', keyIndex('MAT.TRI.Q.TAN60_SIN30'));
      assert.deepEqual(first, { correct: true, feedback: feedback('MAT.TRI.Q.TAN60_SIN30', true), correctOptionIndex: keyIndex('MAT.TRI.Q.TAN60_SIN30') });
      const wrongIndex = (keyIndex('MAT.TRI.Q.TANGGA_6M') + 1) % order('MAT.TRI.Q.TANGGA_6M').length;
      const second = await viaAdapter(learner, 'client-1', 'practice', 'tangga-6m', wrongIndex);
      assert.deepEqual(second, { correct: false, feedback: feedback('MAT.TRI.Q.TANGGA_6M', false), correctOptionIndex: keyIndex('MAT.TRI.Q.TANGGA_6M') });
      // Funnel practice lives in its own canonical session under the same client session id.
      const p1 = await viaAdapter(learner, 'client-1', 'practice', 'p1', keyIndex('MAT.TRI.Q.FUNNEL_P1'));
      assert.equal(p1.correct, true);
      const sessions = (await sql<{ legacy_client_session_id: string; origin: string; n: string }>`select s.legacy_client_session_id, s.origin,
          (select count(*) from question_attempt a where a.session_id = s.id) n from learning_session s where learner_id = ${learner.learnerId} order by legacy_client_session_id`.execute(db)).rows;
      assert.deepEqual(sessions.map(s => [s.legacy_client_session_id, s.origin, s.n]), [['client-1:practice:MAT.S.BANK', 'BANK', '2'], ['client-1:practice:MAT.TRI.S.FUNNEL_PRACTICE', 'BANK', '1']]);
      const evidence = await sql<{ n: string }>`select count(*) n from concept_evidence where learner_id = ${learner.learnerId} and mastery_eligible`.execute(db);
      assert.ok(Number(evidence.rows[0]!.n) > 0, 'facade answers produce the same evidence as canonical ones');
      // Server order holds: an item further down the set is refused, never reached by silent skips.
      const ahead = await raw(app, learner, { sessionId: 'client-1', kind: 'practice', itemId: 'gab-3x-sin', answer: 0 });
      assert.deepEqual([ahead.statusCode, ahead.json().code], [409, 'INVALID_STATE_TRANSITION']);
    });

    await t.test('lessons (CoreView): implied lesson commands, then lesson practice', oracle, async () => {
      const learner = await consentedLearner(db, config);
      const check = (i: number) => `MAT.TRI.Q.SUDUT_ISTIMEWA_C${i}`;
      for (let i = 0; i < 3; i++) {
        const r = await viaAdapter(learner, 'client-2', 'check', `core:sudut-istimewa:c${i}`, keyIndex(check(i)));
        assert.deepEqual([r.correct, r.correctOptionIndex], [true, keyIndex(check(i))]);
      }
      const practice = await viaAdapter(learner, 'client-2', 'check', 'core:sudut-istimewa:q0', keyIndex('MAT.TRI.Q.SUDUT_ISTIMEWA_P0'));
      assert.equal(practice.correct, true);
      const s = (await sql<{ state: string; lesson: string; kinds: string[] }>`select s.state, (select status from lesson_assignment where session_id = s.id) as lesson,
          (select array_agg(kind order by ordinal) from question_attempt where session_id = s.id) as kinds
        from learning_session s where learner_id = ${learner.learnerId}`.execute(db)).rows;
      assert.deepEqual(s, [{ state: 'PRACTICING', lesson: 'COMPLETED', kinds: ['QUICK_CHECK', 'QUICK_CHECK', 'QUICK_CHECK', 'TRANSFER'] }],
        'implied ADVANCE_LESSON per check, then an implied FINISH_LESSON');
      const late = await raw(app, learner, { sessionId: 'client-2', kind: 'check', itemId: 'core:sudut-istimewa:c0', answer: 0 });
      assert.equal(late.statusCode, 409, 'a check after the lesson is over is refused');
    });

    await t.test('derived idempotency: a retried call replays; unreadable keeps the item; refusals and gaps', async () => {
      const learner = await consentedLearner(db, config);
      const body = { sessionId: 'client-3', kind: 'practice', itemId: 'p1', answer: keyIndex('MAT.TRI.Q.FUNNEL_P1') };
      const first = await raw(app, learner, body), retry = await raw(app, learner, body);
      assert.deepEqual([retry.statusCode, retry.headers['idempotency-replayed'], retry.json()], [200, 'true', first.json()], 'the changing attemptId is ignored (rule 5)');
      assert.equal((await sql<{ n: string }>`select count(*) n from question_attempt where learner_id = ${learner.learnerId}`.execute(db)).rows[0]!.n, '1');
      const unreadable = await raw(app, learner, { ...body, itemId: 'p2', answer: 9 });
      assert.deepEqual(unreadable.json(), { correct: null, unreadable: true });
      const after = await raw(app, learner, { ...body, itemId: 'p2', answer: keyIndex('MAT.TRI.Q.FUNNEL_P2') });
      assert.equal(after.json().correct, true, 'an unreadable answer does not consume the item (INV-16)');
      const lenient = await raw(app, learner, { ...body, itemId: 'p3', answer: keyIndex('MAT.TRI.Q.FUNNEL_P3'), somethingNew: { nested: true } });
      assert.equal(lenient.statusCode, 200, 'lenient input: unknown fields are ignored (rule 7)');
      // The set is complete. An identical repeat replays (indistinguishable from a lost-response retry, by design);
      // a different answer is a new command, and the same client session practises the set in a fresh canonical session.
      const identical = await raw(app, learner, { ...body, extra: 1 });
      assert.deepEqual([identical.headers['idempotency-replayed'], identical.json()], ['true', first.json()]);
      const wrongP1 = (keyIndex('MAT.TRI.Q.FUNNEL_P1') + 1) % order('MAT.TRI.Q.FUNNEL_P1').length;
      const again = await raw(app, learner, { ...body, answer: wrongP1 });
      assert.deepEqual([again.statusCode, again.json().correct], [200, false]);
      const sessions = (await sql<{ state: string; legacy: string | null }>`select state, legacy_client_session_id as legacy from learning_session
        where learner_id = ${learner.learnerId} order by started_at`.execute(db)).rows;
      assert.deepEqual(sessions, [{ state: 'COMPLETED', legacy: null }, { state: 'PRACTICING', legacy: 'client-3:practice:MAT.TRI.S.FUNNEL_PRACTICE' }]);
      const before = await state();
      const gaps: [object, number, string][] = [
        [{ ...body, kind: 'check', itemId: 'c1', answer: 1 }, 409, 'CONTENT_UNAVAILABLE'],        // funnel lesson: Slice 2
        [{ ...body, kind: 'retry_original', itemId: 'soal-menara', answer: '20√3' }, 403, 'FEATURE_DISABLED'],
        [{ ...body, itemId: 'not-an-item' }, 404, 'NOT_FOUND'],
      ];
      for (const [b, status, code] of gaps) { const r = await raw(app, learner, b); assert.deepEqual([r.statusCode, r.json().code], [status, code], JSON.stringify(b)); }
      await sql`update consent_record set status = 'REVOKED', revoked_at = now() where learner_id = ${learner.learnerId}`.execute(db);
      const revoked = await raw(app, learner, { ...body, itemId: 'p2', answer: 0 });
      assert.deepEqual([revoked.statusCode, revoked.json().code], [403, 'FEATURE_DISABLED']);
      assert.deepEqual(await state(), before, 'refusals write nothing');
    });
  } finally { await app.close(); await off.close(); await db.destroy(); }
});
