// Topik dan inti yang belum ada di katalog (audit kesenjangan materi kelas 7–12, 10 November 2026).
// Struktur dulu: inti tanpa slides/soal ditulis PLANNED. Isi materi dan soal di sini nanti, inti otomatis menjadi READY.
// Sebagian dibangkitkan dari src/data/intiverse-reference.json FE (topik "peta saja"), sisanya topik baru usulan audit.
import type { PilotCore, PilotRelation, PilotTopic } from './types.js';
import { spread } from './spread.js';
import { SMP_MAT } from './smp-mat.js';
import { SMP_FIS } from './smp-fis.js';
import { SMP_KIM } from './smp-kim.js';
import { SMP_BIO } from './smp-bio.js';

/** Materi dan soal yang sudah ditulis, per "KODE_TOPIK:ID_INTI". Inti yang punya isi di sini menjadi READY. */
const CONTENT: Record<string, Pick<PilotCore, 'slides' | 'q' | 'min'>> = { ...SMP_MAT, ...SMP_FIS, ...SMP_KIM, ...SMP_BIO };

const EV_FE = ["nama inti dan prasyarat mengikuti peta referensi IntiVerse (src/data/intiverse-reference.json)", "dicatat sebagai \"peta saja\" oleh audit kesenjangan materi 10 November 2026; materi dan soal menyusul"];
const EV_NEW = ["inti baru usulan audit kesenjangan materi 10 November 2026 (belum ada di peta FE maupun katalog)", "acuan: Kepka BSKAP 046/H/KR/2025; Panduan Mata Pelajaran BSKAP 2025 (Matematika, IPA, Fisika, Kimia, Biologi)"];

const STRUCTURE: PilotTopic[] = [
  {
    code: "MAT.C26.D.BILANGAN", subject: "MAT", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Bilangan dan operasi", subtitle: "Bilangan rasional, pangkat, akar, pecahan, dan notasi ilmiah", bekal: [],
    cores: [
    { id: "C1", title: "Bilangan rasional & estimasi" },
    { id: "C2", title: "Pangkat, akar & notasi ilmiah" },
    { id: "PECAHAN", title: "Operasi pecahan" },
    { id: "ILMIAH", title: "Notasi ilmiah", capstone: true },
    ],
    edges: [["C1", "PECAHAN", "S"], ["C1", "ILMIAH", "S"]],
  },
  {
    code: "MAT.C26.D.RASIO", subject: "MAT", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Rasio, skala, dan laju", subtitle: "Perbandingan senilai, berbalik nilai, skala, dan laju perubahan", bekal: [],
    cores: [
    { id: "C1", title: "Perbandingan senilai" },
    { id: "C2", title: "Skala dan laju" },
    { id: "BERBALIK", title: "Perbandingan berbalik nilai", capstone: true },
    ],
    edges: [["C1", "BERBALIK", "S"]],
  },
  {
    code: "MAT.C26.D.ALJABAR", subject: "MAT", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Pola, bentuk aljabar & persamaan", subtitle: "Pola ekuivalen, persamaan, dan pertidaksamaan linear satu variabel", bekal: [],
    cores: [
    { id: "C1", title: "Pola & bentuk ekuivalen" },
    { id: "C2", title: "Persamaan & pertidaksamaan" },
    { id: "LINEAR", title: "Persamaan linear satu variabel", capstone: true },
    ],
    edges: [["C1", "LINEAR", "S"]],
  },
  {
    code: "MAT.C26.D.FUNGSI", subject: "MAT", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Relasi, fungsi linear, dan SPLDV", subtitle: "Fungsi, grafik linear, serta eliminasi dan substitusi SPLDV", bekal: [],
    cores: [
    { id: "C1", title: "Fungsi dan grafik" },
    { id: "C2", title: "Sistem persamaan linear" },
    { id: "ELIMINASI", title: "Eliminasi & substitusi SPLDV", capstone: true },
    ],
    edges: [["C1", "ELIMINASI", "S"]],
  },
  {
    code: "MAT.C26.D.GEOMETRI", subject: "MAT", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Sudut, kesebangunan & Pythagoras", subtitle: "Hubungan sudut, kekongruenan, kesebangunan, dan Teorema Pythagoras", bekal: [],
    cores: [
    { id: "C1", title: "Sudut dan kesebangunan" },
    { id: "C2", title: "Teorema Pythagoras" },
    { id: "KONGRUEN", title: "Kongruen dan sebangun", capstone: true },
    ],
    edges: [["C1", "KONGRUEN", "S"]],
  },
  {
    code: "MAT.C26.D.PENGUKURAN", subject: "MAT", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Lingkaran, bangun ruang & transformasi", subtitle: "Luas, volume, jaring-jaring, busur juring, dan transformasi koordinat", bekal: [],
    cores: [
    { id: "C1", title: "Luas, volume & skala" },
    { id: "C2", title: "Transformasi koordinat" },
    { id: "JARING", title: "Jaring-jaring & luas permukaan" },
    { id: "JURING", title: "Busur dan juring lingkaran", capstone: true },
    ],
    edges: [["C1", "JARING", "S"], ["C1", "JURING", "S"]],
  },
  {
    code: "MAT.C26.D.DATA", subject: "MAT", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Data dan peluang sederhana", subtitle: "Sampel representatif, ukuran pemusatan, dan frekuensi relatif", bekal: [],
    cores: [
    { id: "C1", title: "Sampel & ukuran pemusatan" },
    { id: "C2", title: "Peluang & frekuensi relatif" },
    { id: "SAMPEL", title: "Sampel representatif", capstone: true },
    ],
    edges: [["C1", "SAMPEL", "S"]],
  },
  {
    code: "MAT.C26.FPLUS.DISTRIBUSI", subject: "MAT", phase: "F+", decision: 'D9', evidence: EV_FE,
    title: "Distribusi Binomial & Normal", subtitle: "Variabel acak binomial dan kurva distribusi normal", bekal: [],
    cores: [
    { id: "C1", title: "Variabel acak binomial" },
    { id: "PARAMETER", title: "Rataan dan simpangan baku distribusi", sub: "Nilai harapan dan varians variabel acak" },
    { id: "C2", title: "Distribusi normal", capstone: true },
    ],
    edges: [["C1", "C2", "S"], ["C1", "PARAMETER", "S"], ["PARAMETER", "C2", "S"]],
  },
  {
    code: "FIS.C26.D.UKUR", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Pengukuran dan kerja ilmiah", subtitle: "Besaran, satuan, variabel percobaan, dan bukti ilmiah", bekal: [],
    cores: [
    { id: "C1", title: "Besaran dan satuan" },
    { id: "C2", title: "Variabel dan bukti", capstone: true },
    ],
    edges: [["C1", "C2", "S"]],
  },
  {
    code: "FIS.C26.D.GERAK", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Gerak, gaya, dan tekanan", subtitle: "Jarak, perpindahan, kelajuan, resultan gaya, inersia, dan tekanan", bekal: [],
    cores: [
    { id: "C1", title: "Gerak dan gaya resultan" },
    { id: "C2", title: "Tekanan" },
    { id: "KELAJUAN", title: "Jarak, perpindahan & kelajuan" },
    { id: "RESULTAN", title: "Resultan gaya dan inersia", capstone: true },
    ],
    edges: [["C1", "KELAJUAN", "S"], ["C1", "RESULTAN", "S"]],
  },
  {
    code: "FIS.C26.D.ENERGI", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Usaha, energi, dan kalor", subtitle: "Usaha, perubahan energi, suhu, perpindahan kalor, dan kalor jenis", bekal: [],
    cores: [
    { id: "C1", title: "Usaha & perubahan energi" },
    { id: "C2", title: "Suhu & perpindahan kalor" },
    { id: "PESAWAT", title: "Pesawat sederhana", sub: "Tuas, katrol, bidang miring, dan keuntungan mekanis" },
    { id: "KALOR", title: "Kalor jenis", capstone: true },
    ],
    edges: [["C1", "KALOR", "S"], ["C1", "PESAWAT", "S"]],
  },
  {
    code: "FIS.C26.D.GELOMBANG", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Getaran, bunyi, dan cahaya", subtitle: "Getaran, gelombang, bunyi, optik, serta pemantulan dan pembiasan cahaya", bekal: [],
    cores: [
    { id: "C1", title: "Getaran dan gelombang" },
    { id: "C2", title: "Bunyi dan optik" },
    { id: "CAHAYA", title: "Pemantulan & pembiasan cahaya", capstone: true },
    ],
    edges: [["C1", "CAHAYA", "S"]],
  },
  {
    code: "FIS.C26.D.LISTRIK", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Kelistrikan & energi ramah lingkungan", subtitle: "Arus, rangkaian seri paralel, magnet, dan pembangkitan listrik", bekal: [],
    cores: [
    { id: "C1", title: "Arus dan rangkaian" },
    { id: "C2", title: "Magnet & pembangkit listrik" },
    { id: "SERI_PARALEL", title: "Rangkaian seri dan paralel", capstone: true },
    ],
    edges: [["C1", "SERI_PARALEL", "S"]],
  },
  {
    code: "KIM.C26.D.MATERI", subject: "KIM", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Klasifikasi dan sifat materi", subtitle: "Unsur, senyawa, campuran, perubahan materi, dan metode pemisahan", bekal: [],
    cores: [
    { id: "C1", title: "Unsur, senyawa & campuran" },
    { id: "C2", title: "Perubahan dan pemisahan" },
    { id: "PEMISAHAN", title: "Metode pemisahan campuran", capstone: true },
    ],
    edges: [["C1", "PEMISAHAN", "S"]],
  },
  {
    code: "KIM.C26.D.ZAT", subject: "KIM", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Zat aditif dan adiktif", subtitle: "Fungsi zat aditif makanan serta risiko kesehatan zat adiktif", bekal: [],
    cores: [
    { id: "C1", title: "Fungsi zat aditif" },
    { id: "C2", title: "Risiko zat adiktif", capstone: true },
    ],
    edges: [["C1", "C2", "S"]],
  },
  {
    code: "BIO.C26.D.KLASIFIKASI", subject: "BIO", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Ciri dan klasifikasi makhluk hidup", subtitle: "Ciri kehidupan dan klasifikasi makhluk hidup berdasarkan karakter", bekal: [],
    cores: [
    { id: "C1", title: "Ciri kehidupan" },
    { id: "C2", title: "Klasifikasi berdasarkan karakter", capstone: true },
    ],
    edges: [["C1", "C2", "S"]],
  },
  {
    code: "BIO.C26.D.ORGAN", subject: "BIO", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Organisasi kehidupan & sistem organ", subtitle: "Sel sampai organisme, pencernaan, ekskresi, dan gangguan sistem organ", bekal: [],
    cores: [
    { id: "C1", title: "Sel sampai organisme" },
    { id: "C2", title: "Fungsi dan gangguan sistem" },
    { id: "PENCERNAAN", title: "Pencernaan dan penyerapan" },
    { id: "PERNAPASAN", title: "Sistem pernapasan", sub: "Organ pernapasan, pertukaran gas, dan gangguannya" },
    { id: "PEREDARAN", title: "Sistem peredaran darah", sub: "Jantung, pembuluh, darah, dan gangguannya" },
    { id: "EKSKRESI", title: "Ekskresi & keseimbangan cairan", capstone: true },
    ],
    edges: [["C1", "PENCERNAAN", "S"], ["C1", "EKSKRESI", "S"], ["C1", "PERNAPASAN", "S"], ["C1", "PEREDARAN", "S"]],
  },
  {
    code: "BIO.C26.D.EKOLOGI", subject: "BIO", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Ekosistem dan perubahan iklim", subtitle: "Interaksi, aliran energi, rantai jaring makanan, dan perubahan lingkungan", bekal: [],
    cores: [
    { id: "C1", title: "Interaksi & aliran energi" },
    { id: "C2", title: "Perubahan lingkungan" },
    { id: "JEJARING", title: "Rantai dan jaring makanan", capstone: true },
    ],
    edges: [["C1", "JEJARING", "S"]],
  },
  {
    code: "BIO.C26.D.GENETIKA", subject: "BIO", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Pewarisan sifat & bioteknologi SMP", subtitle: "Gen, variasi, genotipe fenotipe, dan fermentasi konvensional", bekal: [],
    cores: [
    { id: "C1", title: "Gen dan variasi" },
    { id: "C2", title: "Fermentasi" },
    { id: "FENOTIPE", title: "Genotipe dan fenotipe", capstone: true },
    ],
    edges: [["C1", "FENOTIPE", "S"]],
  },
  {
    code: "FIS.C26.D.ANTARIKSA", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_NEW,
    title: "Bumi dan tata surya", subtitle: "Posisi dan gerak Bumi, Bulan, Matahari; rotasi, revolusi, dan gerhana", bekal: ["gerak", "cahaya"],
    cores: [
    { id: "C1", title: "Sistem tata surya", sub: "Matahari, planet, dan benda langit lain beserta posisinya" },
    { id: "ROTASI", title: "Rotasi dan revolusi Bumi", sub: "Siang dan malam, gerak semu, dan pergantian musim" },
    { id: "BULAN", title: "Gerak Bulan dan fasenya", sub: "Revolusi Bulan, fase Bulan, dan pasang surut" },
    { id: "GERHANA", title: "Gerhana Matahari dan Bulan", sub: "Posisi Bumi, Bulan, Matahari saat gerhana dan dampaknya", capstone: true },
    ],
    edges: [["C1", "ROTASI", "S"], ["ROTASI", "BULAN", "S"], ["BULAN", "GERHANA", "H"]],
  },
  {
    code: "FIS.C26.D.KEBUMIAN", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_NEW,
    title: "Struktur Bumi dan mitigasi bencana", subtitle: "Lapisan Bumi, gerak lempeng, gempa, gunung api, dan mitigasi risiko", bekal: ["gaya", "energi"],
    cores: [
    { id: "C1", title: "Lapisan Bumi", sub: "Kerak, mantel, dan inti Bumi beserta sifatnya" },
    { id: "LEMPENG", title: "Gerak lempeng tektonik", sub: "Batas divergen, konvergen, dan transform" },
    { id: "GEMPA", title: "Gempa bumi dan gunung api", sub: "Penyebab, gelombang gempa, dan jenis gunung api" },
    { id: "MITIGASI", title: "Mitigasi bencana geologi", sub: "Membaca risiko dan memilih tindakan sebelum, saat, dan sesudah bencana", capstone: true },
    ],
    edges: [["C1", "LEMPENG", "H"], ["LEMPENG", "GEMPA", "H"], ["GEMPA", "MITIGASI", "S"]],
  },
  {
    code: "KIM.C26.D.REAKSI", subject: "KIM", phase: "D", decision: 'D9', evidence: EV_NEW,
    title: "Reaksi kimia dan asam–basa dasar", subtitle: "Ciri reaksi, kekekalan massa, persamaan reaksi, dan indikator asam–basa", bekal: ["perubahan fisika dan kimia"],
    cores: [
    { id: "C1", title: "Ciri-ciri reaksi kimia", sub: "Perubahan warna, gas, endapan, dan suhu" },
    { id: "MASSA", title: "Hukum kekekalan massa", sub: "Massa zat sebelum dan sesudah reaksi dalam sistem tertutup" },
    { id: "PERSAMAAN", title: "Persamaan reaksi sederhana", sub: "Membaca dan menyetarakan persamaan reaksi sederhana" },
    { id: "ASAMBASA", title: "Asam, basa, dan indikator", sub: "Sifat asam–basa, indikator lakmus dan alami, skala pH sederhana", capstone: true },
    ],
    edges: [["C1", "MASSA", "S"], ["MASSA", "PERSAMAAN", "H"], ["C1", "ASAMBASA", "S"]],
  },
  {
    code: "BIO.C26.D.KOORDINASI", subject: "BIO", phase: "D", decision: 'D9', evidence: EV_NEW,
    title: "Koordinasi, reproduksi, dan homeostasis", subtitle: "Sistem saraf, hormon, reproduksi manusia, dan pengaturan kondisi tubuh", bekal: ["sistem organ"],
    cores: [
    { id: "C1", title: "Sistem saraf dan indra", sub: "Neuron, gerak refleks, dan alat indra" },
    { id: "HORMON", title: "Sistem hormon", sub: "Kelenjar endokrin dan fungsi hormon" },
    { id: "REPRODUKSI", title: "Reproduksi dan kesehatan reproduksi", sub: "Organ reproduksi, pubertas, dan menjaga kesehatan reproduksi" },
    { id: "HOMEOSTASIS", title: "Homeostasis", sub: "Kerja sama antarsistem menjaga suhu, cairan, dan gula darah", capstone: true },
    ],
    edges: [["C1", "HORMON", "S"], ["HORMON", "REPRODUKSI", "S"], ["C1", "HOMEOSTASIS", "S"], ["HORMON", "HOMEOSTASIS", "S"]],
  },
  {
    code: "BIO.C26.D.TUMBUH", subject: "BIO", phase: "D", decision: 'D9', evidence: EV_NEW,
    title: "Pertumbuhan dan perkembangan", subtitle: "Beda tumbuh dan berkembang, faktor yang memengaruhi, dan daur hidup", bekal: ["ciri makhluk hidup"],
    cores: [
    { id: "C1", title: "Pertumbuhan dan perkembangan", sub: "Perbedaan bertambah ukuran dan menjadi dewasa" },
    { id: "FAKTOR", title: "Faktor internal dan eksternal", sub: "Gen, hormon, nutrisi, cahaya, suhu, dan air" },
    { id: "DAURHIDUP", title: "Daur hidup dan metamorfosis", sub: "Metamorfosis sempurna, tidak sempurna, dan daur hidup tumbuhan", capstone: true },
    ],
    edges: [["C1", "FAKTOR", "S"], ["C1", "DAURHIDUP", "S"]],
  },
  {
    code: "MAT.C26.E.SPLTV", subject: "MAT", phase: "E", decision: 'D9', evidence: EV_NEW,
    title: "Sistem persamaan linear tiga variabel", subtitle: "Pemodelan tiga variabel, eliminasi–substitusi, dan himpunan solusi", bekal: ["SPLDV", "bentuk aljabar"],
    cores: [
    { id: "C1", title: "Model SPLTV dari masalah", sub: "Menerjemahkan masalah kontekstual menjadi tiga persamaan" },
    { id: "C2", title: "Eliminasi dan substitusi SPLTV", sub: "Mengurangi tiga variabel menjadi dua, lalu satu" },
    { id: "SOLUSI", title: "Himpunan solusi dan interpretasinya", sub: "Memeriksa solusi dan maknanya dalam konteks", capstone: true },
    ],
    edges: [["C1", "C2", "H"], ["C2", "SOLUSI", "H"]],
  },
  {
    code: "MAT.C26.F.REGRESI", subject: "MAT", phase: "F", decision: 'D9', evidence: EV_NEW,
    title: "Statistika dua variabel", subtitle: "Korelasi, regresi linear, prediksi, dan batas hubungan sebab-akibat", bekal: ["diagram pencar", "persamaan garis lurus"],
    cores: [
    { id: "C1", title: "Koefisien korelasi", sub: "Arah dan kekuatan hubungan linear dua variabel" },
    { id: "C2", title: "Garis regresi linear", sub: "Garis kecocokan terbaik dan makna gradien serta titik potong" },
    { id: "PREDIKSI", title: "Prediksi dan batasnya", sub: "Interpolasi, ekstrapolasi, dan sisaan" },
    { id: "KAUSAL", title: "Korelasi bukan sebab-akibat", sub: "Variabel lain dan batas kesimpulan dari data", capstone: true },
    ],
    edges: [["C1", "C2", "S"], ["C2", "PREDIKSI", "H"], ["C1", "KAUSAL", "S"]],
  },
  {
    code: "MAT.C26.FPLUS.KERUCUT", subject: "MAT", phase: "F+", decision: 'D9', evidence: EV_NEW,
    title: "Irisan kerucut", subtitle: "Parabola, elips, dan hiperbola", bekal: ["persamaan kuadrat", "jarak dua titik"],
    cores: [
    { id: "C1", title: "Parabola", sub: "Fokus, direktriks, dan persamaan parabola" },
    { id: "C2", title: "Elips", sub: "Dua fokus, sumbu mayor–minor, dan persamaan elips" },
    { id: "HIPERBOLA", title: "Hiperbola", sub: "Fokus, asimtot, dan persamaan hiperbola", capstone: true },
    ],
    edges: [["C1", "C2", "S"], ["C2", "HIPERBOLA", "S"]],
  },
  {
    code: "KIM.C26.F.ELEKTROLIT", subject: "KIM", phase: "F", decision: 'D9', evidence: EV_NEW,
    title: "Larutan elektrolit", subtitle: "Ionisasi, disosiasi, elektrolit kuat–lemah, dan daya hantar listrik", bekal: ["ikatan ion dan kovalen"],
    cores: [
    { id: "C1", title: "Ionisasi dan disosiasi", sub: "Senyawa ion dan kovalen polar menghasilkan ion dalam air" },
    { id: "C2", title: "Elektrolit kuat, lemah, dan nonelektrolit", sub: "Derajat ionisasi dan contoh larutan" },
    { id: "DAYAHANTAR", title: "Daya hantar listrik larutan", sub: "Membaca hasil uji nyala lampu dan gelembung gas", capstone: true },
    ],
    edges: [["C1", "C2", "H"], ["C2", "DAYAHANTAR", "S"]],
  },
  {
    code: "KIM.C26.F.KOLIGATIF", subject: "KIM", phase: "F", decision: 'D9', evidence: EV_NEW,
    title: "Sifat koligatif larutan", subtitle: "Molalitas, fraksi mol, tekanan uap, titik didih, titik beku, dan osmosis", bekal: ["mol", "larutan elektrolit"],
    cores: [
    { id: "C1", title: "Molalitas dan fraksi mol", sub: "Satuan konsentrasi untuk sifat koligatif" },
    { id: "UAP", title: "Penurunan tekanan uap", sub: "Hukum Raoult" },
    { id: "DIDIHBEKU", title: "Kenaikan titik didih dan penurunan titik beku", sub: "ΔTb = Kb·m dan ΔTf = Kf·m" },
    { id: "OSMOSIS", title: "Tekanan osmosis", sub: "π = MRT dan penerapannya" },
    { id: "VANTHOFF", title: "Faktor van 't Hoff", sub: "Sifat koligatif larutan elektrolit", capstone: true },
    ],
    edges: [["C1", "UAP", "H"], ["C1", "DIDIHBEKU", "H"], ["C1", "OSMOSIS", "H"], ["DIDIHBEKU", "VANTHOFF", "S"]],
  },
  {
    code: "KIM.C26.F.REDOKS", subject: "KIM", phase: "F", decision: 'D9', evidence: EV_NEW,
    title: "Redoks dan elektrokimia", subtitle: "Bilangan oksidasi, penyetaraan redoks, sel volta, elektrolisis, dan korosi", bekal: ["persamaan reaksi", "larutan elektrolit"],
    cores: [
    { id: "C1", title: "Bilangan oksidasi dan reaksi redoks", sub: "Oksidator, reduktor, dan perubahan bilangan oksidasi" },
    { id: "SETARA", title: "Penyetaraan reaksi redoks", sub: "Metode setengah reaksi dan perubahan bilangan oksidasi" },
    { id: "VOLTA", title: "Sel volta dan potensial sel", sub: "Notasi sel dan E° sel" },
    { id: "ELEKTROLISIS", title: "Elektrolisis dan hukum Faraday", sub: "Reaksi di katode–anode dan massa hasil elektrolisis" },
    { id: "KOROSI", title: "Korosi dan pencegahannya", sub: "Perkaratan besi dan cara mencegahnya", capstone: true },
    ],
    edges: [["C1", "SETARA", "H"], ["C1", "VOLTA", "H"], ["VOLTA", "ELEKTROLISIS", "S"], ["VOLTA", "KOROSI", "S"]],
  },
  {
    code: "BIO.C26.F.ORGAN", subject: "BIO", phase: "F", decision: 'D9', evidence: EV_NEW,
    title: "Sistem organ manusia", subtitle: "Keterkaitan struktur dan fungsi: pencernaan, sirkulasi, respirasi, ekskresi, koordinasi, reproduksi", bekal: ["sel dan jaringan"],
    cores: [
    { id: "C1", title: "Struktur dan fungsi jaringan", sub: "Jaringan hewan dan hubungannya dengan fungsi organ" },
    { id: "PENCERNAAN", title: "Sistem pencernaan", sub: "Pencernaan mekanik–kimiawi, enzim, dan penyerapan" },
    { id: "SIRKULASI", title: "Sistem sirkulasi", sub: "Jantung, peredaran darah ganda, dan sistem limfa" },
    { id: "RESPIRASI", title: "Sistem respirasi", sub: "Mekanisme pernapasan dan pertukaran gas" },
    { id: "EKSKRESI", title: "Sistem ekskresi", sub: "Ginjal, pembentukan urine, dan organ ekskresi lain" },
    { id: "KOORDINASI", title: "Sistem koordinasi", sub: "Saraf, hormon, dan alat indra" },
    { id: "REPRODUKSI", title: "Sistem reproduksi", sub: "Gametogenesis, siklus menstruasi, dan fertilisasi", capstone: true },
    ],
    edges: [["C1", "PENCERNAAN", "S"], ["C1", "SIRKULASI", "S"], ["C1", "RESPIRASI", "S"], ["C1", "EKSKRESI", "S"], ["C1", "KOORDINASI", "S"], ["KOORDINASI", "REPRODUKSI", "S"]],
  },
  {
    code: "BIO.C26.F.TUMBUH", subject: "BIO", phase: "F", decision: 'D9', evidence: EV_NEW,
    title: "Pertumbuhan dan perkembangan", subtitle: "Diferensiasi, faktor internal–eksternal, dan eksperimen pertumbuhan", bekal: ["sel", "hormon"],
    cores: [
    { id: "C1", title: "Diferensiasi dan spesialisasi sel", sub: "Dari sel embrio menjadi jaringan khusus" },
    { id: "TUMBUHAN", title: "Pertumbuhan tumbuhan dan hormonnya", sub: "Meristem, perkecambahan, auksin, giberelin, sitokinin" },
    { id: "HEWAN", title: "Pertumbuhan dan perkembangan hewan", sub: "Tahap embrio dan pascaembrio" },
    { id: "EKSPERIMEN", title: "Eksperimen pertumbuhan", sub: "Merancang variabel dan membaca data pertumbuhan", capstone: true },
    ],
    edges: [["C1", "TUMBUHAN", "S"], ["C1", "HEWAN", "S"], ["TUMBUHAN", "EKSPERIMEN", "S"]],
  },
  {
    code: "BIO.C26.F.EVOLUSI", subject: "BIO", phase: "F", decision: 'D9', evidence: EV_NEW,
    title: "Evolusi", subtitle: "Variasi populasi, seleksi alam, bukti evolusi, dan spesiasi", bekal: ["pewarisan sifat", "keanekaragaman hayati"],
    cores: [
    { id: "C1", title: "Variasi dalam populasi", sub: "Sumber variasi: mutasi dan rekombinasi" },
    { id: "SELEKSI", title: "Seleksi alam dan adaptasi", sub: "Kelangsungan hidup dan perubahan frekuensi sifat" },
    { id: "BUKTI", title: "Bukti evolusi", sub: "Fosil, homologi, embriologi, dan molekuler" },
    { id: "SPESIASI", title: "Spesiasi dan keanekaragaman", sub: "Isolasi reproduksi dan terbentuknya spesies baru", capstone: true },
    ],
    edges: [["C1", "SELEKSI", "H"], ["SELEKSI", "SPESIASI", "S"], ["BUKTI", "SPESIASI", "S"]],
  },
  {
    code: "FIS.C26.F.MEDAN", subject: "FIS", phase: "F", decision: 'D9', evidence: EV_NEW,
    title: "Listrik statis dan medan", subtitle: "Muatan, medan dan potensial listrik, kapasitor, medan magnet, dan gaya Lorentz", bekal: ["vektor", "rangkaian listrik"],
    cores: [
    { id: "C1", title: "Muatan dan hukum Coulomb", sub: "Gaya antarmuatan titik" },
    { id: "MEDANLISTRIK", title: "Medan listrik", sub: "Kuat medan dan garis medan" },
    { id: "POTENSIAL", title: "Potensial dan energi potensial listrik", sub: "Usaha memindahkan muatan" },
    { id: "KAPASITOR", title: "Kapasitor", sub: "Kapasitas, susunan seri–paralel, dan energi tersimpan" },
    { id: "LORENTZ", title: "Medan magnet dan gaya Lorentz", sub: "Medan di sekitar arus dan gaya pada muatan atau kawat", capstone: true },
    ],
    edges: [["C1", "MEDANLISTRIK", "H"], ["MEDANLISTRIK", "POTENSIAL", "H"], ["POTENSIAL", "KAPASITOR", "S"], ["MEDANLISTRIK", "LORENTZ", "S"]],
  },
];

for (const key of Object.keys(CONTENT)) {
  const [code, id] = key.split(':');
  if (!STRUCTURE.some(t => t.code === code && t.cores.some(c => c.id === id))) throw new Error(`materi untuk inti yang tidak ada: ${key}`);
}
export const PLANNED_TOPICS: PilotTopic[] = STRUCTURE.map(t => ({ ...t, cores: t.cores.map(c => {
  const key = `${t.code}:${c.id}`, add = CONTENT[key];
  return { ...c, ...add, ...(add?.q ? { q: spread(key, add.q) } : {}) };
}) }));

export const PLANNED_RELATIONS: PilotRelation[] = [
  { from: "MAT.C26.D.BILANGAN", to: "MAT.C26.D.RASIO", kind: "REQUIRES", label: "Konsep dasar operasi bilangan mendukung rasio", decision: 'D9' },
  { from: "MAT.C26.D.BILANGAN", to: "MAT.C26.D.ALJABAR", kind: "REQUIRES", label: "Operasi bilangan menjadi bekal bentuk aljabar", decision: 'D9' },
  { from: "MAT.C26.D.ALJABAR", to: "MAT.C26.D.FUNGSI", kind: "REQUIRES", label: "Persamaan aljabar menjadi bekal SPLDV", decision: 'D9' },
  { from: "MAT.C26.D.GEOMETRI", to: "MAT.C26.D.PENGUKURAN", kind: "REQUIRES", label: "Pythagoras & kesebangunan mendukung bangun ruang", decision: 'D9' },
  { from: "MAT.C26.D.BILANGAN", to: "MAT.EKS", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Bilangan berpangkat SMP menuju Eksponen & Logaritma SMA", decision: 'D9' },
  { from: "MAT.C26.D.ALJABAR", to: "MAT.KUA", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Bentuk aljabar SMP menuju Persamaan & Fungsi Kuadrat SMA", decision: 'D9' },
  { from: "MAT.C26.D.FUNGSI", to: "MAT.SPL", kind: "REQUIRES", label: "Lintas Fase D ➔ E: SPLDV SMP menuju Sistem Pertidaksamaan SMA", decision: 'D9' },
  { from: "MAT.C26.D.GEOMETRI", to: "MAT.TRI", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Kesebangunan & Pythagoras SMP menuju Trigonometri SMA", decision: 'D9' },
  { from: "MAT.C26.D.DATA", to: "MAT.STP", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Data & peluang SMP menuju Statistika SMA", decision: 'D9' },
  { from: "MAT.C26.D.FUNGSI", to: "MAT.INV", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Relasi & fungsi linear menuju Komposisi & Invers Fungsi", decision: 'D9' },
  { from: "MAT.C26.D.GEOMETRI", to: "MAT.CP25.F.LINGKARAN", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Sudut & Pythagoras menuju Hubungan Unsur Lingkaran", decision: 'D9' },
  { from: "MAT.C26.D.DATA", to: "MAT.CP25.F.PELUANG", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Peluang sederhana menuju Peluang Majemuk & Bersyarat", decision: 'D9' },
  { from: "MAT.CP25.F.PELUANG", to: "MAT.C26.FPLUS.DISTRIBUSI", kind: "REQUIRES", label: "Lintas Fase F ➔ F+: Peluang majemuk menuju Distribusi Binomial & Normal", decision: 'D9' },
  { from: "FIS.C26.D.UKUR", to: "FIS.C26.D.GERAK", kind: "REQUIRES", label: "Besaran & satuan mendukung analisis gerak", decision: 'D9' },
  { from: "FIS.C26.D.GERAK", to: "FIS.C26.D.ENERGI", kind: "REQUIRES", label: "Gaya & gerak mendukung konsep usaha dan energi", decision: 'D9' },
  { from: "FIS.C26.D.GERAK", to: "FIS.C26.D.GELOMBANG", kind: "REQUIRES", label: "Konsep gerak mendukung getaran & gelombang", decision: 'D9' },
  { from: "FIS.C26.D.ENERGI", to: "FIS.C26.D.LISTRIK", kind: "REQUIRES", label: "Energi mendukung kelistrikan & energi ramah lingkungan", decision: 'D9' },
  { from: "FIS.C26.D.UKUR", to: "FIS.C26.E.UKUR", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Pengukuran SMP menuju Ketidakpastian & Analisis Data SMA", decision: 'D9' },
  { from: "FIS.C26.D.GERAK", to: "FIS.C26.E.GERAK2D", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Gerak lurus SMP menuju Gerak Dua Dimensi SMA", decision: 'D9' },
  { from: "FIS.C26.D.ENERGI", to: "FIS.C26.E.ENERGI", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Usaha & energi SMP menuju Energi Alternatif SMA", decision: 'D9' },
  { from: "FIS.C26.D.GERAK", to: "FIS.C26.F.FLUIDA", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Gaya & tekanan SMP menuju Fluida Statis & Dinamis", decision: 'D9' },
  { from: "FIS.C26.D.ENERGI", to: "FIS.C26.F.TERMAL", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Kalor SMP menuju Termodinamika SMA", decision: 'D9' },
  { from: "FIS.C26.D.GELOMBANG", to: "FIS.C26.F.GELOMBANG", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Getaran & bunyi SMP menuju Gelombang & Efek Doppler", decision: 'D9' },
  { from: "FIS.C26.D.LISTRIK", to: "FIS.C26.F.ELEKTRO", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Rangkaian SMP menuju Elektromagnetisme & Kirchhoff", decision: 'D9' },
  { from: "KIM.C26.D.MATERI", to: "KIM.C26.D.ZAT", kind: "REQUIRES", label: "Sifat materi mendukung kajian zat aditif", decision: 'D9' },
  { from: "KIM.C26.D.MATERI", to: "KIM.C26.E.ATOM", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Klasifikasi materi SMP menuju Partikel Penyusun Materi SMA", decision: 'D9' },
  { from: "BIO.C26.D.KLASIFIKASI", to: "BIO.C26.D.ORGAN", kind: "REQUIRES", label: "Ciri makhluk hidup mendukung organisasi kehidupan", decision: 'D9' },
  { from: "BIO.C26.D.KLASIFIKASI", to: "BIO.C26.D.EKOLOGI", kind: "REQUIRES", label: "Klasifikasi mendukung interaksi ekosistem", decision: 'D9' },
  { from: "BIO.C26.D.ORGAN", to: "BIO.C26.D.GENETIKA", kind: "REQUIRES", label: "Sistem organ mendukung pewarisan sifat SMP", decision: 'D9' },
  { from: "BIO.C26.D.KLASIFIKASI", to: "BIO.C26.E.BIODIVERSITAS", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Klasifikasi SMP menuju Keanekaragaman & Konservasi SMA", decision: 'D9' },
  { from: "BIO.C26.D.KLASIFIKASI", to: "BIO.C26.E.MIKROBA", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Klasifikasi SMP menuju Virus, Bakteri & Jamur", decision: 'D9' },
  { from: "BIO.C26.D.EKOLOGI", to: "BIO.C26.E.EKOSISTEM", kind: "REQUIRES", label: "Lintas Fase D ➔ E: Ekologi SMP menuju Siklus Karbon & Keseimbangan Ekosistem", decision: 'D9' },
  { from: "BIO.C26.D.ORGAN", to: "BIO.C26.F.SEL", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Sel & organ SMP menuju Struktur Sel & Bioproses", decision: 'D9' },
  { from: "BIO.C26.D.GENETIKA", to: "BIO.C26.F.GENETIKA", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Pewarisan sifat SMP menuju Genetika Molekuler SMA", decision: 'D9' },
  { from: "KIM.C26.E.STOIK", to: "MAT.C26.D.RASIO", kind: "RELATED", label: "Lintas Pelajaran Kimia ↔ Matematika: Perbandingan mol dalam reaksi kimia", decision: 'D9' },
  { from: "KIM.C26.D.MATERI", to: "KIM.C26.D.REAKSI", kind: "REQUIRES", label: "sifat dan perubahan materi → reaksi kimia", decision: 'D9' },
  { from: "KIM.C26.D.REAKSI", to: "KIM.C26.E.STOIK", kind: "REQUIRES", label: "Lintas Fase D ➔ E: kekekalan massa dan persamaan reaksi → stoikiometri", decision: 'D9' },
  { from: "KIM.C26.E.STOIK", to: "KIM.C26.F.KOLIGATIF", kind: "REQUIRES", label: "mol → molalitas dan fraksi mol", decision: 'D9' },
  { from: "KIM.C26.F.ELEKTROLIT", to: "KIM.C26.F.KOLIGATIF", kind: "REQUIRES", label: "jumlah ion → faktor van 't Hoff", decision: 'D9' },
  { from: "KIM.C26.F.ELEKTROLIT", to: "KIM.C26.F.REDOKS", kind: "RELATED", label: "larutan elektrolit dalam sel elektrokimia", decision: 'D9' },
  { from: "BIO.C26.D.ORGAN", to: "BIO.C26.D.KOORDINASI", kind: "REQUIRES", label: "sistem organ → koordinasi antarsistem", decision: 'D9' },
  { from: "BIO.C26.D.ORGAN", to: "BIO.C26.F.ORGAN", kind: "REQUIRES", label: "Lintas Fase D ➔ F: sistem organ SMP → sistem organ SMA", decision: 'D9' },
  { from: "BIO.C26.D.TUMBUH", to: "BIO.C26.F.TUMBUH", kind: "REQUIRES", label: "Lintas Fase D ➔ F: pertumbuhan dan perkembangan", decision: 'D9' },
  { from: "BIO.C26.F.SEL", to: "BIO.C26.F.ORGAN", kind: "REQUIRES", label: "sel dan jaringan → sistem organ", decision: 'D9' },
  { from: "BIO.C26.F.GENETIKA", to: "BIO.C26.F.EVOLUSI", kind: "REQUIRES", label: "pewarisan dan mutasi → variasi populasi", decision: 'D9' },
  { from: "MAT.C26.D.FUNGSI", to: "MAT.C26.E.SPLTV", kind: "REQUIRES", label: "Lintas Fase D ➔ E: SPLDV → SPLTV", decision: 'D9' },
  { from: "MAT.STP", to: "MAT.C26.F.REGRESI", kind: "REQUIRES", label: "diagram pencar → korelasi dan regresi", decision: 'D9' },
  { from: "MAT.KUA", to: "MAT.C26.FPLUS.KERUCUT", kind: "REQUIRES", label: "fungsi kuadrat → parabola", decision: 'D9' },
  { from: "FIS.C26.D.LISTRIK", to: "FIS.C26.F.MEDAN", kind: "REQUIRES", label: "Lintas Fase D ➔ F: listrik dan magnet SMP → medan listrik dan magnet", decision: 'D9' },
  { from: "FIS.C26.F.MEDAN", to: "FIS.C26.F.ELEKTRO", kind: "RELATED", label: "medan magnet ↔ induksi elektromagnetik", decision: 'D9' },
  { from: "FIS.C26.D.ANTARIKSA", to: "FIS.C26.D.KEBUMIAN", kind: "RELATED", label: "Bumi sebagai planet ↔ struktur Bumi", decision: 'D9' },
];
