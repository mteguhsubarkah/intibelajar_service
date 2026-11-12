/* Halaman akun (QA): daftar akun terdaftar dan hapus akun uji.
   Data baru dimuat saat tab dibuka (setiap pembukaan tercatat di audit server) dan tidak disimpan di browser.
   Penghapusan memakai jalur "hapus akun" BE yang sama dengan milik siswa; konfirmasi wajib mengetik ulang label akun. */
const STATUS = { ACTIVE: 'Aktif', PENDING_CONSENT: 'Belum lengkapi profil', DELETION_PENDING: 'Sedang dihapus', SUSPENDED: 'Ditangguhkan', DISABLED: 'Nonaktif' };
const when = iso => iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function createAccountsView({ $, el, api, notice }) {
  let rows = [], openId = null, loading = false;

  async function load() {
    if (loading) return;
    loading = true; $('#accountList').replaceChildren(el('p', 'Memuat akun…', 'muted'));
    try {
      const r = await api('accounts');
      $('#accountsOff').hidden = r.enabled;
      rows = r.enabled ? r.accounts : [];
      $('#accountStaff').textContent = r.enabled ? `Masuk sebagai ${r.staff}. Pembukaan halaman ini tercatat di audit.` : '';
      render();
    } catch (e) { $('#accountList').replaceChildren(); notice(e.message, true); }
    finally { loading = false; }
  }

  function cell(text, cls) { return el('td', text ?? '—', cls); }

  function render() {
    const q = $('#accountSearch').value.trim().toLowerCase();
    const list = rows.filter(a => !q || [a.label, a.displayName, a.email].some(v => v && v.toLowerCase().includes(q)));
    $('#accountSummary').textContent = rows.length ? `${list.length} dari ${rows.length} akun · terbaru di atas` : '';
    if (!rows.length) { $('#accountList').replaceChildren($('#accountsOff').hidden ? el('p', 'Belum ada akun terdaftar.', 'muted') : ''); return; }
    const table = el('table', undefined, 'accounts-table'), head = el('tr');
    for (const h of ['Akun', 'Masuk dengan', 'Email', 'Kelas', 'Status', 'Daftar', 'Terakhir masuk', '']) head.append(el('th', h));
    const thead = el('thead'); thead.append(head);
    const body = el('tbody');
    for (const a of list) {
      const tr = el('tr');
      const name = el('td'); name.append(el('b', a.displayName ?? '(belum isi nama)'), el('small', a.role === 'GUARDIAN' ? 'Wali' : 'Siswa · ' + a.userId.slice(0, 8)));
      const email = a.email ? cell(a.email) : cell(a.emailNote ?? '—', 'muted');
      tr.append(name, cell(a.methods.join(' + ') || '—'), email, cell(a.grade ? `Kelas ${a.grade}` : '—'),
        cell(STATUS[a.status] ?? a.status, a.status === 'DELETION_PENDING' ? 'muted' : ''), cell(when(a.createdAt)), cell(when(a.lastLoginAt)));
      const act = el('td');
      if (a.deletable) { const b = el('button', 'Hapus', 'danger'); b.onclick = () => { openId = openId === a.userId ? null : a.userId; render(); }; act.append(b); }
      tr.append(act); body.append(tr);
      if (openId === a.userId) body.append(confirmRow(a));
    }
    table.append(thead, body);
    const wrap = el('div', undefined, 'table-wrap'); wrap.append(table);
    $('#accountList').replaceChildren(wrap);
    $('#accountList').querySelector('.confirm-row input')?.focus();
  }

  function confirmRow(a) {
    const tr = el('tr', undefined, 'confirm-row'), td = el('td'); td.colSpan = 8;
    const text = el('p'); text.append('Hapus permanen akun ', el('b', a.label), '? Sesi dicabut, lalu progres, riwayat, dan identitas masuknya dihapus oleh worker. Tidak bisa dibatalkan.');
    const label = el('label', `Ketik ${a.label} untuk konfirmasi`), input = el('input'); input.autocomplete = 'off'; input.spellcheck = false; label.append(input);
    const go = el('button', 'Hapus permanen', 'danger'), cancel = el('button', 'Batal');
    go.disabled = true; input.oninput = () => { go.disabled = input.value.trim() !== a.label; };
    cancel.onclick = () => { openId = null; render(); };
    go.onclick = async () => {
      go.disabled = true; cancel.disabled = true;
      try {
        await api('accounts/deletions', { userId: a.userId, confirm: input.value });
        openId = null; notice(`Akun ${a.label} masuk antrean hapus. Worker menghapus datanya dalam beberapa detik.`);
        await load();
      } catch (e) { notice(e.message, true); go.disabled = false; cancel.disabled = false; }
    };
    const actions = el('div', undefined, 'confirm-actions'); actions.append(go, cancel);
    td.append(text, label, actions); tr.append(td); return tr;
  }

  $('#accountSearch').oninput = render;
  return { load, clear() { rows = []; openId = null; $('#accountList').replaceChildren(); $('#accountSummary').textContent = ''; } };
}
