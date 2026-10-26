# Email masuk lewat outbox: evidence (25 Oktober 2026)

Node 24.19.0, PostgreSQL 17.5 (`versions.txt`), database `*_test` saja. Tidak ada email sungguhan: tes memakai transport
palsu dan fetch palsu, tanpa panggilan ke Resend. Belum di-commit.

## Hasil

| Pemeriksaan | Hasil | File |
|---|---|---|
| Tes email (outbox 11 + adapter Resend 1 + self-onboarding 3 subtes) | **17/17** | `email-tests.txt` |
| Mutation checks | **14/14 terbunuh**; sumber dipulihkan (checksum OK) | `mutation-checks.txt`, `mutate-email.mjs` |
| Typecheck backend, batas modul, OpenAPI 3.1, `pilot-readiness` | Lulus | — |
| Suite backend penuh, run 1 dan run 2 | **241/251** dua kali; tiga suite email lulus di keduanya; 10 gagal yang sama (lihat bawah) | `backend-tests-run-1.txt`, `-2.txt` |
| FE `npm test` | Lulus (exit 0) | `frontend-npm-test.txt` |
| Typecheck Vue (alias `@/` dipetakan) | 0 error di `SignInView.vue`; 46 error lain di checkout tidak terkait | `vue-typecheck-alias-mapped.txt` |
| Playwright `email-link.spec.ts` | **2/2** di ketiga run | `browser-e2e*.txt` |
| Playwright kanonik (practice 2 + loop 7), run pertama | **Tidak valid**: API E2E tidak bisa start (port 8000 terpakai) | `browser-e2e.txt`, `browser-e2e-api-log.txt` |
| Playwright ulang 1, port sudah kosong | **10/11**, exit 1 (satu gagal karena waktu, lihat bawah) | `browser-e2e-rerun.txt`, `browser-e2e-rerun-api-log.txt` |
| Playwright ulang 2 | **11/11**, exit 0 | `browser-e2e-rerun-2.txt`, `browser-e2e-rerun-2-api-log.txt` |

**Mutation checks, putaran 1** (`mutation-checks-round-1.txt`): 12/14. Dua mutasi selamat karena tesnya lemah:
- tanpa `FOR UPDATE SKIP LOCKED`: balapan tidak pernah terpicu;
- adapter menerima token di query string: kasus ujinya sudah ditolak oleh pola fragment.

Ditambahkan tes deterministik untuk keduanya; putaran berikutnya 14/14. Satu putaran terhenti di tengah karena tes
baru tidak melepas lock saat assertion gagal. Runner dihentikan, satu file sumber yang masih termutasi dipulihkan dan
diverifikasi dengan checksum, tesnya diperbaiki (`finally`), dan runner diberi timeout per mutasi. Timeout dihitung
sebagai "tidak terbunuh".

## 10 kegagalan suite penuh: sudah ada sebelum perubahan email

Kegagalannya:
- `learning-erasure`, 6 tes:
  - tes rollback migrasi masih mengharapkan hanya 0001–0004;
  - INV-19 menemukan tabel learner dari 0006–0008 (`learner_stats`, `mastery_state`, `private_asset`, `progress_event`,
    `question_intake`, `tutor_conversation`) yang belum masuk erasure;
  - 4 tes lanjutan gagal karena itu.
- `legacy-facade`: `retry_original` sekarang 409 CONTENT_UNAVAILABLE, bukan 403.
- `tutor-ai-connection`.

**Kontrol** (`control-without-0010.txt`): migrasi 0010 di-rollback (`schema_migration` terakhir 0009, `email_outbox` tidak
ada), file 0010 disisihkan, lalu ketiga file tes dijalankan. Kegagalan `learning-erasure` dan `legacy-facade` yang sama
tetap muncul. File 0010 dikembalikan dan migrasi dijalankan ulang.

**Tutor:** tes ini lulus di kontrol dan lulus dua kali sendirian dengan 0010 (`tutor-with-0010-*.txt`). Di suite penuh ia
gagal di `assert.ok(q)`: soal `soal-menara` tidak ada di katalog yang ditinggalkan tes sebelumnya. Ini ketergantungan
urutan, tidak terkait email.

Kegagalan ini milik pekerjaan lain yang belum di-commit (migrasi 0005–0009, katalog) dan tidak diperbaiki di sini.

## Playwright kanonik tidak valid di run ini

API untuk E2E gagal start: `EADDRINUSE 127.0.0.1:8000` (`browser-e2e-api-log.txt`). Port 8000 dan 5180 sudah dipakai
proses node yang berjalan sejak 10:41/10:52, kemungkinan launcher `local:dev` milik pengguna, yang tidak dihentikan.
Spec kanonik akhirnya berbicara dengan API lain dan database lain, jadi hasilnya bukan bukti apa pun. Spec `email-link`
mem-mock semua `/v1`, sehingga tidak terpengaruh.

## Ulang setelah port kosong

Proses node pada port 8000 dan 5180 ternyata berjalan sebagai Administrator, jadi tidak bisa dihentikan dari sesi ini.
Pengguna menghentikannya dari PowerShell Administrator. Port 8000/5180/4173 dipastikan kosong dan PostgreSQL 55432 hidup
sebelum run ulang.

- **Ulang 1: 10/11, exit 1.** Gagal: "diagnosis dari server; refresh melanjutkan…" (tes pertama di worker pertama).
  `.r-filled` belum tampil dalam 5 detik; layar masih "Lagi mengecek langkahmu…", tanpa pesan error. Log API run itu tidak
  berisi 5xx (153×200, 20×201, 4×204, 2×403 dan 1×409 yang memang diharapkan tes), tetapi request awal lambat saat cold
  start: `/v1/auth/session` sekitar 2,1–2,4 s (empat kali), `POST /v1/learning-sessions` 1,8 s, `POST …/attempts` 2,6 s.
  Totalnya melewati batas 5 detik assertion. Ini masalah waktu, bukan fungsi. Penyebab lambatnya cold start belum
  diselidiki.
- **Ulang 2: 11/11, exit 0**, tanpa perubahan kode atau tes. Tes yang sama selesai dalam 6,9 s.

Assertion dan timeout tidak dilonggarkan. Karena satu dari dua run ulang gagal pada waktu, tes pertama itu **belum
terbukti stabil**. Tidak ada kegagalan yang terkait email atau outbox: spec `email-link` lulus di semua run.
