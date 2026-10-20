import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Writable } from 'node:stream';
import { build } from 'esbuild';
import { sql } from 'kysely';
import fc from 'fast-check';
import type { FastifyInstance } from 'fastify';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { buildApp } from '../src/app.js';
import { publish } from '../src/catalog/publisher.js';
import { detect } from '../src/catalog/intake-map.js';
import { legacyRun } from '../src/learning/facade-loop.js';
import { learningService } from '../src/learning/service.js';
import { diagnosisTick } from '../src/learning/diagnosis-worker.js';
import type { DiagnosisEngine, EngineInput } from '../src/assessment/diagnosis.js';
import { rollbackTo } from './fixtures/db.js';
import { reviewedFixture } from './fixtures/catalog.js';
import { consentedLearner, type Learner } from './fixtures/learner.js';
// Slice 2 M7: legacy facade L1, L2, L4, L8 over the question loop (09 §6). The oracle is the shipped frontend itself:
// diagnosisRunWithBackend, solutionWithBackend and mapQuestionWithBackend are bundled from the Vue checkout and pointed at
// this app, so their own validators (isRun, isSolution, isMap) judge every response. Fallback is off outside demo mode,
// so a rejected shape throws. L3's funnel checks (D3) and L6 (D6) are not served.

const FRONTEND = resolve(process.env.FRONTEND_DIR ?? '../mockup/intibelajar');
type Adapter = {
  diagnosisRunWithBackend: (context: object, responseMode: 'know' | 'blank' | null, rawText: string, onRun: (run: unknown) => void, resumeId?: string | null) =>
    Promise<{ data: LegacyRun; source: string }>;
  solutionWithBackend: (context: object, reason: string, fallback: () => unknown) => Promise<{ data: { steps: { title: string; body: string }[]; after: string[] }; source: string }>;
};
type Intake = { mapQuestionWithBackend: (context: object, text: string) => Promise<{ data: { subject: string | null; topicId: string | null; cores: string[]; demo?: boolean }; source: string }>;
  detectLocally: (text: string) => { subject: string | null; topicId: string | null; cores: string[]; demo?: boolean } };
type LegacyRun = { diagnosisRunId: string; status: string; clarification?: string;
  assessment?: { tone: string; title: string; gap: { label: string; name: string; reason: string; coreId: string; mapId: string } | null; okName: string | null;
    next: { core: string; reason: string; formula: string; coreId: string; mapId: string } };
  items?: { id: string; state: string; reason: string }[] };

async function bundle<T>(entry: string): Promise<T | null> {
  if (!existsSync(join(FRONTEND, entry))) return null;
  const out = await build({ entryPoints: [join(FRONTEND, entry)], bundle: true, platform: 'node', format: 'esm', write: false, alias: { '@': join(FRONTEND, 'src') }, logLevel: 'silent' });
  const dir = mkdtempSync(join(tmpdir(), 'ib-adapter-'));
  try { const file = join(dir, 'adapter.mjs'); writeFileSync(file, out.outputFiles[0]!.text); return await import(pathToFileURL(file).href) as T; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

class FakeEngine implements DiagnosisEngine {
  readonly testOnly = true as const; readonly name = 'fake (tests only)';
  steps: ((input: EngineInput) => Promise<unknown>)[] = [];
  async diagnose(input: EngineInput) { const s = this.steps.shift(); if (!s) throw new Error('no scripted step'); return s(input); }
}

test('Slice 2 legacy facade L1, L2, L4, L8 over the question loop', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig({ ...env, FEATURE_LEGACY_FACADE: 'true' });
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  let logs = '';
  const engine = new FakeEngine();
  const { app } = await buildApp(config, { db, diagnosisEngine: engine, logStream: new Writable({ write(c, _e, done) { logs += c.toString(); done(); } }) });
  const { app: off } = await buildApp(readConfig(env), { db, logStream: new Writable({ write(_c, _e, done) { done(); } }) });
  const adapter = await bundle<Adapter>('src/services/learningBackend.ts');
  const intake = await bundle<Intake>('src/services/intake.ts');
  const oracle = { skip: !(adapter && intake) && `no Vue checkout at ${FRONTEND} (set FRONTEND_DIR); the frontend validator oracle cannot run` };
  const tables = ['learning_session', 'question_attempt', 'assistance_event', 'diagnosis_run', 'concept_evidence', 'idempotency_record', 'lesson_assignment'];
  const state = async () => Object.fromEntries(await Promise.all(tables.map(async table =>
    [table, (await sql<{ d: string }>`select count(*) || ':' || coalesce(md5(string_agg(t::text, ',' order by t::text)), '') d from ${sql.table(table)} t`.execute(db)).rows[0]!.d])));
  const context = (sessionId: string, extra: object = {}) => ({ sessionId, questionId: 'soal-menara', topicId: 'trigonometri', hintOpened: false, diagnosisRunId: null, ...extra });
  // The shipped client's request: FlowContext spread in, no CSRF token, no Idempotency-Key.
  const raw = (target: FastifyInstance, learner: Learner | null, method: 'GET' | 'POST', url: string, body?: object) => target.inject({ method, url,
    ...(body ? { payload: JSON.stringify(body) } : {}),
    headers: { ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), origin: config.origin, 'sec-fetch-site': 'same-origin', ...(learner ? { cookie: learner.headers.cookie } : {}) } });
  /** Route the adapters' fetch into the app as the browser would; `onPoll` runs before each GET (the worker). */
  const via = async <T>(learner: Learner, run: () => Promise<T>, onPoll?: () => Promise<void>) => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      if ((init.method ?? 'GET') === 'GET' && onPoll) await onPoll();
      const r = await app.inject({ method: (init.method ?? 'GET') as 'GET' | 'POST', url: new URL(url).pathname, ...(init.body ? { payload: init.body as string } : {}),
        headers: { ...(init.headers as Record<string, string>), origin: config.origin, 'sec-fetch-site': 'same-origin', cookie: learner.headers.cookie } });
      return new Response(r.body, { status: r.statusCode, headers: { 'content-type': 'application/json', ...(r.headers['retry-after'] ? { 'retry-after': String(r.headers['retry-after']) } : {}) } });
    }) as typeof fetch;
    try { return await run(); } finally { globalThis.fetch = original; }
  };
  const diagnose = async (learner: Learner, sessionId: string, mode: 'know' | 'blank' | null, text: string, extra: object = {}, onPoll?: () => Promise<void>) => {
    const runs: unknown[] = [];
    const r = await via(learner, () => adapter!.diagnosisRunWithBackend(context(sessionId, extra), mode, text, run => runs.push(run)), onPoll);
    assert.equal(r.source, 'backend', 'the frontend validator accepted the facade response');
    return { run: r.data, runs };
  };
  const loopOf = async (learnerId: string, sessionId: string) => (await sql<{ id: string; state: string; outcome: string | null }>`select id, state, outcome from learning_session
    where learner_id = ${learnerId} and legacy_client_session_id = ${sessionId + ':loop:soal-menara'}`.execute(db)).rows[0];

  try {
    await t.test('setup: catalog', async () => {
      await migrate(db); await rollbackTo(db, '0001_slice0.up.sql'); await migrate(db);
      await publish(db, reviewedFixture());
    });

    await t.test('off by default; L7 stays closed; guests, unconsented learners and own questions are not served, with zero writes', async () => {
      const learner = await consentedLearner(db, config);
      for (const [method, url, body] of [['POST', '/v1/learning/diagnosis', { ...context('s-off'), responseMode: null, rawText: '34,6' }], ['GET', '/v1/learning/diagnosis/01920000-0000-7000-8000-000000000000', undefined],
        ['POST', '/v1/learning/solution', { ...context('s-off'), reason: 'requested' }], ['POST', '/v1/learning/intake/map', { ...context('s-off'), questionText: 'tan 30' }]] as const)
        assert.equal((await raw(off, learner, method, url, body)).json().code, 'FEATURE_DISABLED', `${url} is off without the flag`);
      assert.equal((await raw(off,learner,'POST','/v1/learning/tutor',{...context('s'),messages:[],hintsUsed:0})).json().code,'FEATURE_DISABLED');
      assert.equal((await raw(app,learner,'POST','/v1/learning/tutor',{...context('s'),messages:[],hintsUsed:0})).json().code,'VALIDATION_FAILED','D6 is enabled but malformed input still fails');
      assert.equal((await raw(app,learner,'POST','/v1/learning/intake/read',{...context('s'),imageDataUrl:'data:,'})).json().code,'FEATURE_DISABLED');
      const before = await state();
      const guest = await raw(app, null, 'POST', '/v1/learning/diagnosis', { ...context('s-guest'), responseMode: null, rawText: 'sin 30 = 20/x' });
      assert.deepEqual([guest.statusCode, guest.json().code], [403, 'FEATURE_DISABLED']);
      const pending = await consentedLearner(db, config, { consent: false });
      assert.equal((await raw(app, pending, 'POST', '/v1/learning/diagnosis', { ...context('s-pending'), responseMode: null, rawText: 'sin 30 = 20/x' })).json().code, 'FEATURE_DISABLED', 'CONSENT_FIRST');
      assert.equal((await raw(app, pending, 'POST', '/v1/learning/intake/map', { ...context('s-pending'), questionText: 'tan 30' })).json().code, 'FEATURE_DISABLED');
      const own = await raw(app, learner, 'POST', '/v1/learning/diagnosis', { ...context('s-own'), questionId: 'own:abc', questionText: 'Sebuah tangga…', coreIds: ['tri-d'], responseMode: null, rawText: 'sin 60 = t/5' });
      assert.deepEqual([own.statusCode, own.json().code], [403, 'FEATURE_DISABLED'], 'own questions need intake (Slice 6)');
      assert.deepEqual(await state(), before, 'nothing written for refused calls');
      const r = await raw(app, learner, 'POST', '/v1/learning/diagnosis', { ...context('s-dep'), responseMode: null, rawText: 'sin 30 = 20/x' });
      assert.deepEqual([r.statusCode, r.headers.deprecation], [200, 'true']);
    });

    await t.test('L1 (oracle isRun): a misconception maps to the legacy gap, next and items (09 §6.3); a network retry replays', { ...oracle }, async () => {
      const learner = await consentedLearner(db, config);
      const { run } = await diagnose(learner, 'sess-sin', null, 'sin 30 = 20/x');
      assert.equal(run.status, 'completed');
      assert.deepEqual([run.assessment!.tone, run.assessment!.okName, run.assessment!.gap!.mapId, run.assessment!.gap!.coreId, run.assessment!.gap!.label],
        ['gap', null, 'tri-d', '', 'Core belum kuat']);
      assert.deepEqual([run.assessment!.next.mapId, run.assessment!.next.coreId, run.assessment!.next.formula], ['tri-d', '', 'tan 30° = 20 / x']);
      assert.deepEqual(run.items!.map(i => [i.id, i.state]), [['tri-c', 'ok'], ['tri-d', 'gap'], ['tri-f', 'rest']]);
      const loop = (await loopOf(learner.learnerId, 'sess-sin'))!;
      assert.equal(loop.state, 'DIAGNOSIS_READY');
      // Rule 5: the same call again (a dropped response) replays: one attempt, the same run.
      const again = await raw(app, learner, 'POST', '/v1/learning/diagnosis', { ...context('sess-sin'), responseMode: null, rawText: 'sin 30 = 20/x' });
      assert.deepEqual([again.json().diagnosisRunId, again.headers['idempotency-replayed']], [run.diagnosisRunId, 'true']);
      assert.equal((await sql<{ n: string }>`select count(*) n from question_attempt where session_id = ${loop.id}`.execute(db)).rows[0]!.n, '1');
    });

    await t.test('L1: correct, bare wrong value (T01-3), self-reports; all accepted by the shipped validator', { ...oracle }, async () => {
      const learner = await consentedLearner(db, config);
      const right = (await diagnose(learner, 'sess-right', null, 'tan 30 = 20/x, x = 20√3')).run;
      assert.deepEqual([right.status, right.assessment!.tone, right.assessment!.gap, typeof right.assessment!.okName], ['completed', 'kuat', null, 'string']);
      assert.ok(right.items!.every(i => i.state === 'ok'));
      assert.equal((await loopOf(learner.learnerId, 'sess-right'))!.outcome, 'SOLVED_FIRST_TRY');
      const forty = (await diagnose(learner, 'sess-40', null, '40')).run;
      assert.deepEqual([forty.status, typeof forty.clarification], ['insufficient_evidence', 'string'], 'T01-3: no gap is invented');
      const blank = (await diagnose(learner, 'sess-blank', 'blank', '')).run;
      const know = (await diagnose(learner, 'sess-know', 'know', '')).run;
      assert.deepEqual([blank.status, know.status, know.clarification], ['insufficient_evidence', 'insufficient_evidence', 'Tulis rumus atau langkah pertamamu.'],
        '"Saya tahu caranya" is a self-report, never a pass (09 §6.5)');
      assert.equal((await loopOf(learner.learnerId, 'sess-blank'))!.state, 'DIAGNOSIS_READY');
      assert.equal((await raw(app, learner, 'POST', '/v1/learning/diagnosis', { ...context('sess-empty'), responseMode: null, rawText: '   ' })).statusCode, 400);
    });

    await t.test('09 §6.1 rule 5: a network retry replays, but the same text after the state moved on is a new command', async () => {
      const learner = await consentedLearner(db, config);
      const post = (text: string) => raw(app, learner, 'POST', '/v1/learning/diagnosis', { ...context('sess-idem'), responseMode: null, rawText: text });
      const attempts = async () => (await sql<{ kind: string }>`select a.kind from question_attempt a join learning_session s on s.id = a.session_id
        where s.learner_id = ${learner.learnerId} order by a.ordinal`.execute(db)).rows.map(r => r.kind);
      const first = await post('saya bingung');                 // INITIAL → CLARIFICATION_NEEDED
      const retry = await post('saya bingung');                 // the same call again, nothing in between: a network retry
      assert.deepEqual([retry.headers['idempotency-replayed'], retry.json().diagnosisRunId], ['true', first.json().diagnosisRunId]);
      assert.deepEqual(await attempts(), ['INITIAL']);
      await post('tan x');                                      // a clarification: the state moves on
      const again = await post('saya bingung');                 // the same text as the first call, in a new state: a new command
      assert.equal(again.headers['idempotency-replayed'], undefined, 'not a replay of the first response');
      assert.notEqual(again.json().diagnosisRunId, first.json().diagnosisRunId);
      assert.deepEqual(await attempts(), ['INITIAL', 'CLARIFICATION', 'CLARIFICATION']);
      assert.equal((await loopOf(learner.learnerId, 'sess-idem'))!.state, 'DIAGNOSIS_READY', 'E-06 after the second clarification');
    });

    await t.test('L1 rule 6: "Coba soal tadi lagi" after a diagnosis implies START_RETRY and verifies; hintOpened is recorded conservatively', { ...oracle }, async () => {
      const learner = await consentedLearner(db, config);
      await diagnose(learner, 'sess-retry', null, 'sin 30 = 20/x', { hintOpened: true });
      const loop = (await loopOf(learner.learnerId, 'sess-retry'))!;
      const hints = (await sql<{ source: string }>`select source from assistance_event where session_id = ${loop.id} and type = 'HINT_SHOWN'`.execute(db)).rows;
      assert.deepEqual(hints.map(h => h.source), ['CLIENT_REPORTED']);
      const retry = (await diagnose(learner, 'sess-retry', null, 'tan 30 = 20/x, x = 20√3', { hintOpened: true })).run;
      assert.deepEqual([retry.status, retry.assessment!.tone], ['completed', 'kuat']);
      const attempts = (await sql<{ kind: string; assistance: string }>`select kind, assistance from question_attempt where session_id = ${loop.id} order by ordinal`.execute(db)).rows;
      assert.deepEqual(attempts.map(a => [a.kind, a.assistance]), [['INITIAL', 'HINT'], ['RETRY', 'HINT']]);
      assert.deepEqual(Object.values((await loopOf(learner.learnerId, 'sess-retry'))!).slice(1), ['COMPLETED', 'SOLVED_AFTER_LEARNING']);
      assert.equal((await sql<{ n: string }>`select count(*) n from assistance_event where session_id = ${loop.id} and type = 'HINT_SHOWN'`.execute(db)).rows[0]!.n, '1', 'once per session');
    });

    await t.test('09 §6.3 as a unit: items follow curriculum order whatever the storage order; gap is the misconception, next the first recommendation', async () => {
      const learner = await consentedLearner(db, config), learning = learningService(config.key);
      await diagnose(learner, 'sess-unit', null, 'sin 30 = 20/x');
      const loop = (await loopOf(learner.learnerId, 'sess-unit'))!;
      const runId = (await sql<{ id: string }>`select d.id from diagnosis_run d join question_attempt a on a.id = d.attempt_id where a.session_id = ${loop.id}`.execute(db)).rows[0]!.id;
      const run = await learning.diagnosisRun(db, learner.learnerId, runId);
      // Synthetic variations of a real run (test data only): storage order reversed, and a first recommendation for another concept.
      const reversed = await legacyRun(db, learning, learner.learnerId, { ...run, evidence: [...run.evidence].reverse() }) as LegacyRun;
      assert.deepEqual(reversed.items!.map(i => i.id), ['tri-c', 'tri-d', 'tri-f']);
      const sides = run.evidence.find(e => e.legacyMapId === 'tri-c')!;
      const other = { conceptId: sides.conceptId, conceptCode: sides.conceptCode, legacyMapId: 'tri-c', conceptTitle: sides.conceptTitle, action: 'LEARN', lessonRouteSlug: 'sudut-depresi-elevasi',
        reason: 'Mulai dari menamai sisi.', estimatedMinutes: 3 };
      const mixed = await legacyRun(db, learning, learner.learnerId, { ...run, recommendations: [other, ...run.recommendations] }) as LegacyRun;
      assert.deepEqual([mixed.assessment!.gap!.mapId, mixed.assessment!.gap!.reason], ['tri-d', run.evidence.find(e => e.legacyMapId === 'tri-d')!.rationale]);
      assert.deepEqual([mixed.assessment!.next.mapId, mixed.assessment!.next.coreId, mixed.assessment!.next.reason], ['tri-c', 'sudut-depresi-elevasi', 'Mulai dari menamai sisi.']);
    });

    await t.test('L4 (oracle isSolution): in RETRY it ends the loop; after two wrong retries (max_tries) it reads; before the retry phase it is refused', { ...oracle }, async () => {
      const learner = await consentedLearner(db, config);
      const solution = (sessionId: string, reason: string) => via(learner, () => adapter!.solutionWithBackend(context(sessionId), reason, () => { throw new Error('fallback must not be used'); }));
      await diagnose(learner, 'sess-sol', null, 'sin 30 = 20/x');
      const before = await state();
      await assert.rejects(solution('sess-sol', 'requested'), /http_409/, 'not before the retry phase (05 §4.5)');
      assert.deepEqual(await state(), before);
      await assert.rejects(solution('sess-none', 'requested'), /http_404/);
      // Two wrong retries end the loop with the solution (E-19); max_tries then reads it.
      await diagnose(learner, 'sess-sol', null, '40');
      await diagnose(learner, 'sess-sol', null, 'tan 30 = x/20');
      assert.deepEqual(Object.values((await loopOf(learner.learnerId, 'sess-sol'))!).slice(1), ['COMPLETED', 'SOLUTION_REVIEWED']);
      const read = await solution('sess-sol', 'max_tries');
      assert.equal(read.source, 'backend');
      assert.ok(read.data.steps.length > 0 && read.data.after.length > 0);
      // In RETRY, "requested" ends the loop (E-21).
      await diagnose(learner, 'sess-sol2', null, 'cos 30 = 20/x');
      await diagnose(learner, 'sess-sol2', null, '40');
      assert.equal((await loopOf(learner.learnerId, 'sess-sol2'))!.state, 'RETRY');
      assert.equal((await solution('sess-sol2', 'requested')).source, 'backend');
      assert.deepEqual(Object.values((await loopOf(learner.learnerId, 'sess-sol2'))!).slice(1), ['COMPLETED', 'SOLUTION_REVIEWED']);
    });

    await t.test('L2 (oracle polling): a queued run is polled with Retry-After until adopted; foreign and device ids are not found', { ...oracle }, async () => {
      const learner = await consentedLearner(db, config, { purposes: ['LEARNING_DATA', 'AI_PROCESSING'] });
      const working = 'tan itu samping dibagi depan';
      engine.steps.push(async () => ({ schemaVersion: 1, verdict: 'INCORRECT', concepts: [{ conceptCode: 'MAT.TRI.DEFINISI_SIN_COS_TAN', classification: 'MISCONCEPTION_EVIDENCED',
        misconceptionCode: 'PERSAMAAN_TERBALIK', rationale: 'Perbandingannya terbalik.', refs: [{ kind: 'SPAN', start: working.indexOf('samping dibagi depan'), end: working.indexOf('samping dibagi depan') + 20, quote: 'samping dibagi depan' }], confidence: 0.9 }] }));
      let polls = 0;
      const { run, runs } = await diagnose(learner, 'sess-poll', null, working, {}, async () => { polls++; await diagnosisTick(db, engine); });
      assert.deepEqual([(runs[0] as LegacyRun).status, run.status, run.assessment!.gap!.mapId], ['pending', 'completed', 'tri-d']);
      assert.ok(polls >= 1, 'the adapter polled L2');
      const first = await raw(app, learner, 'GET', `/v1/learning/diagnosis/${run.diagnosisRunId}`);
      assert.deepEqual([first.statusCode, first.headers.deprecation, first.headers['retry-after']], [200, 'true', undefined], 'no Retry-After once completed');
      const other = await consentedLearner(db, config);
      assert.equal((await raw(app, other, 'GET', `/v1/learning/diagnosis/${run.diagnosisRunId}`)).statusCode, 404, 'owner only');
      assert.equal((await raw(app, learner, 'GET', '/v1/learning/diagnosis/demo-sess-poll')).statusCode, 404, 'device ids are not stored runs');
      // While pending, L1 and L2 both say when to poll again.
      const pendingPost = await raw(app, learner, 'POST', '/v1/learning/diagnosis', { ...context('sess-poll-2'), responseMode: null, rawText: 'pakai perbandingan saja' });
      assert.deepEqual([pendingPost.json().status, pendingPost.headers['retry-after']], ['pending', '2']);
      const pendingGet = await raw(app, learner, 'GET', `/v1/learning/diagnosis/${pendingPost.json().diagnosisRunId}`);
      assert.deepEqual([pendingGet.json().status, pendingGet.headers['retry-after']], ['pending', '2']);
    });

    await t.test('L8 (oracle isMap): the server port equals detectLocally on any text, demo false; nothing outside the frozen aliases', { ...oracle }, async () => {
      const learner = await consentedLearner(db, config);
      const vocabulary = ['sin', 'cos', 'tan', 'sudut', 'segitiga', 'tangga', 'menara', 'elevasi', 'depresi', '°', '30', '45', '60', '90', 'derajat', 'pangkat', 'eksponen',
        'logaritma', 'log', '²', '³', '^', '=', 'x', 'ˣ', 'tanpa', 'sinus', 'Berapa', 'tinggi', 'katalog', ' ', '2'];
      const texts = fc.array(fc.oneof(fc.constantFrom(...vocabulary), fc.string({ maxLength: 3 })), { minLength: 1, maxLength: 12 }).map(parts => parts.join(' ').slice(0, 300)).filter(s => s.trim().length > 0);
      fc.assert(fc.property(texts, text => { const { demo: _demo, ...local } = intake!.detectLocally(text); assert.deepEqual(detect(text), local, JSON.stringify(text)); }), { numRuns: 2000 });
      for (const text of ['Sebuah menara setinggi 20 m dilihat dengan sudut depresi 30°.', 'Hitung 2³ × cos 60°', 'Tentukan x jika 2^x = 8', 'Apa ibu kota Jakarta?']) {
        const r = await via(learner, () => intake!.mapQuestionWithBackend(context('sess-map'), text));
        assert.equal(r.source, 'backend');
        const { demo: _d, ...local } = intake!.detectLocally(text);
        assert.deepEqual(r.data, { ...local, demo: false }, text);
      }
      assert.ok(!logs.includes('ibu kota Jakarta'), 'question text never reaches the logs');
      // Rule 8: an id the current release does not carry is dropped, even though detectLocally would send it.
      const fixture = reviewedFixture(undefined, 2);
      const concept = fixture.topics.flatMap(x => x.concepts).find(c => c.aliases.some(a => a.ns === 'MAP' && a.value === 'tri-p'))!;
      concept.aliases = concept.aliases.filter(a => !(a.ns === 'MAP' && a.value === 'tri-p'));
      await publish(db, fixture);
      const text = 'Sebuah menara dilihat dengan sudut depresi 30°.';
      assert.ok(intake!.detectLocally(text).cores.includes('tri-p'));
      const mapped = (await raw(app, learner, 'POST', '/v1/learning/intake/map', { ...context('sess-map'), questionText: text })).json();
      assert.deepEqual(mapped, { subject: 'matematika', topicId: 'trigonometri', cores: ['tri-c', 'tri-d', 'tri-f'], demo: false });
    });
  } finally { await app.close(); await off.close(); await db.destroy(); }
});
