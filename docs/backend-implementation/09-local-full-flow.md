# Alur lokal D3/D6 dan integrasi diagnosis DeepSeek

Tanggal: 20 Oktober 2026. Scope hanya development, identitas/consent/data buatan. Tidak ada deployment, commit atau push oleh pekerjaan ini. B-01/B-02 tetap terbuka.

## Cara mencoba sekarang

Jalankan dari backend: `powershell -ExecutionPolicy Bypass -File .\scripts\dev-local.ps1`.
Buka http://localhost:5180/__local lalu pilih **Uji Lokal A**. Jika launcher sudah berjalan, cukup buka URL tersebut.

1. Di `/coba`, isi `sin 30 = 20/x` lalu periksa jawaban.
2. Pilih **Pelajari inti ini**, lanjutkan materi, kerjakan cek pemahaman.
3. Buka IntiBot untuk petunjuk terkait soal. Pertanyaan di luar cakupan diarahkan kembali ke soal.
4. Pilih **Kerjakan ulang**, coba `tan 30 = 20/x, x = 20√3`. Sesi selesai melalui backend.
5. Refresh di tengah materi melanjutkan slide dan status server. Akun B terpisah; tamu tetap demo lokal.

## Implementasi

- D3: lesson authored `MAT.TRI.L.FUNNEL_RATIO_CHOICE`, dua slide dan cek c4; canonical learning-session actions, advance, quick-check-answers, finish dan retry terhubung ke Vue.
- D6: `/v1/learning/tutor` memakai naskah milik server, batas soal aktif, ownership, consent, idempotency dan penghitung hint server. Riwayat/hint count dari client tidak menjadi otoritas. Jawaban lengkap mengikuti gate solusi server, bukan sekadar jumlah hint.
- IntiBot saat ini **tutor bernaskah**, belum chatbot DeepSeek bebas. Prompt AI tutor disiapkan di `ai/prompts/tutor/0.1.0.md`, dengan lingkup hubungan soal–inti dan membangun soal dari inti. Panggilan AI tutor tetap nonaktif.
- Diagnosis DeepSeek: fixed host/model, JSON tervalidasi, evidence/span tervalidasi, AI_ONLY, consent dicek sebelum transmisi dan saat adopsi, input hanya tiga teks sintetis exact-match. Tidak ada fallback yang menyamarkan kegagalan provider sebagai hasil AI.
- Migration `0005-development-ai-budget.up.sql` dieksekusi pada PostgreSQL lokal terisolasi dan database pengujian; ledger reservasi atomik bertahan setelah restart. Rollback 0005 belum diuji dalam pekerjaan ini dan tidak dijalankan pada database lokal berisi ledger.
- `LOCAL_DEEPSEEK` default mati; factory hanya mengizinkan development, synthetic dan database `intibelajar_local_dev`. Key tidak diberikan ke proses frontend dan tidak ditulis ke laporan.

## Status panggilan sungguhan: terblokir saldo API

Key terbaca dari `.local/local-dev/deepseek.env`. Uji browser real mencapai run FAILED setelah retry terbatas. Probe satu panggilan tambahan mengonfirmasi **HTTP 402**. [Dokumentasi resmi DeepSeek](https://api-docs.deepseek.com/quick_start/error_codes/) mengartikan 402 sebagai saldo tidak cukup.

Tidak ada respons diagnosis AI berhasil yang dapat diklaim. `LOCAL_DEEPSEEK=false` dikembalikan untuk menghentikan percobaan sampai saldo API tersedia; key tetap tersimpan privat. Proteksi baru menghentikan HTTP/reservasi berikutnya setelah 401/402 sampai restart proses.

Setelah mengisi saldo API, ubah hanya `LOCAL_DEEPSEEK=true` di file privat tersebut, restart launcher, pilih **Uji AI Sintetis**, lalu salin persis:

`Saya memilih sinus karena saya mengira jarak mendatar adalah sisi miring.`

Alternatif verifikasi eksplisit: `node scripts/local/deepseek-smoke.mjs` saat server hidup. Perintah ini melakukan panggilan sungguhan dan worker boleh mencoba ulang secara terbatas. Hasil berhasil harus berstatus COMPLETED dan engine AI_ASSISTED. Jangan menjalankannya berulang untuk polling saldo.

## Pembatas biaya

Batas reservasi aplikasi Rp80.000 dari alokasi Rp100.000. Setiap panggilan mencadangkan ceiling sebelum HTTP; kegagalan tetap mempertahankan reservasi. Ini **bukan tagihan aktual** atau pembacaan saldo provider. Jangan menghapus ledger untuk melanjutkan uji.

Ceiling menggunakan $10/juta token input, $20/juta output, kurs asumsi konservatif Rp20.000/USD dan maksimum 2.048 token output. [Harga resmi yang diperiksa 20 Oktober 2026](https://api-docs.deepseek.com/quick_start/pricing/?push_animated=1&theme=light&webview_progress_bar=1) berada di bawah ceiling ini (Flash peak cache miss $0,30/juta input dan $1,20/juta output). Periksa ulang tarif sebelum penggunaan lanjutan; ini bukan jaminan tarif/kurs masa depan atau batas akun global.

## Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Prompt diagnosis + adapter DeepSeek offline, termasuk stop 401/402 | 12/12 |
| PostgreSQL D3/D6 + ownership/consent/idempotency/ledger atomik | 5/5 |
| Question-loop regression, model stress tidak dijalankan | 20/20 |
| Legacy facade dengan oracle Vue | 11/11 |
| Frontend suite, consumer contract, golden v2, isolation | Lulus; 29 kontrak; 81 numeric, 47 option, 21 tower |
| Browser diagnosis → materi → refresh → cek → tutor → retry → COMPLETED | Lulus; tanpa runtime error |
| TypeScript, batas modul, validator OpenAPI 3.1 | Lulus |
| Manifest draft | 0 error; 62 UNREVIEWED |
| DeepSeek live | Gagal, HTTP 402 dikonfirmasi; bukan kelulusan AI |

Tidak menjalankan ulang full backend/model stress/mutation suite; angka lama tidak dianggap bukti run baru. Kesalahan awal expectation lesson lama dan helper probe kolom `created_at` diperbaiki; probe tersebut berhenti sebelum HTTP. Browser test awal menunggu perubahan state terlalu cepat, diperbaiki dengan polling state server. Bukti browser terakhir disalin ke `evidence/local-full-flow-2026-10-20/`.

## Keputusan dan backlog

- D3/D6 selesai **untuk uji lokal** sesuai otorisasi pengguna. Authored content tetap PROPOSED; review pendidikan/produksi tidak diasumsikan disetujui.
- Kompatibilitas: shape `/v1` dan facade dipertahankan. Lesson baru tidak memiliki routeSlug legacy; field opsional tidak dikirim dan legacy coreId kosong sesuai mapper. Oracle/kontrak diperiksa. Routes Vue tetap dipertahankan.
- B-01/B-02 tetap backlog, akar masalah belum ditetapkan; hasil run hijau tidak menutupnya.
- AI-LIVE-01: isi saldo API lalu verifikasi end-to-end hasil AI. Blocker eksternal; tidak menghalangi uji deterministik.
- AI-TUTOR-01: hubungkan chatbot AI hanya setelah evaluasi prompt dan pembatas scope/biaya; saat ini prompt siap, tutor server tersedia.
- D7/D8/OD-11 dan gate legal/privacy/guardian/identity/email produksi mengikuti plan; tidak diselesaikan diam-diam. Tidak ada data siswa asli atau klaim kesiapan produksi.
