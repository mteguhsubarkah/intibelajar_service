// tower-v1 final-value mutation checks (2026-10-26 change). One at a time, restored in `finally` with write retries.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const F = 'src/assessment/evaluators/tower-v1.ts';
const write = (file, text) => { for (let i = 0; ; i++) { try { writeFileSync(file, text); return; } catch (e) { if (i >= 20) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } } };
const mutations = [
  ['sentence ends do not split clauses', 'text.split(/(,\\s+|\\.\\s+|\\n|;)/)', 'text.split(/(,\\s+|\\n|;)/)'],
  ['another letter is never read', "const slot = head[1] ? 'named' : unknowns.has(head[2]!.toLowerCase()) ? 'other' : null;", "const slot = head[1] ? 'named' : null;"],
  ['any letter is read (no unknown check)', "unknowns.has(head[2]!.toLowerCase()) ? 'other' : null", "'other'"],
  ['another letter wins over x', 'return best.named ?? best.other;', 'return best.other ?? best.named;'],
  ['trailing punctuation kept in the value', "const value = side.replace(/[\\s,.;:]+$/, '');", 'const value = side.trimEnd();'],
  ['"jarak" is not a name of the unknown', '(x|jarak(?:nya)?(?:\\s+mendatar(?:nya)?)?)', '(x)'],
];
let survived = 0;
for (const [name, from, to] of mutations) {
  const original = readFileSync(F, 'utf8');
  try {
    if (!original.includes(from)) throw new Error('anchor: ' + name);
    write(F, original.replace(from, to));
    const r = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--test', 'test/evaluators.test.ts'], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 240000 });
    const failing = (r.stdout.match(/^✖ .*$/gm) ?? []).filter(l => !/failing tests/.test(l)).map(l => l.slice(2, 70)).filter((v, i, a) => a.indexOf(v) === i).join(' | ');
    if (r.status === 0 || r.status === null) survived++;
    console.log(`${r.status === null ? 'TIMEOUT ' : r.status !== 0 ? 'KILLED  ' : 'SURVIVED'} ${name} (exit ${r.status})${failing ? ' — ' + failing : ''}`);
  } finally { write(F, original); }
}
console.log(`${mutations.length - survived}/${mutations.length} mutations killed`);
process.exit(survived ? 1 : 0);
