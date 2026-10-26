# Mode runtime pilot (26 Oktober 2026)

Node 24.19.0 (`versions.txt`), database `*_test`. Tidak ada yang dijalankan di server, dan belum di-commit.

## Apa yang dibuat

- **`src/config.ts`** — `RUNTIME_MODE=pilot` dengan `NODE_ENV=production`; tanpa pasangan itu, production tetap ditolak.
  Server gagal start bila salah satu syarat ini tidak terpenuhi:
  - `APP_ORIGIN` bukan origin https publik yang persis (tidak boleh http, loopback, alamat IP, path, garis miring di
    akhir, atau kredensial);
  - `SYNTHETIC_FIXTURES=true`;
  - `SELF_ONBOARDING_CONSENT=true` atau `FEATURE_GUEST_TRIAL=true` (keduanya izin otomatis);
  - `TRUST_PROXY` bukan `127.0.0.1` atau `::1`.

  Semua integrasi khusus dev (Google uji, DeepSeek, OCR, mailbox sintetis, log penilaian) memerlukan
  `NODE_ENV=development`, jadi semuanya mati di pilot. Mode development dan test tidak berubah; `TRUST_PROXY` ditolak
  di luar pilot.
- **`src/app.ts`**
  - `trustProxy` hanya Nginx lokal, sehingga `req.ip` (rate limit) dan `req.protocol` berasal dari pengunjung.
  - Di pilot, setiap aksi tulis harus https.
  - Pengecekan Origin tidak diubah: tetap persis `APP_ORIGIN`, dan tetap menolak `Sec-Fetch-Site` lintas situs.
  - `/health/ready` melaporkan `environment: pilot` dan `syntheticOnly: false`.
- **`scripts/pilot-readiness.ts`** — gate `PRODUCTION_RUNTIME` siap hanya untuk konfigurasi pilot yang valid; gate
  consent, enrollment, privasi dan AI tetap belum siap.
- **`docs/deployment/intibelajar-com-runbook.md` §2** — `.env` pilot, Nginx (`X-Forwarded-For $remote_addr`,
  `X-Forwarded-Proto $scheme`), cara cek, dan batasnya.

## Hasil

| Pemeriksaan | Hasil | File |
|---|---|---|
| `pilot-runtime` (17 penolakan config; dev/test tidak berubah; 6 subtes app) | **9/9** | `pilot-runtime-tests.txt` |
| `pilot-readiness` (+1 tes: runtime valid hanya membuka gate runtime) | 2/2 | `backend-tests.txt` |
| Mutation checks | **9/9 terbunuh**, sumber dipulihkan (checksum OK) | `mutation-checks.txt` |
| Typecheck, batas modul, OpenAPI 3.1 | Lulus | — |
| Suite backend penuh | 259/272, exit 1. 13 kegagalan sama persis dengan sebelumnya; tidak ada yang baru | `backend-tests.txt` |

**Mutasi yang dibunuh:** tulis lewat http diterima; proxy tidak dipercaya (IP asli hilang); Origin dilonggarkan ke
akhiran domain; origin http diterima; izin otomatis onboarding diterima; guest trial diterima; fixture sintetis
diterima; sembarang proxy dipercaya; `TRUST_PROXY` diterima di development.

**Catatan run:** run pertama subtes CSRF gagal pada kasus "tanpa Origin". Penyebabnya bug di helper tes
(`origin: undefined` terisi kembali oleh nilai default), bukan di app. Helper diganti ke `null`; aplikasinya menolak
request tanpa Origin.

## Batas

Mode pilot membuat runtime aman di domain publik; ia bukan izin memproses data murid.
- Berjalan: login email (Resend, lewat outbox), sesi, profil.
- Belum berjalan: tidak ada jalur persetujuan untuk pengguna nyata (guardian sintetis dan self-consent ditolak), jadi
  fitur belajar menjawab `403 CONSENT_REQUIRED` sampai consent dewasa (OD-02/OD-03) diimplementasikan.
- Tidak ada akun percobaan tamu, dan DeepSeek mati.
