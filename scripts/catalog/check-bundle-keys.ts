import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadManifest, type Manifest } from '../../src/catalog/manifest.js';
// Slice 1 M8 (plan §3): keys of CATALOG items never ship in the frontend bundle. On-device items always carry
// their key (an answer index or `ok` flags), so the rule is stronger and simpler: no CATALOG item's prompt or
// rubric text may appear in the built bundle at all. PUBLIC_PRACTICE items are exempt (D4: keys already public).
//
//   npm run catalog:bundle-check -- --dist ../mockup/intibelajar/dist [--self-test]
// --self-test re-runs the check with one bundled item relabelled CATALOG and expects it to fail.

const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.(js|mjs|html|json|webmanifest)$/.test(name) ? [path] : [];
});
// Minifiers may escape non-ASCII (°, \xb0); compare against the decoded text.
const decode = (text: string) => text.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi, (_, a, b, c) => String.fromCodePoint(parseInt(a ?? b ?? c, 16)));

export function bundleLeaks(m: Manifest, bundle: string) {
  const leaks: string[] = [];
  for (const q of m.questions.filter(x => x.visibility === 'CATALOG')) {
    const secrets = [q.body.prompt, q.rubric.feedback?.correct, q.rubric.feedback?.incorrect, ...q.rubric.misconceptionMap.map(x => x.explanation),
      ...(q.rubric.workedSolution?.steps.map(s => s.body) ?? []), ...(q.rubric.evaluator === 'option-v1' ? [] : q.rubric.acceptedForms)];
    for (const s of secrets) if (s && s.length >= 8 && bundle.includes(s)) leaks.push(`${q.code}: ${s.slice(0, 60)}`);
  }
  return leaks;
}

const args = process.argv.slice(2);
const dist = resolve(args.includes('--dist') ? args[args.indexOf('--dist') + 1] ?? '' : '../mockup/intibelajar/dist');
const files = walk(dist);
if (!files.length) throw new Error(`No built frontend at ${dist}; run npm run build there first`);
const bundle = decode(files.map(f => readFileSync(f, 'utf8')).join('\n'));
const manifest = loadManifest(resolve('catalog/manifest'));
const leaks = bundleLeaks(manifest, bundle);
const catalogItems = manifest.questions.filter(q => q.visibility === 'CATALOG').length;
if (leaks.length) { console.error(`CATALOG content found in the bundle:\n  ${leaks.join('\n  ')}`); process.exit(1); }
console.log(`Bundle key check: ${files.length} files, ${catalogItems} CATALOG items, no CATALOG prompt or rubric text in the bundle`);
if (args.includes('--self-test')) {
  const probe = structuredClone(manifest);
  const bundled = probe.questions.find(q => bundle.includes(q.body.prompt));
  if (!bundled) throw new Error('self-test: no bundled item to relabel');
  bundled.visibility = 'CATALOG';
  if (!bundleLeaks(probe, bundle).length) { console.error('self-test failed: a bundled CATALOG item was not detected'); process.exit(1); }
  console.log(`Self-test: relabelling ${bundled.code} as CATALOG is detected`);
}
