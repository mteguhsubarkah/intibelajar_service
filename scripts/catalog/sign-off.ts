import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
// Usage: npm run catalog:signoff -- --name "Nama Peninjau" --role "Guru Matematika" [--version 3] [--manifest catalog/manifest]
// Mencatat tinjauan manusia: setiap tag review PROPOSED menjadi REVIEWED, semua keputusan disetujui, dan sign-off rilis
// berisi nama, peran, dan tanggal peninjau. Jalankan hanya setelah isi (catalog/pilot-review.md) benar-benar diperiksa.
// Tidak ada nilai bawaan untuk nama atau peran: tanpa keduanya skrip berhenti.
const args = process.argv.slice(2);
const arg = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const name = arg('--name')?.trim(), role = arg('--role')?.trim(), version = arg('--version');
if (!name || !role) {
  console.error('Wajib: --name "Nama Peninjau" --role "Peran" (mis. "Guru Kimia"). Sign-off adalah keputusan manusia, bukan bawaan.');
  process.exit(1);
}
const dir = resolve(arg('--manifest') ?? 'catalog/manifest');
const dump = (value: unknown) => stringify(value, { lineWidth: 0, aliasDuplicateObjects: false });
let marked = 0;
const mark = (node: unknown): void => {
  if (Array.isArray(node)) { node.forEach(mark); return; }
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>, review = o.review as { status?: string } | undefined;
  if (review?.status === 'PROPOSED') { review.status = 'REVIEWED'; marked++; }
  Object.values(o).forEach(mark);
};
const files = [
  ...['subjects.yaml', 'topic-relations.yaml', 'sets.yaml'].map(f => join(dir, f)),
  ...['topics', 'questions', 'lessons'].flatMap(sub => readdirSync(join(dir, sub)).filter(n => n.endsWith('.yaml')).map(n => join(dir, sub, n))),
  ...readdirSync(join(dir, '../authored')).filter(n => n.endsWith('.yaml')).map(n => join(dir, '../authored', n)),
  ...readdirSync(join(dir, '../authored/lessons')).filter(n => n.endsWith('.yaml')).map(n => join(dir, '../authored/lessons', n)),
];
for (const file of files) {
  const before = marked, doc = parse(readFileSync(file, 'utf8'));
  mark(doc);
  if (marked !== before) writeFileSync(file, dump(doc));
}
const releaseFile = join(dir, 'release.yaml'), release = parse(readFileSync(releaseFile, 'utf8')) as {
  version: number; signOff: { status: string; reviewers: { name: string; role: string; date: string }[] }; decisions: { status: string }[] };
release.decisions.forEach(d => { d.status = 'APPROVED'; });
release.signOff = { status: 'REVIEWED', reviewers: [...release.signOff.reviewers, { name, role, date: new Date().toISOString().slice(0, 10) }] };
if (version) release.version = Number(version);
writeFileSync(releaseFile, dump(release));
console.log(`Sign-off dicatat atas nama ${name} (${role}): ${marked} tag review, ${release.decisions.length} keputusan, rilis versi ${release.version}.`);
