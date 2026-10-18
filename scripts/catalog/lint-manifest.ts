import { resolve } from 'node:path';
import { formatFindings, lintManifest, loadManifest } from '../../src/catalog/manifest.js';
// Usage: npm run catalog:lint [-- --strict] [--manifest catalog/manifest]
// --strict is what the publisher applies: open PROPOSED review tags and a pending sign-off are errors.
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const dir = resolve(args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] ?? '' : 'catalog/manifest');
const findings = lintManifest(loadManifest(dir), { strict });
const errors = findings.filter(f => f.severity === 'error'), warnings = findings.filter(f => f.severity === 'warning');
if (findings.length) console.log(formatFindings([...errors, ...warnings]));
const counts = new Map<string, number>();
for (const f of warnings) counts.set(f.rule, (counts.get(f.rule) ?? 0) + 1);
const byRule = [...counts].map(([rule, n]) => `${rule}=${n}`).join(', ');
console.log(`Manifest lint (${strict ? 'strict' : 'draft'}): ${errors.length} error(s), ${warnings.length} warning(s)${byRule ? ` [${byRule}]` : ''}`);
process.exit(errors.length ? 1 : 0);
