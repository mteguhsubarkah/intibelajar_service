# Persiapan pilot privat untuk akun dewasa

25 Oktober 2026. Keputusan pengguna: pilot privat dewasa, provider email belum tersedia.
Dokumen ini menjelaskan hasil yang sudah dibuat dan gate yang masih terbuka; bukan izin
mengolah data nyata. Tidak ada deploy, email nyata, atau perubahan consent produksi dilakukan.

## Status sekarang

- Google OAuth telah tersedia pada localhost untuk satu akun uji dewasa yang diizinkan.
- Sesi dan izin data belajar dipisahkan. Akun bisa authenticated=true sekaligus belum
  boleh memakai progres, dan 403 CONSENT_REQUIRED tidak berarti logout.
- Runtime tetap development/test, database loopback, origin localhost, serta kebijakan
  `synthetic-dev-v1`. NODE_ENV=production masih ditolak. Jangan mematikan guard itu.
- Tujuan pilot dewasa tidak otomatis menyelesaikan OD-02 (age assurance), OD-03
  (self-consent untuk orang dewasa terverifikasi), dan OD-05 (privacy/governance).
  Baseline 08 §6 masih meminta guardian untuk semua learner sampai keputusan tersebut disetujui.
- Google login bukan persetujuan menyimpan data belajar, dan bukan bukti usia.

## Cara mengecek dan mencoba perbaikan lokal

Hentikan API dan worker lama dengan Ctrl+C lalu jalankan dari root backend, satu terminal masing-masing:

```powershell
node scripts/local/component.mjs api
node scripts/local/component.mjs worker
```

Vite yang sedang berjalan memuat perubahan FE lewat HMR. Jika menjalankan frontend terpisah,
pastikan akun memakai path relatif /v1 lewat proxy. APP_ORIGIN backend harus tepat sama
dengan origin FE; launcher lokal memakai http://localhost:5180. npm run dev biasa sering
memakai 5173: pilih origin yang sama pada BE dan redirect Google, jangan mencampurnya.
Cookie host-only tidak dibatasi port, tetapi host, Secure, SameSite dan credentials mode
tetap berlaku; request lintas origin juga memerlukan CORS yang memang tidak diaktifkan di sini.

Login UI saja tidak mengaktifkan penyimpanan latihan canonical. Launcher lokal mengaktifkan
VITE_SLICE0 dan VITE_CANONICAL_LEARNING bersama. Jika npm run dev/build dijalankan langsung
dari FE, periksa kedua flag tersebut. .env.development hanya dibaca saat development;
file itu bukan konfigurasi build production. Setelah seluruh gate pilot selesai, build
pilot yang ditinjau perlu VITE_SLICE0=true, VITE_CANONICAL_LEARNING=true, VITE_API_BASE_URL
kosong, VITE_LEARNING_MODE=assessment dan VITE_BACKEND_FALLBACK=false. Jangan mengaktifkan
build pilot pada server nyata sebelum runtime/consent siap. Tidak ada secret dalam VITE_*.

Jalankan audit kesiapan, tanpa network atau perubahan database:

```powershell
npm run pilot:check
```

Exit 2 berarti gate masih terbuka, bukan kegagalan tes. Memasang API key tidak mengubah
gate tersebut menjadi lulus. Pemeriksa tidak mencetak nilai key, email, URL database, atau password.

## Email masuk: outbox, retry, Idempotency-Key, token di fragment (25 Oktober 2026)

Alurnya sekarang (`src/identity/email-outbox.ts`, `email-transport.ts`, migrasi `0010-email-outbox`):

1. `POST /v1/auth/email/links` menyimpan hash tautan **dan** satu baris `email_outbox` dalam transaksi yang sama,
   lalu selalu menjawab 202. Request tidak pernah memanggil provider, jadi provider yang lambat atau mati tidak
   menggagalkan login dan tidak mengunci transaksi (dulu: satu kegagalan Resend membuat transaksi tak bisa dikirimi
   tautan lagi).
2. Worker (`emailTick`, setiap detik) mengambil baris yang jatuh tempo dengan `FOR UPDATE SKIP LOCKED` dan lease 30 detik,
   lalu mengirim lewat Resend dengan **Idempotency-Key tetap** `signin/<transaksi>` (Resend menyimpannya 24 jam), jadi
   pengiriman ulang tidak menggandakan email.
3. Gagal sementara (jaringan, timeout, 408/409/429, 5xx) dicoba lagi dengan jeda 5 s, 10 s, 20 s… (maks. 2 menit, dengan
   jitter), maksimal 5 kali dan tidak melewati masa berlaku tautan (15 menit). Gagal permanen (4xx lain, input tidak
   valid) berhenti seketika. Lease yang hilang (worker mati) dipulihkan; hasil worker lama dipagari lease token.
4. Alamat dan tautan disimpan terenkripsi (AES-GCM, `APP_KEY`) dan **dihapus** begitu baris selesai (SENT, FAILED,
   EXPIRED). Baris selesai dihapus setelah 7 hari. Log hanya memuat id outbox dan kode error, tidak pernah alamat atau token.
5. Tautan berbentuk `https://<origin>/auth/email#token=…`: token di **fragment**, tidak terkirim ke server, log, atau
   Referer. Halaman `/auth/email` membacanya dari fragment, langsung membersihkan address bar, dan baru memakainya
   setelah tombol ditekan (pemindai tautan di kotak masuk tidak menghabiskannya). Tetap sekali pakai, 15 menit, dan
   terikat ke browser yang meminta.

Adapter lama `email-delivery.ts` (tidak pernah dipakai) dihapus; `email-transport.ts` satu-satunya adapter.

**Konfigurasi** (file privat, misalnya `.local/local-dev/email.env`; jangan di-commit, jangan di `VITE_*`):

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=ISI_SENDIRI
EMAIL_FROM=IntiBelajar <masuk@domain-yang-sudah-diverifikasi>
```

Worker harus berjalan agar email terkirim (`npm run local:dev` menyalakannya). Tanpa worker, baris menunggu lalu
kedaluwarsa; request tetap 202. Untuk melihat status: `select status, attempts, last_error_code, created_at from
email_outbox order by created_at desc limit 10;`

**Uji ke alamat sendiri** (satu kali, lokal): isi file di atas dengan key dan pengirim yang terverifikasi, jalankan
`npm run local:dev`, buka `http://localhost:5180/masuk`, minta tautan ke alamat Anda, buka tautannya **di browser
yang sama**. Belum dilakukan dalam sesi implementasi: semua tes memakai transport palsu, tanpa panggilan ke Resend.

**Masih terbuka untuk pilot nyata:** allowlist/undangan peserta (sekarang alamat mana pun yang valid bisa meminta
tautan), kebijakan account linking email↔Google, uji kirim nyata, monitoring bounce/complaint, dan consent dewasa.
`npm run pilot:check` tetap menandai EMAIL_ENROLLMENT belum siap.

Google dan email harus diuji sebagai provider identitas nyata yang berbeda dari simulasi:
email simulasi tetap email_verified=false dan tidak boleh di-link otomatis ke Google.
Kepemilikan mailbox saja tidak menyelesaikan verifikasi umur atau persetujuan belajar.

Referensi transport resmi:
https://github.com/resend/resend-openapi/blob/main/resend.yaml
https://resend.com/changelog/idempotency-keys
https://resend.com/changelog/new-domains-workflow

## Urutan pekerjaan menuju pilot yang sungguh siap

1. **Identitas peserta:** undangan/allowlist dewasa, metode verifikasi dewasa dan pemilik proses,
   penolakan akun di luar pilot. Jangan mengambil tanggal lahir dari Google sebagai asumsi.
2. **Persetujuan:** selesaikan OD-02/OD-03 dengan penanggung jawab sesuai arsitektur;
   setujui teks nyata, version/hash, tujuan terpisah, pencabutan dan penanganan versi kebijakan.
   Implementasikan alur dewasa setelah keputusan tersebut; tidak auto-grant ketika login.
3. **Konfigurasi runtime:** mode pilot tersendiri, origin HTTPS exact, cookie Secure/HttpOnly,
   CSRF/Origin sama-origin, Google client khusus server, dan allowlist. Guard produksi saat ini
   baru boleh digantikan oleh kontrol yang diuji; jangan menyamarkan server nyata sebagai fixture.
4. **Email:** konfigurasi provider, outbox dan enrollment nyata sebagaimana di atas; uji delivery,
   expired/replay/bad-browser, provider down, account linking dan enumeration protection.
5. **Data:** database pilot terpisah dari fixture, akun DB terbatas, migrasi/backup dan restore
   drill, penghapusan dan retensi yang disetujui. Jangan memasukkan akun Google uji ke seed emas.
6. **Katalog:** review konten/relasi/alias dan publish release yang sah. Draf lokal masih PROPOSED.
7. **AI:** Google/learning consent bukan izin AI. Selesaikan processor/retention/transfer review,
   evaluasi model dan redaksi, serta consent AI terpisah sebelum mengizinkan teks nyata.
   Batas reservasi Rp80.000 saat ini ledger development bersama, bukan billing/quota pilot.
8. **Operasional:** error/abuse monitoring, rate limits yang sesuai reverse proxy,
   pengelolaan secret, penanggung jawab insiden, audit dan rollback release. Uji staging privat
   dengan data buatan dahulu, kemudian peserta dewasa yang lolos proses di atas.

Tidak ada langkah dalam daftar ini mengizinkan akun anak di bawah umur. Pilot anak memerlukan
scope dan review tambahan. Nama role STUDENT pada model bukan bukti akun tersebut anak/dewasa.

## Yang tidak boleh disimpulkan dari hasil hijau

Build produksi Vite hanyalah build aset. /health/ready=200 menunjukkan dependency runtime,
bukan persetujuan data nyata. Login Google berhasil tidak memberi izin progres/AI. Pilot check
akan tetap blocked selama runtime dan kebijakan masih sintetis. Laporan implementasi mencatat
tes yang benar-benar dijalankan dan keterbatasannya.
