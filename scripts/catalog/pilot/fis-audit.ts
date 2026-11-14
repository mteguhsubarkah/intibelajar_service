import type { PilotAudit } from './types.js';
// Audit Fisika kelas 7–12 vs buku resmi dan CP 046/2025 (13 November 2026; docs/backlog.md di repo FE).
// bookRefs: padanan bab di buku teks (VERIFIED = dicek ke isi/daftar isi buku resmi, SNIPPET = baru dari cuplikan,
// CP_ONLY = hanya dari dokumen CP). notes: alasan perubahan, ditempel di review topik untuk peninjau.

export const AUDIT: Record<string, PilotAudit> = {
  "FIS.C26.D.ANTARIKSA": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas VII (SMP/MTs)",
        "edition": "edisi revisi",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA_BS_KLS_VII_Rev.pdf",
        "chapter": "Bab 7 Bumi dan Tata Surya",
        "verification": "SNIPPET"
      }
    ]
  },
  "FIS.C26.D.ENERGI": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas VIII (SMP/MTs)",
        "edition": "revisi 2024",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA_BS_KLS_VIII_Rev.pdf",
        "chapter": "Bab III (usaha, energi, dan pesawat sederhana)",
        "verification": "SNIPPET",
        "note": "Untuk inti kelas 8. Judul bab persis belum dicek."
      }
    ],
    "notes": [
      "Tahap 1 audit Fisika (2026-11-13, docs/backlog.md FE): prasyarat Kalor jenis (kelas 7) diganti dari Usaha & perubahan energi (kelas 8) ke Suhu & perpindahan kalor.",
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): suhu, perpindahan kalor, dan kalor jenis (kelas 7) pindah ke bab baru D.SUHU; dua inti itu disembunyikan di sini. Bab ini kini kelas 8 saja dengan penutup Pesawat sederhana."
    ]
  },
  "FIS.C26.D.GELOMBANG": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas VIII (SMP/MTs)",
        "edition": "revisi 2024",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA_BS_KLS_VIII_Rev.pdf",
        "chapter": "Bab V (getaran, gelombang, dan cahaya)",
        "verification": "SNIPPET",
        "note": "Judul bab persis belum dicek."
      }
    ],
    "notes": [
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): inti gabungan \"Bunyi dan optik\" dipecah jadi Bunyi dan pemantulannya serta Alat optik (penutup baru); inti lama disembunyikan."
    ]
  },
  "FIS.C26.D.GERAK": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas VII (SMP/MTs)",
        "edition": "edisi revisi",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA_BS_KLS_VII_Rev.pdf",
        "chapter": "Bab 4 Gerak dan Gaya",
        "verification": "SNIPPET",
        "note": "Untuk inti kelas 7."
      }
    ],
    "notes": [
      "Tahap 1 audit Fisika (2026-11-13, docs/backlog.md FE): kelas 7 gerak dulu, baru gaya (buku IPA VII Bab 4): Jarak, perpindahan & kelajuan jadi prasyarat Gerak dan gaya resultan, ordinal keduanya ditukar. Tekanan dan inti penutup tetap.",
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): Tekanan pindah ke bab baru D.TEKANAN (4 subbab buku jadi 4 inti); inti Tekanan di sini disembunyikan. Inti \"Gerak dan gaya resultan\" berisi jenis gaya dan gaya berat, jadi judulnya kini \"Gaya dan berat benda\" (kode tetap, progres aman)."
    ]
  },
  "FIS.C26.D.KEBUMIAN": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas VIII (SMP/MTs)",
        "edition": "bahan revisi Mei 2025",
        "chapter": "Bab 6 Struktur Bumi dan Perkembangannya",
        "verification": "VERIFIED",
        "note": "Edisi acuan kelas 8 untuk bab ini (diputuskan 14 November 2026). Tidak ada di IPA VIII revisi 2024 (buku berakhir di Bab VII Tanah bagi Kehidupan Berkelanjutan)."
      },
      {
        "book": "Buku Siswa IPA Kelas VIII (SMP/MTs)",
        "edition": "2021",
        "chapter": "Bab 6 Struktur Bumi dan Perkembangannya",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA-BS-KLS-VIII.pdf",
        "verification": "SNIPPET"
      }
    ],
    "notes": [
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): acuan Struktur Bumi kelas 8 = bahan revisi Mei 2025, Bab 6 Struktur Bumi dan Perkembangannya."
    ]
  },
  "FIS.C26.D.LISTRIK": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas IX (SMP/MTs)",
        "edition": "revisi 2025 (ISBN 978-634-00-2430-2)",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA_BS_KLS_IX_Rev.pdf",
        "chapter": "Bab 5 Listrik, Magnet, dan Energi Alternatif",
        "section": "A. Listrik: listrik statis (hlm. 120), daya listrik (hlm. 145)",
        "verification": "VERIFIED",
        "note": "Bab 5, bukan Bab 4 (edisi 2022). Inti listrik statis, energi dan daya listrik, serta sumber energi alternatif ditambahkan di Tahap 2 audit (13 November 2026)."
      }
    ],
    "notes": [
      "Tahap 2 audit Fisika (2026-11-13, docs/backlog.md FE): inti baru Listrik statis, Energi dan daya listrik, dan Sumber energi alternatif (penutup baru) dari IPA IX rev 2025 Bab 5; urutan mengikuti buku. Rangkaian seri dan paralel kini dihitung ke penguasaan bab. Arus dan rangkaian juga memuat sedikit materi daya dan kWh: cek tumpang tindihnya."
    ]
  },
  "FIS.C26.D.UKUR": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas VII (SMP/MTs)",
        "edition": "edisi revisi",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA_BS_KLS_VII_Rev.pdf",
        "chapter": "Bab I Hakikat Ilmu Sains dan Metode Ilmiah",
        "section": "D. Pengukuran",
        "pages": "25",
        "verification": "VERIFIED",
        "note": "Besaran dan satuan dibahas sebagai bagian dari subbab Pengukuran, bukan bab sendiri."
      }
    ]
  },
  "FIS.C26.E.ENERGI": {
    "bookRefs": [
      {
        "book": "Capaian Pembelajaran Fisika Fase E (Kepka BSKAP 046/H/KR/2025)",
        "edition": "2025",
        "section": "elemen energi alternatif",
        "verification": "CP_ONLY",
        "note": "Belum ada buku Fisika kelas X edisi CP 2025. Rumusan CP diambil dari kutipan pihak ketiga, belum dicek ke dokumen Kepka."
      }
    ],
    "notes": [
      "Tahap 1 audit Fisika (2026-11-13, docs/backlog.md FE): judul dari \"Energi alternatif & perubahan iklim\" (tumpang tindih dengan E.IKLIM) jadi \"Energi, daya, dan efisiensi\"; urutan Daya, Neraca, Evaluasi; inti penutup pindah dari Neraca ke Evaluasi pilihan energi; Evaluasi butuh Neraca (SOFT)."
    ],
    "fields": [
      "title"
    ]
  },
  "FIS.C26.E.GERAK2D": {
    "bookRefs": [
      {
        "book": "Capaian Pembelajaran Fisika Fase E (Kepka BSKAP 046/H/KR/2025)",
        "edition": "2025",
        "section": "elemen gerak dua dimensi",
        "verification": "CP_ONLY",
        "note": "Belum ada buku Fisika kelas X edisi CP 2025. Rumusan CP diambil dari kutipan pihak ketiga, belum dicek ke dokumen Kepka."
      },
      {
        "book": "Buku Siswa Fisika Kelas XI (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika-BS-KLS-XI.pdf",
        "chapter": "Bab 1 Vektor; Bab 2 Kinematika",
        "verification": "VERIFIED",
        "note": "Buku 2022 menaruh vektor dan kinematika di kelas XI; CP 2025 memindahkannya ke Fase E (kelas 10)."
      }
    ],
    "notes": [
      "Tahap 1 audit Fisika (2026-11-13, docs/backlog.md FE): Gerak peluru ideal ditambah prasyarat Proyeksi vektor gerak (v0 cos θ dan v0 sin θ)."
    ]
  },
  "FIS.C26.E.IKLIM": {
    "bookRefs": [
      {
        "book": "Capaian Pembelajaran Fisika Fase E (Kepka BSKAP 046/H/KR/2025)",
        "edition": "2025",
        "section": "elemen perubahan iklim",
        "verification": "CP_ONLY",
        "note": "Belum ada buku Fisika kelas X edisi CP 2025. Rumusan CP diambil dari kutipan pihak ketiga, belum dicek ke dokumen Kepka."
      }
    ]
  },
  "FIS.C26.E.TERBARUKAN": {
    "bookRefs": [
      {
        "book": "Capaian Pembelajaran Fisika Fase E (Kepka BSKAP 046/H/KR/2025)",
        "edition": "2025",
        "section": "elemen energi alternatif",
        "verification": "CP_ONLY",
        "note": "Belum ada buku Fisika kelas X edisi CP 2025. Rumusan CP diambil dari kutipan pihak ketiga, belum dicek ke dokumen Kepka."
      }
    ]
  },
  "FIS.C26.E.UKUR": {
    "bookRefs": [
      {
        "book": "Capaian Pembelajaran Fisika Fase E (Kepka BSKAP 046/H/KR/2025)",
        "edition": "2025",
        "section": "elemen pengukuran",
        "verification": "CP_ONLY",
        "note": "Belum ada buku Fisika kelas X edisi CP 2025. Rumusan CP diambil dari kutipan pihak ketiga, belum dicek ke dokumen Kepka."
      }
    ]
  },
  "FIS.C26.F.ELEKTRO": {
    "bookRefs": [
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 2 Listrik Arus Searah",
        "verification": "VERIFIED"
      },
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 3 Kemagnetan",
        "verification": "VERIFIED",
        "note": "Untuk inti induksi elektromagnetik; letak subbabnya belum dicek."
      },
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 4 Arus Bolak-Balik",
        "verification": "VERIFIED",
        "note": "Untuk inti Arus bolak-balik (Tahap 2)."
      },
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 5 Gelombang Elektromagnetik",
        "verification": "VERIFIED",
        "note": "Untuk inti Gelombang elektromagnetik (Tahap 2)."
      }
    ],
    "notes": [
      "Tahap 2 audit Fisika (2026-11-13, docs/backlog.md FE): inti baru Arus bolak-balik dan Gelombang elektromagnetik (penutup bab baru) dari Fisika XII 2022 Bab 4 dan 5; urutan Hukum rangkaian, Hukum Kirchhoff, Induksi, Arus bolak-balik, Gelombang elektromagnetik. Hukum Kirchhoff bukan penutup lagi, jadi kini dihitung ke penguasaan bab."
    ]
  },
  "FIS.C26.F.FLUIDA": {
    "bookRefs": [
      {
        "book": "Buku Siswa Fisika Kelas XI (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika-BS-KLS-XI.pdf",
        "chapter": "Bab 4 Fluida",
        "verification": "VERIFIED"
      }
    ]
  },
  "FIS.C26.F.GELOMBANG": {
    "bookRefs": [
      {
        "book": "Buku Siswa Fisika Kelas XI (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika-BS-KLS-XI.pdf",
        "chapter": "Bab 5 Gelombang, Bunyi dan Cahaya",
        "verification": "VERIFIED"
      }
    ],
    "notes": [
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): inti gabungan \"Resonansi dan optik\" dipecah jadi Resonansi bunyi serta Lensa dan alat optik; inti lama disembunyikan. Penutup tetap Efek Doppler."
    ]
  },
  "FIS.C26.F.MEDAN": {
    "bookRefs": [
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 1 Listrik Statis",
        "verification": "VERIFIED"
      },
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 3 Kemagnetan",
        "verification": "VERIFIED",
        "note": "Untuk inti medan magnet dan gaya Lorentz."
      }
    ]
  },
  "FIS.C26.F.MEKANIKA": {
    "bookRefs": [
      {
        "book": "Buku Siswa Fisika Kelas XI (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika-BS-KLS-XI.pdf",
        "chapter": "Bab 3 Dinamika Gerak Partikel",
        "verification": "VERIFIED",
        "note": "Momentum dan impuls, torsi dan keseimbangan, serta dinamika rotasi tidak punya bab sendiri di buku ini; subbab Bab 3 belum dicek."
      }
    ],
    "notes": [
      "Tahap 1 audit Fisika (2026-11-13, docs/backlog.md FE): Dinamika rotasi ditambah prasyarat Torsi dan keseimbangan.",
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): inti \"Hukum Newton & momentum\" hanya berisi hukum Newton, jadi judulnya kini \"Hukum Newton dan sistem benda\" (kode tetap); momentum ada di Impuls dan momentum. Urutan ikut Bab 3: Newton, momentum, torsi, rotasi."
    ]
  },
  "FIS.C26.F.MODERN": {
    "bookRefs": [
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 6 Pengantar",
        "section": "sistem elektronika, semikonduktor, gerbang logika",
        "verification": "VERIFIED",
        "note": "Untuk inti Semikonduktor (Tahap 2) dan Representasi biner dan logika."
      },
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 7 Relativitas",
        "verification": "VERIFIED"
      },
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 8 Gejala Kuantum",
        "verification": "VERIFIED",
        "note": "Untuk inti Gejala kuantum."
      },
      {
        "book": "Buku Siswa Fisika Kelas XII (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika_BS_KLS_XII.pdf",
        "chapter": "Bab 9 Fisika Inti dan Radioaktivitas",
        "verification": "VERIFIED",
        "note": "Untuk inti Inti atom dan energi ikat (Tahap 3) dan Peluruhan dan waktu paruh."
      }
    ],
    "notes": [
      "Tahap 1 audit Fisika (2026-11-13, docs/backlog.md FE): prasyarat Relativitas khusus <- Kuantum dan inti atom dihapus; relativitas tidak butuh kuantum (Fisika XII 2022: Bab 7 Relativitas sebelum Bab 8 Gejala Kuantum).",
      "Tahap 2 audit Fisika (2026-11-13, docs/backlog.md FE): inti baru Semikonduktor (sebelum Representasi biner & logika) dari Fisika XII 2022 Bab 6 Pengantar (sistem elektronika, semikonduktor, gerbang logika).",
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): inti \"Kuantum dan inti atom\" hanya berisi foton dan efek fotolistrik, jadi judulnya kini \"Gejala kuantum\" (kode tetap); ditambah inti Inti atom dan energi ikat. Urutan ikut Fisika XII: Bab 6 (semikonduktor, logika), 7 relativitas, 8 kuantum, 9 inti."
    ]
  },
  "FIS.C26.F.TERMAL": {
    "bookRefs": [
      {
        "book": "Buku Siswa Fisika Kelas XI (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika-BS-KLS-XI.pdf",
        "chapter": "Bab 6 Kalor",
        "verification": "VERIFIED"
      },
      {
        "book": "Buku Siswa Fisika Kelas XI (SMA/MA)",
        "edition": "2022",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Fisika-BS-KLS-XI.pdf",
        "chapter": "Bab 7 Termodinamika",
        "verification": "VERIFIED",
        "note": "Gas ideal belum dicek di subbab."
      }
    ]
  },
  "FIS.C26.D.TEKANAN": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas VIII (SMP/MTs)",
        "edition": "revisi 2024",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA_BS_KLS_VIII_Rev.pdf",
        "chapter": "Bab IV Teknologi Penerapan Tekanan pada Zat",
        "section": "A. Tekanan pada Zat Padat (108); B. Tekanan pada Zat Cair (110); C. Tekanan Gas (122); D. Penerapan Tekanan Zat (124)",
        "pages": "105",
        "verification": "VERIFIED",
        "note": "Satu bab dengan 4 subbab; tiap subbab menjadi satu inti (Tahap 3)."
      }
    ],
    "notes": [
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): bab baru. Isi inti Tekanan lama (D.GERAK) dipakai ulang dan dipecah per subbab; soal lama tidak dipindah (kode soal baru)."
    ]
  },
  "FIS.C26.D.SUHU": {
    "bookRefs": [
      {
        "book": "Buku Siswa IPA Kelas VII (SMP/MTs)",
        "edition": "edisi revisi",
        "url": "https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/IPA_BS_KLS_VII_Rev.pdf",
        "chapter": "Bab 3 Suhu, Kalor, dan Pemuaian",
        "verification": "SNIPPET",
        "note": "Subbab Pemuaian belum dijadikan inti: menunggu keputusan sisa Tahap 2."
      }
    ],
    "notes": [
      "Tahap 3 audit Fisika (2026-11-14, docs/backlog.md FE): bab baru dari D.ENERGI. Materi dan soal inti Suhu & perpindahan kalor serta Kalor jenis dipakai ulang dengan kode baru; progres di inti lama tidak ikut pindah."
    ]
  }
};
