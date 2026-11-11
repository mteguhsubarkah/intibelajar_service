import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Kimia/IPA SMP (Fase D) untuk inti PLANNED dari audit kesenjangan materi (prioritas 1).
// Kunci = "KODE_TOPIK:ID_INTI" di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): Content => ({ slides, q, min });

export const SMP_KIM: Record<string, Content> = {
  // ---------- Klasifikasi dan sifat materi ----------
  'KIM.C26.D.MATERI:C1': K([
    S('Zat tunggal: unsur dan senyawa', ['**Unsur** adalah zat tunggal yang tidak dapat diuraikan lagi secara kimia, misalnya besi (Fe) dan oksigen (O₂).', '**Senyawa** adalah gabungan dua unsur atau lebih dengan perbandingan tetap, misalnya air (H₂O) dan garam dapur (NaCl). Sifat senyawa berbeda dari sifat unsur penyusunnya.'], [['air', 'H₂O'], ['garam dapur', 'NaCl']]),
    S('Campuran', ['Campuran tersusun dari beberapa zat tanpa perbandingan tetap, dan sifat zat penyusunnya masih ada.', '**Homogen**: tampak menyatu (larutan gula, udara). **Heterogen**: komponennya masih terlihat (pasir dan air, salad buah).'], [['campuran', 'komposisi berubah-ubah']], 'Rumus kimianya tetap → senyawa. Komposisinya bisa berubah-ubah → campuran.'),
  ], [
    Q('Kelompok zat berikut yang semuanya unsur adalah …', ['besi, oksigen, emas', 'air, garam, gula', 'udara, sirup, besi', 'emas, air, tembaga'], 0, 'Besi, oksigen, dan emas tidak dapat diuraikan lagi. Air, garam, dan gula adalah senyawa; udara dan sirup campuran.', 1),
    Q('Air laut tergolong …', ['unsur', 'senyawa', 'campuran homogen', 'campuran heterogen'], 2, 'Air laut berisi air dan berbagai garam terlarut tanpa perbandingan tetap, dan tampak menyatu.'),
    Q('Ciri senyawa adalah …', ['sifatnya sama dengan unsur penyusunnya', 'tersusun dari unsur-unsur dengan perbandingan tetap', 'dapat dipisahkan dengan penyaringan', 'komposisinya berubah-ubah'], 1, 'Senyawa selalu tersusun dengan perbandingan tetap dan sifatnya baru, berbeda dari unsur penyusunnya.'),
  ], 4),
  'KIM.C26.D.MATERI:C2': K([
    S('Perubahan fisika', ['Perubahan fisika tidak menghasilkan zat baru; biasanya hanya bentuk, ukuran, atau wujudnya yang berubah.', 'Contoh: es mencair, kertas digunting, gula larut dalam air, lilin meleleh.'], [['perubahan fisika', 'tidak ada zat baru']]),
    S('Perubahan kimia', ['Perubahan kimia menghasilkan zat baru dengan sifat berbeda: kayu terbakar, besi berkarat, nasi basi, kue dipanggang.', 'Sifat kimia, seperti mudah terbakar atau mudah berkarat, terlihat saat zat berubah menjadi zat lain.'], [['perubahan kimia', 'terbentuk zat baru']], 'Tanyakan: apakah terbentuk zat baru? Jika ya, itu perubahan kimia.'),
  ], [
    Q('Contoh perubahan kimia adalah …', ['es mencair', 'besi berkarat', 'kertas dilipat', 'air menguap'], 1, 'Karat adalah zat baru (besi oksida). Pilihan lain hanya mengubah bentuk atau wujud.', 1),
    Q('Contoh perubahan fisika adalah …', ['kayu terbakar', 'susu menjadi yoghurt', 'lilin meleleh', 'nasi menjadi basi'], 2, 'Lilin yang meleleh hanya berubah wujud; lilin cair tetap lilin.'),
    Q('Sifat "mudah terbakar" merupakan …', ['sifat fisika', 'sifat kimia', 'perubahan fisika', 'campuran'], 1, 'Mudah terbakar adalah kemampuan suatu zat berubah menjadi zat baru, jadi termasuk sifat kimia.'),
  ], 4),
  'KIM.C26.D.MATERI:PEMISAHAN': K([
    S('Penyaringan, penguapan, penyulingan', ['**Penyaringan (filtrasi)**: memisahkan padatan yang tidak larut dari cairan (pasir dari air).', '**Penguapan (evaporasi)**: mengambil zat padat terlarut dari pelarutnya (garam dari air laut). **Penyulingan (distilasi)**: memisahkan cairan berdasarkan titik didih (air suling, minyak atsiri).'], [['distilasi', 'berdasarkan titik didih']]),
    S('Kromatografi, sublimasi, magnet', ['**Kromatografi** memisahkan zat warna berdasarkan kecepatan meresap (tinta, klorofil).', '**Sublimasi** untuk zat yang dapat menyublim (kapur barus, iodin). **Magnet** untuk memisahkan logam besi dari campuran.'], [['kromatografi', 'berdasarkan kecepatan meresap']], 'Pilih metode dari perbedaan sifat: ukuran partikel, titik didih, kelarutan, atau daya tarik magnet.'),
  ], [
    Q('Petani garam memperoleh garam dari air laut dengan cara …', ['penyaringan', 'penguapan', 'sublimasi', 'kromatografi'], 1, 'Air laut dijemur sampai airnya menguap dan garamnya tertinggal.', 1),
    Q('Cara paling tepat untuk memisahkan zat-zat warna pada tinta spidol adalah …', ['distilasi', 'kromatografi', 'magnet', 'filtrasi'], 1, 'Zat warna yang berbeda meresap dengan kecepatan berbeda pada kertas, sehingga terpisah.'),
    Q('Pembuatan air suling (akuades) memanfaatkan perbedaan …', ['ukuran partikel', 'titik didih', 'warna', 'kemagnetan'], 1, 'Air diuapkan lalu diembunkan kembali, sedangkan zat terlarut dengan titik didih lebih tinggi tertinggal.'),
  ]),
  // ---------- Zat aditif dan adiktif ----------
  'KIM.C26.D.ZAT:C1': K([
    S('Jenis zat aditif', ['Zat aditif ditambahkan ke makanan untuk memperbaiki rasa, warna, aroma, atau daya tahan.', 'Contoh: pemanis (gula, aspartam), pewarna (kunyit, daun suji), pengawet (natrium benzoat), penyedap (MSG), dan pengemulsi (lesitin).'], [['pewarna alami', 'kunyit, daun suji']]),
    S('Membaca label dengan cermat', ['Zat aditif sintetis harus dipakai sesuai batas aman BPOM.', 'Formalin, boraks, serta pewarna tekstil seperti rhodamin B dan metanil yellow dilarang untuk makanan. Periksa label komposisi dan nomor izin BPOM.'], [['dilarang untuk makanan', 'formalin, boraks, rhodamin B']], 'Zat aditif alami umumnya lebih aman, tetapi semua tetap perlu takaran yang wajar.'),
  ], [
    Q('Daun suji pada kue berfungsi sebagai …', ['pengawet', 'pewarna alami', 'pemanis', 'pengental'], 1, 'Daun suji memberi warna hijau alami pada makanan.', 1),
    Q('Zat yang dilarang ditambahkan ke makanan adalah …', ['natrium benzoat sesuai takaran', 'formalin', 'gula', 'garam'], 1, 'Formalin adalah pengawet mayat dan berbahaya bagi tubuh, sehingga dilarang untuk makanan.', 1),
    Q('Fungsi pengawet pada makanan kemasan adalah …', ['menambah warna', 'menghambat pertumbuhan mikroorganisme', 'menambah rasa manis', 'membuat makanan lebih kental'], 1, 'Pengawet memperlambat pembusukan oleh bakteri dan jamur sehingga makanan lebih tahan lama.'),
  ], 4),
  'KIM.C26.D.ZAT:C2': K([
    S('Apa itu zat adiktif', ['Zat adiktif menimbulkan ketergantungan (kecanduan), misalnya kafein (kopi, teh), nikotin (rokok), dan alkohol.', 'Psikotropika dan narkotika memengaruhi sistem saraf; penggunaannya hanya boleh dengan resep dokter untuk pengobatan.'], [['zat adiktif', 'menimbulkan ketergantungan']]),
    S('Dampak dan keputusan sehat', ['Nikotin dan tar dalam rokok merusak paru-paru dan pembuluh darah; narkoba merusak otak dan hubungan sosial.', 'Keputusan sehat: berani menolak, mencari informasi dari sumber tepercaya, dan meminta bantuan orang dewasa atau tenaga kesehatan.'], [['rokok', 'nikotin + tar']], 'Kecanduan membuat seseorang sulit berhenti walaupun tahu dampaknya. Lebih mudah untuk tidak memulai.'),
  ], [
    Q('Zat adiktif yang terdapat dalam rokok adalah …', ['kafein', 'nikotin', 'aspartam', 'lesitin'], 1, 'Nikotin adalah zat adiktif utama dalam tembakau.', 1),
    Q('Ciri utama zat adiktif adalah …', ['memberi warna pada makanan', 'menimbulkan ketergantungan', 'mengawetkan makanan', 'menambah gizi'], 1, 'Zat adiktif membuat pemakainya ingin terus menggunakannya (kecanduan).', 1),
    Q('Seorang teman menawarkan rokok elektrik kepadamu. Sikap yang paling tepat adalah …', ['mencoba sekali saja', 'menolak dengan tegas dan menjelaskan alasannya', 'menyimpannya untuk nanti', 'membelinya agar dianggap keren'], 1, 'Rokok elektrik juga mengandung nikotin yang adiktif. Menolak dengan tegas melindungi kesehatanmu.'),
  ], 4),
  // ---------- Reaksi kimia dan asam–basa dasar ----------
  'KIM.C26.D.REAKSI:C1': K([
    S('Tanda reaksi kimia', ['Reaksi kimia menghasilkan zat baru.', 'Tanda-tandanya: perubahan warna, terbentuk gas (gelembung), terbentuk endapan, dan perubahan suhu (menjadi panas atau dingin).'], [['tanda reaksi', 'warna, gas, endapan, suhu']]),
    S('Contoh sehari-hari', ['Tablet vitamin C effervescent dimasukkan ke air → muncul gelembung gas. Apel yang dipotong menjadi cokelat → perubahan warna. Kayu dibakar → panas dan cahaya.'], [['effervescent', 'gelembung gas CO₂']], 'Satu tanda saja belum tentu reaksi kimia; es mencair juga menyerap panas. Pastikan ada zat baru.'),
  ], [
    Q('Tanda terjadinya reaksi kimia adalah …', ['terbentuk gas atau endapan', 'benda berubah ukuran', 'zat berubah wujud saja', 'benda berpindah tempat'], 0, 'Gas atau endapan baru menunjukkan terbentuknya zat baru.', 1),
    Q('Cuka dicampur dengan soda kue lalu muncul banyak gelembung. Gelembung itu menunjukkan …', ['terbentuk gas baru', 'air mendidih', 'soda kue mencair', 'terjadi penguapan'], 0, 'Cuka (asam) bereaksi dengan soda kue menghasilkan gas karbon dioksida.', 1),
    Q('Dua larutan dicampur, lalu terbentuk padatan yang tidak larut di dasar tabung. Padatan itu disebut …', ['endapan', 'larutan', 'pelarut', 'katalis'], 0, 'Padatan tak larut yang terbentuk dari reaksi dua larutan disebut endapan.'),
  ], 4),
  'KIM.C26.D.REAKSI:MASSA': K([
    S('Hukum Lavoisier', ['Dalam sistem tertutup, massa zat sebelum reaksi sama dengan massa zat sesudah reaksi.', 'Atom-atom hanya tersusun ulang menjadi zat baru; tidak ada atom yang hilang atau bertambah.'], [['hukum kekekalan massa', 'massa sebelum = massa sesudah']]),
    S('Bagaimana dengan sistem terbuka?', ['Kayu yang dibakar di udara terbuka tampak lebih ringan karena gas CO₂ dan uap air lepas ke udara.', 'Jika semua gas itu ditampung (sistem tertutup), massa totalnya tetap sama.'], [['sistem terbuka', 'gas dapat keluar']], 'Massa yang tampak "hilang" biasanya berupa gas yang keluar dari wadah.'),
  ], [
    Q('Dalam wadah tertutup, 10 g zat A bereaksi tepat dengan 6 g zat B. Massa hasil reaksinya adalah …', ['4 g', '10 g', '16 g', '60 g'], 2, 'Massa sebelum = massa sesudah: 10 + 6 = 16 g.', 1),
    Q('Kertas dibakar di udara terbuka dan abunya lebih ringan daripada kertas semula karena …', ['massanya musnah', 'sebagian zat berubah menjadi gas yang lepas ke udara', 'abu lebih padat', 'hukum kekekalan massa tidak berlaku'], 1, 'Massa tidak hilang; sebagian berubah menjadi gas yang keluar dari sistem terbuka.'),
    Q('Belerang sebanyak 32 g bereaksi dengan besi menghasilkan 88 g besi(II) sulfida. Massa besi yang bereaksi adalah …', ['56 g', '120 g', '32 g', '88 g'], 0, 'Massa besi = massa hasil − massa belerang = 88 − 32 = 56 g.'),
  ]),
  'KIM.C26.D.REAKSI:PERSAMAAN': K([
    S('Membaca persamaan reaksi', ['Pereaksi ditulis di kiri tanda panah, hasil reaksi di kanan. C + O₂ → CO₂ berarti karbon bereaksi dengan oksigen menghasilkan karbon dioksida.', 'Wujud zat ditulis dalam kurung: (s) padat, (l) cair, (g) gas, (aq) larutan.'], [['pereaksi → hasil reaksi', 'C + O₂ → CO₂']]),
    S('Menyetarakan persamaan reaksi', ['Jumlah setiap jenis atom di ruas kiri harus sama dengan di ruas kanan, sesuai hukum kekekalan massa.', 'Ubah koefisien di depan rumus, bukan angka kecil di dalam rumus: H₂ + O₂ → H₂O disetarakan menjadi 2H₂ + O₂ → 2H₂O.'], [['setara', 'atom kiri = atom kanan']], 'Hitung atom satu per satu. Pada 2H₂ + O₂ → 2H₂O: H kiri 4 = H kanan 4; O kiri 2 = O kanan 2.'),
  ], [
    Q('Pada reaksi Zn + 2HCl → ZnCl₂ + H₂, zat yang merupakan hasil reaksi adalah …', ['Zn dan HCl', 'ZnCl₂ dan H₂', 'Zn dan H₂', 'HCl dan ZnCl₂'], 1, 'Hasil reaksi ditulis di sebelah kanan tanda panah.', 1),
    Q('Persamaan setara untuk reaksi N₂ + H₂ → NH₃ adalah …', ['N₂ + H₂ → 2NH₃', 'N₂ + 3H₂ → 2NH₃', 'N₂ + 3H₂ → NH₃', '2N₂ + H₂ → 2NH₃'], 1, 'N: 2 = 2 × 1; H: 3 × 2 = 6 = 2 × 3. Jadi N₂ + 3H₂ → 2NH₃.'),
    Q('Pada persamaan 2H₂ + O₂ → 2H₂O, jumlah atom H di ruas kanan adalah …', ['2', '4', '1', '6'], 1, '2H₂O berarti 2 molekul air, masing-masing 2 atom H, jadi 4 atom H.'),
  ]),
  'KIM.C26.D.REAKSI:ASAMBASA': K([
    S('Sifat asam, basa, dan netral', ['**Asam**: rasa masam, pH < 7, memerahkan lakmus biru (cuka, air jeruk). **Basa**: rasa pahit dan licin, pH > 7, membirukan lakmus merah (sabun, air kapur).', '**Netral**: pH = 7 (air murni, larutan garam dapur).'], [['asam', 'pH < 7'], ['basa', 'pH > 7'], ['netral', 'pH = 7']]),
    S('Indikator', ['Indikator menunjukkan sifat larutan melalui perubahan warna: kertas lakmus, indikator universal, dan indikator alami seperti kunyit, kubis ungu, dan bunga sepatu.', 'Ekstrak kubis ungu menjadi kemerahan dalam asam dan kehijauan dalam basa.'], [['lakmus biru', 'menjadi merah dalam asam'], ['lakmus merah', 'menjadi biru dalam basa']], 'Jangan mencicipi larutan untuk menguji sifatnya; gunakan indikator.'),
  ], [
    Q('Larutan yang mengubah kertas lakmus biru menjadi merah bersifat …', ['asam', 'basa', 'netral', 'garam'], 0, 'Asam memerahkan lakmus biru.', 1),
    Q('Larutan dengan pH 12 bersifat …', ['asam kuat', 'basa', 'netral', 'asam lemah'], 1, 'pH lebih dari 7 menunjukkan larutan bersifat basa.', 1),
    Q('Air sabun ditetesi ekstrak kubis ungu. Warna yang kemungkinan muncul adalah …', ['merah', 'hijau', 'tetap ungu', 'tidak berwarna'], 1, 'Air sabun bersifat basa, dan ekstrak kubis ungu berubah kehijauan dalam basa.'),
  ]),
};
