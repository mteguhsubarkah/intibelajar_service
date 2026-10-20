> Status terbaru: lihat [koneksi progress, tutor dan OCR](11-connected-fe-be-progress-tutor-ocr.md). Tabel di bawah mencatat kondisi sebelum pekerjaan lanjutan.

# Swagger, Google sign-in dan status koneksi FE–BE

20 Oktober 2026. Development lokal; tidak ada deployment atau persetujuan produksi. Baseline tetap dokumen arsitektur 01–12. Permintaan pengguna: dokumentasi Swagger, implementasi daftar/masuk Google, dan inventaris fitur yang belum terhubung.

## Swagger: buka dan coba

- **Direkomendasikan:** http://localhost:5180/docs — melalui proxy FE, memakai cookie/Origin yang sama dengan aplikasi.
- Daftar kontrak JSON: http://localhost:5180/docs/openapi.json.
- Akses baca langsung BE: http://127.0.0.1:8000/docs. Mutasi melalui alamat ini dapat ditolak karena Origin berbeda; gunakan alamat FE untuk Try it out.

Pilih tag/endpoint → **Try it out** → isi parameter/body → **Execute**. Untuk endpoint akun, masuk terlebih dahulu lewat http://localhost:5180/__local di browser yang sama. Swagger mengambil CSRF session untuk mutasi; parameter Idempotency-Key dan expectedStateVersion tetap harus diisi bila diperlukan. Jangan mencoba DELETE/revocation pada akun yang progresnya ingin dipertahankan.

Swagger menampilkan **62 operasi kontrak**, termasuk fitur mendatang. Tampil di dokumentasi tidak berarti sudah diimplementasikan/diaktifkan. Aset UI dilayani dari dependency lokal `swagger-ui-dist`, tanpa CDN atau external validator; credentials tidak dipersist oleh Swagger. Requests dibatasi ke origin yang sama. Kontrak bersumber dari `docs/backend-architecture/openapi.yaml`, bukan schema duplikat.

## Google: kode siap, provider masih nonaktif

Sesuai jawaban pengguna, Client ID/Secret belum tersedia. Default `LOCAL_GOOGLE_OIDC=false` atau tidak diisi. `POST /v1/auth/start` provider google menjawab 503 dengan blocker `GOOGLE_OIDC_NOT_CONFIGURED` sampai konfigurasi lengkap.

Alur yang disiapkan: tombol FE → start Google → code flow/PKCE S256 → callback → verifikasi JWS RS256, issuer, audience, expiry, nonce dan state melalui `openid-client` → pembuatan/lookup identitas Google sub → session baru. Auth transaction terikat cookie pre-auth, kedaluwarsa 10 menit dan diklaim sekali sebelum token exchange. Transaksi database tidak ditahan selama HTTP provider. Kegagalan callback perlu memulai sign-in baru. Tokens tidak disimpan; alamat email Google tidak dipersist. Google sub tetap identifier sensitif dalam database.

Akun baru berstatus **PENDING_CONSENT** dan diarahkan ke `/kenalan`; Google tidak membuktikan umur/guardian dan tidak memberikan consent belajar/AI. Akun disabled ditolak. Akun Google dan email hanya dapat terhubung otomatis jika identitas email yang cocok sudah verified; email sintetis `.invalid` tidak verified sehingga tidak dapat mengambil alih/link akun Google.

Mode yang dapat dikonfigurasi saat ini **uji developer dewasa saja**, satu email allowlist, pada database `intibelajar_local_dev`. Semua konten/learner tetap fixture development; jika mode ini kelak diaktifkan, Google sub akun developer merupakan identifier nyata dan harus diperlakukan demikian. Jangan gunakan akun siswa. Uji nyata belum dilakukan dan tidak diklaim berhasil.

## Panduan Google Cloud

Rujukan: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect). Nama menu dapat berubah; bagian penting adalah OAuth client tipe Web application, testing audience dan exact redirect URI.

1. Buka [Google Cloud Console](https://console.cloud.google.com/), buat/pilih proyek development IntiBelajar.
2. Buka **Google Auth Platform**. Isi **Branding** (nama aplikasi, email dukungan/kontak). Pada **Audience**, gunakan mode **Testing** dan tambahkan akun developer dewasa sebagai test user. Pilihan Internal hanya berlaku jika proyek/organisasi mendukungnya.
3. Pada **Clients**, buat OAuth client tipe **Web application**.
4. Isi **Authorized JavaScript origins**: `http://localhost:5180`.
5. Isi **Authorized redirect URIs** persis: `http://localhost:5180/v1/auth/callback/google`. Callback melewati proxy FE ke BE. Jangan menggantinya ke port 8000 selama APP_ORIGIN tetap port 5180.
6. Simpan Client ID dan Client Secret sendiri dalam file Git-ignored `.local/local-dev/google.env` pada backend. Jangan kirim secret ke chat atau memakai variabel `VITE_*` untuk secret.

```dotenv
LOCAL_GOOGLE_OIDC=false
GOOGLE_CLIENT_ID=REPLACE.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=REPLACE
GOOGLE_TEST_EMAIL=EMAIL_AKUN_DEVELOPER_DEWASA
GOOGLE_TEST_ADULT_ACK=false
```

Setelah akun uji dewasa terdaftar dan Anda memang akan melakukan pengujian nyata, ganti `GOOGLE_TEST_ADULT_ACK=true` dan `LOCAL_GOOGLE_OIDC=true`. Restart API. Launcher membaca file ini; secret tidak diteruskan ke proses frontend. Login hanya menerima email allowlist tersebut. Tidak perlu meminta scope Drive/Gmail, hanya `openid email`.

Untuk mencoba UI, buka `/profile` → daftar → Google, atau http://localhost:5180/auth/email → **Lanjutkan dengan Google · akun uji**. Selesaikan Google lalu periksa `/v1/auth/session`. Akun baru tetap perlu onboarding/consent development yang eksplisit; tidak ada auto-grant.

## Menjalankan komponen manual

Sesudah PostgreSQL dan `dev-local.ps1 -PrepareOnly` selesai, dari root backend, satu terminal per komponen:

```powershell
node scripts/local/component.mjs api
node scripts/local/component.mjs worker
node scripts/local/component.mjs frontend
```

Helper ini memuat konfigurasi lokal yang sama tanpa reset database. API/worker membaca file Google/DeepSeek privat; frontend menerima konfigurasi proxy tanpa secrets. `npm run dev` langsung dari repo FE masih memakai konfigurasi Vite repo tersebut, bukan harness ini.

Alternatif bila tetap menggunakan command Node manual sebelumnya: tambahkan `--env-file-if-exists=.local/local-dev/google.env` untuk API, setelah memuat `.local/local-dev/env.json`. Google tidak dibutuhkan oleh worker, tetapi helper menjaga konfigurasi startup konsisten.

## Inventaris koneksi aktual

Audit source pada tanggal di atas; mencakup perbedaan antara BE sudah punya endpoint dan UI sudah memakai endpoint. **Tidak mengimplementasikan Slice 3–6 dalam pekerjaan ini.**

| Fitur FE | Status | Yang masih perlu dikerjakan |
|---|---|---|
| `/coba`, `/challenge`: diagnosis dan retry soal canonical | Terhubung untuk akun eligible | Konten/rubric produksi tetap perlu review; guest sengaja demo lokal |
| Funnel D3: materi, slide, quick check, retry | Terhubung | Approval konten produksi terpisah |
| Bank latihan/gabungan dan core lesson checks | Terhubung pada jalur canonical untuk akun eligible | Copy/konfigurasi seluruh katalog dan review konten bukan approval produksi |
| Tutor D6 pada soal aktif | Terhubung ke naskah server | Chatbot AI/conversation/message polling belum dihubungkan |
| Google daftar/masuk | Kode BE + tombol FE tersedia, nonaktif | OAuth credentials, adult test-user setup dan verifikasi live |
| Email login | Transport sintetis `.invalid` | Provider email sungguhan belum dikonfigurasi |
| Onboarding dan consent/revocation/deletion | Endpoint ada; UI onboarding/permintaan/keputusan/logout development ada | Verifikasi guardian/umur dan legal produksi; layar hak-data lengkap belum tersedia |
| Home/map/progress/mastery/profile ringkasan akun | FE `useLearnerProgress` mencoba `/v1/me/progress`, BE belum ada | Slice 3: progress/mastery projection dan render status server; demo dapat tampak sebagai guest ketika endpoint belum tersedia |
| XP, level, streak, misi/riwayat aktivitas akun | Belum ada BE projection/stats | Slice 3; client/local state tidak dianggap bukti mastery/XP server |
| Tombol “Hasil keliru? Laporkan” | Endpoint report BE ada; tombol FE masih `track('diagnosis_report')` | Hubungkan ke `POST /v1/diagnosis-runs/{diagnosisRunId}/reports`, tampilkan status/replay yang sebenarnya |
| Review laporan oleh staff | Belum siap | D7/tooling staff dan kebijakan operasional |
| Import progres tamu setelah login, lintas perangkat | Belum terhubung | `POST /v1/me/device-imports`, consent lalu resume/import; pointer localStorage saja tidak memenuhi ini |
| Preferensi kelas/mapel perangkat | `useStudyPreferences` lokal | Profil canonical ada, tetapi pilihan perangkat itu belum menjadi sinkronisasi profil lintas perangkat |
| Tanya soal: teks → konsep | Legacy L8 BE tersedia, adapter FE ada | Pemetaan keyword dalam katalog saja; bukan diagnosis bebas untuk setiap soal |
| Foto/OCR/unggahan | Dinonaktifkan; demo memakai teks contoh | Consent upload, penyimpanan aman/OCR dan canonical intake APIs (Slice 6) |
| Diagnosis DeepSeek | Adapter + ledger ada, live off | Saldo provider: run sebelumnya HTTP 402; validasi live output masih terblokir |
| AI chatbot bebas khusus soal–inti | Prompt disiapkan, belum aktif | Evaluasi scope/safety, budget, consent dan endpoint conversation/message (Slice 5) |
| Analytics/reminder/email notifikasi | Event perangkat; fitur eksternal belum aktif | Consent/layanan eksternal/retention yang disetujui |
| Remote CI/deployment | Belum diselesaikan di sini | D8 dan gate deployment; tidak ada deployment oleh pekerjaan ini |

Daftar lengkap hasil cek registrasi route ada di `evidence/swagger-google-2026-10-20/api-coverage.json`. Dari 62 operasi, **15 belum mempunyai route**: device-imports; progress/mastery/detail/progress-events/stats; 4 operasi tutor conversation/message; 5 operasi question-intake. Route terdaftar lainnya masih dapat memiliki feature/auth/consent/provider gate. OCR facade dan public guest evaluation memang fail closed.

Urutan yang disarankan berikutnya: (1) konfigurasi dan uji Google; (2) hubungkan report UI yang BE-nya sudah ada; (3) Slice 3 progress/mastery supaya Home/map/profil benar-benar memakai status akun; (4) account continuity/import; (5) AI tutor/OCR bertahap sesuai gate. B-01/B-02 tetap backlog.

## Kompatibilitas dan verifikasi

- Tidak mengubah shape respons API atau route Vue. Callback menambah parameter query **opsional** `scope`, `authuser`, `prompt`, `hd`, `iss`, `error_description`, karena provider dapat mengirim metadata. Request lama tetap valid, unknown query lain tetap ditolak. Metadata bukan identitas/otoritas consent; optional `iss` diteruskan untuk validasi library. Ini review kompatibilitas eksplisit untuk perubahan kontrak additive.
- Tidak perlu migration baru: state/nonce di-hash dan pasangan nonce/verifier disimpan terenkripsi dalam kolom auth_transaction yang sudah ada. Tidak ada DDL dijalankan selain migration up yang sudah terpasang pada tes.
- Dependency lokal: `openid-client` dan `swagger-ui-dist`, versi exact di package-lock. Tidak mengaktifkan install script telemetry tambahan.
- Tes baru: **22/22** lulus menggunakan token RSA/JWKS sintetis, HTTP mock, dan PostgreSQL *_test. Termasuk signature palsu, nonce/state/issuer/audience/expiry salah, email unverified, allowlist, PKCE, expired/wrong-cookie/replay callback, session rotation, consent tetap pending, verified-only linking, provider gagal dan akun disabled.
- Frontend suite + 29 consumer contract + golden v2 + isolation lulus. Validator OpenAPI 3.1 lulus. TypeScript dan module boundaries diperiksa. Browser Swagger Try it out/session/CSRF dan tombol Google nonaktif diperiksa; hasil di evidence.
- Uji browser awal terlalu luas menghitung Google Fonts milik FE sebagai aset Swagger; pemeriksaan dipisah sesuai halaman dan request FE itu dicatat dalam browser evidence. **FE-FONTS-01:** review/self-host font frontend sebelum penggunaan dengan data nyata; tidak diubah dalam pekerjaan ini.
- Tidak menjalankan full stress/model/mutation suite ulang. Tidak ada uji login Google live karena credentials belum tersedia. Tidak ada real student data, push atau deployment. Produksi tetap disabled dan gate legal/privacy/guardian tidak diubah.
- Architecture Python self-test belum dapat dijalankan pada runtime yang tersedia: alias Python Windows tidak dapat diakses, dan runtime bundled menemukan modul `yaml` tanpa `safe_load`. Tidak memasang dependency tambahan untuk mengejar masalah lingkungan ini; validasi OpenAPI memakai swagger-parser berhasil. `verification.json` lama tetap dipertahankan sebagai artefak baseline, bukan bukti implementasi baru.
