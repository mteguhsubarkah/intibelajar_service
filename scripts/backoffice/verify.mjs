import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const dir = resolve('docs/backend-implementation/evidence/backoffice-' + new Date().toISOString().slice(0,10), new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(dir, { recursive: true });
const checks = [
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['module-boundaries', ['scripts/check-boundaries.mjs']],
  ['browser-script-syntax', ['--check', 'backoffice/app.js']],
  ['report-script-syntax', ['--check', 'backoffice/catalog-view.js']],
  ['backoffice-tests', ['--import', 'tsx', '--test', '--test-concurrency=1', 'test/backoffice.test.ts', 'test/backoffice-view.test.ts']],
];
const results = [];
for (const [name, args] of checks) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 8 << 20 });
  writeFileSync(join(dir, name + '.txt'), `$ node ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? '\nProcess error: ' + r.error.code : ''}\nExit: ${r.status}\n`);
  const result = { name, exit: r.status, pass: !r.error && r.status === 0 }; results.push(result);
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${name}`);
}
writeFileSync(join(dir, 'summary.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version, results }, null, 2) + '\n');
console.log('Evidence:', dir);
process.exitCode = results.every(r => r.pass) ? 0 : 1;
