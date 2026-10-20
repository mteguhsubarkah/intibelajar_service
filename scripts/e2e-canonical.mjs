import { spawn, spawnSync } from 'node:child_process';
import { openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Browser E2E for canonical learning (Slice 1 M8), synthetic data only. Needs the isolated test PostgreSQL running.
//   1. seed the *_test database (reviewed fixture catalog, one consented learner)
//   2. start this API on 127.0.0.1:8000 with APP_ORIGIN = the Vite preview origin
//   3. build the Vue checkout with VITE_SLICE0 and VITE_CANONICAL_LEARNING, then check the bundle for CATALOG keys
//   4. run its Playwright specs canonical-practice (Slice 1) and canonical-loop (Slice 2) (vite preview proxies /v1 here)
//   5. stop the API and rebuild the Vue checkout with its default flags
const frontend = resolve(process.env.FRONTEND_DIR ?? '../mockup/intibelajar');
const origin = 'http://localhost:4173';
const testEnv = process.env.DATABASE_URL ? {} : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
const env = { ...process.env, ...testEnv, APP_ORIGIN: origin, PORT: '8000' };
const win = process.platform === 'win32';
const run = (cmd, args, options = {}) => {
  const r = spawnSync(win ? `${cmd}.cmd` : cmd, args, { stdio: 'inherit', shell: win, ...options });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
};

run('npx', ['tsx', 'scripts/e2e-seed.ts'], { env });
// The API's allow-listed request log (route, status, timing; never bodies) goes to .local/e2e-api.log.
const apiLog = openSync('.local/e2e-api.log', 'w');
const api = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], { env, stdio: ['ignore', apiLog, apiLog] });
let failed = false;
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch('http://127.0.0.1:8000/health/live')).ok) break; } catch { /* starting */ }
    if (i > 60) throw new Error('API did not start');
    await new Promise(r => setTimeout(r, 500));
  }
  run('npm', ['run', 'build'], { cwd: frontend, env: { ...process.env, VITE_SLICE0: 'true', VITE_CANONICAL_LEARNING: 'true' } });
  run('npx', ['tsx', 'scripts/catalog/check-bundle-keys.ts', '--dist', resolve(frontend, 'dist')]);
  run('npx', ['playwright', 'test', ...(process.env.E2E_SPEC ? process.env.E2E_SPEC.split(',') : ['tests/e2e/canonical-practice.spec.ts', 'tests/e2e/canonical-loop.spec.ts'])], { cwd: frontend, env: { ...process.env, E2E_LEARNER_FILE: resolve('.local/e2e-learner.json'), CI: '' } });
} catch (error) { failed = true; console.error(String(error)); }
finally {
  api.kill();
  try { run('npm', ['run', 'build'], { cwd: frontend, env: { ...process.env, VITE_SLICE0: '', VITE_CANONICAL_LEARNING: '' } }); } catch { failed = true; }
}
process.exit(failed ? 1 : 0);
