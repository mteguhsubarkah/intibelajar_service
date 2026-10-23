# Backoffice: filter pelajaran dan laporan PDF

Tanggal implementasi: 23 Oktober 2026. Hanya authoring draf; tidak mengubah API /v1,
database siswa, rute Vue, feature flags, atau status persetujuan konten.

## Penggunaan

1. Buka backoffice dan login, lalu muat ulang halaman (Ctrl+F5 bila cache lama).
2. Di atas seluruh tab, pilih **Pelajaran** dan **Jenjang**. Filter tetap berlaku saat pindah tab.
3. D = SMP; E = SMA awal; F = SMA lanjut; F+ = label aplikasi untuk matematika
   tingkat lanjut SMA (CP resminya tetap Fase F, bukan perguruan tinggi).
4. Ringkasan, topik, pilihan core, materi, sumber, serta graf mengikuti filter.
   Hubungan yang menyentuh pilihan tetap menampilkan ujung di luar filter dengan penanda.
   Membuka editor hubungan lintas filter mengembalikan pilihan ke semua agar kedua ujung tersedia.
5. Antrean/audit merupakan aktivitas global workspace dan tetap diberi penjelasan demikian.
   Seed lama khusus Matematika SMA E/F dinonaktifkan bila filter tidak cocok.
6. **Ekspor PDF / Cetak** membuka laporan baru dari data yang sedang dimuat, kemudian
   dialog cetak browser. Pilih **Simpan sebagai PDF**, A4, semua halaman. Ini fitur print-to-PDF,
   bukan endpoint pengunduhan PDF server. Tidak perlu library atau layanan eksternal.
7. Untuk laporan lengkap, tekan **Reset filter** dahulu. Untuk laporan kecil, pilih pelajaran/jenjang.
   Klik **Muat ulang** sebelum ekspor jika editor lain baru menyimpan perubahan.

Laporan disusun per pelajaran dan jenjang, berisi daftar topik, semua kode/nama core,
jumlah materi terkait, graf topik, graf core, sumber, dan daftar hubungan termasuk lintas halaman.
Graf dipecah maksimal delapan simpul per bagian. Daftar hubungan mempertahankan tautan
yang tidak tergambar karena lintas halaman. Teks materi dua slide tidak dicetak penuh;
laporan ini inventaris kurikulum, bukan buku pelajaran. Status draf tampil jelas.

## Perubahan teknis

- `backoffice/catalog-view.js`: seleksi katalog bersama UI dan laporan; pembentukan SVG/HTML
  dengan escape teks editorial dan allowlist HTTPS untuk tautan sumber.
- `backoffice/report.css`: tata cetak A4, pemisahan bagian, daftar core kompak, dan pagination.
- `backoffice/app.js` / `index.html`: filter global, reset pilihan form saat filter berubah,
  pilihan pelajaran untuk membuat topik, dan ekspor print-to-PDF melalui popup browser.
- Server menyajikan kedua aset tambahan. Autentikasi dan CSP tetap berlaku; key tidak masuk
  URL, HTML laporan, atau PDF. Laporan hanya memakai proyeksi authoring yang tidak memuat rubrik.
- Command topik menerima `subject` opsional; default lama tetap MAT, edit mempertahankan subject.
  Subject tidak dikenal dan pemindahan topik antar pelajaran ditolak. OpenAPI backoffice diperbarui.
- `npm run backoffice:verify` kini mencakup tes seleksi dan laporan serta sintaks modul laporan.

## Pengayaan draf lokal

Sesuai permintaan, worker/konten tambahan tetap di `.local/curriculum-import/` yang diabaikan Git.
`expand.ts --check` memvalidasi; `expand.ts --apply` menyimpan dengan backup, CAS revision,
lint penuh, dan tanpa menimpa core lama. Menjalankan ulang adalah no-op.

Tambahan: 95 core, 95 materi dua slide, 94 hubungan (87 core dan 7 topik).
Tujuh topik lama yang sebelumnya kosong telah diisi. Matriks memiliki tujuh core:
ordo, transpose, operasi, perkalian, determinan, invers, dan transformasi.
Fase draf Matriks dipetakan ke F+ sesuai label aplikasi untuk CP matematika tingkat lanjut.
Isi lain mempertahankan kode dan suntingan lama. Tidak ada topik kosong setelah validasi.

Referensi tetap CP 046/H/KR/2025 (halaman PDF 116–126, 157–175 sesuai bidang) dan
siaran pers Kemendikdasmen 23 Juni 2026 yang menyatakan perubahan 020/2026 hanya pada agama.
Judul/core/contoh/relasi tetap susunan editorial PROPOSED, bukan urutan resmi wajib.
Ini memperinci inventaris, bukan klaim kelengkapan buku atau review guru selesai.
Topik lama yang tumpang tindih dengan peta CP baru masih dipertahankan dan dihubungkan;
rekonsiliasi fase/alias seluruh konten legacy tetap diperlukan sebelum publikasi.

## Verifikasi dan batas

Tes mencakup subject/phase, hasil kosong, relasi lintas filter, escape HTML, pagination graf,
preservasi subject, penolakan subject invalid, serta kontrol backoffice terdahulu.
Tes konten lokal memeriksa nol topik kosong, tujuh core matriks, dua slide tiap core tambahan,
preservasi suntingan lama, lint, dan idempotensi.
Browser uji terisolasi memeriksa empat pelajaran lintas enam tab, filter kosong, tujuh core
dan simpul matriks, serta ekspor PDF terfilter dan lengkap melalui tombol nyata.
Artefak visual/PDF berada di `.local/curriculum-import/pdf-check/`.
Tidak menjalankan ulang full suite PostgreSQL/frontend siswa karena tidak ada perubahan jalur siswa.

## Update server

Perubahan fitur UI/server ini belum di-commit atau di-push. Setelah perubahan ditinjau dan
masuk repo, update checkout server lalu restart **intibelajar-backoffice**; tidak membutuhkan
build Vue, dependency baru, atau migrasi database.

Data draf tidak ikut git pull. Salin folder `.local/curriculum-import/` melalui WinSCP,
tanpa menimpa `.local/backoffice/` server. Jalankan sebagai pemilik workspace:

```bash
cd /var/www/intibelajar_service
node --import tsx .local/curriculum-import/worker.ts --check
node --import tsx .local/curriculum-import/worker.ts --apply
node --import tsx .local/curriculum-import/expand.ts --check
node --import tsx .local/curriculum-import/expand.ts --apply
```

Jalankan satu per satu dan berhenti bila error. Impor pertama diperlukan karena pengayaan
bergantung pada topik `.C26.`. Kedua importer membuat backup dan menjaga konten yang sudah ada.
Tidak ada perintah deploy/server Ubuntu dijalankan dari sesi implementasi ini.
