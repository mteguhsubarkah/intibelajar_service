import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { loadManifest } from '../../src/catalog/manifest.js';
import { checkSignOffFile, parseScope, scopeHash, scopeSummary, scopeText, type SignOffFile } from '../../src/catalog/scope.js';
// Usage: npm run catalog:signoff-scope -- --scope MAT:D --name "Nama Guru" --role "Guru Matematika" [--file catalog/signoffs.yaml] [--manifest catalog/manifest]
// Mencatat bahwa seorang peninjau sudah memeriksa SATU lingkup (mapel, atau mapel:fase) dan mengikatnya ke isi saat ini
// lewat hash. Jalankan hanya setelah isi lingkup itu benar-benar diperiksa (lihat catalog:scope-sheet). Tidak ada nilai
// bawaan untuk nama atau peran. Tidak menerbitkan apa pun; rilis dibuat oleh catalog:release.
const args = process.argv.slice(2);
const arg = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const name = arg('--name')?.trim(), role = arg('--role')?.trim();
if (!name || !role || !arg('--scope')) {
  console.error('Wajib: --scope MAT:D --name "Nama Peninjau" --role "Peran". Sign-off adalah keputusan manusia, bukan bawaan.');
  process.exit(1);
}
const scope = parseScope(arg('--scope')!);
const repo = loadManifest(resolve(arg('--manifest') ?? 'catalog/manifest'));
const summary = scopeSummary(repo, scope);
if (!summary.topics) { console.error(`Lingkup ${scopeText(scope)} tidak punya topik di manifest; tidak ada yang ditandatangani.`); process.exit(1); }
const file = resolve(arg('--file') ?? 'catalog/signoffs.yaml');
const doc: SignOffFile = existsSync(file) ? checkSignOffFile(parse(readFileSync(file, 'utf8'))) : { schemaVersion: 1, signoffs: [] };
const contentSha256 = scopeHash(repo, scope), date = new Date().toISOString().slice(0, 10);
if (doc.signoffs.some(e => scopeText(parseScope(e.scope)) === scopeText(scope) && e.contentSha256 === contentSha256 && e.name === name && e.role === role)) {
  console.log(`${name} sudah menandatangani isi ${scopeText(scope)} yang sama; tidak ada yang berubah.`); process.exit(0);
}
doc.signoffs.push({ scope: scopeText(scope), name, role, date, contentSha256 });
writeFileSync(file, stringify(doc, { lineWidth: 0 }));
console.log(`Sign-off ${scopeText(scope)} dicatat atas nama ${name} (${role}), ${date}: ${summary.topics} topik, ${summary.concepts} inti, ` +
  `${summary.lessons} materi, ${summary.questions} soal (hash ${contentSha256.slice(0, 12)}).`);
console.log(`Simpan ${file} ke git, lalu jalankan catalog:release (simulasi dulu, kemudian --publish).`);
