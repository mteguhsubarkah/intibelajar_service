// M8 mutation checks. One mutation at a time, the source restored in `finally`, nothing else running meanwhile.
// Run from intibelajar_service with Node 24 on PATH. Writes nothing but restores every file it touched.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
if (!process.version.startsWith('v24.')) { console.error('needs Node 24, got ' + process.version); process.exit(2); }
const vue = resolve('../mockup/intibelajar');
const win = process.platform === 'win32';
const npm = (args, cwd, env = process.env) => spawnSync(win ? 'npm.cmd' : 'npm', args, { cwd, env, encoding: 'utf8', shell: win, maxBuffer: 256 << 20 });

const suites = {
  facade: () => spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--test', 'test/legacy-loop-facade.test.ts'], { encoding: 'utf8', maxBuffer: 64 << 20 }),
  client: () => npm(['run', 'test:canonical-loop'], vue),
  e2e: () => spawnSync(process.execPath, ['scripts/e2e-canonical.mjs'], { encoding: 'utf8', maxBuffer: 256 << 20, env: { ...process.env, E2E_SPEC: 'tests/e2e/canonical-loop.spec.ts' } }),
};
const failingOf = (suite, r) => {
  const text = (r.stdout ?? '') + (r.stderr ?? '');
  if (suite === 'facade') return (text.match(/^ {2}✖ .*$/gm) ?? []).map(l => l.trim().slice(2, 90)).join(' | ');
  if (suite === 'e2e') return (text.match(/^\s+x\s+\d+ .*$/gm) ?? []).map(l => l.replace(/^.*› /, '').slice(0, 90)).join(' | ');
  return (text.match(/AssertionError[^\n]*\n[^\n]*/) ?? [''])[0].replace(/\s+/g, ' ').slice(0, 140);
};

const F = 'src/composables/useCobaFlow.ts', L = 'src/services/canonicalLoop.ts';
const mutations = [
  // backend: 09 §6.1 rule 5 (facade derived key)
  ['facade', 'rule 5: derived key without the loop version (same text after the state moved on replays)', 'src/app.ts',
    "const key=(version:number)=>'legacy_'+hash(stable({learnerId:learnerId(req),operation,...payload,version})).toString('hex');",
    "const key=(_version:number)=>'legacy_'+hash(stable({learnerId:learnerId(req),operation,...payload})).toString('hex');"],
  ['facade', 'rule 5: outcome not remembered under the version after (a network retry after commit acts twice)', 'src/app.ts',
    'if(!outcome.replayed)await remember(tx,', 'if(false)await remember(tx,'],
  // client rules (unit, fetch faked)
  ['client', 'a new Idempotency-Key on the network retry', L, "  const key = operationKey();\n  for (let attempt = 0; ; attempt++) {\n    try {\n      return { ok: true, value: await canonicalApi<T>(`/v1/learning-sessions/${loopId}/${path}`, { method: 'POST', key, body }) };",
    "  for (let attempt = 0; ; attempt++) {\n    try {\n      return { ok: true, value: await canonicalApi<T>(`/v1/learning-sessions/${loopId}/${path}`, { method: 'POST', key: operationKey(), body }) };"],
  ['client', 'a stale version is retried instead of re-reading the loop', L,
    "if (error instanceof ApiFailure && (error.code === 'STALE_STATE_VERSION' || error.code === 'INVALID_STATE_TRANSITION')) return { ok: false, loop: await getLoop(loopId) };", ''],
  ['client', 'solution gate ignores allowedActions', L,
    "  if (!loop.allowedActions.includes('REVIEW_SOLUTION')) throw new ApiFailure('SOLUTION_LOCKED', 'Pembahasan terbuka setelah kamu mencoba lagi.', false);", ''],
  ['client', 'polling ignores Retry-After', L, 'seconds > 0 ? seconds * 1000 : 1000', 'seconds > 0 ? 1000 : 1000'],
  ['client', 'checkpoint always saved as /coba', L, "route: channel === 'challenge' ? '/challenge' : '/coba'", "route: '/coba'"],
  // composable wiring (browser E2E against the API)
  ['e2e', 'a failure becomes the device demo result', F,
    '    } catch (error) {\n      state.diagnosisStatus = error instanceof Error && error.message === "diagnosis_pending" ? "pending" : "error";',
    '    } catch (error) { runAnalysis(); state.diagnosisStatus = "completed"; void error;\n      if (Math.random() > 2) state.diagnosisStatus = error instanceof Error && error.message === "diagnosis_pending" ? "pending" : "error";'],
  ['e2e', 'second tab: no notice when the loop already moved on', F,
    '        state.loop = loop;\n        state.canonicalNotice = TAB_NOTICE;\n        await showLoopRun(loop);', '        state.loop = loop;\n        await showLoopRun(loop);'],
  ['e2e', 'resume ignores the server checkpoint (retry step lost on refresh)', F,
    '(loop.state === "DIAGNOSIS_READY" && loop.checkpoint.step === RETRY_STEP)', 'false'],
  ['e2e', 'guest routed to the canonical loop', F,
    'if (await canonicalLearner()) return canonicalAnalysis();', 'if (await canonicalLearner() || true) return canonicalAnalysis();'],
];

let survived = 0; const out = [];
for (const [suite, name, rel, from, to] of mutations) {
  const file = rel.startsWith('src/app.ts') ? resolve(rel) : resolve(vue, rel);
  const original = readFileSync(file, 'utf8');
  try {
    if (!original.includes(from)) throw new Error('anchor: ' + name);
    writeFileSync(file, original.replace(from, to));
    const r = suites[suite]();
    const failing = failingOf(suite, r);
    if (r.status === 0) survived++;
    const line = `${r.status !== 0 ? 'KILLED  ' : 'SURVIVED'} [${suite}] ${name} (exit ${r.status})${failing ? ' — ' + failing : ''}`;
    out.push(line); console.log(line);
  } finally { writeFileSync(file, original); }
}
// The E2E runner rebuilt the Vue checkout while a mutation was in place; rebuild it from the restored source.
const rebuild = npm(['run', 'build'], vue, { ...process.env, VITE_SLICE0: '', VITE_CANONICAL_LEARNING: '' });
out.push(`restored-source rebuild exit ${rebuild.status}`);
out.push(`${mutations.length - survived}/${mutations.length} mutations killed`);
console.log(out.slice(-2).join('\n'));
process.exit(survived || rebuild.status ? 1 : 0);
