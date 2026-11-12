import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { readConfig } from '../../src/config.js';
import { connect } from '../../src/db.js';
import { formatFindings, lintManifest, loadManifest } from '../../src/catalog/manifest.js';
import { currentRelease, publish, PublishError, snapshotOf } from '../../src/catalog/publisher.js';
import { checkSignOffFile, composeRelease, scopeText, selectSignOffs, withRepoGrades } from '../../src/catalog/scope.js';
import { stable } from '../../src/platform/crypto.js';
// Usage: node --env-file=.env --import tsx scripts/catalog/release.ts [--publish] [--version N] [--out DIR] [--file catalog/signoffs.yaml] [--manifest catalog/manifest]
//        node --env-file=.env --import tsx scripts/catalog/release.ts --grades-only [--publish]
// Rilis per lingkup: isi produksi yang sedang aktif + lingkup yang sudah ditandatangani (catalog/signoffs.yaml) dan isinya
// belum berubah sejak ditandatangani. Bawaannya SIMULASI: hanya laporan. --publish menerbitkan lewat publisher yang sama
// (strict lint, transaksi, revisi immutable). Tidak ada jalan untuk menerbitkan lingkup yang belum ditandatangani.
const args = process.argv.slice(2);
const arg = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);

// --grades-only: rilis aktif tetap sama persis; hanya kelas tiap inti yang sudah tayang diambil dari repo. Tidak perlu file
// sign-off karena tidak ada materi atau soal yang berubah. Dipakai agar aplikasi bisa mengelompokkan bab per kelas tanpa
// menunggu tinjauan isi. Keputusan menjalankannya tetap di tangan operator; penempatan kelas belum diperiksa guru.
async function gradesOnlyRelease() {
  const repo = loadManifest(resolve(arg('--manifest') ?? 'catalog/manifest'));
  const db = connect(readConfig().databaseUrl);
  try {
    const live = await currentRelease(db);
    if (!live) throw new Error('Belum ada rilis aktif; --grades-only hanya memasang kelas pada rilis yang sudah ada.');
    const { manifest, changed, skipped } = withRepoGrades(live.snapshot, repo, live.version + 1);
    for (const x of skipped) console.warn(`DILEWATI ${x}`);
    if (!changed.length) { console.log(`Kelas di rilis ${live.version} sudah sama dengan repo; tidak ada yang diterbitkan.`); return; }
    const bySubject = new Map<string, number>();
    for (const c of changed) bySubject.set(c.subject, (bySubject.get(c.subject) ?? 0) + 1);
    console.log(`Dasar: rilis ${live.version} yang sedang aktif. Rilis baru: versi ${manifest.release.version}, HANYA kelas yang berubah.`);
    for (const [subject, n] of bySubject) console.log(`  ${subject}: ${n} inti mendapat kelas`);
    for (const c of changed.filter(x => x.from !== undefined)) console.log(`  pindah kelas: ${c.concept} ${c.from} → ${c.to}`);
    const findings = lintManifest(manifest, { strict: true });
    if (findings.length) { console.error(`Strict lint menolak rilis ini (${findings.length} temuan):\n${formatFindings(findings)}`); process.exitCode = 1; return; }
    if (!args.includes('--publish')) { console.log('SIMULASI: belum ada yang diterbitkan. Ulangi dengan --grades-only --publish setelah laporan di atas diperiksa.'); return; }
    const r = await publish(db, manifest);
    console.log(r.status === 'UNCHANGED' ? `Rilis ${r.version} sudah sama persis; tidak ada yang diterbitkan.`
      : `Rilis ${r.version} TERBIT (sha256 ${r.sha256}): hanya kelas; soal ${JSON.stringify(r.questions)}, materi ${JSON.stringify(r.lessons)}.`);
  } finally { await db.destroy(); }
}
if (args.includes('--grades-only')) { await gradesOnlyRelease(); process.exit(process.exitCode ?? 0); }

const file = resolve(arg('--file') ?? 'catalog/signoffs.yaml');
if (!existsSync(file)) { console.error(`Belum ada sign-off (${file}). Jalankan catalog:signoff-scope setelah lingkupnya ditinjau.`); process.exit(1); }
const repo = loadManifest(resolve(arg('--manifest') ?? 'catalog/manifest'));
const { included, stale } = selectSignOffs(repo, checkSignOffFile(parse(readFileSync(file, 'utf8'))));
for (const s of stale) console.warn(`DILEWATI ${scopeText(s.scope)}: isinya berubah sejak ditandatangani ${s.lastSigned.name} (${s.lastSigned.date}). Versi produksi dipertahankan; tinjau dan tandatangani ulang.`);
if (!included.length) { console.error('Tidak ada lingkup yang siap terbit.'); process.exit(1); }

const db = connect(readConfig().databaseUrl);
try {
  const live = await currentRelease(db);
  const version = Number(arg('--version') ?? (live ? live.version + 1 : 1));
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('--version harus bilangan bulat positif');
  const { manifest, pruned, changes } = composeRelease(live?.snapshot ?? null, repo, included, version);
  console.log(`Dasar: ${live ? `rilis ${live.version} yang sedang aktif` : 'belum ada rilis (rilis pertama)'}. Rilis baru: versi ${version}.`);
  for (const c of changes) console.log(`  ${c.scope}: ${c.added.length} baru, ${c.changed.length} berubah, ${c.retired.length} ditarik`);
  console.log(`  Total rilis: ${manifest.topics.length} topik, ${manifest.lessons.length} materi, ${manifest.questions.length} soal.`);
  if (pruned.length) {
    console.log(`  Disisihkan karena rujukannya belum terbit (${pruned.length}):`);
    for (const p of pruned) console.log(`    - ${p.kind} ${p.code}: ${p.reason}`);
  }
  // Isi (di luar metadata rilis) sama dengan yang sedang aktif: tidak ada yang perlu diterbitkan.
  const content = (m: typeof manifest) => stable({ ...m, release: null });
  if (live && content(manifest) === content(live.snapshot)) { console.log('Tidak ada perubahan isi dibanding rilis aktif; tidak ada yang diterbitkan.'); process.exit(0); }
  const findings = lintManifest(manifest, { strict: true });
  if (findings.length) { console.error(`Strict lint menolak rilis ini (${findings.length} temuan):\n${formatFindings(findings)}`); process.exitCode = 1; }
  const out = arg('--out');
  if (out) {
    mkdirSync(resolve(out), { recursive: true });
    writeFileSync(join(resolve(out), `release-${version}.json`), snapshotOf(manifest).json);
    writeFileSync(join(resolve(out), `release-${version}.md`), [`# Rilis ${version}`, '', `Dasar: ${live ? `rilis ${live.version}` : 'rilis pertama'}`, '',
      ...included.map(i => `- ${scopeText(i.scope)}: ditandatangani ${i.signOff.name} (${i.signOff.role}), ${i.signOff.date}`),
      ...stale.map(s => `- ${scopeText(s.scope)}: DILEWATI, isi berubah sejak sign-off ${s.lastSigned.date}`), '',
      ...changes.map(c => `## ${c.scope}\n\nBaru: ${c.added.join(', ') || '-'}\n\nBerubah: ${c.changed.join(', ') || '-'}\n\nDitarik: ${c.retired.join(', ') || '-'}\n`),
      '## Disisihkan', '', ...pruned.map(p => `- ${p.kind} ${p.code}: ${p.reason}`)].join('\n') + '\n');
    console.log(`  Arsip: ${resolve(out)}/release-${version}.json dan .md`);
  }
  if (!findings.length && !args.includes('--publish')) console.log('SIMULASI: belum ada yang diterbitkan. Ulangi dengan --publish setelah laporan di atas diperiksa.');
  if (!findings.length && args.includes('--publish')) {
    const r = await publish(db, manifest);
    console.log(r.status === 'UNCHANGED' ? `Rilis ${r.version} sudah sama persis; tidak ada yang diterbitkan.`
      : `Rilis ${r.version} TERBIT (sha256 ${r.sha256}): soal ${JSON.stringify(r.questions)}, materi ${JSON.stringify(r.lessons)}.`);
  }
} catch (e) {
  if (e instanceof PublishError) { console.error(`${e.code}: ${e.message}`); if (e.findings.length) console.error(formatFindings(e.findings)); process.exitCode = 1; }
  else throw e;
} finally { await db.destroy(); }
