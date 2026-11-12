import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Kimia untuk bab yang belum ada di katalog menurut pemeriksaan per kelas 12 November 2026:
// IPA SMP (wujud zat, atom-ion-molekul), IPA kelas X (hukum dasar kimia, kimia hijau, model atom), Kimia XI (hidrokarbon,
// laju reaksi), dan Kimia XII (koloid, asam-basa, gugus fungsi). Kunci = "KODE_TOPIK:ID_INTI" di planned.ts.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 4): Content => ({ slides, q, min });

export const KIMIA_LENGKAP: Record<string, Content> = {
  // ---------- Wujud zat dan teori partikel (kelas 7) ----------
  'KIM.C26.D.PARTIKEL:C1': K([
    S('Tiga wujud zat', ['Zat tersusun atas partikel yang selalu bergerak. Pada **zat padat** partikelnya rapat dan teratur, hanya bergetar di tempat; bentuk dan volumenya tetap.', 'Pada **zat cair** partikel berdekatan tetapi dapat bergeser, sehingga volumenya tetap dan bentuknya mengikuti wadah. Pada **gas** partikel berjauhan dan bergerak bebas, sehingga bentuk dan volumenya mengikuti wadah.']),
    S('Gaya tarik antarpartikel', ['Gaya tarik antarpartikel paling kuat pada zat padat dan paling lemah pada gas.', 'Karena jarak partikelnya besar, gas mudah dimampatkan, sedangkan zat cair dan padat hampir tidak bisa dimampatkan.'], undefined, 'Bau parfum menyebar ke seluruh ruangan karena partikel gas bergerak bebas.'),
  ], [
    Q('Zat yang bentuknya berubah sesuai wadah tetapi volumenya tetap adalah zat …', ['cair', 'padat', 'gas', 'plasma'], 0, 'Partikel zat cair dapat bergeser tetapi tetap berdekatan, sehingga volumenya tidak berubah.', 1),
    Q('Gas mudah dimampatkan karena …', ['jarak antarpartikelnya besar', 'partikelnya tidak bergerak', 'gaya tarik antarpartikelnya paling kuat', 'partikelnya tersusun teratur'], 0, 'Ruang kosong di antara partikel gas banyak, sehingga partikel bisa didorong saling mendekat.'),
    Q('Pernyataan yang benar tentang partikel zat padat adalah …', ['tersusun rapat dan hanya bergetar di tempatnya', 'bergerak bebas ke segala arah', 'berjauhan satu sama lain', 'tidak memiliki gaya tarik'], 0, 'Gaya tarik yang kuat menahan partikel padat di posisinya, sehingga partikel hanya bergetar.', 1),
  ]),
  'KIM.C26.D.PARTIKEL:C2': K([
    S('Enam perubahan wujud', ['**Mencair** (padat → cair) dan **menguap** (cair → gas) memerlukan kalor. **Membeku** (cair → padat) dan **mengembun** (gas → cair) melepaskan kalor.', '**Menyublim** (padat → gas langsung) memerlukan kalor, sedangkan **mengkristal** atau deposisi (gas → padat) melepaskan kalor.']),
    S('Contoh sehari-hari', ['Kapur barus yang mengecil di lemari adalah peristiwa menyublim. Embun pada gelas berisi es adalah uap air yang mengembun.', 'Selama mencair atau mendidih, suhu zat murni tetap walaupun kalor terus diberikan.'], undefined, 'Perubahan wujud adalah perubahan fisika: zatnya tetap sama.'),
  ], [
    Q('Butiran air di luar gelas berisi es terbentuk karena peristiwa …', ['pengembunan uap air dari udara', 'penguapan air dari dalam gelas', 'pembekuan air', 'penyubliman es'], 0, 'Uap air di udara mendingin saat menyentuh permukaan gelas yang dingin, lalu berubah menjadi cair.', 1),
    Q('Perubahan wujud berikut yang melepaskan kalor adalah …', ['membeku', 'mencair', 'menguap', 'menyublim'], 0, 'Saat membeku, partikel melepas energi sehingga dapat tersusun lebih rapat.'),
    Q('Kapur barus di lemari lama-kelamaan habis tanpa meninggalkan cairan. Peristiwa ini adalah …', ['menyublim', 'mencair', 'membeku', 'mengembun'], 0, 'Kapur barus berubah langsung dari padat menjadi gas tanpa melewati wujud cair.', 1),
  ]),
  'KIM.C26.D.PARTIKEL:MASSAJENIS': K([
    S('Pengertian massa jenis', ['**Massa jenis** (ρ) adalah massa zat per satuan volume: ρ = m/V. Satuannya kg/m³ atau g/cm³ (1 g/cm³ = 1.000 kg/m³).', 'Massa jenis air sekitar 1 g/cm³. Massa jenis adalah ciri khas suatu zat murni.'], [['massa jenis', 'ρ = m / V']]),
    S('Terapung dan tenggelam', ['Benda yang massa jenisnya lebih kecil daripada zat cair akan **terapung**; yang lebih besar akan **tenggelam**.', 'Volume benda tak beraturan dapat diukur dengan gelas ukur, yaitu dari selisih tinggi permukaan air sebelum dan sesudah benda dimasukkan.'], undefined, 'Satu kilogram kapas dan satu kilogram besi sama berat, tetapi volume kapas jauh lebih besar.'),
  ], [
    Q('Sebuah balok bermassa 270 g bervolume 100 cm³. Massa jenisnya adalah …', ['2,7 g/cm³', '27 g/cm³', '0,37 g/cm³', '270 g/cm³'], 0, 'ρ = 270 g / 100 cm³ = 2,7 g/cm³, yaitu massa jenis aluminium.', 1),
    Q('Batu dimasukkan ke gelas ukur sehingga permukaan air naik dari 50 mL ke 70 mL. Jika massa batu 60 g, massa jenisnya adalah …', ['3 g/cm³', '0,86 g/cm³', '1,2 g/cm³', '30 g/cm³'], 0, 'Volume batu 70 − 50 = 20 mL = 20 cm³, sehingga ρ = 60/20 = 3 g/cm³.'),
    Q('Minyak (ρ = 0,8 g/cm³) dituang ke dalam air (ρ = 1 g/cm³). Yang terjadi adalah …', ['minyak berada di atas air', 'minyak tenggelam ke dasar', 'minyak bercampur rata dengan air', 'air berada di atas minyak'], 0, 'Massa jenis minyak lebih kecil daripada air, sehingga minyak terapung di permukaan.', 1),
  ]),
  // ---------- Atom, ion, dan molekul (kelas 9) ----------
  'KIM.C26.D.ATOM:C1': K([
    S('Partikel subatom', ['**Atom** adalah partikel terkecil unsur yang masih memiliki sifat unsur itu. Inti atom berisi **proton** (bermuatan positif) dan **neutron** (tidak bermuatan); **elektron** (bermuatan negatif) bergerak mengelilingi inti.', 'Atom netral memiliki jumlah proton sama dengan jumlah elektron.'], [['atom netral', 'proton = elektron']]),
    S('Nomor atom dan nomor massa', ['**Nomor atom** = jumlah proton; **nomor massa** = jumlah proton + neutron. Contoh: atom natrium memiliki 11 proton dan 12 neutron, jadi nomor massanya 23.', 'Jumlah neutron = nomor massa − nomor atom.'], [['neutron', 'nomor massa − nomor atom']], 'Jumlah protonlah yang menentukan jenis unsur.'),
  ], [
    Q('Partikel subatom yang bermuatan negatif adalah …', ['elektron', 'proton', 'neutron', 'inti atom'], 0, 'Elektron bermuatan negatif, proton positif, dan neutron netral.', 1),
    Q('Atom karbon memiliki nomor atom 6 dan nomor massa 14. Jumlah neutronnya adalah …', ['8', '6', '14', '20'], 0, 'Neutron = 14 − 6 = 8.'),
    Q('Atom netral oksigen memiliki 8 proton. Jumlah elektronnya adalah …', ['8', '16', '0', '4'], 0, 'Pada atom netral, jumlah elektron sama dengan jumlah proton.', 1),
  ]),
  'KIM.C26.D.ATOM:C2': K([
    S('Ion', ['**Ion** terbentuk ketika atom melepas atau menerima elektron. Atom yang melepas elektron menjadi **kation** (positif), contohnya Na⁺; yang menerima elektron menjadi **anion** (negatif), contohnya Cl⁻.', 'Garam dapur (NaCl) tersusun atas ion Na⁺ dan Cl⁻.'], [['kation', 'melepas elektron → +'], ['anion', 'menerima elektron → −']]),
    S('Molekul', ['**Molekul** adalah gabungan dua atom atau lebih. **Molekul unsur** tersusun dari atom sejenis (O₂, N₂), sedangkan **molekul senyawa** dari atom berbeda (H₂O, CO₂).', 'Angka kecil di bawah lambang menunjukkan jumlah atomnya: H₂O terdiri atas 2 atom H dan 1 atom O.'], undefined, 'Muatan ion ditulis di kanan atas lambang, misalnya Mg²⁺.'),
  ], [
    Q('Atom magnesium melepas 2 elektron. Ion yang terbentuk adalah …', ['Mg²⁺', 'Mg²⁻', 'Mg⁺', 'Mg'], 0, 'Melepas dua elektron membuat proton lebih banyak dua, sehingga muatannya +2.', 1),
    Q('Yang termasuk molekul unsur adalah …', ['O₂', 'H₂O', 'CO₂', 'NaCl'], 0, 'O₂ tersusun dari dua atom yang sejenis, yaitu oksigen.'),
    Q('Jumlah atom dalam satu molekul glukosa C₆H₁₂O₆ adalah …', ['24', '3', '18', '12'], 0, '6 atom C + 12 atom H + 6 atom O = 24 atom.'),
  ]),
  'KIM.C26.D.ATOM:UNSUR': K([
    S('Lambang unsur', ['Setiap unsur memiliki **lambang** satu atau dua huruf dengan huruf pertama kapital. Contoh: H (hidrogen), O (oksigen), Fe (besi, dari ferrum), Na (natrium).', 'Unsur dikelompokkan menjadi **logam** (mengilap, menghantar listrik), **nonlogam**, dan **metaloid** yang sifatnya di antara keduanya, seperti silikon.']),
    S('Tabel periodik', ['Pada **tabel periodik**, unsur diurutkan berdasarkan nomor atom. Baris disebut **periode**; kolom disebut **golongan**.', 'Unsur dalam satu golongan memiliki sifat kimia yang mirip, misalnya natrium dan kalium sama-sama logam yang sangat reaktif.'], undefined, 'Co (kobalt) adalah unsur, sedangkan CO (karbon monoksida) adalah senyawa.'),
  ], [
    Q('Lambang unsur besi adalah …', ['Fe', 'Be', 'B', 'Ir'], 0, 'Lambang besi berasal dari nama Latinnya, ferrum.', 1),
    Q('Unsur berikut yang termasuk logam adalah …', ['tembaga (Cu)', 'belerang (S)', 'oksigen (O)', 'karbon (C)'], 0, 'Tembaga mengilap dan menghantarkan listrik serta panas dengan baik, ciri khas logam.', 1),
    Q('Natrium dan kalium terletak dalam satu golongan. Hal ini berarti keduanya …', ['memiliki sifat kimia yang mirip', 'memiliki nomor atom yang sama', 'merupakan nonlogam', 'memiliki massa yang sama'], 0, 'Unsur dalam satu golongan menunjukkan sifat kimia yang mirip, misalnya sama-sama bereaksi hebat dengan air.'),
  ]),
  // ---------- Hukum dasar kimia (kelas 10) ----------
  'KIM.C26.E.HUKUMDASAR:C1': K([
    S('Isi hukum Lavoisier', ['**Antoine Lavoisier**: dalam sistem tertutup, massa zat sebelum reaksi sama dengan massa zat sesudah reaksi.', 'Contoh: 12 g karbon yang terbakar sempurna dengan 32 g oksigen menghasilkan 44 g CO₂.'], [['Lavoisier', 'massa pereaksi = massa hasil']]),
    S('Sistem terbuka', ['Jika gas hasil reaksi keluar ke udara (sistem terbuka), massa yang tertimbang berkurang, padahal massa total tetap.', 'Sebaliknya, besi yang berkarat menjadi lebih berat karena mengikat oksigen dari udara.'], undefined, 'Hukum ini menjadi dasar penyetaraan reaksi: jumlah atom tiap unsur di ruas kiri dan kanan sama.'),
  ], [
    Q('Sebanyak 5,6 g besi bereaksi tepat dengan 3,2 g belerang dalam sistem tertutup. Massa besi sulfida yang terbentuk adalah …', ['8,8 g', '2,4 g', '5,6 g', '17,9 g'], 0, 'Menurut hukum kekekalan massa, 5,6 + 3,2 = 8,8 g.', 1),
    Q('Kertas dibakar di udara terbuka sehingga abunya lebih ringan daripada kertas semula. Penjelasan yang tepat adalah …', ['sebagian hasil reaksi berupa gas yang keluar ke udara', 'massa hilang selama reaksi', 'hukum kekekalan massa tidak berlaku', 'abu lebih padat'], 0, 'CO₂ dan uap air hasil pembakaran keluar dari sistem, sehingga massa total tetap tetapi tidak ikut tertimbang.'),
    Q('Logam magnesium 2,4 g dibakar dan menghasilkan 4,0 g magnesium oksida. Massa oksigen yang bereaksi adalah …', ['1,6 g', '6,4 g', '4,0 g', '2,4 g'], 0, 'Massa oksigen = 4,0 − 2,4 = 1,6 g.'),
  ]),
  'KIM.C26.E.HUKUMDASAR:C2': K([
    S('Isi hukum Proust', ['**Joseph Proust**: perbandingan massa unsur-unsur dalam suatu senyawa selalu tetap, dari mana pun asal senyawa itu.', 'Contoh: air selalu mengandung hidrogen dan oksigen dengan perbandingan massa 1 : 8.'], [['air', 'H : O = 1 : 8']]),
    S('Menghitung dengan perbandingan', ['Jika 4 g hidrogen direaksikan dengan 40 g oksigen, yang bereaksi hanya 4 g H dengan 32 g O, menghasilkan 36 g air.', 'Sisa 8 g oksigen tidak bereaksi. Unsur yang habis lebih dulu menentukan jumlah hasil.'], undefined, 'Perbandingan massa dalam senyawa dapat dihitung dari Ar: dalam H₂O, (2 × 1) : 16 = 1 : 8.'),
  ], [
    Q('Perbandingan massa C : O dalam CO₂ adalah 3 : 8. Massa oksigen yang diperlukan untuk bereaksi dengan 9 g karbon adalah …', ['24 g', '8 g', '33 g', '12 g'], 0, '9 g karbon setara 3 × 3 g, sehingga oksigen yang dibutuhkan 3 × 8 = 24 g.'),
    Q('Sebanyak 10 g hidrogen direaksikan dengan 64 g oksigen membentuk air (H : O = 1 : 8). Zat yang bersisa dan massanya adalah …', ['hidrogen, 2 g', 'oksigen, 16 g', 'hidrogen, 8 g', 'tidak ada yang bersisa'], 0, '64 g oksigen hanya membutuhkan 8 g hidrogen, sehingga hidrogen bersisa 10 − 8 = 2 g.', 3),
    Q('Hukum Proust menyatakan bahwa …', ['perbandingan massa unsur dalam suatu senyawa selalu tetap', 'massa sebelum dan sesudah reaksi sama', 'volume gas sebanding dengan jumlah molekul', 'dua unsur dapat membentuk lebih dari satu senyawa'], 0, 'Pilihan lain berturut-turut adalah hukum Lavoisier, hipotesis Avogadro, dan dasar hukum Dalton.', 1),
  ]),
  'KIM.C26.E.HUKUMDASAR:BERGANDA': K([
    S('Satu pasang unsur, beberapa senyawa', ['Dua unsur dapat membentuk lebih dari satu senyawa, misalnya karbon dan oksigen membentuk CO dan CO₂.', '**John Dalton**: jika massa salah satu unsur dibuat tetap, perbandingan massa unsur lainnya dalam senyawa-senyawa itu merupakan **bilangan bulat sederhana**.']),
    S('Contoh CO dan CO₂', ['Untuk 12 g karbon: CO mengandung 16 g oksigen, sedangkan CO₂ mengandung 32 g oksigen.', 'Perbandingan oksigen pada CO : CO₂ = 16 : 32 = 1 : 2, yaitu bilangan bulat sederhana.'], [['O pada CO : CO₂', '1 : 2']], 'Samakan dulu massa salah satu unsur sebelum membandingkan unsur yang lain.'),
  ], [
    Q('Nitrogen dan oksigen membentuk NO dan NO₂. Untuk massa nitrogen yang sama, perbandingan massa oksigen NO : NO₂ adalah …', ['1 : 2', '2 : 1', '1 : 1', '7 : 8'], 0, 'NO memiliki satu atom O dan NO₂ dua atom O untuk setiap atom N, sehingga perbandingannya 1 : 2.', 1),
    Q('Belerang membentuk dua oksida. Oksida I mengandung 50% S, oksida II mengandung 40% S. Untuk massa belerang yang sama, perbandingan massa oksigen I : II adalah …', ['2 : 3', '1 : 2', '3 : 2', '4 : 5'], 0, 'Oksida I: 50 g O per 50 g S (1 : 1). Oksida II: 60 g O per 40 g S (1,5 : 1). Perbandingan oksigennya 1 : 1,5 = 2 : 3, sesuai SO₂ dan SO₃.', 3),
    Q('Hukum perbandingan berganda berlaku untuk pasangan senyawa …', ['H₂O dan H₂O₂', 'NaCl dan KCl', 'H₂O dan CO₂', 'CH₄ dan NH₃'], 0, 'H₂O dan H₂O₂ dibentuk oleh dua unsur yang sama, yaitu hidrogen dan oksigen.'),
  ]),
  'KIM.C26.E.HUKUMDASAR:VOLUME': K([
    S('Hukum Gay-Lussac', ['Pada suhu dan tekanan yang sama, perbandingan **volume gas** pereaksi dan hasil reaksi merupakan bilangan bulat sederhana yang sama dengan **perbandingan koefisien** reaksinya.', 'Contoh: N₂ + 3H₂ → 2NH₃. Satu liter N₂ bereaksi dengan 3 liter H₂ menghasilkan 2 liter NH₃.'], [['Gay-Lussac', 'V₁ : V₂ = koefisien₁ : koefisien₂']]),
    S('Hipotesis Avogadro', ['**Avogadro**: pada suhu dan tekanan yang sama, gas-gas bervolume sama mengandung jumlah molekul yang sama.', 'Jadi perbandingan volume gas = perbandingan jumlah molekul = perbandingan mol.'], undefined, 'Perbandingan volume hanya berlaku untuk zat berwujud gas.'),
  ], [
    Q('Pada reaksi 2H₂(g) + O₂(g) → 2H₂O(g), volume O₂ yang diperlukan untuk bereaksi dengan 10 L H₂ adalah …', ['5 L', '10 L', '20 L', '2 L'], 0, 'Perbandingan volume H₂ : O₂ = 2 : 1, sehingga O₂ yang diperlukan 10/2 = 5 L.', 1),
    Q('Pada suhu dan tekanan tertentu, 2 L gas N₂ mengandung n molekul. Jumlah molekul dalam 6 L gas CO₂ pada kondisi yang sama adalah …', ['3n', 'n', 'n/3', '6n'], 0, 'Menurut Avogadro, volume tiga kali lipat berisi molekul tiga kali lipat: 3n.'),
    Q('Pada reaksi C₃H₈(g) + 5O₂(g) → 3CO₂(g) + 4H₂O(g), volume CO₂ yang dihasilkan dari 4 L propana adalah …', ['12 L', '3 L', '20 L', '16 L'], 0, 'Perbandingan C₃H₈ : CO₂ = 1 : 3, sehingga 4 L propana menghasilkan 12 L CO₂.'),
  ]),
  // ---------- Kimia hijau (kelas 10) ----------
  'KIM.C26.E.HIJAU:C1': K([
    S('Apa itu kimia hijau', ['**Kimia hijau** adalah cara merancang produk dan proses kimia yang mengurangi atau menghilangkan zat berbahaya. Paul Anastas dan John Warner merumuskan **12 prinsip** kimia hijau.', 'Prinsip pertama dan terpenting adalah **mencegah limbah**: lebih baik tidak menghasilkan limbah daripada mengolahnya setelah terbentuk.']),
    S('Beberapa prinsip lain', ['Contoh prinsip lain: memakai bahan baku terbarukan, memilih pelarut dan bahan yang lebih aman, menghemat energi dengan reaksi pada suhu dan tekanan ruang, serta memakai katalis.', 'Produk sebaiknya dirancang agar mudah terurai setelah dipakai, misalnya plastik biodegradable.'], undefined, 'Prinsip kimia hijau berlaku dari laboratorium sekolah sampai industri.'),
  ], [
    Q('Prinsip kimia hijau yang paling diutamakan adalah …', ['mencegah terbentuknya limbah', 'mengolah limbah setelah terbentuk', 'membuang limbah ke tempat yang jauh', 'mengencerkan limbah'], 0, 'Mencegah lebih baik daripada mengolah: limbah yang tidak terbentuk tidak perlu ditangani.', 1),
    Q('Mengganti pelarut organik beracun dengan air dalam suatu proses adalah contoh prinsip …', ['penggunaan pelarut yang lebih aman', 'penggunaan bahan baku tak terbarukan', 'peningkatan suhu reaksi', 'pembuatan produk yang sulit terurai'], 0, 'Air tidak beracun dan tidak mudah terbakar, sehingga risiko bagi pekerja dan lingkungan berkurang.'),
    Q('Penggunaan katalis enzim pada suhu ruang mendukung kimia hijau karena …', ['menghemat energi dan mengurangi produk samping', 'menaikkan jumlah limbah', 'membutuhkan suhu sangat tinggi', 'membuat reaksi menjadi lebih lambat'], 0, 'Enzim bekerja spesifik pada kondisi ringan, sehingga energi dan limbah samping berkurang.'),
  ]),
  'KIM.C26.E.HIJAU:C2': K([
    S('Pengertian ekonomi atom', ['**Ekonomi atom** mengukur berapa bagian atom pereaksi yang menjadi produk yang diinginkan.', 'Ekonomi atom = (Mr produk yang diinginkan ÷ jumlah Mr semua pereaksi) × 100%.'], [['ekonomi atom', 'Mr produk ÷ Σ Mr pereaksi × 100%']]),
    S('Menilai reaksi', ['Reaksi adisi seperti C₂H₄ + H₂O → C₂H₅OH memiliki ekonomi atom 100% karena semua atom pereaksi masuk ke produk.', 'Reaksi yang menghasilkan banyak produk samping memiliki ekonomi atom rendah dan menghasilkan lebih banyak limbah.'], undefined, 'Rendemen tinggi belum tentu ekonomi atomnya tinggi; keduanya mengukur hal yang berbeda.'),
  ], [
    Q('Reaksi dengan ekonomi atom 100% adalah reaksi yang …', ['seluruh atom pereaksinya menjadi produk yang diinginkan', 'menghasilkan produk samping paling banyak', 'berlangsung paling cepat', 'tidak memerlukan katalis'], 0, 'Tidak ada atom yang terbuang menjadi produk samping.', 1),
    Q('Pada reaksi CaCO₃ → CaO + CO₂ (Mr CaCO₃ = 100, CaO = 56, CO₂ = 44), ekonomi atom untuk produk CaO adalah …', ['56%', '44%', '100%', '78%'], 0, 'Ekonomi atom = 56/100 × 100% = 56%; sisanya terbuang sebagai CO₂.'),
    Q('Etanol dibuat dengan dua cara: (I) C₂H₄ + H₂O → C₂H₅OH, (II) C₂H₅Br + NaOH → C₂H₅OH + NaBr. Cara yang lebih sesuai prinsip kimia hijau adalah …', ['cara I, karena ekonomi atomnya 100%', 'cara II, karena menghasilkan NaBr', 'cara II, karena memakai basa', 'keduanya sama'], 0, 'Pada cara I semua atom pereaksi menjadi etanol, sedangkan cara II membuang NaBr sebagai produk samping.', 3),
  ]),
  'KIM.C26.E.HIJAU:PENERAPAN': K([
    S('Kimia hijau dan SDGs', ['Kimia hijau mendukung **Tujuan Pembangunan Berkelanjutan (SDGs)**, misalnya air bersih, energi bersih, serta konsumsi dan produksi yang bertanggung jawab.', 'Contoh penerapannya: biodiesel dari minyak jelantah, plastik dari pati singkong, dan deterjen yang mudah terurai.']),
    S('Menilai pilihan', ['Saat memilih produk atau proses, nilai limbah yang dihasilkan, sifat bahayanya, sumber bahan baku, dan energi yang diperlukan.', 'Di rumah, prinsipnya juga bisa diterapkan: mengurangi plastik sekali pakai, memilah sampah, dan memakai bahan pembersih secukupnya.'], undefined, 'Daur ulang tetap penting, tetapi mengurangi pemakaian lebih utama.'),
  ], [
    Q('Pembuatan biodiesel dari minyak jelantah sesuai prinsip kimia hijau karena …', ['memanfaatkan limbah sebagai bahan baku terbarukan', 'memakai bahan bakar fosil', 'menghasilkan lebih banyak limbah', 'memerlukan pelarut beracun'], 0, 'Minyak jelantah yang semula limbah diolah menjadi bahan bakar, sehingga limbah berkurang dan bahan bakunya terbarukan.'),
    Q('Plastik dari pati singkong lebih ramah lingkungan karena …', ['mudah terurai dan bahan bakunya terbarukan', 'tidak dapat terurai', 'dibuat dari minyak bumi', 'lebih awet di tempat sampah'], 0, 'Pati berasal dari tanaman yang dapat ditanam ulang, dan plastiknya dapat diuraikan mikroorganisme.', 1),
    Q('Tindakan siswa di sekolah yang paling sesuai dengan prinsip pencegahan limbah adalah …', ['membawa botol minum isi ulang', 'membakar sampah plastik di halaman', 'membuang sisa larutan praktikum ke selokan', 'membeli air dalam botol plastik setiap hari'], 0, 'Botol isi ulang mencegah sampah plastik terbentuk sejak awal; membakar sampah dan membuang larutan ke selokan justru mencemari.'),
  ]),
  // ---------- Perkembangan model atom (kelas 10) ----------
  'KIM.C26.E.MODELATOM:C1': K([
    S('Dalton dan Thomson', ['**Dalton**: atom adalah bola pejal yang tidak dapat dibagi lagi, dan atom unsur yang sama memiliki sifat yang sama.', '**Thomson** menemukan elektron, sehingga atom digambarkan sebagai bola bermuatan positif dengan elektron tersebar di dalamnya, seperti roti kismis.']),
    S('Rutherford', ['Pada percobaan hamburan sinar alfa terhadap lempeng emas tipis, sebagian besar sinar menembus dan hanya sedikit yang dibelokkan atau dipantulkan.', '**Rutherford** menyimpulkan bahwa atom sebagian besar berupa ruang kosong, dengan inti kecil bermuatan positif yang dikelilingi elektron.'], undefined, 'Setiap model atom muncul untuk menjelaskan hasil percobaan yang tidak bisa dijelaskan model sebelumnya.'),
  ], [
    Q('Model atom yang menggambarkan atom seperti roti kismis dikemukakan oleh …', ['Thomson', 'Dalton', 'Rutherford', 'Bohr'], 0, 'Thomson menggambarkan elektron tersebar dalam bola bermuatan positif, mirip kismis dalam roti.', 1),
    Q('Sebagian besar sinar alfa menembus lempeng emas tanpa dibelokkan. Kesimpulan Rutherford dari hasil ini adalah …', ['sebagian besar atom berupa ruang kosong', 'atom adalah bola pejal', 'elektron bermuatan positif', 'inti atom berukuran besar'], 0, 'Jika sinar alfa lewat tanpa hambatan, berarti sebagian besar ruang dalam atom kosong.'),
    Q('Kelemahan model atom Dalton adalah …', ['tidak dapat menjelaskan adanya elektron dan sifat listrik atom', 'tidak menjelaskan bahwa atom penyusun unsur', 'menganggap atom sebagian besar ruang kosong', 'menganggap elektron berada di kulit'], 0, 'Dalton menganggap atom tidak bisa dibagi, padahal kemudian ditemukan elektron, proton, dan neutron.'),
  ]),
  'KIM.C26.E.MODELATOM:C2': K([
    S('Kulit elektron', ['**Bohr**: elektron mengelilingi inti pada lintasan (kulit) tertentu dengan energi tertentu, tanpa memancarkan energi.', 'Kulit diberi nama K, L, M, N, dan seterusnya dari yang terdekat dengan inti. Kulit ke-n menampung paling banyak 2n² elektron.'], [['kapasitas kulit ke-n', '2n²']]),
    S('Loncatan elektron', ['Elektron dapat berpindah ke kulit yang lebih tinggi bila menyerap energi, lalu kembali ke kulit lebih rendah sambil memancarkan cahaya.', 'Inilah sebabnya setiap unsur memancarkan warna nyala yang khas, misalnya natrium berwarna kuning.'], undefined, 'Model Bohr cocok untuk atom hidrogen, tetapi kurang tepat untuk atom berelektron banyak.'),
  ], [
    Q('Jumlah maksimum elektron pada kulit M (n = 3) adalah …', ['18', '8', '9', '32'], 0, '2n² = 2 × 3² = 18 elektron.', 1),
    Q('Elektron memancarkan cahaya ketika …', ['berpindah dari kulit luar ke kulit yang lebih dalam', 'berpindah ke kulit yang lebih luar', 'berhenti bergerak', 'keluar dari inti atom'], 0, 'Kulit dalam berenergi lebih rendah, sehingga selisih energinya dilepas sebagai cahaya.'),
    Q('Warna nyala yang khas pada uji nyala logam dapat dijelaskan oleh model atom …', ['Bohr', 'Dalton', 'Thomson', 'Rutherford'], 0, 'Bohr menjelaskan bahwa energi elektron bertingkat, sehingga cahaya yang dipancarkan memiliki warna tertentu.'),
  ]),
  'KIM.C26.E.MODELATOM:KONFIGURASI': K([
    S('Konfigurasi menurut kulit', ['**Konfigurasi elektron** disusun dengan mengisi kulit K (maksimum 2), lalu L (8), lalu M, dan seterusnya. Untuk unsur bernomor atom 1–20, kulit terluar diisi paling banyak 8 elektron.', 'Contoh: Na (11) = 2, 8, 1; Cl (17) = 2, 8, 7; Ca (20) = 2, 8, 8, 2.'], [['Na (11)', '2, 8, 1'], ['Cl (17)', '2, 8, 7']]),
    S('Elektron valensi', ['**Elektron valensi** adalah elektron di kulit terluar. Jumlahnya menentukan sifat kimia dan golongan unsur.', 'Na memiliki 1 elektron valensi sehingga mudah melepasnya menjadi Na⁺; Cl memiliki 7 sehingga mudah menerima satu elektron menjadi Cl⁻.'], undefined, 'Untuk golongan utama, nomor golongan sama dengan jumlah elektron valensi.'),
  ], [
    Q('Konfigurasi elektron atom magnesium (nomor atom 12) adalah …', ['2, 8, 2', '2, 10', '2, 8, 1, 1', '2, 2, 8'], 0, 'Kulit K diisi 2, kulit L diisi 8, dan sisanya 2 berada di kulit M.', 1),
    Q('Elektron valensi atom belerang (nomor atom 16) adalah …', ['6', '2', '8', '16'], 0, 'Konfigurasinya 2, 8, 6, sehingga kulit terluarnya berisi 6 elektron.'),
    Q('Atom X bernomor atom 19. Ion yang paling mudah dibentuk X adalah …', ['X⁺', 'X⁻', 'X²⁺', 'X²⁻'], 0, 'Konfigurasi 2, 8, 8, 1 memiliki satu elektron valensi yang mudah dilepas, sehingga terbentuk X⁺.', 3),
  ]),
  // ---------- Hidrokarbon (kelas 11) ----------
  'KIM.C26.F.HIDROKARBON:C1': K([
    S('Empat ikatan karbon', ['Atom karbon memiliki **4 elektron valensi**, sehingga dapat membentuk empat ikatan kovalen.', 'Atom karbon dapat berikatan dengan sesama karbon membentuk rantai lurus, bercabang, atau cincin, dengan ikatan tunggal, rangkap dua, atau rangkap tiga.']),
    S('Jenis atom karbon', ['Berdasarkan jumlah atom C lain yang diikat: **C primer** mengikat 1 atom C, **sekunder** 2, **tersier** 3, dan **kuarterner** 4.', 'Contoh: pada 2-metilpropana, CH(CH₃)₃, atom C pusat adalah C tersier, sedangkan tiga gugus CH₃ adalah C primer.'], undefined, 'Kekhasan inilah yang membuat jumlah senyawa karbon sangat banyak.'),
  ], [
    Q('Atom karbon dapat membentuk empat ikatan kovalen karena …', ['memiliki 4 elektron valensi', 'memiliki 4 kulit elektron', 'bernomor atom 4', 'memiliki 4 proton'], 0, 'Karbon (2, 4) membutuhkan 4 elektron lagi untuk stabil, sehingga membentuk 4 pasangan elektron bersama.', 1),
    Q('Pada senyawa CH₃–C(CH₃)₂–CH₃, atom C yang mengikat empat atom C lain disebut atom C …', ['kuarterner', 'primer', 'sekunder', 'tersier'], 0, 'Atom C pusat terikat pada empat gugus CH₃, sehingga disebut C kuarterner.'),
    Q('Jumlah atom C sekunder pada CH₃–CH₂–CH₂–CH₃ adalah …', ['2', '0', '1', '4'], 0, 'Dua atom C di tengah masing-masing mengikat dua atom C lain.', 1),
  ]),
  'KIM.C26.F.HIDROKARBON:C2': K([
    S('Rumus umum', ['**Alkana** (ikatan tunggal, jenuh): CₙH₂ₙ₊₂, contohnya CH₄ dan C₃H₈.', '**Alkena** (satu ikatan rangkap dua): CₙH₂ₙ, contohnya C₂H₄. **Alkuna** (satu ikatan rangkap tiga): CₙH₂ₙ₋₂, contohnya C₂H₂.'], [['alkana', 'CₙH₂ₙ₊₂'], ['alkena', 'CₙH₂ₙ'], ['alkuna', 'CₙH₂ₙ₋₂']]),
    S('Sifat dan isomer', ['Titik didih alkana naik seiring bertambahnya jumlah atom C. Alkena dan alkuna tidak jenuh, sehingga dapat mengalami reaksi adisi.', '**Isomer** adalah senyawa dengan rumus molekul sama tetapi struktur berbeda. Contoh: C₄H₁₀ dapat berupa butana atau 2-metilpropana.'], undefined, 'Alkana bercabang memiliki titik didih lebih rendah daripada alkana rantai lurus yang rumus molekulnya sama.'),
  ], [
    Q('Rumus molekul alkana dengan 5 atom karbon adalah …', ['C₅H₁₂', 'C₅H₁₀', 'C₅H₈', 'C₅H₁₄'], 0, 'CₙH₂ₙ₊₂ dengan n = 5 memberi C₅H₁₂.', 1),
    Q('Senyawa C₄H₈ termasuk golongan …', ['alkena', 'alkana', 'alkuna', 'alkohol'], 0, 'C₄H₈ memenuhi CₙH₂ₙ, rumus umum alkena.', 1),
    Q('Senyawa yang dapat mengalami reaksi adisi dengan H₂ adalah …', ['C₃H₆', 'C₃H₈', 'CH₄', 'C₂H₆'], 0, 'C₃H₆ (propena) memiliki ikatan rangkap dua yang dapat dibuka oleh adisi; pilihan lain adalah alkana jenuh.'),
  ]),
  'KIM.C26.F.HIDROKARBON:TATANAMA': K([
    S('Langkah penamaan IUPAC', ['Tentukan **rantai induk**, yaitu rantai karbon terpanjang (pada alkena dan alkuna harus memuat ikatan rangkap). Beri nomor dari ujung yang paling dekat dengan cabang atau ikatan rangkap.', 'Nama: nomor cabang–nama cabang + nama rantai induk. Contoh: CH₃–CH(CH₃)–CH₂–CH₃ adalah 2-metilbutana.']),
    S('Alkena dan alkuna', ['Posisi ikatan rangkap ditulis sebelum nama induk: CH₂=CH–CH₂–CH₃ adalah 1-butena; CH₃–C≡C–CH₃ adalah 2-butuna.', 'Cabang yang sama ditulis dengan awalan di- atau tri-: CH₃–C(CH₃)₂–CH₃ adalah 2,2-dimetilpropana.'], undefined, 'Nama cabang: metil (–CH₃), etil (–C₂H₅), propil (–C₃H₇).'),
  ], [
    Q('Nama IUPAC untuk CH₃–CH₂–CH(CH₃)–CH₃ adalah …', ['2-metilbutana', '3-metilbutana', 'pentana', '2-etilpropana'], 0, 'Rantai terpanjang 4 C (butana), dan penomoran dari ujung terdekat cabang menempatkan metil di C-2.'),
    Q('Nama senyawa CH₃–CH=CH–CH₂–CH₃ adalah …', ['2-pentena', '3-pentena', '2-pentana', '2-pentuna'], 0, 'Rantai 5 C dengan ikatan rangkap dua mulai di C-2 bila dinomori dari ujung kiri.'),
    Q('Rumus struktur 3-metil-1-butuna adalah …', ['HC≡C–CH(CH₃)–CH₃', 'CH₃–C≡C–CH(CH₃)₂', 'H₂C=CH–CH(CH₃)–CH₃', 'HC≡C–CH₂–CH₂–CH₃'], 0, 'Butuna dengan rangkap tiga di C-1, ditambah cabang metil di C-3.', 3),
  ]),
  'KIM.C26.F.HIDROKARBON:MINYAK': K([
    S('Fraksi minyak bumi', ['Minyak bumi adalah campuran hidrokarbon yang dipisahkan dengan **distilasi bertingkat** berdasarkan perbedaan titik didih.', 'Fraksi bertitik didih rendah (gas, bensin) keluar di bagian atas menara, sedangkan fraksi bertitik didih tinggi (solar, oli, aspal) di bagian bawah.']),
    S('Bilangan oktan dan pembakaran', ['**Bilangan oktan** menunjukkan ketahanan bensin terhadap ketukan (knocking). Isooktana diberi nilai 100 dan n-heptana 0.', 'Pembakaran sempurna menghasilkan CO₂ dan H₂O. Pembakaran tidak sempurna menghasilkan CO yang beracun dan jelaga.'], [['pembakaran sempurna', 'CₓHᵧ + O₂ → CO₂ + H₂O']], 'Bensin beroktan 92 setara campuran 92% isooktana dan 8% n-heptana.'),
  ], [
    Q('Prinsip pemisahan fraksi minyak bumi adalah perbedaan …', ['titik didih', 'massa jenis', 'warna', 'kelarutan dalam air'], 0, 'Distilasi bertingkat memisahkan komponen berdasarkan suhu didihnya.', 1),
    Q('Gas beracun yang dihasilkan pembakaran tidak sempurna adalah …', ['karbon monoksida (CO)', 'karbon dioksida (CO₂)', 'uap air', 'oksigen'], 0, 'Kekurangan oksigen membuat karbon hanya teroksidasi menjadi CO, yang mengikat hemoglobin darah.', 1),
    Q('Pembakaran sempurna 1 mol propana (C₃H₈) menghasilkan …', ['3 mol CO₂ dan 4 mol H₂O', '3 mol CO dan 4 mol H₂O', '1 mol CO₂ dan 1 mol H₂O', '3 mol CO₂ dan 8 mol H₂O'], 0, 'Persamaan setaranya C₃H₈ + 5O₂ → 3CO₂ + 4H₂O.'),
  ]),
  // ---------- Laju reaksi (kelas 11) ----------
  'KIM.C26.F.LAJU:C1': K([
    S('Pengertian laju reaksi', ['**Laju reaksi** adalah perubahan konsentrasi pereaksi atau hasil reaksi per satuan waktu, biasanya dalam M/s.', 'Laju berkurangnya pereaksi diberi tanda negatif, sedangkan laju bertambahnya produk bertanda positif: v = −Δ[A]/Δt = +Δ[B]/Δt.'], [['laju', 'v = Δ[konsentrasi] / Δt']]),
    S('Hubungan dengan koefisien', ['Untuk reaksi N₂ + 3H₂ → 2NH₃, laju berkurangnya H₂ tiga kali laju berkurangnya N₂, dan laju terbentuknya NH₃ dua kali laju berkurangnya N₂.', 'Perbandingan laju sama dengan perbandingan koefisien reaksi.'], [['N₂ : H₂ : NH₃', '1 : 3 : 2']], 'Konsentrasi molar M = mol zat terlarut per liter larutan.'),
  ], [
    Q('Konsentrasi zat A turun dari 0,8 M menjadi 0,2 M dalam 20 detik. Laju berkurangnya A adalah …', ['0,03 M/s', '0,05 M/s', '0,6 M/s', '0,01 M/s'], 0, 'v = (0,8 − 0,2)/20 = 0,6/20 = 0,03 M/s.', 1),
    Q('Pada reaksi 2SO₂ + O₂ → 2SO₃, jika laju berkurangnya O₂ adalah 0,1 M/s, laju terbentuknya SO₃ adalah …', ['0,2 M/s', '0,1 M/s', '0,05 M/s', '0,4 M/s'], 0, 'Perbandingan koefisien O₂ : SO₃ = 1 : 2, sehingga laju SO₃ = 2 × 0,1 = 0,2 M/s.'),
    Q('Satuan laju reaksi yang tepat adalah …', ['M/s', 'mol', 'M', 's/M'], 0, 'Laju adalah perubahan konsentrasi (M) per satuan waktu (s).', 1),
  ]),
  'KIM.C26.F.LAJU:C2': K([
    S('Tumbukan efektif', ['Reaksi terjadi jika partikel pereaksi **bertumbukan**. Tidak semua tumbukan menghasilkan reaksi; yang berhasil disebut **tumbukan efektif**.', 'Tumbukan efektif terjadi bila partikel memiliki energi yang cukup, setidaknya sebesar **energi aktivasi (Ea)**, dan arah tumbukannya tepat.'], [['syarat', 'energi ≥ Ea + arah tepat']]),
    S('Diagram energi', ['Energi aktivasi digambarkan sebagai bukit energi yang harus dilewati pereaksi sebelum menjadi produk.', 'Makin rendah Ea, makin banyak tumbukan yang efektif, sehingga reaksi makin cepat.'], undefined, 'Frekuensi tumbukan dan energi partikel adalah dua kunci untuk menjelaskan semua faktor laju.'),
  ], [
    Q('Tumbukan efektif adalah tumbukan yang …', ['menghasilkan reaksi karena energinya cukup dan arahnya tepat', 'terjadi paling sering', 'terjadi antara partikel sejenis', 'tidak memerlukan energi'], 0, 'Hanya tumbukan dengan energi minimal sebesar Ea dan orientasi yang tepat yang mengubah pereaksi menjadi produk.', 1),
    Q('Energi aktivasi adalah …', ['energi minimum yang diperlukan agar tumbukan menghasilkan reaksi', 'energi yang dilepas reaksi', 'energi kinetik rata-rata partikel', 'energi ikatan produk'], 0, 'Ea adalah batas energi yang harus dilampaui partikel yang bertumbukan.'),
    Q('Reaksi P memiliki Ea = 40 kJ/mol dan reaksi Q memiliki Ea = 90 kJ/mol pada suhu yang sama. Pernyataan yang tepat adalah …', ['reaksi P berlangsung lebih cepat', 'reaksi Q berlangsung lebih cepat', 'laju keduanya sama', 'reaksi P tidak memerlukan tumbukan'], 0, 'Dengan Ea lebih rendah, lebih banyak partikel P yang memiliki energi cukup untuk bereaksi.'),
  ]),
  'KIM.C26.F.LAJU:FAKTOR': K([
    S('Konsentrasi dan luas permukaan', ['**Konsentrasi** yang lebih tinggi berarti lebih banyak partikel per volume, sehingga tumbukan lebih sering.', '**Luas permukaan** yang lebih besar (zat berupa serbuk) membuat lebih banyak partikel terpapar, sehingga tumbukan juga lebih sering.']),
    S('Suhu dan katalis', ['**Suhu** yang lebih tinggi menaikkan energi kinetik partikel, sehingga tumbukan lebih sering dan lebih banyak yang efektif. Sering dipakai perkiraan: tiap kenaikan 10°C, laju naik sekitar dua kali.', '**Katalis** menyediakan jalan reaksi dengan energi aktivasi lebih rendah tanpa ikut habis bereaksi.'], [['aturan 10°C', 'laju ≈ ×2 tiap naik 10°C']], 'Katalis tidak mengubah ΔH reaksi, hanya menurunkan Ea.'),
  ], [
    Q('Pualam serbuk bereaksi lebih cepat dengan HCl daripada pualam bongkahan karena …', ['luas permukaan sentuhnya lebih besar', 'konsentrasinya lebih besar', 'suhunya lebih tinggi', 'energi aktivasinya naik'], 0, 'Serbuk memiliki permukaan yang jauh lebih luas, sehingga lebih banyak partikel dapat bertumbukan dengan HCl.', 1),
    Q('Suatu reaksi berlangsung 2 kali lebih cepat setiap kenaikan suhu 10°C. Jika pada 20°C lajunya v, maka pada 50°C lajunya …', ['8v', '3v', '6v', '30v'], 0, 'Dari 20°C ke 50°C ada tiga kali kenaikan 10°C, sehingga laju menjadi 2³ = 8 kali.'),
    Q('Katalis mempercepat reaksi dengan cara …', ['menurunkan energi aktivasi', 'menaikkan energi aktivasi', 'memperbesar ΔH reaksi', 'menambah konsentrasi pereaksi'], 0, 'Katalis menyediakan mekanisme lain dengan bukit energi lebih rendah, sehingga lebih banyak tumbukan efektif.'),
  ]),
  // ---------- Koloid (kelas 12) ----------
  'KIM.C26.F.KOLOID:C1': K([
    S('Larutan, koloid, suspensi', ['**Larutan** (partikel < 1 nm) jernih dan tidak dapat disaring. **Suspensi** (partikel > 100 nm) keruh dan mengendap.', '**Koloid** berada di antaranya (1–100 nm): tampak homogen, tidak mengendap, dan tidak dapat disaring dengan kertas saring biasa.'], [['ukuran koloid', '1–100 nm']]),
    S('Jenis koloid', ['Koloid terdiri atas **fase terdispersi** dan **medium pendispersi**. Contoh: **sol** (padat dalam cair, seperti tinta), **emulsi** (cair dalam cair, seperti susu dan mayones), **buih** (gas dalam cair, seperti busa sabun).', 'Ada juga **aerosol cair** (kabut), **aerosol padat** (asap), dan **gel** (cair dalam padat, seperti agar-agar).'], undefined, 'Nama jenis koloid ditentukan oleh wujud fase terdispersi dan medium pendispersinya.'),
  ], [
    Q('Campuran yang tampak homogen, tidak mengendap, dan partikelnya berukuran 1–100 nm disebut …', ['koloid', 'larutan', 'suspensi', 'senyawa'], 0, 'Ukuran partikel 1–100 nm adalah ciri sistem koloid.', 1),
    Q('Susu termasuk koloid jenis …', ['emulsi', 'sol', 'buih', 'aerosol'], 0, 'Susu adalah butiran lemak cair yang terdispersi dalam air (cair dalam cair).', 1),
    Q('Asap termasuk koloid dengan fase terdispersi dan medium pendispersi berturut-turut …', ['padat dalam gas', 'gas dalam padat', 'cair dalam gas', 'padat dalam cair'], 0, 'Asap terdiri atas partikel padat halus yang tersebar di udara, sehingga disebut aerosol padat.'),
  ]),
  'KIM.C26.F.KOLOID:C2': K([
    S('Tyndall dan Brown', ['**Efek Tyndall**: berkas cahaya terlihat jelas saat melewati koloid karena dihamburkan partikel koloid, misalnya sorot lampu mobil di udara berkabut.', '**Gerak Brown**: partikel koloid bergerak zig-zag karena ditumbuk partikel medium dari berbagai arah. Gerak ini membuat koloid tidak mengendap.']),
    S('Adsorpsi, koagulasi, dialisis', ['**Adsorpsi**: permukaan partikel koloid menyerap ion atau zat lain, seperti norit yang menyerap racun di usus. **Koagulasi**: penggumpalan koloid, misalnya lateks yang menggumpal dengan asam format.', '**Dialisis**: pemisahan ion pengganggu dari koloid dengan selaput semipermeabel, prinsip mesin cuci darah.'], undefined, 'Penjernihan air dengan tawas memanfaatkan koagulasi dan adsorpsi.'),
  ], [
    Q('Sorot lampu proyektor tampak jelas di ruangan berdebu karena …', ['efek Tyndall', 'gerak Brown', 'koagulasi', 'dialisis'], 0, 'Partikel debu yang berukuran koloid menghamburkan cahaya sehingga berkasnya terlihat.', 1),
    Q('Pemberian norit untuk mengatasi sakit perut memanfaatkan sifat koloid …', ['adsorpsi', 'koagulasi', 'efek Tyndall', 'gerak Brown'], 0, 'Permukaan karbon aktif menyerap racun dan bakteri di saluran pencernaan.'),
    Q('Prinsip kerja mesin cuci darah (hemodialisis) adalah …', ['dialisis dengan selaput semipermeabel', 'koagulasi darah', 'efek Tyndall', 'elektroforesis'], 0, 'Zat sisa berukuran kecil menembus selaput, sementara protein dan sel darah yang berukuran besar tertahan.'),
  ]),
  'KIM.C26.F.KOLOID:PEMBUATAN': K([
    S('Kondensasi dan dispersi', ['Cara **kondensasi**: partikel kecil (ion atau molekul) digabung menjadi partikel koloid, misalnya hidrolisis FeCl₃ dalam air panas yang membentuk sol Fe(OH)₃.', 'Cara **dispersi**: partikel besar dipecah menjadi seukuran koloid, misalnya dengan penggilingan (mekanik), peptisasi, atau busur Bredig.']),
    S('Pengemulsi dan penerapan', ['**Pengemulsi** menstabilkan emulsi. Sabun dan kuning telur (lesitin) membuat minyak dapat bercampur dengan air.', 'Koloid banyak dipakai dalam makanan, kosmetik, obat, dan cat. Pengemulsi dalam mayones mencegah minyak dan cuka memisah.'], undefined, 'Sabun membersihkan lemak karena satu ujung molekulnya suka air dan ujung lainnya suka minyak.'),
  ], [
    Q('Pembuatan sol Fe(OH)₃ dengan meneteskan FeCl₃ ke air mendidih termasuk cara …', ['kondensasi', 'dispersi mekanik', 'peptisasi', 'busur Bredig'], 0, 'Ion Fe³⁺ bereaksi membentuk partikel Fe(OH)₃ yang bergabung sampai berukuran koloid.'),
    Q('Kuning telur dalam pembuatan mayones berfungsi sebagai …', ['pengemulsi', 'koagulan', 'pelarut', 'katalis'], 0, 'Lesitin dalam kuning telur menstabilkan butiran minyak di dalam cairan cuka.', 1),
    Q('Pembuatan koloid dengan menggiling partikel kasar sampai halus termasuk cara …', ['dispersi mekanik', 'kondensasi', 'reaksi redoks', 'hidrolisis'], 0, 'Partikel besar dipecah secara fisik sampai berukuran koloid.', 1),
  ]),
  // ---------- Asam–basa lanjut (kelas 12) ----------
  'KIM.C26.F.ASAMBASA:C1': K([
    S('Teori Arrhenius', ['**Arrhenius**: asam menghasilkan ion H⁺ dalam air (HCl → H⁺ + Cl⁻), basa menghasilkan ion OH⁻ dalam air (NaOH → Na⁺ + OH⁻).', 'Teori ini terbatas pada larutan dalam air.']),
    S('Brønsted–Lowry dan Lewis', ['**Brønsted–Lowry**: asam adalah donor proton (H⁺), basa adalah akseptor proton. Pada NH₃ + H₂O ⇌ NH₄⁺ + OH⁻, air bertindak sebagai asam dan NH₃ sebagai basa.', 'Pasangan yang berbeda satu H⁺ disebut **pasangan asam–basa konjugasi**, misalnya NH₄⁺/NH₃. Menurut **Lewis**, asam menerima pasangan elektron dan basa memberi pasangan elektron.'], [['pasangan konjugasi', 'berbeda satu H⁺']], 'Air bersifat amfoter: dapat menjadi asam atau basa bergantung pasangannya.'),
  ], [
    Q('Menurut Brønsted–Lowry, basa adalah zat yang …', ['menerima proton', 'memberi proton', 'menghasilkan H⁺ dalam air', 'memberi ion H⁺ pada air'], 0, 'Basa Brønsted–Lowry adalah akseptor proton (H⁺).', 1),
    Q('Pada reaksi HCO₃⁻ + H₂O ⇌ CO₃²⁻ + H₃O⁺, pasangan asam–basa konjugasi yang benar adalah …', ['HCO₃⁻ dan CO₃²⁻', 'HCO₃⁻ dan H₂O', 'H₂O dan CO₃²⁻', 'H₃O⁺ dan CO₃²⁻'], 0, 'HCO₃⁻ memberi satu H⁺ dan menjadi CO₃²⁻, sehingga keduanya berbeda satu proton.'),
    Q('Basa konjugasi dari H₂SO₄ adalah …', ['HSO₄⁻', 'SO₄²⁻', 'H₃SO₄⁺', 'H₂O'], 0, 'Basa konjugasi terbentuk setelah asam melepas satu H⁺: H₂SO₄ → HSO₄⁻.'),
  ]),
  'KIM.C26.F.ASAMBASA:C2': K([
    S('Asam lemah', ['Asam lemah terionisasi sebagian dengan tetapan ionisasi Ka. Konsentrasi H⁺ dihitung dengan **[H⁺] = √(Ka × Ma)**.', 'pH = −log [H⁺]. Contoh: CH₃COOH 0,1 M dengan Ka = 10⁻⁵ memiliki [H⁺] = √(10⁻⁶) = 10⁻³ M, jadi pH = 3.'], [['asam lemah', '[H⁺] = √(Ka · Ma)'], ['pH', '−log [H⁺]']]),
    S('Basa lemah', ['Untuk basa lemah: **[OH⁻] = √(Kb × Mb)**, lalu pOH = −log [OH⁻] dan pH = 14 − pOH pada 25°C.', 'Contoh: NH₃ 0,1 M dengan Kb = 10⁻⁵ memiliki [OH⁻] = 10⁻³ M, pOH = 3, dan pH = 11.'], [['basa lemah', '[OH⁻] = √(Kb · Mb)']], 'Asam kuat langsung memakai [H⁺] = valensi × M, tanpa akar.'),
  ], [
    Q('pH larutan HCl 0,01 M adalah …', ['2', '1', '12', '0,01'], 0, 'HCl asam kuat: [H⁺] = 0,01 = 10⁻² M, sehingga pH = 2.', 1),
    Q('pH larutan HCOOH 0,04 M (Ka = 10⁻⁴) adalah …', ['3 − log 2', '2 − log 4', '4', '3'], 0, '[H⁺] = √(10⁻⁴ × 0,04) = √(4 × 10⁻⁶) = 2 × 10⁻³ M, sehingga pH = 3 − log 2.', 3),
    Q('pH larutan NH₃ 0,01 M (Kb = 10⁻⁶) adalah …', ['10', '4', '8', '12'], 0, '[OH⁻] = √(10⁻⁶ × 10⁻²) = 10⁻⁴ M, pOH = 4, sehingga pH = 14 − 4 = 10.'),
  ]),
  'KIM.C26.F.ASAMBASA:TITRASI': K([
    S('Prinsip titrasi', ['**Titrasi** menentukan konsentrasi larutan dengan meneteskan larutan lain yang konsentrasinya diketahui (titran) sampai reaksi tepat habis.', 'Pada **titik ekuivalen**, mol H⁺ dari asam sama dengan mol OH⁻ dari basa: **Va × Ma × a = Vb × Mb × b**, dengan a dan b valensi asam dan basa.'], [['titik ekuivalen', 'Va · Ma · a = Vb · Mb · b']]),
    S('Indikator dan kurva', ['**Indikator** dipilih agar perubahan warnanya (titik akhir) dekat dengan pH titik ekuivalen. Fenolftalein berubah dari tak berwarna menjadi merah muda pada pH sekitar 8,3–10.', 'Kurva titrasi menunjukkan perubahan pH yang tajam di sekitar titik ekuivalen.'], undefined, 'Titrasi asam kuat dengan basa kuat memiliki titik ekuivalen pada pH 7.'),
  ], [
    Q('Sebanyak 20 mL HCl dititrasi dengan NaOH 0,1 M dan membutuhkan 30 mL NaOH. Konsentrasi HCl adalah …', ['0,15 M', '0,067 M', '0,1 M', '0,3 M'], 0, 'Va · Ma = Vb · Mb: 20 × Ma = 30 × 0,1, sehingga Ma = 0,15 M.'),
    Q('Volume NaOH 0,2 M yang diperlukan untuk menetralkan 10 mL H₂SO₄ 0,1 M adalah …', ['10 mL', '5 mL', '20 mL', '2 mL'], 0, 'H₂SO₄ bervalensi 2: 10 × 0,1 × 2 = V × 0,2 × 1, sehingga V = 10 mL.', 3),
    Q('Indikator fenolftalein pada titrasi asam dengan basa menandai titik akhir saat larutan …', ['berubah dari tak berwarna menjadi merah muda', 'berubah dari merah menjadi kuning', 'tetap tak berwarna', 'berubah menjadi biru'], 0, 'Fenolftalein tak berwarna dalam suasana asam dan merah muda saat larutan menjadi sedikit basa.', 1),
  ]),
  // ---------- Senyawa turunan alkana / gugus fungsi (kelas 12) ----------
  'KIM.C26.F.GUGUS:C1': K([
    S('Alkohol', ['**Alkohol** memiliki gugus fungsi **–OH** dengan rumus umum CₙH₂ₙ₊₁OH (R–OH). Contoh: metanol (CH₃OH) dan etanol (C₂H₅OH).', 'Nama IUPAC-nya berakhiran **-ol**, misalnya 2-propanol. Alkohol primer, sekunder, dan tersier dibedakan dari atom C yang mengikat –OH.'], [['alkohol', 'R–OH (-ol)']]),
    S('Eter', ['**Eter** memiliki gugus **–O–** di antara dua gugus alkil (R–O–R′), contohnya dietil eter (C₂H₅–O–C₂H₅).', 'Alkohol dan eter dengan jumlah C sama adalah **isomer fungsi**. Alkohol bereaksi dengan logam Na, sedangkan eter tidak.'], [['eter', 'R–O–R′']], 'Titik didih alkohol jauh lebih tinggi daripada eter yang setara karena alkohol membentuk ikatan hidrogen.'),
  ], [
    Q('Gugus fungsi alkohol adalah …', ['–OH', '–O–', '–CHO', '–COOH'], 0, 'Alkohol dicirikan oleh gugus hidroksil (–OH) yang terikat pada atom karbon.', 1),
    Q('Isomer fungsi dari etanol (C₂H₅OH) adalah …', ['dimetil eter (CH₃–O–CH₃)', 'metanol', 'etanal', 'asam etanoat'], 0, 'Keduanya memiliki rumus molekul C₂H₆O, tetapi gugus fungsinya berbeda.'),
    Q('Cara membedakan 1-propanol dan metoksietana di laboratorium adalah dengan …', ['mereaksikannya dengan logam natrium', 'mencium baunya saja', 'mengukur massanya', 'melarutkannya dalam bensin'], 0, 'Alkohol bereaksi dengan Na menghasilkan gas H₂, sedangkan eter tidak bereaksi.'),
  ]),
  'KIM.C26.F.GUGUS:C2': K([
    S('Aldehida dan keton', ['**Aldehida** memiliki gugus **–CHO** di ujung rantai dan nama IUPAC berakhiran **-al**, contohnya metanal (formaldehida) dan etanal.', '**Keton** memiliki gugus karbonil **–CO–** di tengah rantai dan nama berakhiran **-on**, contohnya propanon (aseton).'], [['aldehida', 'R–CHO (-al)'], ['keton', 'R–CO–R′ (-on)']]),
    S('Membedakan keduanya', ['Aldehida dan keton dengan jumlah C sama adalah isomer fungsi, misalnya propanal dan propanon (C₃H₆O).', 'Aldehida mudah dioksidasi sehingga memberi hasil positif pada **uji Tollens** (cermin perak) dan **uji Fehling** (endapan merah bata); keton tidak.'], undefined, 'Formalin adalah larutan metanal sekitar 37%, dipakai untuk mengawetkan spesimen, bukan makanan.'),
  ], [
    Q('Senyawa yang memberi cermin perak pada uji Tollens adalah …', ['propanal', 'propanon', '2-propanol', 'dimetil eter'], 0, 'Aldehida mudah dioksidasi dan mereduksi ion perak menjadi logam perak.'),
    Q('Nama IUPAC aseton adalah …', ['propanon', 'propanal', 'etanal', 'propanol'], 0, 'Aseton adalah keton dengan tiga atom C (CH₃–CO–CH₃), sehingga namanya propanon.', 1),
    Q('Gugus fungsi –CHO terdapat pada senyawa …', ['etanal', 'etanol', 'asam etanoat', 'etoksietana'], 0, 'Akhiran -al menunjukkan aldehida, yang memiliki gugus –CHO.', 1),
  ]),
  'KIM.C26.F.GUGUS:KARBOKSILAT': K([
    S('Asam karboksilat dan ester', ['**Asam karboksilat** memiliki gugus **–COOH** dan nama berakhiran **-oat**; asam etanoat (asam asetat) adalah penyusun cuka. Senyawa ini bersifat asam lemah.', '**Ester** memiliki gugus **–COO–** (R–COO–R′) dan banyak memberi aroma buah, misalnya etil butanoat yang beraroma nanas.'], [['asam karboksilat', 'R–COOH'], ['ester', 'R–COO–R′']]),
    S('Esterifikasi', ['Asam karboksilat bereaksi dengan alkohol (katalis asam) membentuk ester dan air: CH₃COOH + C₂H₅OH → CH₃COOC₂H₅ + H₂O.', 'Nama ester: nama alkil dari alkohol, lalu nama asam berakhiran -oat, misalnya etil etanoat.'], undefined, 'Asam karboksilat dan ester dengan rumus molekul sama adalah isomer fungsi.'),
  ], [
    Q('Asam asetat dalam cuka memiliki nama IUPAC …', ['asam etanoat', 'asam metanoat', 'etil etanoat', 'etanal'], 0, 'Asam asetat (CH₃COOH) memiliki dua atom C dengan gugus –COOH.', 1),
    Q('Hasil reaksi asam propanoat dengan metanol adalah …', ['metil propanoat dan air', 'propil metanoat dan air', 'asam metanoat dan propanol', 'metil propanoat dan hidrogen'], 0, 'Pada esterifikasi, alkil dari alkohol (metil) dipadukan dengan nama asam (propanoat), dan air dilepas.'),
    Q('Senyawa yang merupakan isomer fungsi dari asam butanoat (C₄H₈O₂) adalah …', ['etil etanoat', 'butanal', 'butanol', 'butanon'], 0, 'Etil etanoat (CH₃COOC₂H₅) juga berumus C₄H₈O₂, tetapi gugus fungsinya ester.', 3),
  ]),
  'KIM.C26.F.GUGUS:REAKSI': K([
    S('Substitusi, adisi, eliminasi', ['**Substitusi**: satu atom atau gugus diganti yang lain, misalnya CH₄ + Cl₂ → CH₃Cl + HCl.', '**Adisi**: ikatan rangkap terbuka dan atom bertambah, misalnya C₂H₄ + H₂ → C₂H₆. **Eliminasi**: ikatan tunggal menjadi rangkap dengan melepas molekul kecil, misalnya C₂H₅OH → C₂H₄ + H₂O.']),
    S('Oksidasi alkohol', ['Alkohol primer dioksidasi menjadi aldehida, lalu menjadi asam karboksilat. Alkohol sekunder dioksidasi menjadi keton.', 'Alkohol tersier tidak mudah dioksidasi karena atom C yang mengikat –OH tidak memiliki atom H.'], [['alkohol primer', '→ aldehida → asam karboksilat'], ['alkohol sekunder', '→ keton']], 'Adisi hanya terjadi pada senyawa berikatan rangkap; eliminasi justru membentuk ikatan rangkap.'),
  ], [
    Q('Reaksi CH₂=CH₂ + HBr → CH₃–CH₂Br termasuk reaksi …', ['adisi', 'substitusi', 'eliminasi', 'esterifikasi'], 0, 'Ikatan rangkap dua terbuka, lalu H dan Br terikat pada atom C.', 1),
    Q('Oksidasi 2-propanol menghasilkan …', ['propanon', 'propanal', 'asam propanoat', 'propena'], 0, '2-propanol adalah alkohol sekunder, sehingga oksidasinya menghasilkan keton.'),
    Q('Reaksi C₂H₅Cl + NaOH → C₂H₅OH + NaCl termasuk reaksi …', ['substitusi', 'adisi', 'eliminasi', 'polimerisasi'], 0, 'Atom Cl diganti oleh gugus –OH tanpa terbentuk ikatan rangkap.'),
  ]),
};
