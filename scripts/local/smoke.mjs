import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Run against an already-running `local:dev`; never resets a database or changes real consent.
const origin = 'http://localhost:5180';
const frontend = resolve(process.env.FRONTEND_DIR ?? '../mockup/intibelajar');
const require = createRequire(join(frontend, 'package.json'));
const { chromium, expect: baseExpect } = require('@playwright/test');
const expect = baseExpect.configure({ timeout: 20000 });
const evidence = resolve(process.env.LOCAL_CHECK_OUTPUT ?? `.local/local-dev/check-${Date.now()}`);
mkdirSync(evidence, { recursive: true });
const results = [], contexts = [];
let browser;
const check = async (name, action) => {
  const started = Date.now();
  try { await action(); results.push({ name, ok: true, seconds: (Date.now() - started) / 1000 }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, ok: false, error: error.message, seconds: (Date.now() - started) / 1000 }); throw error; }
};
const auth = async page => (await page.request.get(origin + '/v1/auth/session')).json();
const request = async (page, url, body, options = {}) => page.request.post(origin + url, {
  headers: { origin, 'x-csrf-token': (await auth(page)).csrfToken, 'idempotency-key': randomUUID(), ...options }, data: body,
});
let contextA, pageA, loop, questionId;
try {
  browser = await chromium.launch({ headless: true });
  const persona = async name => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); contexts.push(context);
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    await page.goto(origin + '/__local');
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('#formula')).toBeVisible();
    return { context, page };
  };
  await check('readiness through frontend proxy and no live integrations', async () => {
    const r = await fetch(origin + '/v1/auth/session'); assert.equal(r.status, 200);
    const ready = await (await fetch('http://127.0.0.1:8000/health/ready')).json();
    assert.equal(ready.syntheticOnly, true); assert.equal(ready.features.aiDiagnosis, false); assert.equal(ready.features.aiTutor, false);
  });
  await check('fixture sign-in rejects cross-origin and invalid CSRF', async () => {
    const context = await browser.newContext(); contexts.push(context); const page = await context.newPage();
    await page.goto(origin + '/__local'); const csrf = await page.locator('input[name=csrf]').first().inputValue();
    const cross = await page.request.post(origin + '/__local/session', { headers: { origin: 'https://example.invalid' }, form: { persona: 'student', csrf } }); assert.equal(cross.status(), 403);
    const bad = await page.request.post(origin + '/__local/session', { headers: { origin }, form: { persona: 'student', csrf: 'bad' } }); assert.equal(bad.status(), 403);
    assert.equal((await auth(page)).authenticated, false);
  });
  await check('browser selects a synthetic consented account via same-origin form', async () => {
    ({ context: contextA, page: pageA } = await persona('Masuk sebagai Uji Lokal A'));
    const state = await auth(pageA); assert.equal(state.authenticated, true); assert.equal(state.learner.status, 'ACTIVE'); assert.deepEqual(state.learner.missingPurposes, []);
    const questions = await (await pageA.request.get(origin + '/v1/questions?limit=100')).json();
    questionId = questions.items.find(q => q.legacyItemId === 'soal-menara')?.id; assert.ok(questionId);
  });
  await check('diagnosis is persisted by PostgreSQL and survives refresh', async () => {
    await pageA.locator('#formula').fill('sin 30 = 20/x'); await pageA.locator('.diagnose-btn').click();
    await expect(pageA.locator('.r-filled')).toBeVisible();
    const id = await pageA.evaluate(() => localStorage.getItem('intibelajar.loop.coba')); assert.ok(id);
    loop = await (await pageA.request.get(origin + '/v1/learning-sessions/' + id)).json(); assert.equal(loop.state, 'DIAGNOSIS_READY'); assert.equal(loop.stateVersion, 2);
    await pageA.reload(); await expect(pageA.locator('.r-filled')).toBeVisible(); await expect(pageA.locator('#formula')).toHaveValue('sin 30 = 20/x');
    const after = await (await pageA.request.get(origin + '/v1/learning-sessions/' + id)).json(); assert.equal(after.activeAttemptId, loop.activeAttemptId); assert.equal(after.stateVersion, 2);
    await pageA.screenshot({ path: join(evidence, 'diagnosis.png') });
  });
  await check('second tab resumes the existing answer without duplicate submission', async () => {
    const tab = await contextA.newPage(); tab.setDefaultTimeout(20000); await tab.goto(origin + '/coba'); await tab.bringToFront();
    await expect(tab.locator('.r-filled')).toBeVisible();
    const after = await (await tab.request.get(origin + '/v1/learning-sessions/' + loop.id)).json(); assert.equal(after.activeAttemptId, loop.activeAttemptId); assert.equal(after.stateVersion, 2);
    await tab.close(); await pageA.bringToFront();
  });
  await check('API rejects missing CSRF, foreign ownership, and missing consent', async () => {
    const csrf = await pageA.request.post(origin + '/v1/learning-sessions', { headers: { origin, 'idempotency-key': randomUUID() }, data: { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId } });
    assert.equal(csrf.status(), 403); assert.equal((await csrf.json()).code, 'CSRF_FAILED');
    const { page: b } = await persona('Masuk sebagai Uji Lokal B');
    assert.equal((await b.request.get(origin + '/v1/learning-sessions/' + loop.id)).status(), 404);
    const { page: pending } = await persona('Masuk akun tanpa izin');
    const refused = await request(pending, '/v1/learning-sessions', { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId });
    assert.equal(refused.status(), 403); assert.equal((await refused.json()).code, 'CONSENT_REQUIRED');
  });
  await check('practice answers use backend and resume after refresh', async () => {
    await pageA.goto(origin + '/latihan/soal?set=gabungan'); await expect(pageA.locator('.kicker')).toContainText('Soal 1 dari 4');
    await pageA.locator('.opts .opt').first().click(); await expect(pageA.locator('.feedback').first()).toBeVisible();
    await pageA.reload(); await expect(pageA.locator('.kicker')).toContainText('Soal 2 dari 4');
  });
  await check('server failures remain visible instead of becoming demo verdicts', async () => {
    await pageA.goto(origin + '/challenge');
    await pageA.route('**/v1/learning-sessions/*/attempts', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic failure', requestId: 'local-check', retryable: true }) }));
    await pageA.locator('#formula').fill('sin 30 = 20/x'); await pageA.locator('.diagnose-btn').click();
    await expect(pageA.locator('.r-empty[role=status]')).toContainText('Layanan belum bisa memeriksa'); await expect(pageA.locator('.r-filled')).toHaveCount(0);
    await pageA.unroute('**/v1/learning-sessions/*/attempts');
    await pageA.getByRole('button', { name: /Coba periksa lagi/ }).click(); await expect(pageA.locator('.r-filled')).toBeVisible();
  });
  await check('guest demo keeps learning local and never creates a canonical session', async () => {
    const { page: guest } = await persona('Coba sebagai tamu'); const calls = [];
    guest.on('request', r => { if (r.url().includes('/v1/learning-sessions')) calls.push(r.url()); });
    await guest.locator('#formula').fill('sin 30 = 20/x'); await guest.locator('.diagnose-btn').click();
    await expect(guest.locator('.r-filled')).toBeVisible(); assert.deepEqual(calls, []);
    assert.equal(await guest.evaluate(() => localStorage.getItem('intibelajar.loop.coba')), null);
  });
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close();
  const ok = results.length === 9 && results.every(r => r.ok);
  writeFileSync(join(evidence, 'summary.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version, syntheticOnly: true, database: 'intibelajar_local_dev', origin, total: results.length, expected: 9, passed: results.filter(r => r.ok).length, exit: ok ? 0 : 1, results }, null, 2));
  console.log(`${results.filter(r => r.ok).length}/9 local connection checks passed. Evidence: ${evidence}`);
  if (!ok) process.exitCode = 1;
}
