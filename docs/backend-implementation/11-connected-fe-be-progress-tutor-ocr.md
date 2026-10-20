# Koneksi FE–BE, progress, import, tutor dan OCR

Tanggal: 20 Oktober 2026. Lanjutan development lokal berdasarkan dokumen arsitektur terbaru. Scope tetap data/konten/identitas sintetis; produksi, deploy dan push tidak dilakukan. B-01/B-02 tetap backlog.

## Yang sekarang terhubung

| Bagian | Hasil |
|---|---|
| Home, peta, progress dan profil | Membaca snapshot akun server; status tier/needs-review memakai canonical mastery, misi memakai stats, kelas memakai profil server |
| Mastery dan gamifikasi | Enam view/projection endpoints: progress, mastery page/detail, activity feed, stats; K05, kontradiksi, staleness, XP family/tier/remediation/refresh/mission, streak timezone |
| Laporkan hasil diagnosis | Tombol FE menyimpan report pada run milik learner, status tersimpan muncul kembali setelah refresh; staff review/regrade tetap menunggu D7 |
| Progres tamu/perangkat | UI opt-in di `/account/consent`, checkbox jawaban default kosong; dedupe global device-session, ownership, tanpa evidence/mastery/XP dari import |
| Tutor | FE memakai conversation/message endpoints dan polling; server menyimpan pesan dan hints, tidak mempercayai riwayat/jumlah hints client |
| DeepSeek tutor | Adapter dan worker siap, berbagi ledger biaya diagnosis; live default mati. AI hanya memilih scaffolding soal yang ditulis server, bukan teks bebas |
| Intake ketik | Create/read/discard/confirm tersimpan; saran konsep terbatas katalog; konfirmasi membuat soal privat UNREVIEWED yang hanya pemiliknya dapat baca |
| OCR foto | FE upload/poll canonical, quarantine terenkripsi, worker dan adapter OpenRouter siap; belum diaktifkan karena key belum tersedia |

Semua **62 operasi kontrak mempunyai route** setelah pekerjaan ini. Registrasi route bukan bukti semua kapabilitas aktif: provider/gate tetap dapat menjawab blocker. Public guest evaluation dan facade OCR lama tetap FEATURE_DISABLED sesuai kontrak; upload baru melalui canonical intake. Kontrak response yang sudah ada dan route Vue dipertahankan.

## Menjalankan dan mencoba

PostgreSQL lokal harus hidup. Dari root backend:

```powershell
node scripts/local/component.mjs prepare
```

Lalu satu terminal per komponen:

```powershell
node scripts/local/component.mjs api
node scripts/local/component.mjs worker
node scripts/local/component.mjs frontend
```

Alternatif tetap `npm run local:dev`. Buka http://localhost:5180/__local. Lima akun uji tersedia, dengan consent awal simulasi saja. Consent yang telah dicabut tidak dikembalikan oleh prepare.

1. **Uji Lokal A:** `/coba`, diagnosis `sin 30 = 20/x`, laporkan hasil, refresh, buka tutor, belajar dan retry. Home/progress/profil kemudian membaca data server.
2. **Import:** dengan riwayat perangkat yang valid, buka `/account/consent`, pilih impor. Jawaban hanya dikirim bila checkbox dicentang. Saat ini UI import dibatasi soal menara.
3. **Uji AI Sintetis:** untuk diagnosis/tutor provider setelah konfigurasi diaktifkan. Tanpa AI aktif, tutor tetap berfungsi dengan naskah server dan tidak mengaku telah memanggil DeepSeek.
4. **Uji OCR Sintetis:** punya consent buatan LEARNING_DATA/AI_PROCESSING/IMAGE_UPLOAD. Gunakan hanya gambar contoh buatan; provider tetap memerlukan konfigurasi.
5. **Swagger:** http://localhost:5180/docs. Parameter/auth/consent/provider gates tetap berlaku.

## DeepSeek chatbot: konfigurasi dan batas

Tambahkan flag berikut di `.local/local-dev/deepseek.env` yang sudah Git-ignored. Key tetap di file privat, tidak di chat atau variabel `VITE_*`.

```dotenv
# Aktifkan setelah saldo API siap dan Anda akan menguji fixture sintetis.
LOCAL_DEEPSEEK_TUTOR=false
# DEEPSEEK_API_KEY sudah disimpan sendiri sebelumnya.
# DEEPSEEK_PRICE_CEILING_CONFIRMED=true setelah review ceiling pada laporan 09.
```

Ubah flag tutor menjadi `true` lalu restart **API dan worker** untuk menguji sungguhan. Flag diagnosis `LOCAL_DEEPSEEK` tetap terpisah. Tidak ada panggilan live baru pada pekerjaan ini; hasil live sebelumnya adalah HTTP 402 dan belum dianggap selesai sampai saldo/konfigurasi diverifikasi.

Prompt baru: `ai/prompts/tutor/0.2.0.md`. Dalam batas development saat ini, model memilih **index naskah scaffolding yang tersedia** untuk soal aktif. Pesan egress hanya pilihan pertanyaan sintetis yang cocok dengan node authored, misalnya “Hubungkan soal dengan inti” dan “Bangun soal dari inti”. Pertanyaan lain, permintaan campuran yang tidak cocok, dan permintaan di luar soal diarahkan kembali secara lokal. Model tidak dapat mengirim teks bebas atau membuka kunci lewat output-nya. Ini sengaja lebih terbatas daripada percakapan generatif bebas; mode bebas memerlukan evaluasi/gate tersendiri.

Hint dan solusi penuh tetap melewati gate server yang sudah ada. AI tidak menghasilkan evidence/mastery/XP. AI_PROCESSING diperiksa sebelum HTTP dan saat adoption; lease/context version mencegah hasil basi diadopsi. Gagal provider tidak diganti diagnosis/reply AI palsu. 401/402 menghentikan panggilan berikutnya sampai restart. Reservasi memakai ledger bersama Rp80.000 (laporan 09), bukan anggaran baru untuk chatbot.

## OCR gratis dari pendekatan repo yang dikirim

Referensi: [ceodaniyal/free-llm-image-to-text](https://github.com/ceodaniyal/free-llm-image-to-text). Repo tersebut memakai **OpenRouter**, bukan OCR offline. Implementasi di sini ditulis sebagai adapter TypeScript dan tidak menjalankan script Python repo tersebut.

Pengguna memilih agar kode/panduan disiapkan terlebih dahulu karena belum mempunyai key. Maka tidak ada panggilan OpenRouter sungguhan dan tidak ada klaim akurasi OCR live.

1. Buat key pada [OpenRouter](https://openrouter.ai/settings/keys). Simpan sendiri dalam `.local/local-dev/ocr.env` memakai contoh `.env.ocr.example`.
2. Pilih model vision **yang saat itu masih tersedia** di [daftar model](https://openrouter.ai/models). ID wajib berakhiran `:free`. Nama contoh dari README repo tidak diasumsikan masih tersedia. Adapter memeriksa metadata `/api/v1/models`, modality image dan harga nol sebelum mengirim gambar.
3. Buat gambar uji lokal:

```powershell
node scripts/local/make-ocr-fixture.mjs
```

Perintah mencetak SHA-256 non-rahasia dan menyimpan `.local/local-dev/ocr-synthetic.png`. Contoh yang sama dapat diunduh melalui pemilih akun lokal setelah dibuat.

```dotenv
LOCAL_OPENROUTER_OCR=false
OPENROUTER_API_KEY=ISI_SENDIRI
OPENROUTER_OCR_MODEL=ID_MODEL_VISION_YANG_MASIH_AKTIF:free
OCR_SYNTHETIC_IMAGE_SHA256=HASH_DARI_PERINTAH_DI_ATAS
```

Setelah key/model siap untuk uji nyata, ganti flag ke `true` dan restart API/worker. Masuk **Uji OCR Sintetis**, buka `/tanya`, unggah gambar contoh tersebut. Gambar lain ditolak sebelum egress. Persetujuan simulasi bukan persetujuan siswa sungguhan.

Transport membatasi harga prompt/completion/image/request ke nol, mematikan provider fallback, meminta provider yang tidak mengumpulkan data dan ZDR, serta tidak menggunakan paid plugins. Jika tidak ada provider gratis yang memenuhi batas itu, panggilan gagal secara eksplisit; batas tidak diturunkan diam-diam. Respons berbiaya nonzero ditolak. [OpenRouter menerapkan rate/credit limits](https://openrouter.ai/docs/api_reference/limits); gratis bukan tanpa kuota atau jaminan selalu tersedia.

Gambar JPEG/PNG/WebP ≤5 MB diperiksa/di-decode dengan batas piksel dan disandikan ulang ke PNG sebelum dikirim; EXIF tidak diteruskan. Development menyimpan quarantine terenkripsi di PostgreSQL, tanpa URL gambar publik. Byte gambar dibuang setelah read/failure/discard dan saat expiry. Learner dapat mengoreksi hasil baca sebelum konfirmasi. OCR bukan penilaian jawaban.

## Migrasi dan verifikasi aktual

Migrasi yang ditambahkan dan dijalankan **up** di PostgreSQL test serta `intibelajar_local_dev`:

- `0006-progress`: mastery_state, progress_event, learner_stats, indeks feed.
- `0007-tutor`: tutor_conversation, tutor_message, uniqueness untuk conversation/reply.
- `0008-intake`: private_asset, question_intake, development_intake_image terenkripsi.

DDL utama diekstrak dari dokumen 04. Kysely types diregenerasi dari schema aktual (45 tabel). Database sementara `ib_connect_<random>_test` digunakan untuk all-up → rollback 0008/0007/0006 → reapply → simulated transaction failure → recovery verification, lalu hanya database sementara itu dihapus. Database lokal pengguna tidak di-rollback/reset.

| Pemeriksaan | Hasil |
|---|---|
| Progress/import/intake/tutor AI dan OCR transport | 13/13 lulus |
| K05, kontradiksi, staleness, non-eligible facts | Lulus dalam suite di atas |
| Grading nyata → XP, dedupe, rebuild identik, solusi tidak memberi XP ulang | Lulus |
| Consent/cross-user, opt-in jawaban, revoke saat AI call, private ownership | Lulus |
| DELETE + worker menghapus seluruh dependency baru termasuk private question | Lulus |
| Regresi question-loop dan disputes, model stress dilewati | 25/25 lulus |
| Frontend suite + consumer contract | Lulus; 29 consumer checks |
| Golden | 81 numeric, 47 option, 21 tower; 12 delta tetap PROPOSED |
| Browser alur D3/D6 lengkap | Lulus |
| Browser laporan persist, canonical tutor, Home akun, import tanpa jawaban/XP | Lulus, tanpa runtime errors |
| Migration up/down/recovery terisolasi | Lulus |
| Backend TypeScript, module ownership/rubric boundaries, OpenAPI validator | Lulus |
| DeepSeek/OpenRouter live pada pekerjaan ini | Tidak dilakukan; blocker konfigurasi/saldo |

Bukti ada di `evidence/connections-2026-10-20/`. Uji browser awal memakai fixture localStorage tanpa field `events` yang diwajibkan frontend sehingga import tidak tampil; fixture tes diperbaiki. Kegagalan awal import checkpoint menambah field di luar kontrak dan insert mapping setelah revision published juga diperbaiki; validasi/immutability tidak dilemahkan.

## Batas, keputusan development dan backlog

- Projections dihitung ulang pada read dan command di bawah lock learner, plus refresh worker per jam untuk stale state. Ini default development yang lebih sederhana daripada incremental projection + durable nightly projection job. Optimasi ke incremental/job tetap backlog; tidak mengubah ambang mastery.
- Import menyimpan provenance DEVICE_IMPORT dan fakta presentasi lesson, tetapi tidak mempercayai diagnosis/verdict client. Tahap sesudah soal di-resume sebagai RETRY untuk verifikasi server, termasuk claim COMPLETED dari perangkat. UI saat ini hanya soal menara. Penyempurnaan exact checkpoint/history-only completion lintas semua lesson tetap **C-IMPORT-01**; tidak ada imported mastery/XP.
- Soal intake privat tersimpan sebagai UNREVIEWED, konsep advisory/non-assessable dan rubric AI-assisted tanpa kunci. Owner dapat membaca; publik/akun lain mendapat 404. **C-INTAKE-01:** diagnosis otomatis untuk soal bebas/private masih diblokir CONTENT_UNAVAILABLE karena belum punya evaluator yang sah; confirmation tidak mengaku jawaban sudah dinilai. UI ketik lama tetap memakai mapper katalog, bukan diagnosis AI bebas.
- **C-INTAKE-02:** confirmation/history UI penuh dan hardening gambar/queue/penyimpanan produksi perlu kelanjutan. OCR adapter/foto canonical sudah terhubung, tetapi belum lulus live tanpa key/model. Quarantine PostgreSQL terenkripsi adalah default lokal, bukan pilihan object storage produksi.
- Create PHOTO mencadangkan record asset QUARANTINED untuk memenuhi constraint asset yang sudah ditetapkan; metadata ukuran/hash placeholder diganti saat upload fixture yang lolos allowlist. Record reservation bukan klaim gambar sudah diunggah. Desain reservation/storage produksi perlu review tersendiri.
- Provider DeepSeek/OpenRouter menggantikan usulan provider pada baseline atas instruksi pengguna, hanya untuk development sintetis. Lease tutor memakai metadata pesan dan lease OCR memakai tabel quarantine PostgreSQL pada implementasi lokal ini, bukan job queue generik penuh. Penyatuan registry/invocation audit/queue produksi tetap gate Slice 5–6.
- **C-TUTOR-01:** percakapan generatif bebas belum aktif; AI dibatasi memilih scaffolding authored untuk menjaga scope dan kunci. Provider live menunggu saldo/konfigurasi dan evaluasi.
- **C-PROGRESS-01:** projection rebuild/event replay untuk seluruh backfill historis dan kebijakan perubahan timezone setelah aktivitas perlu pengujian lebih luas sebelum produksi. Level/XP schema dipertahankan, streak freezes tetap 0/off. Tidak ada klaim full Slice 3 production readiness.
- Staff review D7, remote CI D8, email provider nyata, guardian/age verification dan keputusan legal/privacy/retention produksi tetap gate terpisah. Tidak memilih provider email, mengaktifkan analytics/notifikasi atau melakukan deployment secara diam-diam.
- B-01/B-02 dan FE-FONTS-01 tetap backlog. Full backend stress/model/mutation suite tidak diulang. Tes terarah hijau tidak menutup backlog tersebut.
