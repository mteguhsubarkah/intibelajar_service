/* Bab per kelas: susunan bab buku teks kelas 7–12 (catalog/book-chapters.json, disalin dari FE) dengan inti katalog
   berurutan seperti di bab. Modul murni: dipakai tab "Bab per kelas" dan laporan cetaknya, tanpa DOM. */
export const GRADES = [7, 8, 9, 10, 11, 12];
export const BOOK_SUBJECTS = [['', 'Semua pelajaran'], ['MAT', 'Matematika'], ['FIS', 'Fisika'], ['KIM', 'Kimia'], ['BIO', 'Biologi']];

/**
 * status inti di draf studio: Siap (READY), Segera (PLANNED), Disembunyikan (hidden). "Belum ada di draf studio": kode ada di
 * bab buku FE tetapi tidak di draf (draf studio dibuat sekali dari manifest repo; inti baru di repo belum masuk draf).
 */
export function coreStatus(core) {
  if (!core) return { key: 'missing', label: 'Belum ada di draf studio' };
  if (core.hidden) return { key: 'hidden', label: 'Disembunyikan' };
  if (core.availability === 'PLANNED') return { key: 'planned', label: 'Segera' };
  return { key: 'ready', label: 'Siap' };
}

/**
 * Satu kelas: buku-bukunya dengan bab berurutan, lalu "inti tambahan" (inti katalog berkelas sama yang belum masuk
 * bab buku mana pun, dikelompokkan per topik). subject '' = semua pelajaran.
 */
export function gradeChapters(state, grade, subject = '') {
  const book = state.bookChapters ?? { books: [], chapters: [] };
  const cores = new Map(), topicOf = new Map();
  for (const t of state.topics) for (const c of t.concepts) { cores.set(c.code, c); topicOf.set(c.code, t); }
  const lessonOf = code => state.lessons.find(l => l.concepts.includes(code)) ?? null;
  const practiceOf = code => state.practice.filter(q => q.concepts.includes(code)).length;
  const core = code => {
    const c = cores.get(code) ?? null, lesson = c ? lessonOf(code) : null;
    return { code, title: c?.title ?? code, core: c, topic: topicOf.get(code) ?? null, status: coreStatus(c), lesson,
      slides: lesson ? Math.max(...lesson.blocks.map(b => b.slide)) + 1 : 0, practice: c ? practiceOf(code) : 0 };
  };
  const books = book.books.filter(b => b.grade === grade).map(b => ({
    ...b,
    chapters: book.chapters.filter(ch => ch.book === b.key && (!subject || ch.subject === subject))
      .map(ch => ({ ...ch, cores: ch.concepts.map(core) })),
  })).filter(b => b.chapters.length);
  const mapped = new Set(book.chapters.flatMap(ch => ch.concepts));
  const extras = [];
  for (const t of state.topics) {
    if (subject && t.subject !== subject) continue;
    const list = t.concepts.filter(c => c.grade === grade && !c.hidden && !mapped.has(c.code));
    if (list.length) extras.push({ topic: t, cores: list.slice().sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)).map(c => core(c.code)) });
  }
  const all = [...books.flatMap(b => b.chapters.flatMap(ch => ch.cores)), ...extras.flatMap(e => e.cores)];
  return {
    grade, books, extras,
    totals: {
      chapters: books.reduce((n, b) => n + b.chapters.length, 0),
      cores: all.length,
      ready: all.filter(c => c.status.key === 'ready').length,
      noLesson: all.filter(c => c.core && !c.lesson).length,
      noPractice: all.filter(c => c.core && !c.practice).length,
      missing: all.filter(c => c.status.key === 'missing').length,
    },
  };
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Laporan cetak (Simpan sebagai PDF): semua kelas yang dipilih, bab dan inti berurutan. */
export function bookReportHtml(state, grades = GRADES, subject = '', cssUrl = 'report.css') {
  const subjectName = BOOK_SUBJECTS.find(([code]) => code === subject)?.[1] ?? 'Semua pelajaran';
  const coreRows = list => `<ol class="book-cores">${list.map(c => `<li>${escape(c.title)} <small>${escape(c.code)} · ${escape(c.status.label)} · ${c.lesson ? `materi ${c.slides} slide` : 'belum ada materi'} · ${c.practice ? `${c.practice} soal latihan` : 'belum ada latihan'}</small></li>`).join('')}</ol>`;
  let html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Bab per kelas IntiBelajar - revisi ${escape(state.revision)}</title><link rel="stylesheet" href="${escape(cssUrl)}"></head><body>`;
  html += `<section><p class="eyebrow">INTIBELAJAR · BAB PER KELAS</p><h1>Bab per kelas · ${escape(subjectName)}</h1><p class="muted">Draf revisi ${escape(state.revision)}. Susunan bab: ${escape(state.bookChapters?.source ?? 'tidak tersedia')}.</p></section>`;
  for (const g of grades) {
    const v = gradeChapters(state, g, subject);
    if (!v.books.length && !v.extras.length) continue;
    html += `<section><h2>Kelas ${g}</h2><p class="muted">${v.totals.chapters} bab · ${v.totals.cores} inti · ${v.totals.ready} siap · ${v.totals.noLesson} belum ada materi · ${v.totals.noPractice} belum ada latihan</p>`;
    for (const b of v.books) {
      html += `<h3>${escape(b.title)}</h3><p class="muted">${escape(b.source)}</p>`;
      for (const ch of b.chapters) html += `<h4>${escape(ch.no)}: ${escape(ch.title)} <small>${escape(ch.label)}</small></h4>${ch.cores.length ? coreRows(ch.cores) : '<p class="muted">Belum ada inti di katalog untuk bab ini.</p>'}`;
    }
    if (v.extras.length) {
      html += '<h3>Inti tambahan (belum masuk bab buku)</h3>';
      for (const e of v.extras) html += `<h4>${escape(e.topic.title)} <small>${escape(e.topic.code)}</small></h4>${coreRows(e.cores)}`;
    }
    html += '</section>';
  }
  return html + '</body></html>';
}
