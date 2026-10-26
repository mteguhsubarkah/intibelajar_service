import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { buildApp } from '../src/app.js';

/*
 * Pilot runtime (RUNTIME_MODE=pilot): one exact public https origin behind the local Nginx. What must hold:
 * - the configuration fails closed (wrong origin, synthetic fixtures, automatic consent, untrusted proxy);
 * - development and test behave exactly as before;
 * - CSRF is not weakened: the Origin check stays exact, and a write must arrive over https at Nginx;
 * - rate limits count the client's real IP, and only the local proxy's X-Forwarded-For is believed;
 * - session cookies stay __Host-, Secure, HttpOnly, SameSite=Lax.
 */
const base = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
const ORIGIN = 'https://intibelajar.com';
const pilotEnv = { DATABASE_URL: base.DATABASE_URL, APP_KEY: base.APP_KEY, NODE_ENV: 'production', RUNTIME_MODE: 'pilot', APP_ORIGIN: ORIGIN, TRUST_PROXY: '127.0.0.1' };

test('pilot configuration: accepted only as an exact https origin behind the local proxy, without automatic guest consent', () => {
  const config = readConfig(pilotEnv);
  assert.deepEqual([config.mode, config.origin, config.trustProxy, config.synthetic, config.selfConsent, config.features.guestTrial],
    ['pilot', ORIGIN, '127.0.0.1', false, false, false]);
  assert.equal(readConfig({ ...pilotEnv, TRUST_PROXY: '::1' }).trustProxy, '::1');
  const refused: [string, Record<string, string | undefined>][] = [
    ['http origin', { APP_ORIGIN: 'http://intibelajar.com' }],
    ['origin with a path', { APP_ORIGIN: 'https://intibelajar.com/app' }],
    ['origin with a trailing slash', { APP_ORIGIN: 'https://intibelajar.com/' }],
    ['loopback origin', { APP_ORIGIN: 'https://localhost' }],
    ['IP address origin', { APP_ORIGIN: 'https://43.173.28.8' }],
    ['credentials in origin', { APP_ORIGIN: 'https://user:pw@intibelajar.com' }],
    ['no origin', { APP_ORIGIN: undefined }],
    ['synthetic fixtures', { SYNTHETIC_FIXTURES: 'true' }],
    ['guest trial (automatic consent)', { FEATURE_GUEST_TRIAL: 'true' }],
    ['no trusted proxy', { TRUST_PROXY: undefined }],
    ['a remote trusted proxy', { TRUST_PROXY: '10.0.0.5' }],
    ['trust every proxy', { TRUST_PROXY: 'true' }],
    ['pilot without NODE_ENV=production', { NODE_ENV: 'development' }],
    ['local DeepSeek', { LOCAL_DEEPSEEK: 'true' }],
    ['local Google test sign-in', { LOCAL_GOOGLE_OIDC: 'true' }],
    ['public binding', { HOST: '0.0.0.0' }],
  ];
  for (const [why, change] of refused) {
    const env: Record<string, string | undefined> = { ...pilotEnv, ...change };
    for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
    assert.throws(() => readConfig(env), Error, why);
  }
});

test('development and test are unchanged: loopback origin only, no proxy trust, production still refused without pilot', () => {
  const dev = { DATABASE_URL: base.DATABASE_URL, APP_KEY: base.APP_KEY, NODE_ENV: 'development', APP_ORIGIN: 'http://localhost:5180' };
  const config = readConfig(dev);
  assert.deepEqual([config.mode, config.trustProxy], ['development', false]);
  assert.throws(() => readConfig({ ...dev, APP_ORIGIN: ORIGIN }), /loopback/);
  assert.throws(() => readConfig({ ...dev, TRUST_PROXY: '127.0.0.1' }), /pilot mode only/);
  assert.throws(() => readConfig({ ...dev, NODE_ENV: 'production' }), /Production is disabled/);
  assert.throws(() => readConfig({ ...dev, RUNTIME_MODE: 'staging' }), /pilot only/);
});

test('pilot app: exact Origin and https for writes, per-client rate limits, Secure session cookie', async t => {
  const config = readConfig({ ...pilotEnv, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'IntiBelajar <masuk@intibelajar.com>' });
  assert.match(new URL(config.databaseUrl).pathname, /_test$/);
  const db = connect(config.databaseUrl);
  await migrate(db);
  const { app } = await buildApp(config, { db, logStream: new Writable({ write(_c, _e, done) { done(); } }) });
  // As Nginx forwards it: the client's IP and scheme in X-Forwarded-*; the request itself comes from 127.0.0.1.
  const post = (url: string, { ip = '198.51.100.1', proto = 'https', origin = ORIGIN as string | null, remote = '127.0.0.1' } = {}) =>
    app.inject({ method: 'POST', url, remoteAddress: remote, payload: '{}',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'x-forwarded-proto': proto, ...(origin !== null ? { origin } : {}) } });
  try {
    await t.test('health reports the pilot, not a synthetic-only environment', async () => {
      const r = await app.inject({ method: 'GET', url: '/health/ready' });
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual([r.json().environment, r.json().syntheticOnly], ['pilot', false]);
    });

    await t.test('the exact Origin over https passes the CSRF check (and the guest trial is off)', async () => {
      const r = await post('/v1/auth/guest');
      assert.deepEqual([r.statusCode, r.json().code], [403, 'FEATURE_DISABLED']);
    });

    await t.test('CSRF is not weakened: wrong or missing Origin, cross-site, or a write over http are refused', async () => {
      for (const [why, opts] of [['loopback origin', { origin: 'http://localhost:5173' }], ['other site', { origin: 'https://evil.example' }],
        ['http variant of the origin', { origin: 'http://intibelajar.com' }], ['no Origin', { origin: null }], ['write over http', { proto: 'http' }]] as const) {
        const r = await post('/v1/auth/guest', { ip: '198.51.100.50', ...opts });
        assert.deepEqual([r.statusCode, r.json().code], [403, 'CSRF_FAILED'], why);
      }
      const cross = await app.inject({ method: 'POST', url: '/v1/auth/guest', remoteAddress: '127.0.0.1', payload: '{}',
        headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-proto': 'https', 'x-forwarded-for': '198.51.100.51', 'sec-fetch-site': 'cross-site' } });
      assert.deepEqual([cross.statusCode, cross.json().code], [403, 'CSRF_FAILED'], 'Sec-Fetch-Site cross-site');
    });

    await t.test('rate limits count the real client: one IP is limited, another is not', async () => {
      for (let i = 0; i < 20; i++) assert.notEqual((await post('/v1/auth/guest', { ip: '198.51.100.10' })).statusCode, 429, `request ${i + 1}`);
      assert.equal((await post('/v1/auth/guest', { ip: '198.51.100.10' })).statusCode, 429, 'the 21st from the same client');
      assert.notEqual((await post('/v1/auth/guest', { ip: '198.51.100.11' })).statusCode, 429, 'another client is not affected');
    });

    await t.test('only the local proxy is believed: a forged X-Forwarded-For or -Proto from elsewhere changes nothing', async () => {
      // A direct connection from another host: its own address counts, whatever X-Forwarded-For it claims.
      for (let i = 0; i < 20; i++) await post('/v1/auth/guest', { remote: '203.0.113.7', ip: `198.51.100.${100 + i}` });
      assert.equal((await post('/v1/auth/guest', { remote: '203.0.113.7', ip: '198.51.100.200' })).statusCode, 429);
      // Its X-Forwarded-Proto is not believed either: the write is not https.
      const r = await post('/v1/auth/guest', { remote: '203.0.113.8', ip: '198.51.100.201' });
      assert.deepEqual([r.statusCode, r.json().code], [403, 'CSRF_FAILED']);
    });

    await t.test('the session cookie stays __Host-, Secure, HttpOnly, SameSite=Lax, and links use the public origin', async () => {
      const r = await app.inject({ method: 'POST', url: '/v1/auth/start', remoteAddress: '127.0.0.1',
        payload: JSON.stringify({ provider: 'email', continuation: { targetPath: '/home', step: 0 } }),
        headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-proto': 'https', 'x-forwarded-for': '198.51.100.60' } });
      assert.equal(r.statusCode, 200, r.body);
      const cookie = String(r.headers['set-cookie']);
      assert.match(cookie, /^__Host-ib_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=\d+$/);
      assert.ok(String(r.json().redirectUrl).startsWith(ORIGIN + '/auth/email?transaction='));
    });
  } finally {
    await app.close(); await db.destroy();
  }
});
