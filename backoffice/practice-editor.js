/* Editor latihan inti: soal pilihan ganda dan soal angka untuk satu inti.
   Daftar soal datang tanpa kunci; kunci baru diminta saat satu soal dibuka untuk diedit. */
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const LETTER = i => String.fromCharCode(65 + i);
const TYPE = { MULTIPLE_CHOICE: 'Pilihan ganda', NUMERIC: 'Angka', FREE_RESPONSE: 'Uraian' };

export function createPracticeEditor({ $, api, notice, getState: current, reload, visibleTopics }) {
  const form = $('#questionForm');
  /* sebelum masuk studio belum ada data */
  const getState = () => current() ?? { topics: [], practice: [] };
  let options = ['', ''], key = null, legacy = false;

  const core = () => $('#practiceCore').value;
  function topicOf(code) { return getState().topics.find(t => t.concepts.some(c => c.code === code)); }

  function renderOptions() {
    const host = $('#optionList'); host.replaceChildren();
    options.forEach((label, i) => {
      const row = el('div', undefined, 'option-row');
      const pick = el('input'); pick.type = 'radio'; pick.name = 'answerIndex'; pick.value = String(i); pick.checked = key === i;
      pick.setAttribute('aria-label', `Pilihan ${LETTER(i)} adalah kunci`); pick.onchange = () => { key = i; };
      const input = el('input'); input.value = label; input.maxLength = 240; input.placeholder = `Pilihan ${LETTER(i)}`;
      input.oninput = () => { options[i] = input.value; };
      const del = el('button', '✕'); del.type = 'button'; del.title = 'Hapus pilihan'; del.setAttribute('aria-label', `Hapus pilihan ${LETTER(i)}`);
      del.disabled = options.length <= 2 || legacy;
      del.onclick = () => { options.splice(i, 1); if (key === i) key = null; else if (key !== null && key > i) key--; renderOptions(); };
      row.append(pick, el('b', LETTER(i)), input, del); host.append(row);
    });
    $('#addOption').disabled = options.length >= 6 || legacy;
  }
  function setType(type) {
    form.elements.itemType.value = type;
    $('#optionFields').hidden = type !== 'MULTIPLE_CHOICE';
    $('#numericFields').hidden = type !== 'NUMERIC';
  }
  function reset() {
    form.reset(); form.elements.code.value = ''; form.elements.itemType.disabled = false;
    options = ['', '', '', '']; key = null; legacy = false; setType('MULTIPLE_CHOICE'); renderOptions();
    const c = topicOf(core())?.concepts.find(x => x.code === core());
    $('#questionHeading').textContent = c ? `Soal baru · ${c.title}` : 'Soal baru';
    $('#questionNote').textContent = 'Kunci jawaban hanya dikirim ke studio saat satu soal dibuka.';
  }
  async function edit(code) {
    try {
      const q = await api('questions/' + encodeURIComponent(code));
      reset();
      const f = form.elements;
      f.code.value = q.code; f.itemType.disabled = true; setType(q.itemType);
      f.prompt.value = q.prompt; f.difficulty.value = String(q.difficulty); f.estimatedMinutes.value = String(q.estimatedMinutes);
      f.feedbackCorrect.value = q.feedbackCorrect; f.feedbackIncorrect.value = q.feedbackIncorrect;
      f.answerValue.value = q.answerValue ?? ''; f.unit.value = q.unit; f.answerExample.value = q.answerExample;
      options = q.options.length ? [...q.options] : ['', '']; key = q.answerIndex; legacy = q.legacy; renderOptions();
      $('#questionHeading').textContent = `Edit soal · ${q.code}`;
      $('#questionNote').textContent = legacy ? 'Soal ini dipakai aplikasi lama: teks boleh diubah, jumlah pilihan tetap.' : 'Jenis soal tidak bisa diganti; buat soal baru bila perlu.';
    } catch (e) { notice(e.message, true); }
  }

  function renderCores() {
    const topic = getState().topics.find(t => t.code === $('#practiceTopic').value);
    const prev = core(), select = $('#practiceCore'); select.replaceChildren();
    for (const c of topic?.concepts ?? []) {
      const n = getState().practice.filter(q => q.concepts.includes(c.code)).length;
      const o = el('option', `${c.title} · ${n ? n + ' soal' : 'belum ada latihan'}`); o.value = c.code; select.append(o);
    }
    if ([...select.options].some(o => o.value === prev)) select.value = prev;
    renderList();
  }
  function renderList() {
    const list = $('#practiceList'); list.replaceChildren();
    const items = getState().practice.filter(q => q.concepts.includes(core()));
    $('#practiceSummary').textContent = core() ? `${items.length} soal latihan untuk inti ini. Soal dengan lebih dari satu inti ikut dihitung bila inti ini utama.` : 'Pilih inti.';
    for (const q of items) {
      const row = el('div', undefined, 'row'), text = el('div');
      text.append(el('p', q.prompt), el('small', `${q.code} · ${TYPE[q.itemType] ?? q.itemType} · tingkat ${q.difficulty} · ±${q.estimatedMinutes} mnt${q.only ? '' : ' · gabungan beberapa inti'}`));
      if (q.options.length) text.append(el('small', q.options.map((o, i) => `${LETTER(i)}. ${o}`).join('   ')));
      row.append(text);
      const b = el('button', q.editable ? 'Edit' : 'Lewat manifest'); b.disabled = !q.editable;
      if (!q.editable) b.title = 'Soal ini memakai penilai khusus (uraian / langkah); edit lewat manifest.';
      b.onclick = () => edit(q.code); row.append(b); list.append(row);
    }
    if (!items.length) list.append(el('p', 'Belum ada soal latihan. Siswa yang membuka materi inti ini tidak mendapat tombol "Latihan inti ini".', 'muted'));
  }
  function render() {
    const topics = visibleTopics();
    const sel = $('#practiceTopic');
    if (!topics.some(t => t.code === sel.value) && topics[0]) sel.value = topics[0].code;
    renderCores();
  }
  function openFor(topic, coreCode) {
    $('#practiceTopic').value = topic.code; renderCores(); $('#practiceCore').value = coreCode; renderList(); reset();
  }

  $('#practiceTopic').onchange = () => { renderCores(); reset(); };
  $('#practiceCore').onchange = () => { renderList(); reset(); };
  $('#newQuestion').onclick = reset;
  $('#addOption').onclick = () => { options.push(''); renderOptions(); };
  form.elements.itemType.onchange = () => setType(form.elements.itemType.value);
  form.onsubmit = async e => {
    e.preventDefault();
    const f = form.elements, type = f.itemType.value, button = form.querySelector('button.primary');
    if (!core()) { notice('Pilih inti dulu.', true); return; }
    button.disabled = true;
    try {
      const r = await api('commands', {
        kind: 'question', code: f.code.value, concept: core(), itemType: type, prompt: f.prompt.value,
        difficulty: f.difficulty.value, estimatedMinutes: f.estimatedMinutes.value,
        feedbackCorrect: f.feedbackCorrect.value, feedbackIncorrect: f.feedbackIncorrect.value,
        ...(type === 'MULTIPLE_CHOICE' ? { options, answerIndex: key ?? -1 } : { answerValue: f.answerValue.value, unit: f.unit.value, answerExample: f.answerExample.value }),
        ...(f.source.value ? { source: f.source.value } : {}),
      });
      await reload();
      notice(`Soal ${r.code} tersimpan sebagai draf. Siswa belum melihatnya sampai katalog dipublikasikan.`);
      await edit(r.code);
    } catch (err) { notice(err.message, true); } finally { button.disabled = false; }
  };
  reset();
  return { render, openFor };
}
