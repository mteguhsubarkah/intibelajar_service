// Topik dan inti yang belum ada di katalog (audit kesenjangan materi kelas 7–12, 10 November 2026).
// Struktur dulu: inti tanpa slides/soal ditulis PLANNED. Isi materi dan soal di sini nanti, inti otomatis menjadi READY.
// Sebagian dibangkitkan dari src/data/intiverse-reference.json FE (topik "peta saja"), sisanya topik baru usulan audit.
import type { PilotCore, PilotRelation, PilotTopic } from './types.js';
import { spread } from './spread.js';
import { SMP_MAT } from './smp-mat.js';
import { SMP_FIS } from './smp-fis.js';
import { SMP_KIM } from './smp-kim.js';
import { SMP_BIO } from './smp-bio.js';
import { SMA_MAT } from './sma-mat.js';
import { SMA_FIS } from './sma-fis.js';
import { SMA_KIM } from './sma-kim.js';
import { SMA_BIO } from './sma-bio.js';
import { SMA_MAT_LANJUT } from './sma-mat-lanjut.js';
import { IPA_FIS_E } from './ipa-fis-e.js';
import { KIMIA_LENGKAP } from './kimia-lengkap.js';
import { BIOLOGI_LENGKAP } from './biologi-lengkap.js';

/** Materi dan soal yang sudah ditulis, per "KODE_TOPIK:ID_INTI". Inti yang punya isi di sini menjadi READY. */
const CONTENT: Record<string, Pick<PilotCore, 'slides' | 'q' | 'min'>> = {
  ...SMP_MAT, ...SMP_FIS, ...SMP_KIM, ...SMP_BIO, // prioritas 1: inti SMP
  ...SMA_MAT, ...SMA_FIS, ...SMA_KIM, ...SMA_BIO, // prioritas 2: celah SMA Fase E/F
  ...SMA_MAT_LANJUT, ...IPA_FIS_E, ...KIMIA_LENGKAP, ...BIOLOGI_LENGKAP, // pemeriksaan per kelas 12 November 2026
};

const EV_FE = ["nama inti dan prasyarat mengikuti peta referensi IntiVerse (src/data/intiverse-reference.json)", "dicatat sebagai \"peta saja\" oleh audit kesenjangan materi 10 November 2026; materi dan soal menyusul"];
/** Bab baru dari Tahap 3 audit Fisika (struktur bab mengikuti buku resmi). */
const EV_T3 = ["bab baru dari Tahap 3 audit Fisika 14 November 2026 (docs/backlog.md FE): struktur bab mengikuti Buku Siswa IPA Kurikulum Merdeka", "inti yang pindah ke bab ini ditulis ulang sebagai inti baru; inti lamanya disembunyikan di bab asal (kode inti tidak bisa pindah bab)"];
const EV_NEW = ["inti baru usulan audit kesenjangan materi 10 November 2026 (belum ada di peta FE maupun katalog)", "acuan: Kepka BSKAP 046/H/KR/2025; Panduan Mata Pelajaran BSKAP 2025 (Matematika, IPA, Fisika, Kimia, Biologi)"];

/** Bab dari pemeriksaan per kelas (12 November 2026): ada di daftar isi buku siswa per kelas, belum ada di katalog. */
const EV_GRADE = ["bab baru dari pemeriksaan per kelas 12 November 2026: ada di daftar isi Buku Siswa Kurikulum Merdeka per kelas, belum ada di katalog", "acuan: Buku Siswa Kurikulum Merdeka terbitan Pusbuk Kemendikbudristek (Matematika Tingkat Lanjut XI–XII, IPA VII–X, Kimia XI–XII, Biologi XI–XII) lewat rangkuman Ruangguru, Mamikos, Tirto, dan Gramedia karena PDF buku tidak dapat dibuka dari lingkungan pembuat; rentang fase Kepka BSKAP 046/H/KR/2025; kelas tiap inti di scripts/catalog/pilot/grades.ts"];
type Core = [string, string, string?, boolean?];
const G = (code: string, subject: PilotTopic['subject'], phase: PilotTopic['phase'], title: string, subtitle: string, bekal: string[], cores: Core[], edges: PilotTopic['edges']): PilotTopic =>
  ({ code, subject, phase, decision: 'D9', evidence: EV_GRADE, title, subtitle, bekal, edges,
     cores: cores.map(([id, title, sub, capstone]) => ({ id, title, ...(sub ? { sub } : {}), ...(capstone ? { capstone } : {}) })) });

const BY_GRADE: PilotTopic[] = [
  // ---- Matematika Tingkat Lanjut kelas 11
  G('MAT.C26.FPLUS.KOMPLEKS', 'MAT', 'F+', 'Bilangan kompleks', 'Satuan imajiner, operasi, modulus, argumen, dan bentuk polar', ['akar kuadrat', 'koordinat Kartesius'], [
    ['C1', 'Bentuk dan bidang bilangan kompleks', 'Satuan imajiner i, bagian real dan imajiner, bidang kompleks'],
    ['C2', 'Operasi bilangan kompleks', 'Jumlah, selisih, kali, dan bagi dengan sekawan'],
    ['KONJUGAT', 'Konjugat, modulus, dan argumen', 'Sekawan, jarak ke titik asal, dan sudut terhadap sumbu real'],
    ['POLAR', 'Bentuk polar', 'r cis θ, perkalian, dan Teorema De Moivre', true]],
    [['C1', 'C2', 'H'], ['C2', 'KONJUGAT', 'H'], ['KONJUGAT', 'POLAR', 'H']]),
  G('MAT.C26.FPLUS.POLINOMIAL', 'MAT', 'F+', 'Polinomial', 'Operasi, pembagian, teorema sisa dan faktor, serta akar-akar polinomial', ['bentuk aljabar', 'persamaan kuadrat'], [
    ['C1', 'Bentuk dan operasi polinomial', 'Derajat, koefisien, nilai, dan operasi polinomial'],
    ['C2', 'Pembagian polinomial', 'Hasil bagi dan sisa, cara bersusun dan Horner'],
    ['SISA', 'Teorema sisa dan faktor', 'Sisa P(k) dan menemukan faktor'],
    ['AKAR', 'Akar-akar dan hubungan koefisien', 'Akar polinomial dan rumus Vieta derajat tiga', true]],
    [['C1', 'C2', 'H'], ['C2', 'SISA', 'H'], ['SISA', 'AKAR', 'H']]),
  G('MAT.C26.FPLUS.TRANSFORMASI', 'MAT', 'F+', 'Transformasi geometri', 'Translasi, refleksi, rotasi, dilatasi, dan komposisinya dengan matriks', ['matriks', 'koordinat Kartesius'], [
    ['C1', 'Translasi dan refleksi', 'Pergeseran dan pencerminan terhadap sumbu dan garis'],
    ['C2', 'Rotasi', 'Perputaran terhadap titik asal dan pusat lain'],
    ['DILATASI', 'Dilatasi', 'Perbesaran dengan faktor skala dan perubahan luas'],
    ['KOMPOSISI', 'Komposisi transformasi dengan matriks', 'Urutan komposisi dan determinan sebagai faktor luas', true]],
    [['C1', 'C2', 'S'], ['C1', 'DILATASI', 'S'], ['C2', 'KOMPOSISI', 'H'], ['DILATASI', 'KOMPOSISI', 'H']]),
  G('MAT.C26.FPLUS.FUNGSI', 'MAT', 'F+', 'Fungsi dan pemodelan', 'Fungsi rasional, model periodik trigonometri, dan memilih model dari data', ['fungsi', 'trigonometri'], [
    ['C1', 'Fungsi rasional dan asimtot', 'Daerah asal, asimtot tegak, dan asimtot datar'],
    ['C2', 'Model periodik trigonometri', 'Amplitudo, periode, dan garis tengah dari data berulang'],
    ['MODEL', 'Memilih model fungsi dari data', 'Selisih, rasio, dan pola untuk memilih model', true]],
    [['C1', 'MODEL', 'S'], ['C2', 'MODEL', 'S']]),
  // ---- Matematika Tingkat Lanjut kelas 12
  G('MAT.C26.FPLUS.LINGKARAN', 'MAT', 'F+', 'Persamaan lingkaran', 'Persamaan lingkaran, bentuk umum, kedudukan titik dan garis, serta garis singgung', ['jarak dua titik', 'melengkapkan kuadrat'], [
    ['C1', 'Persamaan lingkaran', 'Lingkaran dengan pusat dan jari-jari tertentu'],
    ['C2', 'Bentuk umum dan pusat-jari-jari', 'Membaca pusat dan jari-jari dari bentuk umum'],
    ['KEDUDUKAN', 'Kedudukan titik dan garis terhadap lingkaran', 'Di dalam, pada, di luar; memotong, menyinggung, tidak memotong'],
    ['SINGGUNG', 'Persamaan garis singgung', 'Garis singgung di titik dan dengan gradien tertentu', true]],
    [['C1', 'C2', 'H'], ['C2', 'KEDUDUKAN', 'H'], ['KEDUDUKAN', 'SINGGUNG', 'H']]),
  G('MAT.C26.FPLUS.LIMIT', 'MAT', 'F+', 'Limit fungsi', 'Konsep limit, limit aljabar, limit di tak hingga, dan limit trigonometri', ['fungsi', 'faktorisasi'], [
    ['C1', 'Konsep limit', 'Mendekati suatu nilai, limit kiri dan kanan'],
    ['C2', 'Limit fungsi aljabar', 'Substitusi, faktorisasi, dan perkalian sekawan'],
    ['TAKHINGGA', 'Limit di tak hingga', 'Fungsi rasional dan selisih akar untuk x → ∞'],
    ['TRIGONOMETRI', 'Limit fungsi trigonometri', 'lim sin x / x = 1 dan bentuk turunannya', true]],
    [['C1', 'C2', 'H'], ['C2', 'TAKHINGGA', 'S'], ['C2', 'TRIGONOMETRI', 'H']]),
  G('MAT.C26.FPLUS.TURUNAN', 'MAT', 'F+', 'Turunan lanjut', 'Aturan rantai, turunan trigonometri, titik stasioner, dan kemonotonan', ['turunan dasar'], [
    ['C1', 'Aturan rantai', 'Turunan fungsi komposisi dan bentuk pangkat'],
    ['C2', 'Turunan fungsi trigonometri', 'Turunan sinus, kosinus, dan tangen'],
    ['STASIONER', 'Titik stasioner dan kemonotonan', 'Fungsi naik dan turun, uji turunan kedua', true]],
    [['C1', 'C2', 'H'], ['C1', 'STASIONER', 'S'], ['C2', 'STASIONER', 'S']]),
  G('MAT.C26.FPLUS.INTEGRAL', 'MAT', 'F+', 'Integral lanjut', 'Integral substitusi, luas antara dua kurva, dan volume benda putar', ['antiturunan', 'integral tentu'], [
    ['C1', 'Integral substitusi', 'Memisalkan u = g(x) untuk menyederhanakan integral'],
    ['C2', 'Luas daerah antara dua kurva', 'Kurva atas dikurangi kurva bawah'],
    ['VOLUME', 'Volume benda putar', 'Metode cakram dan cincin', true]],
    [['C1', 'C2', 'S'], ['C2', 'VOLUME', 'H']]),
  // ---- Fisika kelas 10
  G('FIS.C26.E.IKLIM', 'FIS', 'E', 'Pemanasan global dan perubahan iklim', 'Efek rumah kaca, bukti dan penyebab pemanasan global, dampak, mitigasi, dan adaptasi', ['kalor', 'radiasi'], [
    ['C1', 'Efek rumah kaca', 'Gas rumah kaca dan radiasi inframerah'],
    ['C2', 'Bukti dan penyebab pemanasan global', 'Data suhu, muka laut, dan emisi dari aktivitas manusia'],
    ['DAMPAK', 'Dampak perubahan iklim', 'Cuaca ekstrem, kenaikan muka laut, dan dampak pada kehidupan'],
    ['MITIGASI', 'Mitigasi dan adaptasi', 'Mengurangi emisi dan menyesuaikan diri dengan dampak', true]],
    [['C1', 'C2', 'H'], ['C2', 'DAMPAK', 'S'], ['DAMPAK', 'MITIGASI', 'S']]),
  G('FIS.C26.E.TERBARUKAN', 'FIS', 'E', 'Pembangkit energi terbarukan', 'Sel surya, tenaga air dan angin, panas bumi, dan bioenergi', ['energi dan daya', 'perubahan energi'], [
    ['C1', 'Energi surya dan sel surya', 'Fotovoltaik, efisiensi, dan daya panel'],
    ['C2', 'Pembangkit tenaga air dan angin', 'PLTA, PLTB, dan perubahan energinya'],
    ['PANASBUMI', 'Panas bumi dan bioenergi', 'PLTP, biogas, biodiesel, dan menilai pilihan energi', true]],
    [['C1', 'PANASBUMI', 'S'], ['C2', 'PANASBUMI', 'S']]),
  // ---- Kimia
  G('KIM.C26.D.PARTIKEL', 'KIM', 'D', 'Wujud zat dan teori partikel', 'Susunan partikel padat, cair, dan gas, perubahan wujud, serta massa jenis', ['sifat benda'], [
    ['C1', 'Wujud zat dan susunan partikel', 'Padat, cair, dan gas menurut gerak dan jarak partikel'],
    ['C2', 'Perubahan wujud zat', 'Mencair, membeku, menguap, mengembun, menyublim, mengkristal'],
    ['MASSAJENIS', 'Massa jenis', 'ρ = m/V, terapung dan tenggelam', true]],
    [['C1', 'C2', 'H'], ['C1', 'MASSAJENIS', 'S']]),
  G('KIM.C26.D.ATOM', 'KIM', 'D', 'Atom, ion, dan molekul', 'Partikel penyusun atom, ion dan molekul, serta lambang unsur', ['wujud zat'], [
    ['C1', 'Atom dan partikel penyusunnya', 'Proton, neutron, elektron, nomor atom, dan nomor massa'],
    ['C2', 'Ion dan molekul', 'Kation, anion, molekul unsur, dan molekul senyawa'],
    ['UNSUR', 'Lambang unsur dan tabel periodik sederhana', 'Lambang unsur, logam dan nonlogam, golongan dan periode', true]],
    [['C1', 'C2', 'H'], ['C1', 'UNSUR', 'S']]),
  G('KIM.C26.E.HUKUMDASAR', 'KIM', 'E', 'Hukum dasar kimia', 'Hukum Lavoisier, Proust, Dalton, Gay-Lussac, dan hipotesis Avogadro', ['persamaan reaksi'], [
    ['C1', 'Hukum kekekalan massa (Lavoisier)', 'Massa sebelum dan sesudah reaksi dalam sistem tertutup'],
    ['C2', 'Hukum perbandingan tetap (Proust)', 'Perbandingan massa unsur dalam senyawa'],
    ['BERGANDA', 'Hukum perbandingan berganda (Dalton)', 'Dua unsur yang membentuk lebih dari satu senyawa'],
    ['VOLUME', 'Hukum perbandingan volume dan Avogadro', 'Perbandingan volume gas sama dengan perbandingan koefisien', true]],
    [['C1', 'C2', 'H'], ['C2', 'BERGANDA', 'H'], ['C2', 'VOLUME', 'S']]),
  G('KIM.C26.E.HIJAU', 'KIM', 'E', 'Kimia hijau dan pembangunan berkelanjutan', 'Prinsip kimia hijau, ekonomi atom, dan penerapannya', ['reaksi kimia'], [
    ['C1', 'Prinsip kimia hijau', 'Mencegah limbah, bahan lebih aman, hemat energi, katalis'],
    ['C2', 'Ekonomi atom', 'Persentase atom pereaksi yang menjadi produk'],
    ['PENERAPAN', 'Kimia hijau dan pembangunan berkelanjutan', 'Contoh penerapan dan kaitannya dengan SDGs', true]],
    [['C1', 'C2', 'S'], ['C1', 'PENERAPAN', 'S']]),
  G('KIM.C26.E.MODELATOM', 'KIM', 'E', 'Perkembangan model atom', 'Model Dalton sampai Bohr, konfigurasi elektron, dan elektron valensi', ['atom, ion, dan molekul'], [
    ['C1', 'Model atom Dalton, Thomson, Rutherford', 'Percobaan dan kesimpulan tiap model'],
    ['C2', 'Model atom Bohr', 'Kulit elektron, tingkat energi, dan warna nyala'],
    ['KONFIGURASI', 'Konfigurasi elektron dan elektron valensi', 'Pengisian kulit K, L, M dan elektron terluar', true]],
    [['C1', 'C2', 'H'], ['C2', 'KONFIGURASI', 'H']]),
  G('KIM.C26.F.HIDROKARBON', 'KIM', 'F', 'Hidrokarbon dan minyak bumi', 'Kekhasan atom karbon, alkana-alkena-alkuna, tata nama, dan minyak bumi', ['ikatan kovalen'], [
    ['C1', 'Kekhasan atom karbon', 'Empat ikatan kovalen dan atom C primer sampai kuarterner'],
    ['C2', 'Alkana, alkena, dan alkuna', 'Rumus umum, sifat, dan isomer'],
    ['TATANAMA', 'Tata nama hidrokarbon', 'Rantai induk, penomoran, dan cabang menurut IUPAC'],
    ['MINYAK', 'Minyak bumi dan pembakaran', 'Distilasi bertingkat, bilangan oktan, dan pembakaran', true]],
    [['C1', 'C2', 'H'], ['C2', 'TATANAMA', 'H'], ['C2', 'MINYAK', 'S']]),
  G('KIM.C26.F.LAJU', 'KIM', 'F', 'Laju reaksi', 'Pengertian laju, teori tumbukan, dan faktor yang memengaruhi laju', ['konsentrasi molar', 'persamaan reaksi'], [
    ['C1', 'Konsep laju reaksi', 'Perubahan konsentrasi per satuan waktu'],
    ['C2', 'Teori tumbukan', 'Tumbukan efektif dan energi aktivasi'],
    ['FAKTOR', 'Faktor yang memengaruhi laju', 'Konsentrasi, luas permukaan, suhu, dan katalis', true]],
    [['C1', 'C2', 'S'], ['C2', 'FAKTOR', 'H']]),
  G('KIM.C26.F.KOLOID', 'KIM', 'F', 'Sistem koloid', 'Jenis koloid, sifat-sifat koloid, serta pembuatan dan penerapannya', ['larutan'], [
    ['C1', 'Sistem dispersi dan jenis koloid', 'Larutan, koloid, suspensi, dan jenis koloid'],
    ['C2', 'Sifat koloid', 'Efek Tyndall, gerak Brown, adsorpsi, koagulasi, dialisis'],
    ['PEMBUATAN', 'Pembuatan dan penerapan koloid', 'Kondensasi, dispersi, dan pengemulsi', true]],
    [['C1', 'C2', 'H'], ['C2', 'PEMBUATAN', 'S']]),
  G('KIM.C26.F.ASAMBASA', 'KIM', 'F', 'Asam–basa dan titrasi', 'Teori asam–basa, pH asam dan basa lemah, serta titrasi', ['larutan elektrolit', 'logaritma'], [
    ['C1', 'Teori asam–basa', 'Arrhenius, Brønsted–Lowry, Lewis, dan pasangan konjugasi'],
    ['C2', 'pH asam dan basa lemah', 'Ka, Kb, dan menghitung pH'],
    ['TITRASI', 'Titrasi asam–basa', 'Titik ekuivalen, indikator, dan kurva titrasi', true]],
    [['C1', 'C2', 'H'], ['C2', 'TITRASI', 'S']]),
  G('KIM.C26.F.GUGUS', 'KIM', 'F', 'Senyawa turunan alkana', 'Alkohol, eter, aldehida, keton, asam karboksilat, ester, dan reaksinya', ['hidrokarbon'], [
    ['C1', 'Alkohol dan eter', 'Gugus –OH dan –O–, tata nama, dan isomer fungsi'],
    ['C2', 'Aldehida dan keton', 'Gugus karbonil, uji Tollens dan Fehling'],
    ['KARBOKSILAT', 'Asam karboksilat dan ester', 'Gugus –COOH dan –COO–, esterifikasi'],
    ['REAKSI', 'Reaksi senyawa karbon', 'Substitusi, adisi, eliminasi, dan oksidasi alkohol', true]],
    [['C1', 'C2', 'S'], ['C2', 'KARBOKSILAT', 'S'], ['KARBOKSILAT', 'REAKSI', 'S']]),
  // ---- Biologi
  G('BIO.C26.E.KLASIFIKASI', 'BIO', 'E', 'Klasifikasi makhluk hidup', 'Takson, tata nama binomial, lima kingdom, dan tiga domain', ['ciri makhluk hidup'], [
    ['C1', 'Sistem klasifikasi dan takson', 'Tujuan klasifikasi dan urutan takson'],
    ['C2', 'Tata nama binomial', 'Aturan penulisan nama ilmiah'],
    ['KINGDOM', 'Sistem lima kingdom dan tiga domain', 'Monera sampai Animalia; Bacteria, Archaea, Eukarya', true]],
    [['C1', 'C2', 'S'], ['C1', 'KINGDOM', 'H']]),
  G('BIO.C26.E.LIMBAH', 'BIO', 'E', 'Pencemaran dan pengelolaan limbah', 'Pencemaran air, tanah, udara, jenis limbah, dan daur ulang', ['ekosistem'], [
    ['C1', 'Pencemaran lingkungan', 'Polutan, eutrofikasi, dan indikator kualitas air'],
    ['C2', 'Jenis limbah', 'Organik, anorganik, dan limbah B3'],
    ['DAURULANG', 'Daur ulang dan pengelolaan limbah', 'Prinsip 3R, kompos, bank sampah, dan IPAL', true]],
    [['C1', 'C2', 'S'], ['C2', 'DAURULANG', 'H']]),
  G('BIO.C26.F.TUMBUHAN', 'BIO', 'F', 'Jaringan dan transpor pada tumbuhan', 'Jaringan dan organ tumbuhan, transpor air, hara, dan hasil fotosintesis', ['sel', 'fotosintesis'], [
    ['C1', 'Jaringan tumbuhan', 'Meristem, jaringan dewasa, xilem, dan floem'],
    ['C2', 'Organ tumbuhan', 'Akar, batang, dan struktur daun'],
    ['AIR', 'Transpor air dan hara', 'Osmosis, transpirasi, kohesi, dan adhesi'],
    ['FLOEM', 'Transpor hasil fotosintesis', 'Translokasi sukrosa dari sumber ke penerima', true]],
    [['C1', 'C2', 'H'], ['C2', 'AIR', 'H'], ['AIR', 'FLOEM', 'S']]),
  G('BIO.C26.F.GERAK', 'BIO', 'F', 'Sistem gerak manusia', 'Rangka, sendi, otot, dan gangguan sistem gerak', ['jaringan hewan'], [
    ['C1', 'Rangka dan tulang', 'Fungsi rangka, rangka aksial dan apendikular, osifikasi'],
    ['C2', 'Sendi', 'Sinartrosis, amfiartrosis, dan jenis diartrosis'],
    ['OTOT', 'Otot dan kontraksi', 'Jenis otot, kerja antagonis, aktin dan miosin'],
    ['GANGGUAN', 'Gangguan sistem gerak', 'Kelainan tulang, sendi, dan otot serta pencegahannya', true]],
    [['C1', 'C2', 'H'], ['C1', 'OTOT', 'S'], ['OTOT', 'GANGGUAN', 'S']]),
  G('BIO.C26.F.IMUN', 'BIO', 'F', 'Sistem pertahanan tubuh', 'Pertahanan nonspesifik dan spesifik, vaksin, dan gangguan sistem imun', ['sel darah'], [
    ['C1', 'Pertahanan nonspesifik', 'Kulit, selaput lendir, fagositosis, dan inflamasi'],
    ['C2', 'Pertahanan spesifik', 'Limfosit B dan T, antibodi, dan sel memori'],
    ['VAKSIN', 'Imunisasi dan vaksin', 'Kekebalan aktif dan pasif, cara kerja vaksin'],
    ['GANGGUAN', 'Gangguan sistem imun', 'Alergi, autoimun, HIV, dan AIDS', true]],
    [['C1', 'C2', 'H'], ['C2', 'VAKSIN', 'H'], ['C2', 'GANGGUAN', 'S']]),
  G('BIO.C26.F.HEREDITAS', 'BIO', 'F', 'Pola hereditas', 'Penyimpangan semu Mendel, pautan, pautan seks, dan hereditas manusia', ['hukum Mendel', 'meiosis'], [
    ['C1', 'Penyimpangan semu hukum Mendel', 'Epistasis, kriptomeri, komplementer, dan polimeri'],
    ['C2', 'Pautan dan pindah silang', 'Gen tertaut dan nilai pindah silang'],
    ['SEKS', 'Penentuan jenis kelamin dan pautan seks', 'Kromosom XX/XY, buta warna, dan hemofilia'],
    ['MANUSIA', 'Hereditas pada manusia', 'Golongan darah ABO dan peta silsilah', true]],
    [['C1', 'C2', 'S'], ['C2', 'SEKS', 'S'], ['SEKS', 'MANUSIA', 'H']]),
  G('BIO.C26.F.MUTASI', 'BIO', 'F', 'Mutasi', 'Mutasi gen, mutasi kromosom, penyebab, dan dampaknya', ['DNA dan kromosom'], [
    ['C1', 'Mutasi gen', 'Substitusi, insersi, delesi, dan pergeseran kerangka baca'],
    ['C2', 'Mutasi kromosom', 'Perubahan struktur, aneuploidi, dan poliploidi'],
    ['PENYEBAB', 'Penyebab dan dampak mutasi', 'Mutagen, dampak merugikan, dan pemanfaatan', true]],
    [['C1', 'C2', 'S'], ['C1', 'PENYEBAB', 'S']]),
];

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
  // Tahap 3 audit Fisika (14 November 2026): kode inti tidak bisa pindah bab, jadi inti yang pindah atau dipecah ditulis
  // ulang sebagai inti baru dan inti lamanya disembunyikan (hidden, di akhir daftar). Inti yang hanya ganti judul memakai
  // codeFrom agar kode, soal, dan progres siswa tetap.
  {
    code: "FIS.C26.D.SUHU", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_T3,
    title: "Suhu dan kalor", subtitle: "Suhu, termometer, perpindahan kalor, kalor jenis, dan perubahan wujud", bekal: ["besaran dan satuan"],
    cores: [
    { id: "SUHU", title: "Suhu & perpindahan kalor" },
    { id: "KALOR", title: "Kalor jenis", capstone: true },
    ],
    edges: [["SUHU", "KALOR", "S"]],
  },
  {
    code: "FIS.C26.D.GERAK", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Gerak dan gaya", subtitle: "Jarak, perpindahan, kelajuan, gaya dan berat, resultan gaya, dan inersia", bekal: [],
    cores: [
    { id: "KELAJUAN", title: "Jarak, perpindahan & kelajuan" },
    { id: "C1", title: "Gaya dan berat benda", codeFrom: "Gerak dan gaya resultan" },
    { id: "RESULTAN", title: "Resultan gaya dan inersia", capstone: true },
    { id: "C2", title: "Tekanan", hidden: true },
    ],
    edges: [["C1", "RESULTAN", "S"], ["KELAJUAN", "C1", "S"]],
  },
  {
    code: "FIS.C26.D.TEKANAN", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_T3,
    title: "Tekanan zat dan penerapannya", subtitle: "Tekanan pada zat padat, zat cair, dan gas, serta penerapannya dalam teknologi dan makhluk hidup", bekal: ["gaya", "luas bidang"],
    cores: [
    { id: "PADAT", title: "Tekanan zat padat" },
    { id: "CAIR", title: "Tekanan zat cair", sub: "Tekanan hidrostatis, Hukum Pascal, dan Hukum Archimedes" },
    { id: "GAS", title: "Tekanan gas", sub: "Tekanan udara dan tekanan gas di ruang tertutup" },
    { id: "PENERAPAN", title: "Penerapan tekanan zat", sub: "Hidrolik, kapal selam, tekanan darah, dan pengangkutan air pada tumbuhan", capstone: true },
    ],
    edges: [["PADAT", "CAIR", "S"], ["PADAT", "GAS", "S"], ["CAIR", "PENERAPAN", "S"], ["GAS", "PENERAPAN", "S"]],
  },
  {
    code: "FIS.C26.D.ENERGI", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Usaha, energi, dan pesawat sederhana", subtitle: "Usaha, perubahan energi, dan pesawat sederhana", bekal: [],
    cores: [
    { id: "C1", title: "Usaha & perubahan energi" },
    { id: "PESAWAT", title: "Pesawat sederhana", sub: "Tuas, katrol, bidang miring, dan keuntungan mekanis", capstone: true },
    { id: "C2", title: "Suhu & perpindahan kalor", hidden: true },
    { id: "KALOR", title: "Kalor jenis", hidden: true },
    ],
    edges: [["C1", "PESAWAT", "S"]],
  },
  {
    code: "FIS.C26.D.GELOMBANG", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Getaran, bunyi, dan cahaya", subtitle: "Getaran, gelombang, bunyi, pemantulan dan pembiasan cahaya, serta alat optik", bekal: [],
    cores: [
    { id: "C1", title: "Getaran dan gelombang" },
    { id: "BUNYI", title: "Bunyi dan pemantulannya" },
    { id: "CAHAYA", title: "Pemantulan & pembiasan cahaya" },
    { id: "OPTIK", title: "Alat optik", sub: "Mata, cacat mata, lup, kamera, dan mikroskop", capstone: true },
    { id: "C2", title: "Bunyi dan optik", hidden: true },
    ],
    edges: [["C1", "BUNYI", "S"], ["C1", "CAHAYA", "S"], ["CAHAYA", "OPTIK", "S"]],
  },
  {
    code: "FIS.C26.D.LISTRIK", subject: "FIS", phase: "D", decision: 'D9', evidence: EV_FE,
    title: "Kelistrikan & energi ramah lingkungan", subtitle: "Listrik statis, arus, rangkaian, energi dan daya listrik, magnet, dan energi alternatif", bekal: [],
    cores: [
    { id: "STATIS", title: "Listrik statis" },
    { id: "C1", title: "Arus dan rangkaian" },
    { id: "SERI_PARALEL", title: "Rangkaian seri dan paralel" },
    { id: "DAYA", title: "Energi dan daya listrik" },
    { id: "C2", title: "Magnet & pembangkit listrik" },
    { id: "ALTERNATIF", title: "Sumber energi alternatif", capstone: true },
    ],
    edges: [["C1", "SERI_PARALEL", "S"], ["STATIS", "C1", "S"], ["C1", "DAYA", "S"], ["DAYA", "ALTERNATIF", "S"], ["C2", "ALTERNATIF", "S"]],
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
  ...BY_GRADE,
];

for (const key of Object.keys(CONTENT)) {
  const [code, id] = key.split(':');
  if (!STRUCTURE.some(t => t.code === code && t.cores.some(c => c.id === id))) throw new Error(`materi untuk inti yang tidak ada: ${key}`);
}
export const PLANNED_TOPICS: PilotTopic[] = STRUCTURE.map(t => ({ ...t, cores: t.cores.map(c => {
  // Inti tersembunyi (Tahap 3 audit Fisika) tidak membawa isi lagi; isinya dipakai ulang oleh inti barunya.
  const key = `${t.code}:${c.id}`, add = c.hidden ? undefined : CONTENT[key];
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
  { from: "FIS.C26.D.TEKANAN", to: "FIS.C26.F.FLUIDA", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Tekanan zat SMP menuju Fluida Statis & Dinamis", decision: 'D9',
    notes: ["Tahap 3 audit Fisika (2026-11-14): tekanan pindah dari D.GERAK ke bab D.TEKANAN, jadi relasi ke Fluida ikut pindah."] },
  { from: "FIS.C26.D.GERAK", to: "FIS.C26.D.TEKANAN", kind: "REQUIRES", label: "Gaya menjadi bekal tekanan (P = F / A)", decision: 'D9',
    evidence: ["Tahap 3 audit Fisika (2026-11-14): tekanan didefinisikan sebagai gaya per luas, jadi bab Gerak dan gaya (kelas 7) menjadi bekal bab Tekanan (kelas 8)"] },
  { from: "FIS.C26.D.SUHU", to: "FIS.C26.F.TERMAL", kind: "REQUIRES", label: "Lintas Fase D ➔ F: Suhu dan kalor SMP menuju Kalor dan termodinamika SMA", decision: 'D9',
    notes: ["Tahap 3 audit Fisika (2026-11-14): suhu dan kalor pindah dari D.ENERGI ke bab D.SUHU, jadi relasi ke F.TERMAL ikut pindah."] },
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
  { from: "FIS.C26.F.MEDAN", to: "FIS.C26.F.ELEKTRO", kind: "REQUIRES", label: "medan magnet → induksi elektromagnetik", decision: 'D9',
    notes: ["Tahap 1 audit Fisika (2026-11-13, docs/backlog.md FE): RELATED jadi REQUIRES: induksi elektromagnetik butuh medan magnet."] },
  { from: "FIS.C26.D.SUHU", to: "FIS.C26.E.IKLIM", kind: "REQUIRES", label: "Lintas Fase D ➔ E: suhu dan perpindahan kalor SMP → efek rumah kaca dan pemanasan global", decision: 'D9',
    evidence: ["Tahap 1 audit Fisika (2026-11-13, docs/backlog.md FE): relasi baru; E.IKLIM mencantumkan kalor dan radiasi sebagai bekal; kalor ada di IPA VII Bab 3 Suhu, Kalor, dan Pemuaian."],
    notes: ["Tahap 3 (2026-11-14): asal relasi pindah dari D.ENERGI ke bab baru D.SUHU."] },
  { from: "FIS.C26.D.ANTARIKSA", to: "FIS.C26.D.KEBUMIAN", kind: "RELATED", label: "Bumi sebagai planet ↔ struktur Bumi", decision: 'D9' },  // pemeriksaan per kelas 12 November 2026
  { from: "MAT.KUA", to: "MAT.C26.FPLUS.POLINOMIAL", kind: "REQUIRES", label: "persamaan kuadrat → polinomial berderajat tinggi", decision: 'D9' },
  { from: "MAT.KUA", to: "MAT.C26.FPLUS.KOMPLEKS", kind: "RELATED", label: "diskriminan negatif → akar kompleks", decision: 'D9' },
  { from: "MAT.MTX", to: "MAT.C26.FPLUS.TRANSFORMASI", kind: "REQUIRES", label: "perkalian matriks → komposisi transformasi", decision: 'D9' },
  { from: "MAT.TRI", to: "MAT.C26.FPLUS.FUNGSI", kind: "REQUIRES", label: "grafik trigonometri → model periodik", decision: 'D9' },
  { from: "MAT.CP25.F.LINGKARAN", to: "MAT.C26.FPLUS.LINGKARAN", kind: "REQUIRES", label: "unsur lingkaran → persamaan lingkaran", decision: 'D9' },
  { from: "MAT.C26.FPLUS.LINGKARAN", to: "MAT.C26.FPLUS.KERUCUT", kind: "RELATED", label: "lingkaran sebagai irisan kerucut", decision: 'D9' },
  { from: "MAT.C26.FPLUS.LIMIT", to: "MAT.KAL", kind: "REQUIRES", label: "limit → turunan sebagai laju sesaat", decision: 'D9' },
  { from: "MAT.KAL", to: "MAT.C26.FPLUS.TURUNAN", kind: "REQUIRES", label: "aturan turunan dasar → aturan rantai dan trigonometri", decision: 'D9' },
  { from: "MAT.KAL", to: "MAT.C26.FPLUS.INTEGRAL", kind: "REQUIRES", label: "integral tentu → luas dan volume benda putar", decision: 'D9' },
  { from: "FIS.C26.E.ENERGI", to: "FIS.C26.E.TERBARUKAN", kind: "REQUIRES", label: "daya dan efisiensi → pembangkit energi terbarukan", decision: 'D9' },
  { from: "FIS.C26.E.TERBARUKAN", to: "FIS.C26.E.IKLIM", kind: "RELATED", label: "energi terbarukan sebagai mitigasi perubahan iklim", decision: 'D9' },
  { from: "KIM.C26.D.PARTIKEL", to: "KIM.C26.D.MATERI", kind: "REQUIRES", label: "teori partikel → klasifikasi dan perubahan materi", decision: 'D9' },
  { from: "KIM.C26.D.ATOM", to: "KIM.C26.E.MODELATOM", kind: "REQUIRES", label: "Lintas Fase D ➔ E: atom dan ion SMP → model atom dan konfigurasi elektron", decision: 'D9' },
  { from: "KIM.C26.E.MODELATOM", to: "KIM.C26.F.STRUKTUR", kind: "REQUIRES", label: "konfigurasi kulit → struktur elektron dan periodisitas", decision: 'D9' },
  { from: "KIM.C26.E.HUKUMDASAR", to: "KIM.C26.E.STOIK", kind: "REQUIRES", label: "hukum dasar kimia → stoikiometri", decision: 'D9' },
  { from: "KIM.C26.F.HIDROKARBON", to: "KIM.C26.F.GUGUS", kind: "REQUIRES", label: "hidrokarbon → senyawa turunan alkana", decision: 'D9' },
  { from: "KIM.C26.F.HIDROKARBON", to: "KIM.C26.F.KARBON", kind: "REQUIRES", label: "rantai karbon → makromolekul", decision: 'D9' },
  { from: "KIM.C26.F.LAJU", to: "KIM.C26.F.TERMOKIMIA", kind: "RELATED", label: "energi aktivasi ↔ diagram energi reaksi", decision: 'D9' },
  { from: "KIM.C26.F.SETIMBANG", to: "KIM.C26.F.ASAMBASA", kind: "REQUIRES", label: "tetapan kesetimbangan → Ka, Kb, dan titrasi", decision: 'D9' },
  { from: "KIM.C26.F.ELEKTROLIT", to: "KIM.C26.F.KOLOID", kind: "RELATED", label: "larutan sejati ↔ sistem koloid", decision: 'D9' },
  { from: "BIO.C26.D.KLASIFIKASI", to: "BIO.C26.E.KLASIFIKASI", kind: "REQUIRES", label: "Lintas Fase D ➔ E: ciri makhluk hidup → takson dan kingdom", decision: 'D9' },
  { from: "BIO.C26.E.KLASIFIKASI", to: "BIO.C26.E.BIODIVERSITAS", kind: "RELATED", label: "klasifikasi ↔ keanekaragaman hayati", decision: 'D9' },
  { from: "BIO.C26.E.EKOSISTEM", to: "BIO.C26.E.LIMBAH", kind: "REQUIRES", label: "keseimbangan ekosistem → pencemaran dan limbah", decision: 'D9' },
  { from: "BIO.C26.F.SEL", to: "BIO.C26.F.TUMBUHAN", kind: "REQUIRES", label: "sel dan transpor membran → jaringan dan transpor tumbuhan", decision: 'D9' },
  { from: "BIO.C26.F.SEL", to: "BIO.C26.F.GERAK", kind: "REQUIRES", label: "sel dan jaringan → sistem gerak", decision: 'D9' },
  { from: "BIO.C26.F.ORGAN", to: "BIO.C26.F.IMUN", kind: "RELATED", label: "sistem sirkulasi ↔ sistem pertahanan tubuh", decision: 'D9' },
  { from: "BIO.C26.F.GENETIKA", to: "BIO.C26.F.HEREDITAS", kind: "REQUIRES", label: "pola pewarisan Mendel → penyimpangan dan pautan", decision: 'D9' },
  { from: "BIO.C26.F.GENETIKA", to: "BIO.C26.F.MUTASI", kind: "REQUIRES", label: "DNA dan kromosom → mutasi", decision: 'D9' },
  { from: "BIO.C26.F.MUTASI", to: "BIO.C26.F.EVOLUSI", kind: "REQUIRES", label: "mutasi sebagai sumber variasi → evolusi", decision: 'D9' },
];
