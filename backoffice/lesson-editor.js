/* Editor materi berbentuk blok + pratinjau memakai halaman aplikasi siswa sendiri (/pratinjau/materi).
   Tidak ada HTML dari editor: semua isi dikirim sebagai teks dan dirender aplikasi sebagai teks. */
const TYPES = [
  ['heading', 'Judul'], ['text', 'Teks'], ['math', 'Rumus'], ['tip', 'Tip'], ['figure', 'Ilustrasi'],
];
const LABEL = Object.fromEntries(TYPES);
const MAX_SLIDES = 10;
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const blank = (type, slide) => type === 'math' ? { type, slide, name: '', expression: '' } : type === 'figure' ? { type, slide, figureRef: '' } : { type, slide, text: '' };

export function createLessonEditor({ $, api, notice, getState: current, reload }) {
  const getState = () => current() ?? { topics: [], lessons: [], practice: [], sources: {} };
  const form = $('#lessonMeta'), host = $('#slideEditor'), frame = $('#previewFrame');
  let draft = null, original = null, slide = 0, ready = false, origin = '', timer;

  function lessonOf(code) { return getState().lessons.find(l => l.code === code); }
  function coreInfo(codes) {
    const s = getState();
    for (const code of codes) for (const t of s.topics) {
      const c = t.concepts.find(x => x.code === code);
      if (c) return { core: c, topic: t, questions: s.practice.filter(q => q.concepts.includes(code)).length };
    }
    return null;
  }
  function slides() { return Math.max(1, ...draft.blocks.map(b => b.slide + 1)); }
  function checksOn(i) { return (original?.checks ?? []).filter(c => c.slideIndex === i).length; }

  function readMeta() {
    const f = form.elements;
    draft.code = f.code.value.trim(); draft.title = f.title.value.trim();
    draft.concepts = f.concepts.value.split(',').map(x => x.trim()).filter(Boolean);
    draft.estimatedMinutes = Number(f.estimatedMinutes.value) || 5; draft.source = f.source.value.trim();
  }

  function payload() {
    const info = coreInfo(draft.concepts);
    return { type: 'ib-lesson-preview', slide, lesson: {
      code: draft.code, title: draft.title, estimatedMinutes: draft.estimatedMinutes, blocks: draft.blocks,
      coreTitle: info?.core.title ?? draft.title, topicTitle: info?.topic.title ?? '', questionCount: info?.questions ?? 0 } };
  }
  function push() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (ready && draft && frame.contentWindow) frame.contentWindow.postMessage(payload(), origin); }, 120);
  }
  window.addEventListener('message', e => {
    if (e.source !== frame.contentWindow || e.origin !== origin || !e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'ib-lesson-preview-ready') { ready = true; push(); }
    if (e.data.type === 'ib-lesson-preview-slide' && Number.isInteger(e.data.slide)) { slide = e.data.slide; render(false); }
  });
  function mountPreview() {
    const url = getState().previewUrl;
    if (!url) return;
    const next = new URL(url).origin;
    if (frame.dataset.src === url) return;
    origin = next; ready = false; frame.dataset.src = url; frame.src = url;
    $('#previewNote').textContent = `Tampilan sama dengan halaman materi siswa (${new URL(url).host}). Klik "Lanjut" di pratinjau untuk pindah slide.`;
  }

  function field(block, key, label, multiline, max) {
    const l = el('label', label), input = el(multiline ? 'textarea' : 'input');
    if (multiline) input.rows = 3;
    input.value = block[key] ?? ''; input.maxLength = max;
    input.oninput = () => { block[key] = input.value; push(); };
    l.append(input); return l;
  }
  function blockCard(block, list) {
    const card = el('div', undefined, 'block-card');
    const head = el('div', undefined, 'block-head');
    head.append(el('strong', LABEL[block.type]));
    const tools = el('span', undefined, 'block-tools');
    const i = () => draft.blocks.indexOf(block);
    const sameSlide = () => draft.blocks.filter(b => b.slide === block.slide);
    const move = d => {
      const mine = sameSlide(), at = mine.indexOf(block), other = mine[at + d]; if (!other) return;
      const a = i(), b = draft.blocks.indexOf(other); [draft.blocks[a], draft.blocks[b]] = [draft.blocks[b], draft.blocks[a]]; render();
    };
    for (const [text, title, fn] of [['↑', 'Naikkan', () => move(-1)], ['↓', 'Turunkan', () => move(1)], ['✕', 'Hapus blok', () => { draft.blocks.splice(i(), 1); render(); }]]) {
      const b = el('button', text); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; tools.append(b);
    }
    head.append(tools); card.append(head);
    if (block.type === 'heading') card.append(field(block, 'text', 'Judul', false, 240));
    if (block.type === 'text') card.append(field(block, 'text', 'Teks · **tebal**', true, 2000));
    if (block.type === 'tip') card.append(field(block, 'text', 'Tip (kotak catatan)', true, 2000));
    if (block.type === 'math') {
      const row = el('div', undefined, 'math-row');
      row.append(field(block, 'name', 'Kiri', false, 240), el('span', '=', 'eq'), field(block, 'expression', 'Kanan', false, 240));
      const hl = el('label', undefined, 'check'), box = el('input'); box.type = 'checkbox'; box.checked = block.highlight === true;
      box.onchange = () => { if (box.checked) block.highlight = true; else delete block.highlight; push(); };
      hl.append(box, document.createTextNode(' Sorot rumus ini')); card.append(row, hl);
    }
    if (block.type === 'figure') {
      card.append(field(block, 'figureRef', 'Kode ilustrasi (huruf kecil, angka, -)', false, 40),
        el('small', 'Ilustrasi katalog belum digambar di halaman materi siswa; pratinjau tidak menampilkannya.', 'muted'));
    }
    list.append(card);
  }
  function render(scroll = true) {
    host.replaceChildren();
    if (!draft) return;
    const total = slides();
    for (let s = 0; s < total; s++) {
      const card = el('section', undefined, 'slide-card' + (s === slide ? ' current' : ''));
      const head = el('div', undefined, 'slide-head');
      const pick = el('button', `Slide ${s + 1}`, 'slide-pick'); pick.type = 'button'; pick.onclick = () => { slide = s; render(false); push(); };
      head.append(pick);
      const checks = checksOn(s);
      if (checks) head.append(el('span', `${checks} cek pemahaman terpasang`, 'badge'));
      const del = el('button', 'Hapus slide'); del.type = 'button';
      del.disabled = total === 1 || checks > 0;
      del.title = checks ? 'Slide ini punya cek pemahaman; tidak bisa dihapus dari studio' : '';
      del.onclick = () => {
        if (!confirm(`Hapus slide ${s + 1} beserta isinya?`)) return;
        draft.blocks = draft.blocks.filter(b => b.slide !== s).map(b => b.slide > s ? { ...b, slide: b.slide - 1 } : b);
        slide = Math.min(slide, slides() - 1); render();
      };
      head.append(del); card.append(head);
      const list = el('div', undefined, 'block-list');
      for (const b of draft.blocks.filter(b => b.slide === s)) blockCard(b, list);
      if (!list.children.length) list.append(el('p', 'Slide kosong. Tambahkan minimal satu blok.', 'muted'));
      card.append(list);
      const add = el('div', undefined, 'add-row'); add.append(el('small', 'Tambah:'));
      for (const [type, label] of TYPES) {
        const b = el('button', '+ ' + label); b.type = 'button';
        b.onclick = () => { const after = draft.blocks.map(x => x.slide).lastIndexOf(s); draft.blocks.splice(after + 1, 0, blank(type, s)); slide = s; render(); };
        add.append(b);
      }
      card.append(add);
      host.append(card);
    }
    $('#addSlide').disabled = total >= MAX_SLIDES;
    if (scroll) push();
  }

  function open(lesson, defaults = {}) {
    original = lesson ? structuredClone(lesson) : null;
    draft = lesson ? { code: lesson.code, title: lesson.title, concepts: [...lesson.concepts], estimatedMinutes: lesson.estimatedMinutes, source: getState().sources[lesson.code]?.[0] ?? '', blocks: structuredClone(lesson.blocks) }
      : { code: '', title: '', concepts: [], estimatedMinutes: 5, source: '', blocks: [blank('heading', 0), blank('text', 0), blank('heading', 1), blank('text', 1)], ...defaults };
    const f = form.elements;
    f.code.value = draft.code; f.code.readOnly = Boolean(lesson); f.title.value = draft.title;
    f.concepts.value = draft.concepts.join(', '); f.estimatedMinutes.value = draft.estimatedMinutes; f.source.value = draft.source;
    $('#lessonHeading').textContent = lesson ? `Edit materi · ${lesson.title}` : 'Materi baru';
    slide = 0; mountPreview(); render();
  }
  form.oninput = () => { if (draft) { readMeta(); push(); } };
  $('#addSlide').onclick = () => { if (!draft) open(null); const s = slides(); draft.blocks.push(blank('heading', s), blank('text', s)); slide = s; render(); };
  $('#newLesson').onclick = () => open(null);
  $('#saveLesson').onclick = async () => {
    if (!draft) return;
    readMeta();
    const button = $('#saveLesson'); button.disabled = true;
    try {
      await api('commands', { kind: 'lesson-blocks', code: draft.code, title: draft.title, concepts: draft.concepts, estimatedMinutes: draft.estimatedMinutes, blocks: draft.blocks, ...(draft.source ? { source: draft.source } : {}) });
      await reload();
      const saved = lessonOf(draft.code); if (saved) open(saved);
      notice('Materi tersimpan sebagai draf. Siswa belum melihatnya sampai katalog dipublikasikan.');
    } catch (e) { notice(e.message, true); } finally { button.disabled = false; }
  };
  /* Materi baru untuk satu inti: kode, judul, dan inti sudah terisi. */
  function forCore(topic, core) {
    const stem = `${topic.code}.L.${core.code.slice(topic.code.length + 1)}`;
    let code = stem, n = 2; while (lessonOf(code)) code = `${stem}_${n++}`;
    open(null, { code, title: core.title, concepts: [core.code], estimatedMinutes: core.estimatedMinutes ?? 5 });
  }
  return { open, forCore, refresh: () => { mountPreview(); if (draft) render(false); } };
}
