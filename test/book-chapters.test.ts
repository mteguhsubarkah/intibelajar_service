import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draftManifest } from './fixtures/catalog.js';
// @ts-expect-error plain browser JS module
import { gradeChapters, bookReportHtml, coreStatus } from '../backoffice/book-view.js';

const book = JSON.parse(readFileSync(new URL('../catalog/book-chapters.json', import.meta.url), 'utf8'));
const manifest = draftManifest();
const cores = new Map(manifest.topics.flatMap(t => t.concepts.map(c => [c.code, c])));

test('book chapters (salinan FE) only point at catalog concepts, once each, for grades 7–12', () => {
  assert.deepEqual([...new Set(book.chapters.map((c: any) => c.grade))].sort((a: any, b: any) => a - b), [7, 8, 9, 10, 11, 12]);
  const missing = book.chapters.flatMap((ch: any) => ch.concepts.filter((code: string) => !cores.has(code)).map((code: string) => `${ch.id} ${code}`));
  assert.deepEqual(missing, [], 'jalankan npm run catalog:book-chapters setelah bookChapters.ts FE berubah');
  const seen = book.chapters.flatMap((ch: any) => ch.concepts);
  assert.equal(new Set(seen).size, seen.length, 'satu inti hanya di satu bab');
  for (const ch of book.chapters) assert.ok(book.books.some((b: any) => b.key === ch.book && b.grade === ch.grade), ch.id);
});

test('Bab per kelas view: kelas 7 Matematika, Bab 1 Bilangan Bulat berurutan, status, materi dan latihan', () => {
  const state = { revision: 1, topics: manifest.topics, lessons: manifest.lessons,
    practice: manifest.questions.map(q => ({ code: q.code, concepts: q.concepts.filter(c => c.role === 'PRIMARY' && c.assessable).map(c => c.concept) })), bookChapters: book };
  const v = gradeChapters(state, 7, 'MAT');
  assert.deepEqual(v.books.map((b: any) => b.key), ['MAT7']);
  const bab1 = v.books[0].chapters[0];
  assert.equal(`${bab1.no}: ${bab1.title}`, 'Bab 1: Bilangan Bulat');
  assert.deepEqual(bab1.cores.map((c: any) => [c.title, c.status.key]), [
    ['Bilangan bulat dan garis bilangan', 'planned'],
    ['Penjumlahan dan pengurangan bilangan bulat', 'ready'],
    ['Perkalian dan pembagian bilangan bulat', 'planned'],
  ]);
  assert.ok(bab1.cores[1].lesson && bab1.cores[1].practice > 0, 'inti siap punya materi dan latihan');
  assert.equal(v.totals.missing, 0);
  // IPA kelas 7 tampil dengan labelnya, pelajaran lain tidak bocor ke filter Matematika
  const ipa = gradeChapters(state, 7, 'KIM');
  assert.ok(ipa.books.every((b: any) => b.chapters.every((ch: any) => ch.subject === 'KIM')));
  assert.ok(ipa.books[0].chapters[0].label.startsWith('IPA Terpadu'));
  // SMA: tidak ada pengelompokan atau label "IPA"; kelas 10 terpisah Fisika, Kimia, Biologi (SMP tetap IPA Terpadu)
  for (const g of [10, 11, 12]) for (const b of gradeChapters(state, g).books) {
    assert.ok(!/^IPA/.test(b.title), `kelas ${g}: ${b.title}`);
    for (const ch of b.chapters) assert.ok(!ch.label.includes('IPA'), `kelas ${g}: ${ch.no} ${ch.label}`);
  }
  assert.deepEqual(gradeChapters(state, 10).books.map((b: any) => b.title), ['Matematika Kelas X (Edisi Revisi)', 'Fisika Kelas X', 'Kimia Kelas X', 'Biologi Kelas X']);
  assert.ok(gradeChapters(state, 10, 'KIM').books.every((b: any) => b.chapters.every((ch: any) => ch.label === 'Kimia')));
  assert.ok(gradeChapters(state, 8).books.some((b: any) => b.chapters.some((ch: any) => ch.label.startsWith('IPA Terpadu'))));
  // inti tambahan: berkelas sama, tidak di bab mana pun
  const mapped = new Set(book.chapters.flatMap((ch: any) => ch.concepts));
  for (const g of [7, 8, 9, 10, 11, 12]) for (const e of gradeChapters(state, g).extras) for (const c of e.cores) assert.ok(!mapped.has(c.code) && c.core.grade === g);
  // laporan cetak memuat bab dan inti berurutan
  const html = bookReportHtml(state, [7], 'MAT');
  assert.ok(html.indexOf('Bilangan bulat dan garis bilangan') < html.indexOf('Penjumlahan dan pengurangan bilangan bulat'));
  assert.ok(html.includes('Bab 1: Bilangan Bulat'));
});

test('book view escapes authored text and reports unknown codes instead of failing', () => {
  const state = { revision: '<1>', topics: [{ code: 'T', subject: 'MAT', title: 'A <b>', concepts: [{ code: 'T.X', title: 'Inti <script>', grade: 7, availability: 'READY' }], prerequisites: [] }],
    lessons: [], practice: [], bookChapters: { source: 's', books: [{ key: 'B', grade: 7, title: 'Buku', source: 'x' }],
      chapters: [{ id: 'B.1', book: 'B', grade: 7, no: 'Bab 1', title: 'Satu', label: 'Matematika', subject: 'MAT', concepts: ['T.X', 'T.HILANG'] }] } };
  const v = gradeChapters(state, 7);
  assert.deepEqual(v.books[0].chapters[0].cores.map((c: any) => c.status.key), ['ready', 'missing']);
  assert.equal(v.totals.missing, 1);
  assert.equal(coreStatus({ hidden: true }).key, 'hidden');
  const html = bookReportHtml(state, [7]);
  assert.ok(!html.includes('<script>') && html.includes('Inti &lt;script&gt;'));
});
