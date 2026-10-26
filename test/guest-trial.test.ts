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
import { diagnosisTick } from '../src/learning/diagnosis-worker.js';
import { sweep, workerTick } from '../src/privacy/erasure.js';
import type { DiagnosisEngine, EngineInput } from '../src/assessment/diagnosis.js';
import { rollbackTo } from './fixtures/db.js';
import { reviewedFixture } from './fixtures/catalog.js';
import { client, consentedLearner } from './fixtures/learner.js';

/*
 * /coba untuk semua orang (FEATURE_GUEST_TRIAL, migrasi 0011): pengunjung tanpa sesi mendapat akun percobaan 24 jam,
 * lalu dinilai server persis seperti siswa: aturan inline, dan jawaban yang tidak tercakup aturan masuk antrean AI
 * (di sini engine palsu khusus tes, bukan DeepSeek sungguhan). Yang dibuktikan: fitur mati = 403 tanpa tulisan;
 * akun dan sesi percobaan berakhir bersama; akun sungguhan tidak pernah diganti; tamu menjalani loop kanonik dan
 * antrean AI; akun percobaan yang habis dihapus lewat erasure biasa.
 */
class FakeEngine implements DiagnosisEngine {
  readonly testOnly = true as const; readonly name = 'fake (tests only)';
  steps: ((input: EngineInput) => Promise<unknown>)[] = [];
  calls = 0;
  async diagnose(input: EngineInput) { this.calls++; const step = this.steps.shift(); if (!step) throw new Error('no scripted step'); return step(input); }
}
const span = (text: string, quote: string) => { const start = text.indexOf(quote); return { kind: 'SPAN', start, end: start + quote.length, quote }; };

test('guest trial accounts for /coba', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig({ ...env, FEATURE_GUEST_TRIAL: 'true', FEATURE_LEGACY_FACADE: 'true' });
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  const engine = new FakeEngine();
  const quiet = () => new Writable({ write(_c, _e, done) { done(); } });
  const { app } = await buildApp(config, { db, diagnosisEngine: engine, logStream: quiet() });
  const { app: off } = await buildApp(readConfig({ ...env, FEATURE_LEGACY_FACADE: 'true' }), { db, logStream: quiet() });
  const guestPost = (target: typeof app, headers: Record<string, string> = {}) =>
    target.inject({ method: 'POST', url: '/v1/auth/guest', headers: { origin: config.origin, 'content-type': 'application/json', ...headers }, payload: '{}' });
  const cookieOf = (r: { headers: Record<string, unknown> }) => String(r.headers['set-cookie'] ?? '').split(';')[0]!;
  const count = async (table: string) => Number((await sql<{ n: string }>`select count(*) n from ${sql.table(table)}`.execute(db)).rows[0]!.n);
  /** A guest: their cookie and CSRF token, as the browser would hold them. */
  const startGuest = async () => {
    const r = await guestPost(app);
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json(), { guest: true });
    const cookie = cookieOf(r);
    const session = (await app.inject({ method: 'GET', url: '/v1/auth/session', headers: { cookie } })).json();
    return { cookie, session, headers: { cookie, 'x-csrf-token': session.csrfToken as string } };
  };
  let menara = '';

  try {
    await t.test('setup: catalog', async () => {
      await migrate(db); await rollbackTo(db, '0001_slice0.up.sql'); await migrate(db);
      await publish(db, reviewedFixture());
      menara = (await sql<{ id: string }>`select id from question where code = 'MAT.TRI.Q.SOAL_MENARA'`.execute(db)).rows[0]!.id;
    });

    await t.test('off by default: 403 FEATURE_DISABLED and nothing is created', async () => {
      const before = [await count('app_user'), await count('learner'), await count('auth_session')];
      const r = await guestPost(off);
      assert.deepEqual([r.statusCode, r.json().code, r.headers['set-cookie']], [403, 'FEATURE_DISABLED', undefined]);
      assert.deepEqual([await count('app_user'), await count('learner'), await count('auth_session')], before);
    });

    await t.test('a visitor gets a 24-hour trial: active learner, the /coba purposes, a session that ends with it, guest: true', async () => {
      const g = await startGuest();
      assert.match(g.cookie, /^__Host-ib_session=[A-Za-z0-9_-]{43}$/);
      assert.equal(g.session.authenticated, true);
      assert.equal(g.session.guest, true);
      assert.deepEqual([g.session.user.role, g.session.learner.status, g.session.learner.missingPurposes], ['STUDENT', 'ACTIVE', []]);
      const row = (await sql<{ trial: Date; absolute: Date; idle: Date }>`select u.trial_expires_at trial, s.absolute_expires_at absolute, s.idle_expires_at idle
        from app_user u join auth_session s on s.user_id = u.id where u.learner_id = ${g.session.learner.id}`.execute(db)).rows[0]!;
      const hours = (d: Date) => (d.getTime() - Date.now()) / 3600000;
      assert.ok(hours(row.trial) > 23.9 && hours(row.trial) <= 24, 'the trial lasts 24 hours');
      assert.ok(hours(row.absolute) <= 24 && hours(row.idle) <= 24, 'the session never outlives the trial');
      const consents = (await sql<{ purpose: string; method: string; status: string; guardian_id: string | null }>`select purpose, method, status, guardian_id
        from consent_record where learner_id = ${g.session.learner.id} order by purpose`.execute(db)).rows;
      assert.deepEqual(consents.map(c => [c.purpose, c.method, c.status, c.guardian_id]),
        [['AI_PROCESSING', 'GUEST_TRIAL', 'GRANTED', null], ['IMAGE_UPLOAD', 'GUEST_TRIAL', 'GRANTED', null], ['LEARNING_DATA', 'GUEST_TRIAL', 'GRANTED', null]]);
      // Asking again with the trial cookie creates nothing new.
      const before = await count('app_user');
      const again = await guestPost(app, { cookie: g.cookie });
      assert.deepEqual([again.statusCode, again.json(), again.headers['set-cookie'], await count('app_user')], [200, { guest: true }, undefined, before]);
    });

    await t.test('a real account is never replaced by a trial, and has no guest flag', async () => {
      const learner = await consentedLearner(db, config);
      const before = await count('app_user');
      const r = await guestPost(app, learner.headers);
      assert.deepEqual([r.statusCode, r.json(), r.headers['set-cookie'], await count('app_user')], [200, { guest: false }, undefined, before]);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/auth/session', headers: learner.headers })).json().guest, undefined);
    });

    await t.test('the trial needs the exact Origin, like every auth call', async () => {
      const r = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, payload: '{}' });
      assert.deepEqual([r.statusCode, r.json().code, r.headers['set-cookie']], [403, 'CSRF_FAILED', undefined]);
    });

    await t.test('a guest is graded by the server on the canonical loop, and the legacy /coba calls serve them', async () => {
      const g = await startGuest();
      const call = client(app, config, { learnerId: g.session.learner.id, headers: g.headers } as Parameters<typeof client>[2]);
      const s = (await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: menara })).body;
      const r = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: s.stateVersion, response: { responseType: 'TEXT', text: 'sin 30 = 20/x' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.deepEqual([r.body.diagnosisRun.status, r.body.attempt.verdict, r.body.session.state], ['COMPLETED', 'INCORRECT', 'DIAGNOSIS_READY']);
      // The shipped /coba adapter (legacy facade L1) serves the trial account too: it is a consented STUDENT.
      const legacy = await app.inject({ method: 'POST', url: '/v1/learning/diagnosis', headers: { ...g.headers, origin: config.origin, 'content-type': 'application/json' },
        payload: JSON.stringify({ sessionId: 'coba-' + Date.now(), questionId: 'soal-menara', topicId: 'trigonometri', hintOpened: false, responseMode: null, rawText: 'tan 30 = 20/x, x = 20√3' }) });
      assert.equal(legacy.statusCode, 200, legacy.body);
      assert.equal(legacy.json().status, 'completed');
    });

    await t.test('an answer the rules do not cover is queued for AI and adopted (the DeepSeek path, with a fake engine)', async () => {
      const g = await startGuest();
      const call = client(app, config, { learnerId: g.session.learner.id, headers: g.headers } as Parameters<typeof client>[2]);
      const s = (await call('POST', '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: menara })).body;
      const working = 'tan itu samping dibagi depan';
      const r = await call('POST', `/v1/learning-sessions/${s.id}/attempts`, { expectedStateVersion: s.stateVersion, response: { responseType: 'TEXT', text: working } });
      assert.deepEqual([r.status, r.body.diagnosisRun.status, r.body.diagnosisRun.engine, r.body.session.state], [201, 'QUEUED', 'AI_ASSISTED', 'DIAGNOSING'],
        'AI_PROCESSING comes with the trial, so the run is queued for the engine');
      engine.steps.push(async () => ({ schemaVersion: 1, verdict: 'INCORRECT', concepts: [
        { conceptCode: 'MAT.TRI.DEFINISI_SIN_COS_TAN', classification: 'MISCONCEPTION_EVIDENCED', misconceptionCode: 'PERSAMAAN_TERBALIK', rationale: 'Perbandingannya terbalik.',
          refs: [span(working, 'samping dibagi depan')], confidence: 0.9 }] }));
      assert.equal(await diagnosisTick(db, engine), 'adopted');
      const run = (await call('GET', `/v1/diagnosis-runs/${r.body.diagnosisRun.id}`)).body;
      assert.deepEqual([run.status, run.verdict, run.aiAssisted, run.session.state], ['COMPLETED', 'INCORRECT', true, 'DIAGNOSIS_READY']);
    });

    await t.test('an expired trial is erased by the usual erasure; its session stops working at once', async () => {
      const g = await startGuest();
      const id = g.session.learner.id as string;
      await sql`update app_user set trial_expires_at = now() - interval '1 second' where learner_id = ${id}`.execute(db);
      // The sweep alone first: the deletion is requested by SYSTEM for TRIAL_EXPIRED, and the session ends with it.
      await db.transaction().execute(tx => sweep(tx, config));
      const request = (await sql<{ reason: string; requested_by: string }>`select reason, requested_by from deletion_request where learner_id = ${id}`.execute(db)).rows;
      assert.deepEqual(request.map(r => [r.reason, r.requested_by]), [['TRIAL_EXPIRED', 'SYSTEM']]);
      await db.transaction().execute(tx => sweep(tx, config));
      assert.equal((await sql`select id from deletion_request where learner_id = ${id}`.execute(db)).rows.length, 1, 'a second sweep does not request it again');
      for (let i = 0; i < 5 && (await sql`select id from learner where id = ${id}`.execute(db)).rows.length; i++) await workerTick(db, config);
      assert.equal((await sql`select id from learner where id = ${id}`.execute(db)).rows.length, 0, 'learner erased');
      assert.equal((await sql`select id from app_user where learner_id = ${id}`.execute(db)).rows.length, 0, 'account erased');
      assert.equal((await sql`select id from consent_record where learner_id = ${id}`.execute(db)).rows.length, 0, 'consents erased');
      const session = (await app.inject({ method: 'GET', url: '/v1/auth/session', headers: { cookie: g.cookie } })).json();
      assert.equal(session.authenticated, false);
      // A tick with nothing expired leaves live trials alone.
      const live = await startGuest();
      await workerTick(db, config);
      assert.equal((await sql`select id from learner where id = ${live.session.learner.id} and status = 'ACTIVE'`.execute(db)).rows.length, 1);
    });
  } finally {
    await app.close(); await off.close(); await db.destroy();
  }
});
