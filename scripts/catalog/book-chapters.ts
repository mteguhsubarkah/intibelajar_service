// Usage: FRONTEND_DIR=../intibelajar npm run catalog:book-chapters [-- --frontend ../intibelajar]
// Menyalin susunan bab buku per kelas dari FE (src/data/bookChapters.ts) ke catalog/book-chapters.json supaya backoffice
// bisa menampilkan bab kelas 7–12 dengan inti berurutan. FE tetap sumber kebenarannya; jalankan ulang setiap kali
// bookChapters.ts berubah (tes test/book-chapters.test.ts memeriksa setiap kode inti ada di manifest).
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1]! : fallback; };
const frontendDir = resolve(arg('--frontend', process.env.FRONTEND_DIR ?? '../intibelajar'));
const file = join(frontendDir, 'src', 'data', 'bookChapters.ts');
if (!existsSync(file)) throw new Error(`bookChapters.ts tidak ada di ${frontendDir} (set FRONTEND_DIR atau --frontend)`);

type Field = 'Matematika' | 'Matematika Lanjut' | 'Fisika' | 'Kimia' | 'Biologi' | 'Terpadu';
const fe = await import(pathToFileURL(file).href) as {
  BOOKS: { key: string; grade: number; title: string; source: string; ipa?: boolean }[];
  BOOK_CHAPTERS: { id: string; book: string; grade: number; no: string; title: string; field: Field; subject: string; concepts: string[] }[];
  fieldLabel: (grade: number, field: Field) => string;
};
let commit = 'unknown';
try { commit = execFileSync('git', ['-C', frontendDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* bukan checkout git */ }

const out = {
  schemaVersion: 1,
  source: `FE src/data/bookChapters.ts @ ${commit}`,
  books: fe.BOOKS.map(b => ({ key: b.key, grade: b.grade, title: b.title, source: b.source, ipa: b.ipa === true })),
  chapters: fe.BOOK_CHAPTERS.map(ch => ({ id: ch.id, book: ch.book, grade: ch.grade, no: ch.no, title: ch.title, field: ch.field,
    label: fe.fieldLabel(ch.grade, ch.field), subject: ch.subject, concepts: [...ch.concepts] })),
};
const target = resolve('catalog/book-chapters.json');
writeFileSync(target, JSON.stringify(out, null, 1) + '\n');
console.log(`${out.chapters.length} bab dari ${out.books.length} buku ditulis ke ${target} (${out.source})`);
