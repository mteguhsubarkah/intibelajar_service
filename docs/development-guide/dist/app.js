'use strict';
(() => {
  const data = window.INTIBELAJAR_GUIDE_DATA;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if(cls) n.className = cls; if(text !== undefined) n.textContent = text; return n; };
  const $ = id => document.getElementById(id);
  if (!data) { $('slice-list').textContent = 'Snapshot belum tersedia. Lihat README untuk membuatnya.'; return; }
  $('snapshot').textContent = `Dari plan lokal · ${data.sourceDate} · bukan status live`;
  $('source-note').textContent = 'Ringkasan mengikuti plan §17–18. B-03 sudah ditutup; B-01/B-02 masih terbuka. FE/BE bisa dicoba lokal dengan akun sintetis, tanpa deployment atau AI. Status tidak berubah lewat halaman ini.';
  const names = {
    1:['Daftar dan identitas materi','Database dan publisher katalog','API untuk membaca katalog','Database sesi belajar dan penghapusan data','Penilai jawaban angka dan pilihan','Mesin sesi latihan dan endpoint','Sambungkan API latihan lama','Sambungkan frontend dan uji browser','Verifikasi akhir dan laporan'],
    2:['Siapkan konten alur soal','Penilai jawaban soal menara','Database laporan dan antrean job','Aturan perpindahan tahap belajar','Service dan endpoint alur soal','Laporan hasil keliru dan penanganan staf','Sambungkan API frontend lama','Hubungkan /coba dan /challenge ke sesi backend','Verifikasi akhir di CI dan laporan']
  };
  const s2Labels = ['Sebagian selesai','Terverifikasi; review konten terbuka','Sudah di-commit','Sudah di-commit','Ada kode; B-01/B-02 terbuka','Sisi learner selesai; staf tunggu D7','Sebagian selesai; tunggu D3/D6','Sebagian terverifikasi; lokal tersedia','Menunggu syarat exit'];
  const d2Names = ['Cara memindahkan penilaian dari frontend','Materi mana untuk rekomendasi tiap konsep','Isi materi dua slide di funnel','Uji antrean dengan engine palsu khusus tes','Nasib alur lama yang tidak dirutekan','Isi dan urutan hint tutor','Alat staf untuk menyelesaikan laporan','Izin push dan akses CI remote'];
  const d1Names = ['Menjaga materi terbit tetap tidak berubah','Menyimpan beberapa alias untuk konten yang sama','Skema kode konten dan penanggung jawab approval','Aturan soal yang kuncinya sudah terbuka','Identitas dua versi soal menara','Materi mengajarkan / menguji konsep apa','Pilihan tooling test','Aturan consent untuk latihan guest'];
  const sliceStates = ['Fondasi dev tersedia','Engineering dev selesai','Kita di sini','Berikutnya','Berikutnya / paralel Slice 3','Setelah gate pilot','Setelah Slice 5'];
  function workRow(code, title, note, status, type) {
    const row = el('div', 'work-row'), copy = el('div');
    copy.append(el('div', 'work-title', title)); if(note) copy.append(el('p', 'work-note', note));
    row.append(el('span', 'work-code', code), copy, el('span', `tag ${type}`, status)); return row;
  }
  data.roadmap.forEach(r => {
    const d = el('details', `slice${r.id === 2 ? ' current' : ''}`); d.open = r.id === 2;
    const sum = el('summary'); sum.append(el('span', 'slice-no', `Slice ${r.id}`), el('span', 'slice-name', r.title), el('span', `tag ${r.id === 2 ? 'next' : r.id < 2 ? 'good' : 'wait'}`, sliceStates[r.id]));
    const body = el('div', 'slice-body'); body.append(el('p', '', r.plain));
    if (r.id === 1 || r.id === 2) {
      body.append(el('p', '', r.id === 1 ? 'M1–M9 selesai untuk engineering dengan fixture sintetis. Rilis katalog asli masih menunggu review D3–D6.' : 'M tidak harus dikerjakan berurutan: M3/M4 bisa paralel, lalu M5 bergantung pada M2/M3/M4. M6/M7 dapat memakai implementasi M5, tetapi gate M5 belum tertutup.'));
      const list = el('div', 'work-list');
      data.milestones.filter(m => m.slice === r.id).forEach((m, i) => {
        list.append(workRow(`S${r.id} / ${m.id}`, names[r.id][i], r.id === 2 ? m.note : '', r.id === 1 ? 'Engineering dev selesai' : s2Labels[i], r.id === 1 || m.state === 'verified' ? 'good' : m.state === 'partial' || m.state === 'gate' ? 'open' : 'wait'));
      }); body.append(list);
      const decisions = el('details', 'decision-table'); decisions.append(el('summary', 'small-heading', `Keputusan Slice ${r.id}: D1–D8`));
      const records = r.id === 2 ? data.decisions : data.slice1Decisions || [];
      records.forEach((v, i) => {
        const status = r.id === 2 ? v.approved ? 'Approved' : 'Terbuka' : v.status;
        decisions.append(workRow(`S${r.id} / ${v.id}`, (r.id === 2 ? d2Names : d1Names)[i], '', status, status === 'Approved' ? 'good' : status === 'Default development' ? 'wait' : 'open'));
      }); body.append(decisions);
    } else {
      const descriptions = {
        0:'Fondasi backend, database, sesi login, keamanan, onboarding, dan consent. Ini landasan Slice berikutnya; bukan pernyataan siap produksi.',
        3:'Setelah Slice 2: isi progres Map/Home dari backend, aturan penguasaan materi, XP, dan streak.',
        4:'Setelah Slice 2, dapat paralel dengan Slice 3: kelanjutan akun, import riwayat, retensi, dan hak data.',
        5:'Setelah gate pilot: integrasi AI diagnosis/tutor, consent dan provider. AI masih dinonaktifkan sekarang.',
        6:'Setelah Slice 5: intake soal sendiri, foto dan OCR dengan kontrol privasi.'
      }; body.append(el('p', '', descriptions[r.id]));
      if(r.id > 2) body.append(el('p', 'note', 'Belum ada breakdown M/D khusus Slice ini pada plan implementasi yang dipakai halaman ini. Jangan memakai nomor M/D Slice 2 untuk tahap ini.'));
    }
    const a = el('a', 'source-link', 'Lihat dokumen sumber ↗'); a.href = r.id === 1 ? '../../backend-implementation/03-slice1-plan.md' : r.id === 2 ? '../../backend-implementation/05-slice2-plan.md' : '../../backend-architecture/12-implementation-roadmap.md'; a.target = '_blank'; a.rel = 'noopener'; body.append(a);
    d.append(sum, body); $('slice-list').append(d);
  });
  const prompt = 'Lanjutkan IntiBelajar dengan fokus B-01/B-02 di docs/backend-implementation/05-slice2-plan.md §14 dan status terbaru §17–18. B-03 sudah ditutup; jangan mengulanginya sebagai pekerjaan utama. Cari akar masalah 500 pada T01-11 dan respons yang kehilangan items pada model test, tambahkan diagnosis log aman tanpa data pribadi, lalu perbaiki penyebab yang benar-benar terbukti. Penuhi acceptance criteria masing-masing sebelum menutupnya. Jangan sekadar menaikkan timeout, melemahkan tes, atau menutup temuan karena satu run hijau. Simpan evidence baru tanpa menimpa evidence lama. Pertahankan database intibelajar_local_dev dan launcher lokal agar pengguna bisa mencoba FE/BE. Tetap data sintetis, tanpa AI, deployment, push, atau perubahan approval konten. Catat hasil dan batas yang tersisa.';
  $('next-prompt').textContent = prompt;
  $('copy-task').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(prompt); $('copy-status').textContent = 'Teks tugas tersalin.';
    } catch {
      $('task-text').open = true;
      const range = document.createRange(); range.selectNodeContents($('next-prompt'));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      $('copy-status').textContent = 'Teks dipilih. Tekan Ctrl+C untuk menyalin.';
    }
  });
})();
