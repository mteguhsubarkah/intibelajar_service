// Slice 2 M8 verification on Node 24.19.0, run from intibelajar_service.
//   node verify-m8.mjs <new evidence dir>                      full verification
//   node verify-m8.mjs <new evidence dir> --negative-control   B-03: one passing check plus one deliberately failing check
// The output dir must not exist (earlier evidence is never touched). PostgreSQL checks run one after another.
// Every check's own exit code is recorded in summary.json; the runner exits 1 when any check fails.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const out = process.argv[2];
const negativeControl = process.argv.includes('--negative-control');
if (!out) { console.error('usage: node verify-m8.mjs <new evidence dir> [--negative-control]'); process.exit(2); }
if (existsSync(out)) { console.error(`${out} exists; refusing to overwrite evidence`); process.exit(2); }
mkdirSync(out, { recursive: true });
const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve('../mockup/intibelajar');
const win = process.platform === 'win32', tsx = [resolve('node_modules/tsx/dist/cli.mjs')], node = process.execPath;
const results = [];
const childNode = spawnSync('node', ['-v'], { encoding: 'utf8', shell: win }).stdout.trim();
if (process.version !== 'v24.19.0' || childNode !== 'v24.19.0') { console.error(`Node 24.19.0 required; runner ${process.version}, child ${childNode}`); process.exit(2); }
const versions = {
  node: process.version, childNode,
  npm: spawnSync(win ? 'npm.cmd' : 'npm', ['-v'], { encoding: 'utf8', shell: win }).stdout.trim(),
  postgresql: spawnSync('C:/Program Files/PostgreSQL/17/bin/postgres.exe', ['--version'], { encoding: 'utf8' }).stdout?.trim() ?? 'unknown',
  playwright: spawnSync(win ? 'npx.cmd' : 'npx', ['playwright', '--version'], { cwd: frontend, encoding: 'utf8', shell: win }).stdout.trim(),
  python: spawnSync('python', ['--version'], { encoding: 'utf8' }).stdout.trim(),
  os: `${process.platform} ${process.arch}`,
};
console.log(`Node runner ${process.version}, child ${childNode}`);
function run(name, cmd, args, { expectExit = 0, cwd, env, keep = () => true } = {}) {
  const started = Date.now();
  const r = spawnSync(win && ['npm', 'npx'].includes(cmd) ? `${cmd}.cmd` : cmd, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', shell: win, maxBuffer: 64 << 20 });
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.split(/\r?\n/).filter(l => !/FastifyDeprecation|trace-warnings|"level":30/.test(l)).filter(keep).join('\n');
  writeFileSync(join(out, `${name}.txt`), `$ ${cmd} ${args.join(' ')}\n${text}\nexit ${r.status}\n`);
  const ok = r.status === expectExit; results.push({ name, exit: r.status, expectExit, ok, seconds: Math.round((Date.now() - started) / 100) / 10 });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (exit ${r.status}${expectExit ? `, expected ${expectExit}` : ''})`);
  return text;
}

if (negativeControl) {
  // B-03 negative control: the same run() as every real check. The failing test is a real node:test file whose
  // assertion fails; the runner must record its non-zero exit and exit 1 itself.
  run('typecheck', node, ['node_modules/typescript/bin/tsc', '--noEmit']);
  run('negative-control-deliberately-failing-test', node, [...tsx, '--test', join(here, 'negative-control.test.ts')]);
} else {
  run('typecheck', node, ['node_modules/typescript/bin/tsc', '--noEmit']);
  run('module-and-rubric-boundaries', node, ['scripts/check-boundaries.mjs']);
  run('openapi-validation', node, [...tsx, 'scripts/validate-contract.ts']);
  run('manifest-lint-draft', node, [...tsx, 'scripts/catalog/lint-manifest.ts']);
  run('manifest-lint-strict-refuses-draft', node, [...tsx, 'scripts/catalog/lint-manifest.ts', '--strict'], { expectExit: 1 });
  run('golden-sync-v2', node, [...tsx, 'scripts/catalog/golden.ts']);
  run('alias-coverage-and-freeze', node, [...tsx, 'scripts/catalog/extract-from-frontend.ts', '--check'], { env: { FRONTEND_DIR: frontend } });
  for (const s of ['catalog', 'learning', 'question-loop']) run(`migration-extraction-${s}`, 'python', [`scripts/extract-migration-${s}.py`]);
  run('migrations-unchanged-after-regeneration', 'git', ['diff', '--exit-code', '--stat', '--', 'migrations']);
  const tmp = mkdtempSync(join(tmpdir(), 'ib-roundtrip-'));
  run('draft-extraction-roundtrip-write', node, [...tsx, 'scripts/catalog/extract-from-frontend.ts', '--out', join(tmp, 'manifest'), '--force'], { env: { FRONTEND_DIR: frontend } });
  const recorded = readFileSync('catalog/manifest/release.yaml', 'utf8').match(/frontendCommit: (\w+)/)[1];
  run('frontend-data-unchanged-since-extraction', 'git', ['-C', frontend, 'diff', '--quiet', recorded, 'HEAD', '--', 'src/data']);
  const fresh = join(tmp, 'manifest', 'release.yaml');
  writeFileSync(fresh, readFileSync(fresh, 'utf8').replace(/frontendCommit: \w+/, `frontendCommit: ${recorded}`));
  run('draft-extraction-roundtrip-identical', 'git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--exit-code', '--stat', 'catalog/manifest', join(tmp, 'manifest')]);
  rmSync(tmp, { recursive: true, force: true });
  run('m5-question-loop-suite', node, [...tsx, '--test', '--test-concurrency=1', 'test/question-loop.test.ts']);
  run('m6-disputes-suite', node, [...tsx, '--test', '--test-concurrency=1', 'test/disputes.test.ts']);
  run('m7-m8-facade-l1-l2-l4-l8-suite-with-idempotency-regression', node, [...tsx, '--test', '--test-concurrency=1', 'test/legacy-loop-facade.test.ts']);
  run('m7-facade-l3-regression-suite', node, [...tsx, '--test', '--test-concurrency=1', 'test/legacy-facade.test.ts']);
  run('backend-tests-run-1', node, [...tsx, '--test', '--test-concurrency=1', 'test/*.test.ts']);
  run('backend-tests-run-2', node, [...tsx, '--test', '--test-concurrency=1', 'test/*.test.ts']);
  run('architecture-self-test', 'python', ['scripts/verify-architecture.py', '--self-test']);
  // Vue typecheck with the @/ alias mapped (the checkout's own `vue-tsc` checks no files; see the plan). The check
  // passes when none of the files M8 changed has an error; the rest of the checkout's errors are recorded, not judged.
  const vt = run('vue-typecheck-alias-mapped-all-files', node, [resolve(frontend, 'node_modules/vue-tsc/bin/vue-tsc.js'), '-p', join(here, 'tsconfig.m8check.json')], { cwd: frontend, expectExit: 2 });
  const m8Files = /src[\\/](composables[\\/]useCobaFlow\.ts|services[\\/]canonicalLoop\.ts|components[\\/]coba[\\/]StepSoalTadi\.vue|components[\\/]coba[\\/]StepQuestion\.vue|views[\\/]CobaView\.vue)\(/;
  const m8Errors = vt.split('\n').filter(l => m8Files.test(l));
  writeFileSync(join(out, 'vue-typecheck-m8-files.txt'), `files: useCobaFlow.ts, canonicalLoop.ts, StepSoalTadi.vue, StepQuestion.vue, CobaView.vue\nerrors in those files: ${m8Errors.length}\n${m8Errors.join('\n')}\nerrors in the whole checkout: ${vt.split('\n').filter(l => /error TS/.test(l)).length}\n`);
  results.push({ name: 'vue-typecheck-m8-files', exit: m8Errors.length ? 1 : 0, expectExit: 0, ok: m8Errors.length === 0 });
  console.log(`${m8Errors.length ? 'FAIL' : 'PASS'} vue-typecheck-m8-files (${m8Errors.length} errors)`);
  run('frontend-suite-consumer-golden-v2', 'npm', ['run', 'verify:frontend'], { env: { FRONTEND_DIR: frontend } });
  run('browser-e2e-canonical-practice-and-loop', 'npm', ['run', 'e2e:canonical'], { env: { FRONTEND_DIR: frontend }, keep: l => !/transforming|modules transformed|gzip|rendering chunks|computing/.test(l) });
}
const passed = results.filter(r => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
writeFileSync(join(out, 'summary.json'), JSON.stringify({ date: new Date().toISOString(), mode: negativeControl ? 'negative-control' : 'full', versions,
  postgresqlCluster: 'isolated cluster 127.0.0.1:55432, *_test database', passed, total: results.length, runnerExit: passed === results.length ? 0 : 1, results }, null, 2) + '\n');
process.exit(passed === results.length ? 0 : 1);
