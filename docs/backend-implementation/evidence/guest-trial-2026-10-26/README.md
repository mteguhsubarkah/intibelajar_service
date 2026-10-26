# /coba untuk semua orang: akun percobaan tamu (26 Oktober 2026)

Node 24.19.0, PostgreSQL 17.5 (`versions.txt`), database `*_test` saja. Tidak ada panggilan DeepSeek sungguhan: jalur AI
diuji dengan engine palsu khusus tes. Belum di-commit.

## Apa yang dibuat

- **Backend.**
  - `POST /v1/auth/guest` (`FEATURE_GUEST_TRIAL`, mati secara default, dinyalakan oleh `npm run local:dev` dan runner E2E)
    membuat akun percobaan 24 jam untuk pengunjung tanpa sesi: learner `ACTIVE`, izin `LEARNING_DATA`, `AI_PROCESSING`
    dan `IMAGE_UPLOAD` (`method = GUEST_TRIAL`), dan sesi yang tidak lebih lama dari percobaannya.
  - Akun sungguhan (dengan atau tanpa izin) tidak pernah diganti; panggilan ulang dengan sesi yang ada tidak membuat apa pun.
  - `GET /v1/auth/session` menambahkan `guest: true` untuk akun percobaan.
  - Sweep privasi meminta erasure (`TRIAL_EXPIRED`) untuk percobaan yang habis, lalu erasure biasa menghapus semuanya.
  - Migrasi `0011-guest-trial` (up/down).
- **Frontend.**
  - `ensureLearner()`: tanpa akun, minta akun percobaan, lalu `/coba` memakai loop kanonik yang sama seperti siswa
    yang masuk. Panggilan `backendFirst` (cek, solusi, tutor) memanggilnya lebih dulu, best effort.
  - `useAuth` tetap menganggap akun percobaan sebagai tamu (tanpa profil atau keluar; tawaran daftar tetap).
  - Ini menggantikan jalur `/v1/trial/*` (stateless, tanpa DeepSeek) yang ditambahkan sesi Codex, atas pilihan pengguna.
    File `src/platform/trial-routes.ts` dan `src/assessment/trial.ts` dari Codex tidak dihapus; FE tidak memakainya lagi.

## Hasil

| Pemeriksaan | Hasil | File |
|---|---|---|
| Typecheck, batas modul, OpenAPI 3.1 | Lulus | `typecheck.txt`, `boundaries.txt`, `openapi.txt` |
| `guest-trial` (9 subtes) | Lulus | `backend-tests-run-1.txt` |
| Suite backend penuh | **250/263**, exit 1. Suite guest, email dan self-onboarding lulus. 13 gagal, semuanya dari pekerjaan lain (lihat bawah) | `backend-tests-run-1.txt` |
| FE `npm test` | Exit 0 (run ke-3) | `frontend-npm-test.txt`; run gagal 1–2 disimpan |
| Typecheck Vue (alias dipetakan) | 0 error di file yang diubah; 50 error lain di checkout | `vue-typecheck-alias-mapped.txt` |
| FE build | Exit 0 | `frontend-build.txt` |
| Playwright: practice 2 + loop 7 (termasuk tes tamu baru) + email-link 2 | **11/11** (run 2) | `browser-e2e-run-2.txt`; run 1 gagal disimpan |
| Mutation checks (API 6, klien 4, E2E 1) | **11/11 terbunuh**; sumber dipulihkan, checksum OK | `mutation-checks-part-1-1to5.txt`, `mutation-checks-part-2-6to11.txt`, `mutate-guest.mjs` |

### Run yang gagal, apa adanya

- **E2E run 1, 9/11.**
  - Tes tamu: `POST /v1/auth/guest` menjawab 400. FE mengirim JSON tanpa body, dan API menolak body JSON kosong.
    Diperbaiki dengan FE mengirim `{}`; tes klien sekarang memeriksa body.
  - Tes "backend gagal": assertion masih mencari teks lama "Layanan belum bisa memeriksa". Sejak perubahan Codex di
    `apiErrors.ts` (25 Okt 19:38), kegagalan tampil sebagai alert "Server sedang bermasalah (HTTP 503)". Halaman memang
    menampilkan kegagalan tanpa hasil. Assertion disesuaikan ke UI sekarang; maksud tes (gagal tetap gagal, bukan demo)
    tidak dilonggarkan.
- **FE `npm test` run 1.** `test:backend` gagal karena `backendFirst` menunda `fetch` satu microtask. Diperbaiki:
  `ensureLearner` hanya dipanggil bila akun dan kanonik aktif.
- **FE `npm test` run 2.** `test:no-fallback` (Codex) gagal karena kegagalan `ensureLearner` menghentikan panggilan.
  Diperbaiki: best effort, panggilan sebenarnya tetap berjalan dan memunculkan kegagalannya sendiri.

## 13 kegagalan suite penuh: bukan dari perubahan ini

- **10 yang sama seperti 25 Oktober** (`../email-outbox-2026-10-25/README.md`, kontrol tanpa 0010): rollback migrasi,
  INV-19 dan turunannya, `retry_original` L3, dan tutor (ketergantungan urutan).
- **2 baru, L4 dan L8** (`legacy-loop-facade`), dari perubahan FE Codex 25 Okt 19:38–19:40:
  - L8: `detectLocally` dihapus dari `src/services/intake.ts` (di HEAD masih ada);
  - L4: pesan error berubah dari `http_409` ke "(HTTP 409)".
- **Penghitungan:** runner menghitung induk suite juga. 25 Oktober: 8 tes gagal + 2 induk = 10. Sekarang
  ditambah L4, L8 dan induk `legacy-loop-facade` = 13.

## Untuk dicoba

Jalankan ulang `npm run local:dev` (API lama harus diganti untuk memuat migrasi 0011 dan route baru), buka
`http://localhost:5180/coba` tanpa login, lalu cek jawaban. Jawaban yang tidak tercakup aturan diantrekan ke DeepSeek bila
`deepseek.env` terisi.

## Catatan mutation run

Putaran pertama berhenti setelah mutasi #5: Windows mengunci `src/privacy/erasure.ts` sesaat (`UNKNOWN: open`), sehingga
pemulihan gagal dan file tertinggal termutasi. File dipulihkan manual dan dicek dengan checksum (cocok). Runner diberi
percobaan ulang saat menulis (maks. 20× tiap 250 ms) dan opsi `--from`, lalu #6–#11 dijalankan. Kelima mutasi pertama
sudah terbunuh sebelum penguncian terjadi.
