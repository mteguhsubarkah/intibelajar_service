/* Generated from local planning docs. Do not treat as a live status feed. */
window.INTIBELAJAR_GUIDE_DATA = {
  "generatedAt": "2026-10-20T01:30:32+07:00",
  "sourceDate": "20 Oktober 2026",
  "statusQuote": "Date: 2026-10-18. Status: D1, D2 and D4 approved (2026-10-19); D3, D5–D8 and OD-11 open. M3 and M4 committed as bf02e7f, not pushed. M1 (the parts D1/D2 support) and M2 verified on Node 24.19.0 (§11). M5 implementation is available, but its verification gate is not closed: two open findings (§14, B-01 and B-02) block it and the release gate. M6 learner side implemented and verified (§15); M6 staff side waits for D7. M7 L1, L2, L4, L8 implemented and verified (§16), but M7 as a whole is partial: L3 funnel checks and retry_original wait for D3, L6 for D6. M8: /coba and /challenge on the canonical QUESTION_LOOP implemented and verified for the paths that need no open decision (§17); in-flow lesson, L6 and OD-11 copy blocked. B-03 closed by a negative control (§17); B-01 and B-02 stay OPEN. Nothing committed.",
  "glossary": [
    {
      "id": "Slice",
      "name": "Paket fitur besar",
      "question": "Produk ini dibangun per bagian apa?",
      "explanation": "Satu Slice mengumpulkan kemampuan produk yang bisa dipakai dan diuji bersama. Di dalamnya ada beberapa milestone.",
      "analogy": "Seperti satu bagian rumah: fondasi, ruang belajar, lalu fasilitas tambahan.",
      "example": "Slice 2 = alur soal → diagnosis → materi singkat → coba lagi.",
      "scope": "Nomor Slice berlaku untuk roadmap besar: 0 sampai 6.",
      "source": "../../backend-architecture/12-implementation-roadmap.md",
      "tag": "Lingkup pekerjaan"
    },
    {
      "id": "M",
      "name": "Milestone / langkah kerja",
      "question": "Pekerjaan apa yang sedang dibuat?",
      "explanation": "M adalah potongan pekerjaan di dalam satu Slice. Nomornya dimulai lagi pada Slice berikutnya, sehingga M5 harus selalu dibaca bersama nomor Slice.",
      "analogy": "Seperti langkah memasang pintu dalam pekerjaan satu ruangan.",
      "example": "Slice 1/M5 = evaluator angka dan pilihan. Slice 2/M5 = service dan endpoint question loop.",
      "scope": "Tulis Slice 2/M5, bukan M5 saja saat berdiskusi lintas Slice.",
      "source": "../../backend-implementation/05-slice2-plan.md",
      "tag": "Lingkup pekerjaan"
    },
    {
      "id": "D",
      "name": "Decision / keputusan per Slice",
      "question": "Pilihan apa yang perlu disepakati?",
      "explanation": "D mencatat pilihan produk, konten, atau engineering. Keputusan yang masih OPEN belum otomatis disetujui karena implementasi atau tesnya sudah ada.",
      "analogy": "Seperti memutuskan model pintu sebelum pemasangannya diselesaikan.",
      "example": "Slice 2/D3 = materi funnel. Slice 2/D6 = tangga hint tutor.",
      "scope": "D1 di Slice 1 berbeda dengan D1 di Slice 2. Kode D07 dari blueprint juga berbeda dengan Slice 2/D7.",
      "source": "../../backend-implementation/05-slice2-plan.md",
      "tag": "Keputusan"
    },
    {
      "id": "OD",
      "name": "Open Decision / keputusan lintas proyek",
      "question": "Persetujuan besar apa yang masih dibutuhkan?",
      "explanation": "OD berasal dari roadmap arsitektur dan dapat memengaruhi beberapa Slice. Sebagian memerlukan pemilik produk, security, manajemen, atau penasihat hukum.",
      "analogy": "Seperti persetujuan pemilik dan izin yang memengaruhi keseluruhan rumah.",
      "example": "OD-11 = copy/alur “Saya tahu caranya”. OD-02 = minimum umur dan metode age assurance.",
      "scope": "Development default adalah pilihan sementara; bukan bukti approval produksi.",
      "source": "../../backend-architecture/12-implementation-roadmap.md",
      "tag": "Keputusan"
    },
    {
      "id": "T",
      "name": "Test scenario / skenario pembuktian",
      "question": "Bagaimana kita membuktikan fitur bekerja?",
      "explanation": "T menjelaskan situasi yang harus diuji. T01 adalah kelompok skenario penerimaan, sedangkan T01-11 menunjuk satu skenario di dalamnya.",
      "analogy": "Seperti mencoba pintu dari dua sisi untuk memastikan kuncinya bekerja.",
      "example": "T01-11 = dua tab mengubah sesi versi sama: satu 201, satu 409; data tidak tertimpa.",
      "scope": "T02 memuat resume, perpindahan guest ke akun, dan konsistensi Map/Home. Jumlah tes lulus bukan persentase produk selesai.",
      "source": "../../backend-architecture/11-test-matrix.md",
      "tag": "Pembuktian"
    },
    {
      "id": "B",
      "name": "Backlog finding / temuan yang belum ditutup",
      "question": "Masalah apa yang masih perlu dituntaskan?",
      "explanation": "B adalah temuan konkret dengan evidence dan acceptance criteria. Pekerjaan independen bisa lanjut, sementara temuan tetap menahan gate yang terdampak.",
      "analogy": "Seperti catatan pintu kadang macet: ruangan lain boleh dikerjakan, pemeriksaan akhir masih tertahan.",
      "example": "B-01 = T01-11 pernah mendapat 500. B-02 = model test gagal membaca items. B-03 = runner menyembunyikan exit code gagal.",
      "scope": "Satu run hijau tidak otomatis menutup masalah yang penyebabnya belum diketahui.",
      "source": "../../backend-implementation/05-slice2-plan.md",
      "tag": "Masalah"
    },
    {
      "id": "INV",
      "name": "Invariant / aturan yang harus selalu benar",
      "question": "Aturan apa yang tidak boleh dilanggar?",
      "explanation": "INV berlaku di semua alur yang relevan. Satu milestone boleh memiliki banyak test untuk menjaga invariant yang sama.",
      "analogy": "Seperti aturan bahwa kunci rumah satu orang tidak boleh membuka rumah tetangga.",
      "example": "INV-01 = ownership; INV-14 = satu idempotency key punya satu hasil; INV-19 = penghapusan data lengkap.",
      "scope": "Invariant adalah aturan sistem; skenario T adalah cara membuktikannya.",
      "source": "../../backend-architecture/03-domain-model.md",
      "tag": "Aturan sistem"
    },
    {
      "id": "E",
      "name": "Event / transisi state yang diizinkan",
      "question": "Setelah aksi ini, sesi boleh pindah ke tahap apa?",
      "explanation": "E-xx menamai baris transisi pada mesin belajar. Server memeriksa state, syarat, dan perubahan yang diizinkan sebelum menyimpan hasil.",
      "analogy": "Seperti urutan membuka kunci, memutar gagang, lalu membuka pintu.",
      "example": "E-01 = membuat question loop; E-24 = abandon; E-25 = expiry.",
      "scope": "Angka E adalah nomor transisi, bukan urutan milestone pengerjaan.",
      "source": "../../backend-architecture/05-learning-state-machine.md",
      "tag": "Aturan sistem"
    },
    {
      "id": "L",
      "name": "Legacy call / adapter frontend lama",
      "question": "Panggilan frontend lama mana yang sedang disambungkan?",
      "explanation": "L1–L9 menamai kontrak panggilan frontend yang sudah ada. Facade menerjemahkannya ke service canonical tanpa mengganti bentuk respons lama.",
      "analogy": "Seperti adaptor colokan yang menyambungkan perangkat lama ke instalasi baru.",
      "example": "L1 = diagnosis; L3 = answer check; L4 = solution; L6 = tutor; L8 = mapping soal.",
      "scope": "Huruf L pada kolom Size berarti Large. Itu berbeda dari kode adapter L1/L2/L3.",
      "source": "../../backend-architecture/09-api-design.md",
      "tag": "Integrasi"
    },
    {
      "id": "ADR",
      "name": "Architecture Decision Record",
      "question": "Kenapa pendekatan teknis ini dipilih?",
      "explanation": "ADR mencatat konteks, pilihan teknologi, keputusan, konsekuensi, dan jalan untuk mengubahnya. Ini membantu memahami alasan arsitektur.",
      "analogy": "Seperti catatan alasan memilih jenis fondasi dan bahan bangunan.",
      "example": "ADR-01 = modular monolith; ADR-04 = Kysely dan SQL migrations; ADR-15 = session server-side.",
      "scope": "Status ADR dan persetujuan tetap mengikuti dokumen sumber; catatan alasan bukan sertifikat siap produksi.",
      "source": "../../backend-architecture/10-architecture-decisions.md",
      "tag": "Keputusan"
    },
    {
      "id": "K / A",
      "name": "Kode aturan dari blueprint",
      "question": "Prinsip produk atau API apa yang dirujuk?",
      "explanation": "K dan A adalah kode keputusan/prinsip pada blueprint yang ditelusuri oleh arsitektur. Bacalah bersama nama dokumen, karena kode singkat bisa punya konteks berbeda.",
      "analogy": "Seperti nomor aturan dalam rancangan awal rumah.",
      "example": "K01 = berbagai cara penyelesaian yang valid; K05 = syarat mastery; A01 = shared diagnosis run.",
      "scope": "Contoh penting: blueprint D07 (“jangan mengarang gap”) berbeda dari Slice 2/D7 (staff tool).",
      "source": "../../backend-architecture/03-domain-model.md",
      "tag": "Aturan sistem"
    },
    {
      "id": "S / M / L",
      "name": "Ukuran estimasi pekerjaan",
      "question": "Seberapa besar pekerjaannya relatif terhadap pekerjaan lain?",
      "explanation": "Jika huruf muncul di kolom Size, S/M/L berarti Small/Medium/Large. Ini ukuran relatif, bukan nomor milestone dan bukan janji tanggal selesai.",
      "analogy": "Seperti label pekerjaan kecil, sedang, dan besar pada daftar renovasi.",
      "example": "Baris M5 dapat memiliki Size L: milestone nomor 5, ukurannya Large.",
      "scope": "M pada kolom Size berbeda dari M5 pada kolom Milestone.",
      "source": "../../backend-implementation/05-slice2-plan.md",
      "tag": "Lingkup pekerjaan"
    }
  ],
  "milestones": [
    {
      "slice": 1,
      "id": "M1",
      "title": "Alias manifest: schema, extractor, reviewed manifest, linter",
      "size": "L",
      "dependencies": "—",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 1,
      "id": "M2",
      "title": "Catalog migration and publisher",
      "size": "M",
      "dependencies": "M1",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 1,
      "id": "M3",
      "title": "Public catalog read API",
      "size": "M",
      "dependencies": "M2",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 1,
      "id": "M4",
      "title": "Learning migration and erasure extension",
      "size": "M",
      "dependencies": "M2",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 1,
      "id": "M5",
      "title": "Deterministic evaluators option-v1 and numeric-v1",
      "size": "S",
      "dependencies": "M1",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 1,
      "id": "M6",
      "title": "PRACTICE session engine and canonical endpoints",
      "size": "L",
      "dependencies": "M3, M4, M5",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 1,
      "id": "M7",
      "title": "Legacy facade L3 (practice, check)",
      "size": "M",
      "dependencies": "M6",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 1,
      "id": "M8",
      "title": "Frontend integration and Playwright",
      "size": "L",
      "dependencies": "M6, M7",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 1,
      "id": "M9",
      "title": "Exit verification and report",
      "size": "S",
      "dependencies": "all",
      "state": "verified",
      "label": "Engineering dev · laporan tersedia",
      "note": "Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "slice": 2,
      "id": "M1",
      "title": "Loop content in the manifest: tower rubric, funnel lesson, lesson links, tutor ladder",
      "size": "M",
      "dependencies": "decisions D1–D3, D6",
      "state": "partial",
      "label": "Sebagian terverifikasi",
      "note": "Bagian D1/D2 sudah ada. Materi funnel D3 dan tutor ladder D6 masih menunggu keputusan.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "slice": 2,
      "id": "M2",
      "title": "tower-v1 evaluator + golden branch cases (both repos)",
      "size": "M",
      "dependencies": "M1",
      "state": "verified",
      "label": "Terverifikasi untuk development",
      "note": "tower-v1 dan golden tersedia. Dua belas delta serta tiga overlay masih PROPOSED.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "slice": 2,
      "id": "M3",
      "title": "Migration 0004, diagnosis_report, job.diagnosis_run_id; generic job queue; erasure",
      "size": "S",
      "dependencies": "—",
      "state": "verified",
      "label": "Sudah di-commit",
      "note": "Skema loop, antrean dan erasure tercatat dalam bf02e7f; belum di-push menurut plan.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "slice": 2,
      "id": "M4",
      "title": "QUESTION_LOOP in the pure machine + property tests",
      "size": "M",
      "dependencies": "—",
      "state": "verified",
      "label": "Sudah di-commit",
      "note": "Mesin QUESTION_LOOP dan property tests tersedia dalam bf02e7f.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "slice": 2,
      "id": "M5",
      "title": "Loop service and endpoints: runs (inline and queued), retry, verification, solution",
      "size": "L",
      "dependencies": "M2, M3, M4",
      "state": "gate",
      "label": "Implementasi ada · gate terbuka",
      "note": "Loop service tersedia. B-01/B-02 masih menahan verification/release gate. B-03 sudah ditutup di §17.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "slice": 2,
      "id": "M6",
      "title": "Disputes: reports, staff resolution CLI, EDUCATOR regrade",
      "size": "M",
      "dependencies": "M5",
      "state": "partial",
      "label": "Sisi learner terverifikasi",
      "note": "Pelaporan oleh learner tersedia. Staff resolution menunggu D7.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "slice": 2,
      "id": "M7",
      "title": "Facade L1, L2, L4, L6, L8 (+ L3 funnel checks and retry_original)",
      "size": "L",
      "dependencies": "M5",
      "state": "partial",
      "label": "Empat adapter terverifikasi",
      "note": "L1/L2/L4/L8 tersedia. L3 funnel/check dan retry_original menunggu D3; L6 menunggu D6.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "slice": 2,
      "id": "M8",
      "title": "Frontend /coba and /challenge on canonical sessions + Playwright",
      "size": "L",
      "dependencies": "M5, M7",
      "state": "partial",
      "label": "Jalur tanpa blocker terverifikasi",
      "note": "/coba dan /challenge sudah canonical pada jalur yang tersedia (§17). Harness lokal FE/BE tersedia (§18). Materi, tutor, dan copy masih menunggu D3/D6/OD-11.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "slice": 2,
      "id": "M9",
      "title": "Exit: T01 scenarios in remote CI against PostgreSQL, report",
      "size": "M",
      "dependencies": "all; CI access (§6)",
      "state": "blocked",
      "label": "Gate exit belum terpenuhi",
      "note": "Memerlukan milestone terkait selesai, temuan blocker ditutup, dan T01 di remote CI; D8 masih terbuka.",
      "source": "../../backend-implementation/05-slice2-plan.md"
    }
  ],
  "decisions": [
    {
      "id": "D1",
      "title": "tower-v1 fidelity to analysis.ts",
      "proposal": "Port the structure and copy; fix the evidence rules. A concept counts as UNDERSTANDING_DEMONSTRATED only when a rubric step matches a span (or a correct final value, through finalAnswerEvidence). A misconception requires a catalogued pattern. Everything else is INSUFFICIENT_EVIDENCE. Each changed branch is an explicit golden case labelled \"delta from analysis.ts\", for review.",
      "owner": "Content lead + engineering",
      "approved": true,
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "id": "D2",
      "title": "Which lesson START_LESSON {conceptId} assigns in a question loop",
      "proposal": "An authored link on the question: rubric.lessonFor: {conceptCode: lessonCode}. The linter requires it for every concept that can be recommended. Recommendations (06 Recommendations VO) carry that lesson. lessonFor(concept) \"first by code\" is used only when a question has no link (practice).",
      "owner": "Content lead (links), engineering (lint)",
      "approved": true,
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "id": "D3",
      "title": "The funnel lesson",
      "proposal": "Author StepMateri.vue's two slides as a catalog lesson (MAT.TRI.L.FUNNEL_RATIO_CHOICE or similar) with c4 as its required check on slide 1. This is manual extraction, not the extractor, because the content lives in a template. Retire c1–c3 as unused (a manifest note; they stay published for practice).",
      "owner": "Content lead",
      "approved": false,
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "id": "D4",
      "title": "Async diagnosis in Slice 2 (AI is off)",
      "proposal": "Build the queued path now, with a test-only fake engine: job gains diagnosis_run_id; a diagnosis queue; leases, heartbeat, recovery and adoption fencing (04 §7); E-09 and E-10. In production configuration nothing is ever queued, because deterministic coverage completes inline and there is no AI. The fake engine exists only in tests (NODE_ENV=test and an explicit flag). This makes T01-4, E-09, E-10 and lease recovery real tests now, and Slice 5 only adds the AI gateway.",
      "owner": "Engineering",
      "approved": true,
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "id": "D5",
      "title": "The unrouted typed loop (§1.1)",
      "proposal": "Out of Slice 2. Product decides: revive it as a second loop (its diagnostic steps then need a value object, see the Slice 1 report §7), or retire it. Until then its items stay practice-only. Recommendation: retire, and keep trig-depression-01 and its retry as practice items.",
      "owner": "Product",
      "approved": false,
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "id": "D6",
      "title": "The L6 tutor ladder",
      "proposal": "Port tutor.ts's menara and umum scripts into the manifest as private rubric content (rubric.tutorLadder). Its last node is the worked solution, so it never ships in public projections. The server counts hints; client hintsUsed and history are ignored (09 §6.2). tangga belongs to the intake demo (Slice 6).",
      "owner": "Content lead",
      "approved": false,
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "id": "D7",
      "title": "Dispute resolution tooling",
      "proposal": "A staff CLI (npm run reports -- list",
      "owner": "uphold",
      "approved": false,
      "source": "../../backend-implementation/05-slice2-plan.md"
    },
    {
      "id": "D8",
      "title": "Remote CI for the exit",
      "proposal": "The Slice 2 exit is \"T01 scenarios pass in CI against PostgreSQL\". This needs the repositories pushed and a GitHub Actions run with both checkouts. Recommendation: push the Slice 1 commits and add a coordinating workflow before M9.",
      "owner": "Owner (push and CI access)",
      "approved": false,
      "source": "../../backend-implementation/05-slice2-plan.md"
    }
  ],
  "backlogs": [
    {
      "id": "B-01",
      "title": "Dua tab pernah menghasilkan 500",
      "impact": "API dua tab seharusnya menghasilkan 201 + 409. Penyebab 500 belum terbukti.",
      "acceptance": "Penyebab teridentifikasi, fix teruji, tidak ada partial write, dan uji race/full suite memenuhi acceptance criteria.",
      "status": "OPEN / NEEDS FIX",
      "source": "../../backend-implementation/05-slice2-plan.md",
      "heading": "### B-01 · T01-11 returned 500 under full-suite load: OPEN / NEEDS FIX (still open after M8, §17)"
    },
    {
      "id": "B-02",
      "title": "Model test membaca items yang tidak ada",
      "impact": "PRACTICE model-based test pernah berhenti pada .map atas undefined. Respons sebelumnya harus ditelusuri.",
      "acceptance": "Status dan code respons penyebab diketahui, akar masalah diperbaiki tanpa melemahkan tes, property test dan dua full runs lulus.",
      "status": "OPEN / NEEDS FIX",
      "source": "../../backend-implementation/05-slice2-plan.md",
      "heading": "### B-02 · PRACTICE model-based test (INV-06.1) failed on `.map` of undefined: OPEN / NEEDS FIX (still open after M8, §17)"
    },
    {
      "id": "B-03",
      "title": "Runner menutupi kegagalan Node",
      "impact": "Pipeline Bash pernah melaporkan exit 0 ketika output menunjukkan tes gagal.",
      "acceptance": "Negative-control test membuktikan child gagal membuat keseluruhan runner gagal; exit code tiap pemeriksaan disimpan.",
      "status": "CLOSED",
      "source": "../../backend-implementation/05-slice2-plan.md",
      "heading": "### B-03 · The Bash runner reported exit 0 although Node failed: CLOSED (2026-10-19, negative control in §17)"
    }
  ],
  "roadmap": [
    {
      "id": 0,
      "title": "Fondasi, identitas & consent",
      "plain": "Login, profil minimum, persetujuan guardian, keamanan dan database.",
      "status": "Fondasi development tersedia",
      "state": "verified"
    },
    {
      "id": 1,
      "title": "Katalog & latihan deterministik",
      "plain": "Materi dan latihan dinilai oleh server, dengan kunci jawaban terlindungi.",
      "status": "Exit engineering pada fixture sintetis",
      "state": "verified"
    },
    {
      "id": 2,
      "title": "Question loop",
      "plain": "Soal → diagnosis → materi → quick check → retry → selesai.",
      "status": "Fokus saat ini · beberapa bagian dan gate terbuka",
      "state": "partial"
    },
    {
      "id": 3,
      "title": "Progres, mastery & gamifikasi",
      "plain": "Map/Home memakai progres server, aturan mastery, XP dan streak.",
      "status": "Tahap roadmap berikutnya",
      "state": "future"
    },
    {
      "id": 4,
      "title": "Kelanjutan akun & hak data",
      "plain": "Import riwayat perangkat, resume, retensi dan hak atas data.",
      "status": "Tahap roadmap berikutnya",
      "state": "future"
    },
    {
      "id": 5,
      "title": "AI diagnosis & tutor",
      "plain": "AI masuk setelah gate pilot, consent, review keamanan dan provider.",
      "status": "Sesudah gate pilot · AI tetap nonaktif sekarang",
      "state": "future"
    },
    {
      "id": 6,
      "title": "Tanya soal & foto / OCR",
      "plain": "Unggah, baca, konfirmasi soal sendiri dengan kontrol privasi.",
      "status": "Sesudah Slice 5",
      "state": "future"
    }
  ],
  "tests": [
    {
      "id": "T01-1",
      "title": "Submit answer: stored as an attempt with a unique ID and the right question version",
      "proof": "POST …/attempts → 201 with a UUIDv7 attempt that pins the session's revision. A second identical request is a replay.",
      "reference": "E-03, INV-04, INV-07"
    },
    {
      "id": "T01-2",
      "title": "Correct diagnosis: the 2³ = 6 error leads to the exponent concept, not automatically to trigonometry",
      "proof": "Bank item gab-pangkat-cos60: the option produced by 2³ = 6 → misconception on eks-b (blueprint EXP-01), tri-f NOT_ASSESSED",
      "reference": "06 §10"
    },
    {
      "id": "T01-3",
      "title": "Insufficient evidence: a wrong final answer without working → INSUFFICIENT_EVIDENCE, not a definite misconception",
      "proof": "Tower item, response 40 → every concept INSUFFICIENT_EVIDENCE, state CLARIFICATION_NEEDED",
      "reference": "E-05, 06 §10"
    },
    {
      "id": "T01-4",
      "title": "Diagnosis failure: timeout, provider down or invalid schema produce no fake diagnosis; the learner gets a fallback",
      "proof": "Fake adapter: 3 timeouts; 529s until the circuit opens; invalid output twice; a refusal. Each → no evidence rows, run FAILED or insufficient, session EVALUATION_FAILED or CLARIFICATION_NEEDED, resumable.",
      "reference": "05 §5.4, 07 §5"
    },
    {
      "id": "T01-5",
      "title": "Retry after timeout: the same clientAttemptId creates no duplicate",
      "proof": "Same Idempotency-Key after a dropped response → one attempt, one run",
      "reference": "INV-14"
    },
    {
      "id": "T01-6",
      "title": "Microlearning checkpoint survives a refresh",
      "proof": "ADVANCE_LESSON to slide 2, new client → GET session shows slide 2",
      "reference": "E-12"
    },
    {
      "id": "T01-7",
      "title": "Correct grading: a wrong answer stays wrong; no demo bypass",
      "proof": "Strict schemas reject client verdict fields; the facade ignores demo flags; a wrong answer → INCORRECT in every mode",
      "reference": "§5, INV-12"
    },
    {
      "id": "T01-8",
      "title": "Mastery: lesson complete plus a correct retry does not make DEMONSTRATED",
      "proof": "After E-14 and E-17: status DEVELOPING, tier ≤ 1",
      "reference": "06 §6"
    },
    {
      "id": "T01-9",
      "title": "Solution exposure: a retry after seeing the solution is not independent transfer",
      "proof": "After E-21 or the tutor gate: later attempts in the family → not mastery-eligible (SOLUTION_SEEN), no XP",
      "reference": "06 §5"
    },
    {
      "id": "T01-10",
      "title": "Guest to account: verified login, idempotent claim, nothing lost or duplicated",
      "proof": "Device import replayed with the same key → same session. Re-import by key or by another account → 409 ALREADY_IMPORTED. The device copy stays until marked.",
      "reference": "05 §5.5, 08 §5"
    },
    {
      "id": "T01-11",
      "title": "Two stale tabs: an old stateVersion gets 409; nothing is overwritten",
      "proof": "Two clients, same version, different keys → one 201, one 409 STALE_STATE_VERSION",
      "reference": "INV-06"
    },
    {
      "id": "T01-12",
      "title": "Unknown core ID → 404; the exponent–trigonometry link on the sample is QUESTION_APPLICATION, not a prerequisite",
      "proof": "GET /v1/concepts/{unknown} → 404; GET /v1/concepts?legacyMapId=unknown → empty list; no prerequisite edge from the combined item",
      "reference": "INV-17, K02"
    }
  ],
  "globalDecisions": [
    {
      "id": "OD-01",
      "title": "Guest evaluation mode: CONSENT_FIRST or OPEN_TRIAL (08 §2.2)",
      "proposal": "CONSENT_FIRST",
      "owner": "Counsel + product owner",
      "needed": "Slice 1"
    },
    {
      "id": "OD-02",
      "title": "Published minimum age and age-verification method under PP 17/2025 and Permenkomdigi 9/2026",
      "proposal": "12 years; guardian confirms the age band",
      "owner": "Counsel + product owner",
      "needed": "Slice 0"
    },
    {
      "id": "OD-03",
      "title": "Self-consent with guardian notice for older learners; self-consent for verified adults",
      "proposal": "Off: guardian consent for everyone",
      "owner": "Counsel",
      "needed": "Slice 0"
    },
    {
      "id": "OD-04",
      "title": "Retention periods (04 §8)",
      "proposal": "As proposed",
      "owner": "Counsel",
      "needed": "Slice 4"
    },
    {
      "id": "OD-05",
      "title": "DPIA owner, data protection officer, PP 17/2025 risk self-assessment",
      "proposal": "Launch gates",
      "owner": "Management + counsel",
      "needed": "Pilot gate"
    },
    {
      "id": "OD-06",
      "title": "AI provider retention terms, zero-data-retention availability, processing agreement, Pasal 56 transfer basis (AI-1, AI-2)",
      "proposal": "AI off until settled",
      "owner": "Counsel + engineering",
      "needed": "Slice 5"
    },
    {
      "id": "OD-07",
      "title": "Model per purpose after the gold-set comparison (AI-3)",
      "proposal": "claude-opus-5-5 everywhere",
      "owner": "Product owner",
      "needed": "Slice 5"
    },
    {
      "id": "OD-08",
      "title": "AI budget caps (AI-4)",
      "proposal": "20 diagnoses, 60 tutor messages, 10 intakes per learner per day",
      "owner": "Product owner",
      "needed": "Slice 5"
    },
    {
      "id": "OD-09",
      "title": "Distress escalation protocol and verified help resources (AI-5)",
      "proposal": "Tutor stays off until approved",
      "owner": "Child-protection advisers + counsel",
      "needed": "Slice 5"
    },
    {
      "id": "OD-10",
      "title": "Real learner answers in the gold set (AI-6)",
      "proposal": "No: synthetic items only",
      "owner": "Counsel + product owner",
      "needed": "Slice 5"
    },
    {
      "id": "OD-11",
      "title": "\"Saya tahu caranya\" asks for a short proof instead of counting as correct (05 §4.4)",
      "proposal": "Ask for proof; no XP for a claim",
      "owner": "Product owner",
      "needed": "Slice 2"
    },
    {
      "id": "OD-12",
      "title": "Streak freezes",
      "proposal": "Off",
      "owner": "Product owner",
      "needed": "Slice 3"
    },
    {
      "id": "OD-13",
      "title": "What guardians may see (supervision tools, PP 17/2025 Pasal 21)",
      "proposal": "Consent status only; progress summary proposed",
      "owner": "Product owner + counsel",
      "needed": "Slice 4"
    },
    {
      "id": "OD-14",
      "title": "Cloud provider and exact Jakarta region; managed PostgreSQL vendor",
      "proposal": "Any of ADR-10's options",
      "owner": "Engineering + finance",
      "needed": "Slice 0"
    },
    {
      "id": "OD-15",
      "title": "Migration runner (dbmate or node-pg-migrate)",
      "proposal": "Either",
      "owner": "Engineering",
      "needed": "Slice 0"
    },
    {
      "id": "OD-16",
      "title": "Dispute review target and staffing",
      "proposal": "5 school days",
      "owner": "Product owner",
      "needed": "Slice 2"
    },
    {
      "id": "OD-17",
      "title": "Session lifetimes on shared school devices",
      "proposal": "7 days idle, 30 days absolute",
      "owner": "Product owner + security",
      "needed": "Slice 0"
    },
    {
      "id": "OD-18",
      "title": "K05 thresholds and tier copy (3/3, ≥ 2 contexts, ≥ 24 hours in another session)",
      "proposal": "As the blueprint",
      "owner": "Content lead",
      "needed": "Slice 3"
    },
    {
      "id": "OD-19",
      "title": "Launch timing against the PP 17/2025 compliance deadline (2 years from 27 March 2025)",
      "proposal": "Plan the pilot gate before it",
      "owner": "Management",
      "needed": "Now"
    }
  ],
  "slice1Decisions": [
    {
      "id": "D1",
      "title": "How published lessons and concepts stay immutable without release-scoped rows",
      "status": "Approved",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "id": "D2",
      "title": "Where secondary aliases live",
      "status": "Approved",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "id": "D3",
      "title": "Content-code scheme and who approves it",
      "status": "Menunggu review konten",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "id": "D4",
      "title": "Visibility of items whose keys already shipped",
      "status": "Menunggu review konten",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "id": "D5",
      "title": "Tower question identity (finding 1.2.3)",
      "status": "Menunggu review konten",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "id": "D6",
      "title": "Lesson ↔ assessed-concept mapping (findings 1.2.1–2)",
      "status": "Menunggu review konten",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "id": "D7",
      "title": "Test tooling",
      "status": "Approved",
      "source": "../../backend-implementation/03-slice1-plan.md"
    },
    {
      "id": "D8",
      "title": "OD-01 for this slice",
      "status": "Default development",
      "source": "../../backend-implementation/03-slice1-plan.md"
    }
  ],
  "sources": [
    {
      "id": "slice0",
      "path": "backend-implementation/01-slice0-report.md",
      "href": "../../backend-implementation/01-slice0-report.md",
      "sha256": "d6c9df7c64ae0a57e72f57ee27a7f21b66bfe86da18b43d15ea8cfad17b35330"
    },
    {
      "id": "slice1Plan",
      "path": "backend-implementation/03-slice1-plan.md",
      "href": "../../backend-implementation/03-slice1-plan.md",
      "sha256": "ec067991022262d238abd6adc14c2b7207420b7017390f781bf34ea6bbfa4e3d"
    },
    {
      "id": "slice1Report",
      "path": "backend-implementation/04-slice1-report.md",
      "href": "../../backend-implementation/04-slice1-report.md",
      "sha256": "459b8efaf2e753a19852be9eb0097c3d9e9f1f4dc81f3037a9af0e26f7b8b68f"
    },
    {
      "id": "slice2",
      "path": "backend-implementation/05-slice2-plan.md",
      "href": "../../backend-implementation/05-slice2-plan.md",
      "sha256": "240bfabd2c72cbd6398a7808adc02818ddb427957c09c23e54efbe48815db2ef"
    },
    {
      "id": "roadmap",
      "path": "backend-architecture/12-implementation-roadmap.md",
      "href": "../../backend-architecture/12-implementation-roadmap.md",
      "sha256": "98511bff19589d1702374694bdd3e74e31885d09359ebbfa2549ad11c3471094"
    },
    {
      "id": "tests",
      "path": "backend-architecture/11-test-matrix.md",
      "href": "../../backend-architecture/11-test-matrix.md",
      "sha256": "88a4e892604a31cd366bc3bd9850c85084784bc7957f9e9a51afe0df53cbef07"
    },
    {
      "id": "domain",
      "path": "backend-architecture/03-domain-model.md",
      "href": "../../backend-architecture/03-domain-model.md",
      "sha256": "00bbc598171623e41802be0f923bcc57a95c336822c2379fae22c814290c365e"
    },
    {
      "id": "machine",
      "path": "backend-architecture/05-learning-state-machine.md",
      "href": "../../backend-architecture/05-learning-state-machine.md",
      "sha256": "4bd7e1ee1ea191c1987bc79184ecebe816c9a831c4ea87e37f8658c12c6dd345"
    },
    {
      "id": "api",
      "path": "backend-architecture/09-api-design.md",
      "href": "../../backend-architecture/09-api-design.md",
      "sha256": "b21a846bdd5b8b10b8121e1b490d60b8ec37be978536c8c620eadfd4db273209"
    },
    {
      "id": "adrs",
      "path": "backend-architecture/10-architecture-decisions.md",
      "href": "../../backend-architecture/10-architecture-decisions.md",
      "sha256": "eca55b5278be418dc2c1c8b44d62dbf9bbcddc25f0db90f5976397b2542f219b"
    }
  ],
  "context": "Snapshot penjelasan dari dokumen lokal. Bukan monitor live, bukan approval, dan tidak menjalankan API atau tes."
};
