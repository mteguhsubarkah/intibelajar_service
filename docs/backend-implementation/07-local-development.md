> Pembaruan 20 Oktober 2026: lihat [status alur lokal D3/D6 dan DeepSeek](09-local-full-flow.md). Catatan awal di bawah bersifat historis.

# FE + BE lokal: cara menjalankan dan mencoba

Scope: akun dan data sintetis, di komputer sendiri. Tidak ada deployment, push, AI, atau approval konten/privasi baru. Request pengguna adalah membuat FE dan BE bisa dicoba bersama secara lokal terlebih dahulu.

## Jalankan

Di terminal dari folder `intibelajar_service`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-local.ps1
```

Lalu buka **http://localhost:5180/__local**. Pilih **Masuk sebagai Uji Lokal A**.

Launcher memakai Node yang tersedia, atau menemukan runtime Node 24 lokal jika symlink nvm belum berfungsi. ExecutionPolicy Bypass hanya berlaku untuk proses PowerShell itu; tidak mengubah policy Windows global. Jika Node/npm sudah normal, alternatifnya `npm run local:dev`.

Yang otomatis dinyalakan:

- FE Vue dari `../mockup/intibelajar`, port **5180**. Port 5173 yang mungkin sudah dipakai Vite lain tetap dibiarkan.
- API backend, `127.0.0.1:8000`, dengan Origin `http://localhost:5180`.
- Background worker.
- PostgreSQL yang sudah tersedia di `.local/pg17` bila belum berjalan. Membutuhkan PostgreSQL 16+ dan kredensial cluster lokal di `.local/test-env.json`.

Ctrl+C menghentikan FE/API/worker pada terminal launcher. PostgreSQL dan data lokal dipertahankan. Launcher menolak port yang sudah terpakai, pada IPv4 maupun IPv6, dan tidak membunuh proses lain.

## Yang bisa dicoba sekarang

1. **Diagnosis:** masuk akun A → `/coba` → isi `sin 30 = 20/x` → periksa. Hasil berasal dari server. Refresh tetap memakai attempt dan hasil yang sama.
2. **Latihan:** buka `/latihan/soal?set=gabungan`, pilih jawaban, lalu refresh. Server melanjutkan soal berikutnya.
3. **Challenge:** `/challenge` mempunyai loop sendiri, terpisah dari `/coba`.
4. **Pemisahan akun:** pilih akun B dari `/__local`. Data milik akun A ditolak oleh backend.
5. **Consent:** akun **Uji Tanpa Izin** tidak boleh membuat sesi belajar canonical; API mengembalikan `403 CONSENT_REQUIRED`. FE masih dapat memperlihatkan alur perangkat untuk pengunjung yang tidak eligible; itu bukan bukti backend mengizinkannya.
6. **Guest:** pilih **Coba sebagai tamu**. Cookie akun dihapus dan demo tetap berjalan di perangkat, tanpa membuat sesi belajar canonical.

Identitas, consent awal, serta review katalog dibuat dari fixture pengujian yang sudah ada. Halaman pemilih menyatakan bahwa semuanya simulasi development. Tidak ada verifikasi guardian/identity atau content approval produksi. Pada identitas yang sudah tersimpan, launcher **tidak memperbarui/mengembalikan consent** yang dicabut; status database tetap berlaku.

## Menjalankan tes koneksi lagi

Biarkan launcher hidup. Buka terminal kedua di backend:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-local.ps1 -Check
```

Atau `npm run local:check`. Sembilan cek browser ini menggunakan frontend dan PostgreSQL yang sedang hidup; tanpa reset database. Evidence baru ditulis ke `.local/local-dev/check-<timestamp>/`. Tes menambah sesi/attempt uji ke akun lokal, bukan memakai data murid asli.

## Database dan kontrol development

- Database harness: **`intibelajar_local_dev`**, terpisah dari database destructive-test `*_test`.
- Database harus memiliki marker khusus harness. Bila nama tersebut sudah ada tanpa marker, launcher menolak menulisnya.
- Migrasi hanya **up**; tidak rollback, truncate, atau memakai `scripts/e2e-seed.ts` yang mereset tabel.
- Katalog fixture sintetis diterbitkan hanya di database ini. `catalog/manifest/`, overlay PROPOSED, dan persetujuan dalam plan tidak diubah. Snapshot yang sama tidak dipublikasikan ulang.
- Profil dan progres dipakai kembali setelah restart. Cookie sesi diperbarui saat launcher dijalankan; buka `/__local` untuk memilih akun lagi bila sesi browser lama sudah tidak valid.
- Halaman fixture dan pemilihan akun hanya ada di **proses Vite harness**. Tidak ditambahkan ke API `/v1`, router Vue, atau build `dist`.
- Form pilihan akun memerlukan Host localhost yang tepat, Origin yang tepat, token CSRF acak, POST, dan body terbatas. Cookie tetap `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`; tidak diberikan ke JavaScript aplikasi.
- Semua path `/v1` melewati proxy Vite dengan origin yang sama. Tidak perlu CORS terbuka atau mematikan proteksi CSRF backend.
- Feature flags backend tetap false; Vite harness mengaktifkan integrasi akun/canonical khusus proses ini. `VITE_LEARNING_MODE=demo` mempertahankan jalur guest, tetapi kegagalan pada jalur canonical tidak diganti verdict demo.
- Key, kredensial, dan cookie fixture tersimpan di `.local/local-dev/` yang diabaikan Git. Jangan unggah file tersebut.

## Batas yang belum selesai

Ini membuktikan koneksi lokal pada jalur yang telah tersedia, bukan completion seluruh Slice 2.

- Materi funnel → quick check → retry lengkap masih bergantung **D3**. Jalur checkpoint/retry yang sudah ada bukan bukti bahwa navigasi melalui materi selesai.
- Hint tutor masih bergantung **D6**; copy SELF_REPORT KNOW masih **OD-11**.
- **B-01/B-02 tetap OPEN**. Satu startup ulang pada sesi ini terkena connection timeout sebelum server dinyalakan; percobaan berikutnya berhasil. Timeout backend tidak diubah dan akar masalah belum ditetapkan. Jika terjadi lagi, simpan log dan periksa; jangan menyatakan temuan selesai hanya karena retry berhasil.
- Typecheck frontend global yang dilaporkan di §17 plan tetap pekerjaan terpisah. Verifikasi di bawah tidak mengklaim build Vue merupakan typecheck seluruh frontend.
- CI remote/M9 dan deployment tidak dilakukan.

## Prasyarat pada checkout lain

Backend dan FE memerlukan dependensi yang terpasang (`npm ci` di masing-masing repo), Node 22+ (sesi ini 24.19.0), serta PostgreSQL 16+. Jangan menjalankan instalasi ulang bila dependensi sudah ada.

`.local/test-env.json` adalah file lokal yang sudah disiapkan untuk cluster sintetis, bukan file yang boleh di-commit. Pada mesin baru, jalankan prosedur database isolasi dalam README terlebih dahulu atau siapkan file itu dengan `DATABASE_URL` loopback untuk role yang dapat membuat database development. Launcher hanya memakai kredensial cluster darinya; tidak memakai atau mereset database `_test` yang disebut URL tersebut. `PG_BIN` dapat menunjuk direktori binary PostgreSQL lain; `FRONTEND_DIR` dapat menunjuk lokasi FE lain.

Log: `.local/local-dev/api.log`, `worker.log`, `frontend.log`, dan `postgres.log` (jika cluster dinyalakan launcher). `local:dev --prepare-only`/PowerShell `-PrepareOnly` menyiapkan fixture tanpa menyalakan FE/API.

## Verifikasi sesi 20 Oktober 2026

Evidence: [local-connection-2026-10-20](evidence/local-connection-2026-10-20/).

- Backend TypeScript dan batas modul: lulus.
- Browser pada Vite development + API + PostgreSQL 17.5: **9/9** lulus, mencakup proxy/readiness, form fixture/CSRF, login sintetis, diagnosis+refresh, tab kedua, CSRF/ownership/consent refusal, practice+refresh, failure/recovery, dan guest isolation.
- `verify:frontend`: lulus, termasuk suite frontend, **29 consumer checks**, golden **81 numeric / 47 option / 21 tower**, dan **3 local-event/beacon isolation** checks.
- Permintaan langsung melalui Vite ke file `env.json` dan `personas.json` di backend: ditolak **403**.
- Dua percobaan browser awal belum lulus (benturan Vite IPv6 pada 5173; Origin form null akibat header no-referrer). Launcher dipisah ke 5180 dan policy form diperbaiki menjadi same-origin. Origin null tetap ditolak. Ringkasan kegagalan dipertahankan bersama evidence.

Tidak menjalankan ulang keseluruhan backend suite/mutation suite karena kode aplikasi backend/frontend tidak diubah pada pekerjaan ini. Pemeriksaan baru menargetkan harness dan hubungan FE–BE yang diminta.
