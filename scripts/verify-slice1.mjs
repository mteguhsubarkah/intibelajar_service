import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import pg from 'pg';
// Slice 1 exit verification (plan 03 §3 M9). Runs every exit check, keeps each output under
// docs/backend-implementation/evidence/slice1-exit/, and writes docs/backend-implementation/verification-slice1.json.
// Needs: the isolated test PostgreSQL, the Vue checkout (FRONTEND_DIR), PYTHONPATH=.local/python for PyYAML.
// A check's outcome is recorded as observed; expected refusals (strict lint on the unreviewed draft) are named as such.

const out = 'docs/backend-implementation/evidence/slice1-exit';
const frontend = resolve(process.env.FRONTEND_DIR ?? '../mockup/intibelajar');
mkdirSync(out, { recursive: true });
const win = process.platform === 'win32';
const checks = [];
// informational: recorded as a finding (not a gate) when it exits non-zero, e.g. a dependency audit.
function run(name, cmd, args, { expectExit = 0, cwd, env, keep = l => true, informational = false } = {}) {
  const r = spawnSync(win && ['npm', 'npx'].includes(cmd) ? `${cmd}.cmd` : cmd, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', shell: win, maxBuffer: 64 * 1024 * 1024 });
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.split(/\r?\n/).filter(l => !/FastifyDeprecation|trace-warnings/.test(l)).filter(keep).join('\n');
  writeFileSync(join(out, `${name}.txt`), `$ ${cmd} ${args.join(' ')}\n${text}\n`);
  const ok = r.status === expectExit, result = ok ? 'pass' : informational ? 'finding' : 'fail';
  checks.push({ name, exit: r.status, expectedExit: expectExit, result });
  console.log(`${result.toUpperCase()} ${name} (exit ${r.status}${expectExit ? `, expected ${expectExit}` : ''})`);
  return text;
}
const tsx = [resolve('node_modules/tsx/dist/cli.mjs')];
const node = process.execPath;

run('typecheck', node, ['node_modules/typescript/bin/tsc', '--noEmit']);
run('module-and-rubric-boundaries', node, ['scripts/check-boundaries.mjs']);
run('openapi-validation', node, [...tsx, 'scripts/validate-contract.ts']);
const draft = run('manifest-lint-draft', node, [...tsx, 'scripts/catalog/lint-manifest.ts']);
const strict = run('manifest-lint-strict-refuses-draft', node, [...tsx, 'scripts/catalog/lint-manifest.ts', '--strict'], { expectExit: 1 });
run('golden-sync', node, [...tsx, 'scripts/catalog/golden.ts']);
run('alias-coverage-and-freeze', node, [...tsx, 'scripts/catalog/extract-from-frontend.ts', '--check'], { env: { FRONTEND_DIR: frontend } });
// Reproducibility: generated migrations and the extracted draft must match what is committed.
run('migration-extraction-catalog', 'python', ['scripts/extract-migration-catalog.py']);
run('migration-extraction-learning', 'python', ['scripts/extract-migration-learning.py']);
run('migrations-unchanged-after-regeneration', 'git', ['diff', '--exit-code', '--stat', '--', 'migrations']);
const tmp = mkdtempSync(join(tmpdir(), 'ib-roundtrip-'));
run('draft-extraction-roundtrip-write', node, [...tsx, 'scripts/catalog/extract-from-frontend.ts', '--out', join(tmp, 'manifest'), '--force'], { env: { FRONTEND_DIR: frontend } });
// The draft records the frontend commit it was read from. The Vue repo may gain commits that do not touch
// src/data; then only that provenance line may differ, and everything else must be byte-identical.
const recorded = readFileSync('catalog/manifest/release.yaml', 'utf8').match(/frontendCommit: (\w+)/)[1];
run('frontend-data-unchanged-since-extraction', 'git', ['-C', frontend, 'diff', '--quiet', recorded, 'HEAD', '--', 'src/data']);
const fresh = join(tmp, 'manifest', 'release.yaml');
writeFileSync(fresh, readFileSync(fresh, 'utf8').replace(/frontendCommit: \w+/, `frontendCommit: ${recorded}`));
run('draft-extraction-roundtrip-identical', 'git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--exit-code', '--stat', 'catalog/manifest', join(tmp, 'manifest')]);
rmSync(tmp, { recursive: true, force: true });
const tests = run('backend-tests', node, [...tsx, '--test', '--test-concurrency=1', 'test/*.test.ts'], { keep: l => !/"level":30/.test(l) });
run('architecture-self-test', 'python', ['scripts/verify-architecture.py', '--self-test']);
run('frontend-suite-consumer-golden', 'npm', ['run', 'verify:frontend'], { env: { FRONTEND_DIR: frontend } });
const e2e = run('browser-e2e-canonical', 'npm', ['run', 'e2e:canonical'], { env: { FRONTEND_DIR: frontend },
  keep: l => !/transforming|modules transformed|gzip|rendering chunks|computing/.test(l) });
for (const [name, cwd] of [['dependency-audit-backend', '.'], ['dependency-audit-frontend', frontend]])
  run(name, 'npm', ['audit', '--registry=https://registry.npmjs.org', '--audit-level=high'], { cwd, informational: true });

// Facts from the database the tests ran against.
const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();
const migrations = (await client.query('select name, sha256 from schema_migration order by name')).rows;
const version = (await client.query('show server_version')).rows[0].server_version;
const tables = Number((await client.query("select count(*) n from information_schema.tables where table_schema = 'public'")).rows[0].n);
await client.end();

const count = (text, re) => Number(text.match(re)?.[1] ?? NaN);
const summary = {
  date: new Date().toISOString().slice(0, 10), scope: 'Slice 1 exit verification. Synthetic local development only; no deployment, no real learner data.',
  node: process.version, postgresql: version, database: new URL(env.DATABASE_URL).pathname.slice(1), publicTables: tables, migrations,
  backendTests: { total: count(tests, /ℹ tests (\d+)/), pass: count(tests, /ℹ pass (\d+)/), fail: count(tests, /ℹ fail (\d+)/), skipped: count(tests, /ℹ skipped (\d+)/) },
  browserE2E: { passed: count(e2e, /(\d+) passed/), failed: count(e2e, /(\d+) failed/) || 0 },
  manifest: { draftUnreviewed: count(draft, /UNREVIEWED=(\d+)/), strictErrors: count(strict, /(\d+) error\(s\)/) },
  checks,
};
writeFileSync('docs/backend-implementation/verification-slice1.json', JSON.stringify(summary, null, 2) + '\n');
console.log(`\n${checks.filter(c => c.result === 'pass').length}/${checks.length} checks passed, ${checks.filter(c => c.result === 'fail').length} failed; summary in docs/backend-implementation/verification-slice1.json`);
const findings = checks.filter(c => c.result === 'finding').map(c => c.name);
if (findings.length) console.log(`Findings (not gates): ${findings.join(', ')}`);
process.exit(checks.every(c => c.result !== 'fail') ? 0 : 1);
