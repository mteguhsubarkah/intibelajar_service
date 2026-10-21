# Studio katalog privat — 21 Oktober 2026

**Update akses domain:** mode opt-in HTTPS dengan login Nginx + access key kini disiapkan. Lihat [panduan domain backoffice](../deployment/backoffice-domain.md). Larangan proxy publik di panduan awal ini berlaku untuk mode loopback default; jangan mengeksposnya tanpa konfigurasi HTTPS/auth yang baru.

## Hasil

Backoffice mandiri tersedia di `http://localhost:8010`, bukan di domain siswa. Editor topik/bab, inti/core, relasi antartopik, prasyarat antarinti, graf SVG yang dapat diklik, editor materi teks dua slide dengan pratinjau, impor awal lewat worker, dan ekspor manifest. Tidak memerlukan perubahan atau build repository Vue.

Ini alat authoring development privat untuk pemilik proyek melalui SSH. Bukan staff admin produksi: workforce IdP/MFA pada arsitektur 08 §1 belum tersedia. Karena itu server hardcoded bind `127.0.0.1`, menolak Host publik dan Origin asing; jangan menambah reverse proxy publik atau membuka port 8010.

## Cara lokal

Node >=22 dan `npm ci` lengkap (tsx diperlukan).

```bash
# Terminal 1, dari root BE
npm run backoffice

# Terminal 2: isi awal sekali, lalu keluar
npm run backoffice:seed

# Alternatif worker terus hidup untuk tombol antrekan di UI
npm run backoffice:worker
```

Buka `http://localhost:8010`. Access key otomatis dibuat pada `.local/backoffice/access-key`; lihat sendiri melalui `Get-Content .local/backoffice/access-key` (PowerShell) atau `cat .local/backoffice/access-key` (Ubuntu). Jangan kirim ke chat/Git. Di browser key hanya di memori, tidak localStorage, URL, atau cookie. Tombol Kunci studio menghapus key dari memori aplikasi; untuk perangkat bersama tutup tab setelah selesai karena DOM yang pernah ditampilkan bukan mekanisme penghapusan data forensik.

Alur: Topik → Inti → Hubungan → Materi 2 slide → Graf → Ekspor. Gunakan kode yang sama untuk memperbarui entitas. Kode adalah identitas tetap; mengganti kode membuat entitas baru. Belum ada delete/cascade atau pemindahan inti antar topik. Materi terstruktur yang berisi rumus/gambar atau slide lebih dari dua harus diedit melalui manifest; editor sederhana menolaknya agar tidak menghapus struktur lama.

## Data dan keamanan

- `.local/backoffice/state.json`: manifest draf lengkap, provenance, jobs, audit teknis. File ini **mengandung rubrik baseline** sebagai bagian manifest internal; tidak dikirim ke UI dan tidak boleh dipublikasikan/download melalui Nginx. Directory mode 700/file 600 pada Linux.
- Server API mengirim hanya topik, inti, pelajaran, relasi, temuan, dan jobs; tidak mengirim soal/kunci/rubrik atau data siswa. Header no-store, CSP self-only, tanpa CDN/font/tracker.
- Access key acak 32 byte, pemeriksaan konstan waktu, bearer header; mutation memerlukan Origin loopback tepat. Tidak ada CORS wildcard.
- Simpan atomik lewat temp+rename, lock lintas proses, optimistic revision: tab basi mendapat 409 dan harus muat ulang, bukan menimpa diam-diam.
- Semua command divalidasi schema/referensi/alias dan DAG; kegagalan tidak menyimpan sebagian perubahan. Setiap suntingan menandai PROPOSED dan PENDING kembali. Tidak tersedia API publish atau jalan pintas review.
- Worker file-backed khusus authoring ini tidak memakai queue siswa/PostgreSQL. Ini pilihan development karena tidak memerlukan DB dan tidak menerima input siswa. Jobs bertahan setelah restart, claim berlease 60 detik, token fencing, maksimum 3 claim; PID lock mati dipulihkan setelah process exit terdeteksi. Jangan memakai satu workspace dari beberapa mesin/network filesystem.
- Impor hanya membaca seed yang ada di Git; tidak menerima URL fetch dari browser, tidak menjalankan shell atau AI. SHA seed mengikat job ke versi konten, sehingga update kode di tengah antrean gagal eksplisit. Tidak menimpa entitas yang sudah ada.
- Audit file ini berguna untuk riwayat developer, bukan audit compliance dengan identitas staff terverifikasi.

Backup `.local/backoffice/` sebelum update dan secara berkala ke tempat privat; jangan commit file itu. Jangan hapus/menimpa state saat deploy. Template log systemd tidak mencetak access key, body, atau rubrik.

## Materi: API yang sudah ada

`GET /v1/concepts/{conceptId}` memuat daftar lesson yang mengajarkan inti. `GET /v1/lessons/{lessonId}` mengembalikan `slideCount`, `blocks[].slide` (0 dan 1 untuk dua slide), dan checks. Endpoint ini membaca revision PUBLISHED dari database. Tidak mengubah response shape `/v1` atau rute Vue.

API authoring baru berada di proses privat: `GET /api/state`, `POST /api/commands`, `POST /api/imports`, `POST /api/exports`. Kontrak terpisah di `backoffice/openapi.yaml`, juga dapat dibaca dari `http://localhost:8010/openapi.yaml`. API ini mengisi **draf**, bukan langsung tabel published. Tidak menambahkan endpoint tulis publik ke kontrak canonical `/v1` tanpa autentikasi staff.

Ekspor menghasilkan `.local/backoffice/exports/<revision>-<uuid>/` berisi YAML manifest dan catatan sumber. Overlay baseline dimaterialisasi hanya di salinan draf; file extractor/canonical asli tidak diubah. Ekspor bukan publikasi dan belum otomatis muncul di FE.

Setelah review nyata pada salinan ekspor, lengkapi review entitas, keputusan yang terbuka, sign-off reviewer/date, versi release yang lebih tinggi dari DB, serta ketersediaan konten sesuai kesiapan. Jangan mengganti semua PROPOSED menjadi REVIEWED secara massal. Lalu gunakan publisher yang sudah ada:

```bash
# Ganti /ABS/PATH/EXPORT dengan directory yang ditampilkan backoffice.
node --import tsx scripts/catalog/lint-manifest.ts --strict --manifest /ABS/PATH/EXPORT

# Hanya setelah strict lint lulus dan target database sudah diperiksa/backed up:
node --env-file=.env --import tsx scripts/catalog/publish.ts --manifest /ABS/PATH/EXPORT
```

Publisher tetap menolak seluruh temuan review dan memakai transaksi/revision immutable yang sudah ada. Tidak ada konten yang dipublikasikan oleh implementasi ini. Setelah publikasi sah, katalog API siswa membaca release baru; rute FE tertentu masih menggunakan frozen legacy alias, sehingga penambahan topik baru tidak otomatis membuat rute Vue baru. Tinjau alias/navigasi FE sebelum mengklaim semua materi baru bisa dibuka dari home. Tidak ada seed soal asesmen baru: editor ini tidak membuat answer key atau checks otomatis.

## Kurikulum awal dan sumber otentik

Lingkup awal **Matematika umum SMA fase E/F**, 12 topik dan 36 inti; bukan seluruh SD/SMP/SMA dan bukan Fase F Tingkat Lanjut. Nama bab, pemecahan inti, definisi, contoh materi dua slide, serta 4 relasi topik dan 5 prasyarat adalah usulan editorial (PROPOSED), bukan susunan bab resmi yang wajib. Kode `MAT.CP25.*` memisahkan peta baru dari alias demo lama; potensi tumpang tindih semantik harus ditinjau sebelum publikasi.

Dasar per 21 Oktober 2026:

1. [Keputusan BSKAP 046/H/KR/2025, PDF resmi BPMP Bangka Belitung](https://bpmpbabel.kemendikdasmen.go.id/PPID/wp-content/uploads/2025/07/KepKaBSKAP-046_2025-ttg-CP.pdf), Lampiran II Matematika bagian 5–6, **halaman PDF 118–120**. Diunduh dan dibaca langsung untuk pemetaan. SHA256 `45809d2c88a612f90ee5adbd60d71a8952527d6924c626d126ea6926ae3d3394`.
2. [Siaran pers Kemendikdasmen 23 Juni 2026](https://www.kemendikdasmen.go.id/siaran-pers/15636-capaian-pembelajaran-baru-telah-terbit-yang-berubah-hanya-mata-pelajaran-agama-dan-budi-pekerti): keputusan 020/2026 hanya mengubah Agama dan Budi Pekerti; mata pelajaran lain tetap mengacu 046/2025.
3. [SIBI resmi](https://buku.kemendikdasmen.go.id/) untuk pencarian buku lanjutan. Tidak menyalin buku atau menyimpulkan lisensi reproduksi buku dari akses unduh gratis.

Perbedaan penting terhadap beberapa daftar lama: barisan/deret dan peluang majemuk berada pada Fase F di CP yang diperiksa; trigonometri E dibatasi perbandingan sudut lancip. Pemetaan lama di katalog tidak diam-diam dipindahkan. Belum ditemukan API publik resmi terdokumentasi khusus CP→topik→inti; domain yang menyerupai pemerintah tidak dipakai sebagai sumber. Worker menggunakan seed versioned `catalog/curriculum/math-sma-2025.json`, bukan scraper atau endpoint internal yang tidak stabil.

## Update Ubuntu

Tidak ada commit/push/deploy dilakukan. Langkah ini baru bisa dipakai setelah file fitur dipilih, direview, di-commit dan di-push ke repo BE. Jangan `git add .` tanpa memeriksa perubahan lama yang masih ada.

```bash
cd /var/www/intibelajar_service
git status
# Ada downtime singkat: npm ci mengganti node_modules yang juga dipakai API/worker.
sudo systemctl stop intibelajar-api intibelajar-worker
# Jika service authoring sudah terpasang, stop keduanya juga sebelum pull/npm ci.
git pull --ff-only
npm ci
npm run typecheck

# Menguji perubahan authoring tanpa menggunakan DB aplikasi
node --import tsx --test test/backoffice.test.ts

sudo systemctl start intibelajar-api intibelajar-worker
curl -f http://127.0.0.1:8000/health/ready

# Worker one-shot memasukkan draf. Tidak perlu migrasi DB baru untuk backoffice ini.
npm run backoffice:seed
npm run backoffice
```

Jika pull/install/check gagal, hentikan urutan dan periksa error; jangan menganggap update berhasil atau melakukan rollback DB. Tidak ada migrasi baru untuk fitur ini, tetapi bila commit yang ditarik juga memuat migrasi fitur lain, tinjau/backup database dan jalankan migrasi up sesuai runbook fitur tersebut sebelum menyalakan API.

Untuk proses permanen: unit `docs/deployment/templates/intibelajar-backoffice.service` dan worker pasang sebagai dua file di `/etc/systemd/system/`. Ganti path Node dengan hasil `command -v node`, user/group dengan akun pemilik checkout (jangan root), dan WorkingDirectory bila berbeda. Jangan menimpa unit worker siswa dengan worker backoffice.

```bash
sudo cp docs/deployment/templates/intibelajar-backoffice.service /etc/systemd/system/
sudo cp docs/deployment/templates/intibelajar-backoffice-worker.service /etc/systemd/system/
sudo nano /etc/systemd/system/intibelajar-backoffice.service
sudo nano /etc/systemd/system/intibelajar-backoffice-worker.service
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now intibelajar-backoffice intibelajar-backoffice-worker

# Untuk update selanjutnya: hentikan API, worker siswa dan kedua proses authoring
# sebelum pull/npm ci; backup workspace privat, jalankan checks lalu start lagi.
sudo systemctl status intibelajar-backoffice intibelajar-backoffice-worker --no-pager
```

Jika setelah pembaruan katalog seed berubah, antrekan ulang job FAILED dari tombol impor. Impor tetap tidak menimpa isian lama; migrasi isi seed lama memerlukan edit/review eksplisit.

PuTTY → Connection → SSH → Tunnels: Source `8010`, Destination `127.0.0.1:8010`, Local → Add. Hubungkan SSH, lalu buka `http://localhost:8010` di PC. Alternatif terminal PC:

```bash
ssh -N -L 127.0.0.1:8010:127.0.0.1:8010 ubuntu@43.173.28.8
```

Jangan buka firewall 8010/8000/5432. Jangan tambah `/backoffice` proxy ke domain publik. HTTPS siswa/domain-origin rollout adalah pekerjaan terpisah; backoffice tetap dapat dipakai melalui tunnel sambil pekerjaan tersebut diselesaikan.

## Verifikasi dan batas

Lihat evidence hasil aktual pada folder `evidence/backoffice-2026-10-21/`. **7/7 kelompok tes lulus**, termasuk validasi OpenAPI 3.1 dengan swagger-parser. Tes khusus mencakup auth/Host/Origin, conflict revision, validasi siklus/referensi, dua slide, ekspor round-trip, strict review gate, import idempotent, lease fencing/recovery, kegagalan atomik, penolakan flatten materi terstruktur dan larangan klaim review lewat request. Module boundaries dan syntax JavaScript browser lulus. Typecheck pertama dalam runner gagal karena mesin kehabisan memori (exit 134); pengulangan sendiri dengan heap 512 MB lulus (exit 0). Evidence awal yang gagal tidak dihapus. Typecheck sebelumnya juga lulus sebelum dua tes terakhir ditambahkan.

Browser: login privat berhasil, hasil impor terlihat (total bersama baseline: 23 topik, 97 inti, 8 materi), graf 3 inti/2 panah diperiksa visual, materi dua slide dibuka dan disimpan melalui UI dengan konfirmasi draf. Tidak ada console warning/error pada pemeriksaan akhir. Screenshot di `graph.png` dan `lesson.png`; catatan di `browser.json`. Verifikasi ulang melalui `npm run backoffice:verify`; runner mencatat exit proses langsung dan membuat folder evidence baru, tanpa menimpa evidence sebelumnya.

Tidak ada database siswa, panggilan AI, data murid, atau publikasi katalog pada verifikasi ini. Full PostgreSQL/model/mutation dan suite Vue/29 consumer checks tidak dijalankan ulang karena tidak ada perubahan ke runtime `/v1`, schema DB, evaluator, atau repository Vue. Backoffice baru diuji melalui tes API sendiri dan browser.

Keputusan development: loopback + SSH + local access key, file-backed draft queue, paket curated CP, editor dua slide teks. Gate produksi: staff IdP+MFA/RBAC/audit, backup restore drill, review konten/alias, workflow approval/publish terintegrasi, serta gate legal/privacy yang sudah ada. Semua tetap terbuka; tidak ada approval produksi yang disimpulkan.
