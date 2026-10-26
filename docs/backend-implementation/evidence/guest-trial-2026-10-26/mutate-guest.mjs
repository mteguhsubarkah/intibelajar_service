// Guest-trial mutation checks: one mutation at a time, restored in `finally`, nothing else running meanwhile.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const vue = resolve('../mockup/intibelajar'), win = process.platform === 'win32';
const opts = { encoding: 'utf8', maxBuffer: 256 << 20, timeout: 400000 };
const suites = {
  api: () => spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--test', '--test-concurrency=1', 'test/guest-trial.test.ts'], opts),
  client: () => spawnSync(win ? 'npm.cmd' : 'npm', ['run', 'test:guest-trial'], { ...opts, cwd: vue, shell: win }),
  e2e: () => spawnSync(process.execPath, ['scripts/e2e-canonical.mjs'], { ...opts, env: { ...process.env, E2E_SPEC: 'tests/e2e/canonical-loop.spec.ts' } }),
};
const A = resolve('src/app.ts'), P = resolve('src/privacy/service.ts'), R = resolve('src/privacy/erasure.ts'), I = resolve('src/identity/service.ts');
const L = resolve(vue, 'src/services/learningSessions.ts'), U = resolve(vue, 'src/composables/useAuth.ts'), F = resolve(vue, 'src/composables/useCobaFlow.ts');
const mutations = [
  ['api', 'feature flag ignored', A, "    if(!config.features.guestTrial)fail(403,'FEATURE_DISABLED');\n", ''],
  ['api', 'a signed-in user gets a trial too', A, '    if(current)return {guest:await identity.isTrial(db,current.userId)};\n', ''],
  ['api', 'session view without the guest flag', A, '...(await identity.isTrial(db,p.userId)?{guest:true}:{}),', ''],
  ['api', 'trial session outlives the trial', I, "  await sql`update auth_session set absolute_expires_at=least(absolute_expires_at,now()+${hours}*interval '1 hour'),\n    idle_expires_at=least(idle_expires_at,now()+${hours}*interval '1 hour') where id=${session.id}`.execute(tx);\n", ''],
  ['api', 'expired trials are never erased', R, "  for(const id of await dueTrials(tx,await expiredTrialLearners(tx))) await deletion(tx,config,id,'SYSTEM','TRIAL_EXPIRED');", ''],
  ['api', 'trial without AI consent (no DeepSeek path)', P, "export const selfPurposes=['LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD'] as const;", "export const selfPurposes=['LEARNING_DATA','IMAGE_UPLOAD'] as const;"],
  ['client', 'a real account without consent is replaced by a trial', L, '  if (session?.authenticated) return false;\n', ''],
  ['client', 'every trial failure is swallowed', L, "if (error instanceof ApiFailure && error.code === 'FEATURE_DISABLED') return false; throw error;", 'return false;'],
  ['client', 'a trial counts as signed in', U, 'const signedIn = computed(() => !!state.session?.authenticated && !state.session.guest);', 'const signedIn = computed(() => !!state.session?.authenticated);'],
  ['client', 'trial requested without a JSON body', L, "{ method: 'POST', public: true, body: {} }", "{ method: 'POST', public: true }"],
  ['e2e', '/coba guests are not given a trial', F, '    try { if (await ensureLearner()) return canonicalAnalysis(); }', '    try { if (await canonicalLearner()) return canonicalAnalysis(); }'],
];
// Windows can lock a file for a moment (antivirus, indexer): retry a write instead of leaving a mutation in place.
const write = (file, text) => { for (let i = 0; ; i++) { try { writeFileSync(file, text); return; } catch (e) { if (i >= 20) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } } };
const start = Number((process.argv.find(a => a.startsWith('--from=')) ?? '--from=1').slice(7));
let survived = 0;
for (const [index, [suite, name, file, from, to]] of mutations.entries()) {
  if (index + 1 < start) continue;
  const original = readFileSync(file, 'utf8');
  try {
    if (!original.includes(from)) throw new Error('anchor: ' + name);
    write(file, original.replace(from, to));
    const r = suites[suite]();
    const text = (r.stdout ?? '') + (r.stderr ?? '');
    const failing = suite === 'api' ? (text.match(/^ {2}✖ .*$/gm) ?? []).map(l => l.trim().slice(2, 80)).join(' | ')
      : suite === 'e2e' ? (text.match(/^\s+x\s+\d+ .*$/gm) ?? []).map(l => l.replace(/^.*› /, '').slice(0, 80)).join(' | ')
      : (text.match(/(AssertionError|Error)[^\n]*/) ?? [''])[0].slice(0, 120);
    if (r.status === 0 || r.status === null) survived++;
    console.log(`${r.status === null ? 'TIMEOUT ' : r.status !== 0 ? 'KILLED  ' : 'SURVIVED'} [${suite}] ${name} (exit ${r.status})${failing ? ' — ' + failing : ''}`);
  } finally { write(file, original); }
}
const rebuild = spawnSync(win ? 'npm.cmd' : 'npm', ['run', 'build'], { ...opts, cwd: vue, shell: win, env: { ...process.env, VITE_SLICE0: '', VITE_CANONICAL_LEARNING: '' } });
console.log(`restored-source rebuild exit ${rebuild.status}`);
const ran = mutations.length - start + 1;
console.log(`${ran - survived}/${ran} mutations killed (from #${start})`);
process.exit(survived || rebuild.status ? 1 : 0);
