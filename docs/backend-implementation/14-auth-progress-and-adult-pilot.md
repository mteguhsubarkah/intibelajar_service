# Status login/progres dan persiapan pilot dewasa

25 Oktober 2026. Scope: memperbaiki penawaran daftar setelah login, memeriksa backend,
dan menyiapkan jalur pilot privat dewasa. Provider email belum ada menurut jawaban pengguna.

## Temuan dan perubahan

FE memiliki perubahan auth yang belum di-commit saat mulai kerja; perubahan tersebut
dipertahankan dan diperbaiki secara terarah. File desain/landing yang tidak terkait tidak diubah.

- `useAuth`: /v1/auth/session menjadi sumber autentikasi. Error jaringan/503 tidak diubah
  menjadi guest; sesi terakhir yang dikonfirmasi dipertahankan dan prompt akun disembunyikan
  selama status belum diketahui. Hanya respons authenticated=false yang mengizinkan tawaran daftar.
- `useLearnerProgress`: path akun tetap /v1 sama-origin. Hanya 403 CONSENT_REQUIRED ditangani
  sebagai kebutuhan consent; FORBIDDEN/503 tetap error. Data progres dan grade lama dibersihkan
  pada kegagalan/logout untuk mencegah campuran data akun.
- Pengingat SaveNudge, modal AccountOffer, GuestAccountState dan halaman akun memakai eligibility
  tawaran akun. Pengguna login tidak ditawari daftar ketika progress belum diizinkan.
- Verifikasi email, onboarding, dan logout menyegarkan status sesi/progres bersama, bukan
  hanya ref pada halaman lokal. Respons sesi malformed ditangani sebagai error.
- Banner consent berbeda dari penawaran registrasi. Tidak ada auto-grant, skip consent,
  klaim server telah menyimpan, atau perubahan demo verdict.
- Backend /v1/auth/session: missingPurposes memakai hasConsent dengan policy_version dan expiry
  yang sama dengan guard endpoint belajar. Grant kebijakan lama tidak lagi terlihat eligible
  hanya karena konsen paling baru berstatus GRANTED.
- Worker projectionLearners juga memfilter policy_version aktif agar tidak menjadwalkan rebuild
  yang kemudian ditolak guard versi kebijakan.

Response shape /v1 tetap sama. Tidak ada migrasi schema, penggantian versi policy, atau deployment.
Kebijakan guardian-default tetap dipertahankan, termasuk untuk akun dewasa hingga OD-03 diselesaikan.

## Persiapan email dan pilot

**Diperbarui 25 Oktober 2026:** email masuk kini lewat outbox (migrasi 0010, `email_outbox`), worker mengirim dengan
retry dan Idempotency-Key tetap, token di fragment; lihat [panduan pilot](../deployment/private-adult-pilot.md).
Adapter `email-delivery.ts` di bawah sudah dihapus. Catatan asli:

Adapter email Resend opsional disiapkan di identity/email-delivery.ts: default off, transport
HTTPS tetap, timeout, idempotency key, validasi alamat/link, token dalam fragment, error redaction.
Ia **belum disambungkan ke enrollment nyata**. Auth email yang aktif tetap .invalid + mailbox sintetis.
Tidak ada pengiriman real email saat implementasi atau tes.

`npm run pilot:check` memberikan audit read-only dengan exit 2 untuk gate yang masih terbuka,
dan tidak membocorkan secret. Memasang kredensial bukan bukti persetujuan produksi.
Lihat [panduan pilot dewasa](../deployment/private-adult-pilot.md) untuk langkah provider,
lokasi file konfigurasi, urutan engineering dan persetujuan yang diperlukan.

## Verifikasi yang dijalankan

- BE tes sesi/progres + Google + email transport + pilot readiness: **33/33 lulus**.
- BE regresi Slice 0 dan progres/import/tutor: **24/24 lulus**, termasuk email sintetis,
  CSRF/Origin, session expiry, consent/revocation, migration rollback/reapply/recovery,
  ownership, deletion, idempotency dan redaksi log.
- TypeScript backend, module/rubric boundaries dan OpenAPI 3.1 validator: lulus.
- FE suite lengkap termasuk tes auth baru: lulus. **29 consumer contract checks**: lulus.
- Golden: **81 numeric, 47 option, 21 tower**; 12 delta tetap PROPOSED: lulus.
- FE build: 87 komponen, 0 binding bermasalah; vue-tsc dan Vite lulus.
- Browser terisolasi: pending consent, valid account, offline, forbidden, anonymous:
  **5/5 lulus**, tanpa runtime JS errors. API dipalsukan dengan data buatan; bukan bukti
  provider email nyata atau pengujian Google pengguna ulang.
- Uji browser awal berhenti karena selector tes mencari teks error yang tidak sesuai pesan
  sebenarnya. Selector diperbaiki lalu kelima kasus lulus; guard tidak dilemahkan.

Tes database hanya *_test, bukan data pengguna. Tidak ada email/AI network call atau deployment.
Full backend stress/model/mutation suite tidak diulang; B-01/B-02 tetap backlog.
Screenshot browser lokal berada di .local/evidence/account-pilot-2026-10-25/.

## Batas untuk data nyata

**Belum siap menerima real learning data.** Runtime masih menolak production/public origin,
policy masih synthetic-dev-v1, akun Google masih single adult test allowlist. Self-consent
dewasa/verifikasi usia, pemberitahuan privasi, provider email/outbox/enrollment nyata,
retention/deletion/restore operasional serta persetujuan processor AI belum selesai.
Semua itu disebut sebagai gate konkret, bukan dianggap disetujui oleh pilihan scope pilot dewasa.
