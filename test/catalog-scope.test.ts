import test from 'node:test';
import assert from 'node:assert/strict';
import { lintManifest, loadManifest, type Manifest } from '../src/catalog/manifest.js';
import { snapshotOf } from '../src/catalog/publisher.js';
import { checkSignOffFile, composeRelease, homeTopic, parseScope, scopeHash, selectSignOffs, withRepoGrades, type SignOff } from '../src/catalog/scope.js';

// Sign-off dan rilis per lingkup memakai manifest repo sungguhan. Sign-off di sini sintetis (tes otomatis), bukan tinjauan guru.
const repo = loadManifest('catalog/manifest');
const clone = (m: Manifest): Manifest => JSON.parse(snapshotOf(m).json) as Manifest; // seperti snapshot di DB
const signed = (m: Manifest, text: string) => { const scope = parseScope(text);
  return { scope, signOff: { scope: text, name: 'Peninjau Sintetis', role: 'tes otomatis', date: '2026-11-12', contentSha256: scopeHash(m, scope) } as SignOff }; };
const reviews = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) value.forEach(v => reviews(v, out));
  else if (value && typeof value === 'object') { const r = (value as { review?: { status: string } }).review; if (r) out.push(r.status); Object.values(value).forEach(v => reviews(v, out)); }
  return out;
};

test('catalog scope: lingkup, kode pemilik, dan hash yang terikat pada isi', () => {
  assert.deepEqual(parseScope('MAT:D'), { subject: 'MAT', phase: 'D' });
  assert.deepEqual(parseScope('FIS:F+'), { subject: 'FIS', phase: 'F+' });
  assert.deepEqual(parseScope('KIM'), { subject: 'KIM' });
  for (const bad of ['mat', 'MAT:G', 'MAT:', '', 'MAT D']) assert.throws(() => parseScope(bad));
  assert.equal(homeTopic('MAT.TRI.L.SUDUT_ISTIMEWA'), 'MAT.TRI');
  assert.equal(homeTopic('MAT.C26.D.BILANGAN.Q.PECAHAN_1'), 'MAT.C26.D.BILANGAN');
  assert.equal(homeTopic('MAT.S.BANK'), null);
  const scope = parseScope('MAT:D'), before = scopeHash(repo, scope);
  const flipped = clone(repo); for (const t of flipped.topics) if (t.review) t.review.status = 'REVIEWED';
  assert.equal(scopeHash(flipped, scope), before, 'status review bukan isi');
  const edited = clone(repo), q = edited.questions.find(x => x.code.startsWith('MAT.C26.D.'))!;
  q.body.prompt += ' (diubah)';
  assert.notEqual(scopeHash(edited, scope), before, 'isi yang berubah mengubah hash');
  assert.equal(scopeHash(edited, parseScope('FIS:D')), scopeHash(repo, parseScope('FIS:D')), 'lingkup lain tidak terpengaruh');
});

test('catalog scope: rilis pertama hanya memuat lingkup yang ditandatangani dan lolos strict lint', () => {
  const { manifest, pruned } = composeRelease(null, repo, [signed(repo, 'MAT:D')], 1);
  assert.deepEqual(lintManifest(manifest, { strict: true }), []);
  assert.ok(manifest.topics.length > 0 && manifest.topics.every(t => t.subject === 'MAT' && t.phase === 'D'));
  assert.ok(manifest.questions.every(q => homeTopic(q.code)?.startsWith('MAT.C26.D.')));
  assert.ok(reviews(manifest).every(s => s === 'REVIEWED'));
  assert.equal(manifest.release.signOff.status, 'REVIEWED');
  assert.ok(manifest.release.signOff.reviewers.some(r => r.role.includes('lingkup MAT:D')));
  assert.ok(manifest.release.decisions.every(d => d.status === 'APPROVED'));
  assert.ok(pruned.every(p => p.kind === 'relation'), 'relasi ke topik yang belum terbit disisihkan, bukan isi lingkup');
});

test('catalog scope: produksi di luar lingkup tetap utuh dan suntingan yang belum ditandatangani tidak ikut terbit', () => {
  const live = clone(composeRelease(null, repo, [signed(repo, 'FIS:D')], 1).manifest);
  const edited = clone(repo);
  const fisLesson = edited.lessons.find(l => l.code.startsWith('FIS.C26.D.'))!;
  const original = fisLesson.title; fisLesson.title = 'Judul baru yang belum ditinjau';
  const { manifest, changes } = composeRelease(live, edited, [signed(edited, 'MAT:D')], 2);
  assert.deepEqual(lintManifest(manifest, { strict: true }), []);
  const fis = (m: Manifest) => JSON.stringify({ t: m.topics.filter(t => t.subject === 'FIS'), l: m.lessons.filter(l => l.code.startsWith('FIS.')), q: m.questions.filter(q => q.code.startsWith('FIS.')) });
  assert.equal(fis(manifest), fis(live), 'FIS persis seperti di produksi');
  assert.equal(manifest.lessons.find(l => l.code === fisLesson.code)?.title, original);
  assert.ok(manifest.topics.some(t => t.subject === 'MAT' && t.phase === 'D'));
  const mat = changes.find(c => c.scope === 'MAT:D')!;
  assert.ok(mat.added.length > 0); assert.deepEqual([mat.changed, mat.retired], [[], []]);
  assert.ok(manifest.release.signOff.reviewers.some(r => r.role.includes('lingkup FIS:D')), 'peninjau rilis sebelumnya tetap tercatat');
});

test('catalog scope: sign-off basi dilewati, item yang dihapus di dalam lingkup ditarik', () => {
  const file = { schemaVersion: 1 as const, signoffs: [signed(repo, 'MAT:D').signOff] };
  assert.equal(selectSignOffs(repo, file).included.length, 1);
  const edited = clone(repo); edited.questions.find(x => x.code.startsWith('MAT.C26.D.'))!.body.prompt += ' (diubah)';
  const sel = selectSignOffs(edited, file);
  assert.deepEqual([sel.included.length, sel.stale.length], [0, 1], 'isi berubah sesudah sign-off: tidak boleh terbit');

  const live = clone(composeRelease(null, repo, [signed(repo, 'MAT:D')], 1).manifest);
  const smaller = clone(repo), gone = smaller.lessons.find(l => l.code.startsWith('MAT.C26.D.'))!.code;
  smaller.lessons = smaller.lessons.filter(l => l.code !== gone);
  const { manifest, changes } = composeRelease(live, smaller, [signed(smaller, 'MAT:D')], 2);
  assert.deepEqual(lintManifest(manifest, { strict: true }), []);
  assert.ok(changes[0]!.retired.includes('lesson:' + gone));
  assert.ok(!manifest.lessons.some(l => l.code === gone));
});

test('catalog scope: file sign-off yang rusak ditolak', () => {
  const ok = signed(repo, 'MAT:D').signOff;
  assert.doesNotThrow(() => checkSignOffFile({ schemaVersion: 1, signoffs: [ok] }));
  for (const bad of [{}, { schemaVersion: 2, signoffs: [] }, { schemaVersion: 1, signoffs: [{ ...ok, name: '' }] },
    { schemaVersion: 1, signoffs: [{ ...ok, scope: 'mat' }] }, { schemaVersion: 1, signoffs: [{ ...ok, contentSha256: 'abc' }] }])
    assert.throws(() => checkSignOffFile(bad));
});

test('catalog scope: rilis khusus kelas hanya memasang kelas pada isi yang sudah tayang', () => {
  const noGrades = clone(repo);
  for (const t of noGrades.topics) for (const c of t.concepts) delete c.grade;
  const live = clone(composeRelease(null, noGrades, [signed(noGrades, 'FIS:D'), signed(noGrades, 'BIO')], 1).manifest);
  const { manifest, changed, skipped } = withRepoGrades(live, repo, 2);
  assert.deepEqual(lintManifest(manifest, { strict: true }), []);
  assert.equal(manifest.release.version, 2);
  assert.ok(changed.length > 0 && skipped.length === 0);
  assert.ok(manifest.topics.flatMap(t => t.concepts).filter(c => !c.hidden).every(c => c.grade !== undefined), 'semua inti yang tayang mendapat kelas');
  const strip = (m: Manifest) => { const x = clone(m); x.release.version = 0; for (const t of x.topics) for (const c of t.concepts) delete c.grade; return snapshotOf(x).json; };
  assert.equal(strip(manifest), strip(live), 'selain kelas dan versi, isi rilis sama persis: tidak ada materi, soal, atau bab baru');
  assert.equal(withRepoGrades(manifest, repo, 3).changed.length, 0, 'dijalankan ulang: tidak ada perubahan');
  const moved = clone(live), t = moved.topics.find(x => x.subject === 'FIS' && x.phase === 'D')!;
  t.phase = 'E';
  const r = withRepoGrades(moved, repo, 2);
  assert.ok(r.skipped.some(x => x.startsWith(t.concepts[0]!.code)), 'kelas di luar fase bab produksi tidak dipasang');
  assert.deepEqual(lintManifest(r.manifest, { strict: true }), []);
});
