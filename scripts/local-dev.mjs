import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// A separate, persistent synthetic database. Never run the destructive E2E seed here.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
// Optional private key file, ignored by Git. Never serialize its contents into env.json or logs.
if (existsSync(join(root,'.local/local-dev/deepseek.env'))) process.loadEnvFile(join(root,'.local/local-dev/deepseek.env'));
if (existsSync(join(root,'.local/local-dev/google.env'))) process.loadEnvFile(join(root,'.local/local-dev/google.env'));
if (existsSync(join(root,'.local/local-dev/email.env'))) process.loadEnvFile(join(root,'.local/local-dev/email.env'));
if (existsSync(join(root,'.local/local-dev/ocr.env'))) process.loadEnvFile(join(root,'.local/local-dev/ocr.env'));
const dir = join(root, '.local', 'local-dev');
const frontend = resolve(process.env.FRONTEND_DIR ?? join(root, '../mockup/intibelajar'));
const origin = 'http://localhost:5180';
const marker = 'IntiBelajar local-dev harness: SYNTHETIC ONLY';
const databaseName = 'intibelajar_local_dev';
const children = [];
let closing = false;
mkdirSync(dir, { recursive: true, mode: 0o700 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
function fail(message) { throw new Error(message); }
function run(args, options = {}) {
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', ...options });
  if (r.error || r.status !== 0) fail(`Local setup failed (${r.status ?? 'could not start'}). See output above.`);
}
async function freePort(port) {
  for (const host of ['127.0.0.1', '::1']) await new Promise((yes, no) => {
    const server = createServer();
    server.once('error', error => error.code === 'EAFNOSUPPORT' ? yes() : no(new Error(`Port ${port} is occupied or unavailable on ${host}. Stop the existing server first; it will not be killed.`)));
    server.listen(port, host, () => server.close(yes));
  });
}
function cleanup(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  console.log('\nFE, API and worker stopped. PostgreSQL and local fixture data are retained.');
  process.exitCode = code;
}
process.once('SIGINT', () => cleanup());
process.once('SIGTERM', () => cleanup());
try {
  if (Number(process.versions.node.split('.')[0]) < 22) fail('Node 22+ is required (verified with Node 24.19.0).');
  if (!existsSync(join(frontend, 'node_modules/vite/dist/node/index.js'))) fail(`Frontend dependencies missing in ${frontend}. Install them before starting.`);
  await Promise.all([freePort(5180), freePort(8000)]);
  // Use only this checkout's existing loopback test-cluster credentials, not a user's DATABASE_URL/.env.
  const testFile = join(root, '.local/test-env.json');
  if (!existsSync(testFile)) fail('Missing .local/test-env.json. See docs/backend-implementation/07-local-development.md for database setup.');
  const base = new URL(JSON.parse(readFileSync(testFile, 'utf8')).DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || !['postgres:', 'postgresql:'].includes(base.protocol)) fail('The fixture cluster must be loopback PostgreSQL.');
  const adminUrl = new URL(base); adminUrl.pathname = '/postgres';
  async function admin() { const c = new pg.Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 3000 }); await c.connect(); return c; }
  let client;
  try { client = await admin(); }
  catch (error) {
    if (error.code !== 'ECONNREFUSED') fail('Cannot connect to the local fixture cluster. Check its credentials; no database was modified.');
    const bin = process.env.PG_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '');
    const pgctl = join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
    const cluster = join(root, '.local/pg17');
    if (!existsSync(cluster)) fail('Start your isolated PostgreSQL cluster first; see the local development guide.');
    const r = spawnSync(pgctl, ['-D', cluster, '-l', join(dir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${base.port || '5432'}`, '-w', 'start'], { stdio: 'inherit', windowsHide: true });
    if (r.error || r.status !== 0) fail('Could not start the existing PostgreSQL cluster. No reset or reinstall was attempted.');
    client = await admin();
  }
  try {
    const v = Number((await client.query('show server_version_num')).rows[0].server_version_num);
    if (v < 160000) fail('PostgreSQL 16+ is required.');
    const existing = (await client.query('select shobj_description(oid, \'pg_database\') as marker from pg_database where datname=$1', [databaseName])).rows[0];
    if (existing && existing.marker !== marker) fail(`${databaseName} already exists without the local-only marker; refusing to modify it.`);
    if (!existing) {
      await client.query(`create database ${databaseName}`);
      await client.query(`comment on database ${databaseName} is '${marker}'`);
    }
  } finally { await client.end(); }
  base.pathname = '/' + databaseName;
  const envFile = join(dir, 'env.json');
  const previous = existsSync(envFile) ? JSON.parse(readFileSync(envFile, 'utf8')) : {};
  const env = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}` };
  for (const name of Object.keys(env)) if (name.startsWith('FEATURE_') || name.startsWith('VITE_')) delete env[name];
  const local = { NODE_ENV: 'development', DATABASE_URL: base.href, APP_ORIGIN: origin,
    APP_KEY: previous.APP_KEY ?? randomBytes(32).toString('hex'), SYNTHETIC_FIXTURES: 'true',
    HOST: '127.0.0.1', PORT: '8000', FEATURE_LEGACY_FACADE: 'true', FEATURE_GUEST_TRIAL: 'true' };
  writeFileSync(envFile, JSON.stringify(local, null, 2), { mode: 0o600 });
  Object.assign(env, local, { FRONTEND_DIR: frontend });
  run(['--import', 'tsx', 'scripts/local/prepare.ts'], { env });
  if (process.argv.includes('--prepare-only')) { console.log('Local fixture prepared; no API or frontend started.'); }
  else {
    function start(name, args) {
      const fd = openSync(join(dir, `${name}.log`), 'a', 0o600);
      const childEnv={...env};
      if(name==='frontend')for(const k of ['DEEPSEEK_API_KEY','GOOGLE_CLIENT_SECRET','GOOGLE_CLIENT_ID','GOOGLE_TEST_EMAIL','OPENROUTER_API_KEY','RESEND_API_KEY'])delete childEnv[k];
      const child = spawn(process.execPath, args, { cwd: root, env:childEnv, stdio: ['ignore', fd, fd], windowsHide: true });
      closeSync(fd); children.push(child);
      child.once('error', () => { console.error(`${name} could not start; see .local/local-dev/${name}.log`); cleanup(1); });
      child.once('exit', (code, signal) => { if (!closing) { console.error(`${name} stopped unexpectedly (${code ?? signal}); see its local log.`); cleanup(1); } });
      return child;
    }
    start('api', ['--import', 'tsx', 'src/main.ts']);
    start('worker', ['--import', 'tsx', 'src/worker.ts']);
    start('frontend', ['scripts/local/vite.mjs']);
    let ready = false;
    for (let i = 0; i < 120 && !closing; i++) {
      try {
        const api = await fetch('http://127.0.0.1:8000/health/ready', { signal: AbortSignal.timeout(1500) });
        const fe = await fetch(origin + '/__local', { signal: AbortSignal.timeout(1500) });
        if (api.ok && fe.ok) { ready = true; break; }
      } catch { /* wait for startup, never expose connection strings */ }
      await sleep(500);
    }
    if (!ready && !closing) fail('Local startup timed out. See .local/local-dev/*.log');
    if (ready) {
      console.log(`\nLOCAL SYNTHETIC TEST ONLY\n  Choose test account: ${origin}/__local\n  Frontend:            ${origin}\n  Database:            ${databaseName} (separate from *_test)\n  Stop FE/API/worker:   Ctrl+C\n\nD3/D6 local flow available. B-01/B-02 remain backlog. Synthetic identities/consents only. DeepSeek requires explicit configuration; no deployment.\n`);
    }
  }
} catch (error) { console.error(error.message); cleanup(1); }
