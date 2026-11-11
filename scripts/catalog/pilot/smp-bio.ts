import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Biologi/IPA SMP (Fase D) untuk inti PLANNED dari audit kesenjangan materi (prioritas 1).
// Kunci = "KODE_TOPIK:ID_INTI" di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): Content => ({ slides, q, min });

export const SMP_BIO: Record<string, Content> = {
  // ---------- Ciri dan klasifikasi makhluk hidup ----------
  'BIO.C26.D.KLASIFIKASI:C1': K([
    S('Ciri makhluk hidup', ['Makhluk hidup bernapas, bergerak, memerlukan nutrisi, tumbuh dan berkembang, berkembang biak, peka terhadap rangsang, mengeluarkan zat sisa, dan beradaptasi.'], [['iritabilitas', 'peka terhadap rangsang']]),
    S('Hidup atau tidak hidup?', ['Benda tak hidup bisa menunjukkan satu ciri, misalnya mobil bergerak atau api membesar, tetapi makhluk hidup memiliki semua ciri tersebut.', 'Tumbuhan juga bergerak, walaupun lambat: daun putri malu menutup saat disentuh.'], [['makhluk hidup', 'memiliki semua ciri kehidupan']], 'Satu ciri saja tidak cukup untuk menyebut sesuatu hidup.'),
  ], [
    Q('Daun putri malu menutup saat disentuh. Hal ini menunjukkan ciri makhluk hidup, yaitu …', ['bernapas', 'peka terhadap rangsang', 'berkembang biak', 'mengeluarkan zat sisa'], 1, 'Putri malu menanggapi rangsang sentuhan.', 1),
    Q('Kucing mengeluarkan keringat melalui telapak kakinya. Ini contoh ciri makhluk hidup, yaitu …', ['mengeluarkan zat sisa', 'tumbuh', 'bergerak', 'memerlukan nutrisi'], 0, 'Keringat adalah zat sisa yang dikeluarkan tubuh.', 1),
    Q('Mobil dapat bergerak dan memerlukan bensin, tetapi bukan makhluk hidup karena …', ['tidak berwarna', 'tidak tumbuh dan tidak berkembang biak', 'terbuat dari logam', 'tidak bersuara'], 1, 'Mobil tidak memiliki semua ciri kehidupan, misalnya tumbuh dan berkembang biak.'),
  ], 4),
  'BIO.C26.D.KLASIFIKASI:C2': K([
    S('Mengapa mengelompokkan?', ['Klasifikasi memudahkan kita mengenali dan mempelajari makhluk hidup yang sangat beragam.', 'Dasarnya persamaan dan perbedaan ciri, misalnya bertulang belakang atau tidak, berbunga atau tidak, bersel satu atau bersel banyak.'], [['dasar klasifikasi', 'persamaan dan perbedaan ciri']]),
    S('Lima kingdom', ['**Monera** (bakteri, tanpa membran inti), **Protista** (bersel satu bermembran inti, misalnya amoeba dan alga), **Fungi** (jamur), **Plantae** (tumbuhan berklorofil), **Animalia** (hewan).', 'Hewan dibagi menjadi vertebrata (ikan, amfibi, reptil, burung, mamalia) dan invertebrata.'], [['vertebrata', 'bertulang belakang']], 'Mulailah dari ciri yang paling membedakan, lalu ke ciri yang lebih rinci.'),
  ], [
    Q('Hewan berikut yang termasuk vertebrata adalah …', ['cacing tanah', 'katak', 'ubur-ubur', 'kupu-kupu'], 1, 'Katak memiliki tulang belakang (amfibi). Hewan lain invertebrata.', 1),
    Q('Kingdom yang anggotanya tidak memiliki membran inti adalah …', ['Monera', 'Protista', 'Fungi', 'Plantae'], 0, 'Monera (bakteri) bersifat prokariotik, tanpa membran inti.'),
    Q('Kelelawar dikelompokkan ke dalam mamalia, bukan burung, karena …', ['dapat terbang', 'menyusui anaknya dan berambut', 'hidup di gua', 'aktif pada malam hari'], 1, 'Menyusui dan berambut adalah ciri khas mamalia; kemampuan terbang bukan dasar pengelompokan.'),
  ], 4),
  // ---------- Organisasi kehidupan & sistem organ ----------
  'BIO.C26.D.ORGAN:C1': K([
    S('Tingkat organisasi kehidupan', ['Sel → jaringan → organ → sistem organ → organisme.', 'Contoh: sel otot jantung → jaringan otot → jantung → sistem peredaran darah → manusia.'], [['urutan', 'sel → jaringan → organ → sistem organ → organisme']]),
    S('Sel hewan dan sel tumbuhan', ['Keduanya memiliki membran sel, sitoplasma, dan inti sel.', 'Sel tumbuhan juga memiliki **dinding sel**, **kloroplas**, dan **vakuola besar**, yang tidak dimiliki sel hewan.'], [['khas sel tumbuhan', 'dinding sel, kloroplas, vakuola besar']], 'Kloroplas adalah tempat fotosintesis, hanya ada pada sel tumbuhan.'),
  ], [
    Q('Urutan tingkat organisasi kehidupan yang benar adalah …', ['sel → organ → jaringan → sistem organ', 'sel → jaringan → organ → sistem organ', 'jaringan → sel → organ → organisme', 'organ → sel → jaringan → organisme'], 1, 'Sel membentuk jaringan, jaringan membentuk organ, organ membentuk sistem organ.', 1),
    Q('Bagian sel yang hanya dimiliki sel tumbuhan adalah …', ['membran sel', 'dinding sel dan kloroplas', 'inti sel', 'sitoplasma'], 1, 'Membran sel, inti, dan sitoplasma dimiliki sel hewan dan tumbuhan.', 1),
    Q('Jantung termasuk tingkat organisasi …', ['sel', 'jaringan', 'organ', 'organisme'], 2, 'Jantung tersusun dari beberapa jaringan yang bekerja sama, jadi termasuk organ.'),
  ], 4),
  'BIO.C26.D.ORGAN:C2': K([
    S('Sistem gerak', ['Tulang adalah alat gerak pasif; otot adalah alat gerak aktif.', 'Sendi menghubungkan tulang: sendi engsel (siku, lutut), sendi peluru (bahu, pangkal paha), dan sendi putar (leher).'], [['sendi engsel', 'siku, lutut'], ['sendi peluru', 'bahu, pangkal paha']]),
    S('Gangguan dan cara menjaganya', ['Skoliosis: tulang belakang bengkok ke samping, antara lain karena posisi duduk yang salah. Osteoporosis: tulang keropos karena kekurangan kalsium. Kram: otot menegang tiba-tiba.', 'Cegah dengan postur tubuh yang baik, olahraga teratur, serta cukup kalsium dan vitamin D.'], [['osteoporosis', 'kekurangan kalsium']], 'Gangguan pada satu sistem organ dapat memengaruhi sistem lain.'),
  ], [
    Q('Sendi pada siku termasuk sendi …', ['peluru', 'engsel', 'putar', 'pelana'], 1, 'Sendi engsel hanya memungkinkan gerak ke satu arah, seperti pada siku.', 1),
    Q('Kelainan tulang belakang yang bengkok ke samping disebut …', ['lordosis', 'kifosis', 'skoliosis', 'osteoporosis'], 2, 'Lordosis bengkok ke depan, kifosis bengkok ke belakang, skoliosis bengkok ke samping.', 1),
    Q('Osteoporosis dapat dicegah dengan …', ['kurang bergerak', 'cukup kalsium, vitamin D, dan olahraga teratur', 'mengurangi minum air', 'duduk membungkuk'], 1, 'Kalsium dan vitamin D menjaga kepadatan tulang, dan olahraga menguatkannya.'),
  ], 4),
  'BIO.C26.D.ORGAN:PENCERNAAN': K([
    S('Saluran pencernaan', ['Mulut → kerongkongan → lambung → usus halus → usus besar → anus.', 'Pencernaan mekanik: makanan dikunyah dan diremas. Pencernaan kimiawi: dengan enzim, misalnya amilase di mulut memecah amilum, pepsin di lambung memecah protein.'], [['amilase', 'amilum → gula']]),
    S('Penyerapan dan gangguannya', ['Sari makanan diserap terutama di usus halus melalui jonjot usus (vili) yang memperluas permukaan. Usus besar menyerap air.', 'Gangguan: maag (radang lambung), diare (penyerapan air terganggu), dan sembelit.'], [['penyerapan sari makanan', 'usus halus']], 'Makan teratur, cukup serat, dan cukup minum menjaga pencernaan tetap sehat.'),
  ], [
    Q('Enzim amilase di dalam mulut mengubah …', ['protein menjadi asam amino', 'amilum menjadi gula', 'lemak menjadi asam lemak', 'gula menjadi amilum'], 1, 'Amilase memecah amilum (pati) menjadi gula yang lebih sederhana.'),
    Q('Penyerapan sari makanan terutama terjadi di …', ['lambung', 'usus halus', 'usus besar', 'kerongkongan'], 1, 'Jonjot usus halus memperluas permukaan penyerapan.', 1),
    Q('Sembelit dapat dicegah dengan …', ['banyak makan makanan berserat dan cukup minum', 'mengurangi minum air', 'banyak makan makanan berlemak', 'tidak sarapan'], 0, 'Serat dan air membantu feses lunak dan mudah dikeluarkan.', 1),
  ]),
  'BIO.C26.D.ORGAN:PERNAPASAN': K([
    S('Jalur udara dan pertukaran gas', ['Udara masuk melalui hidung → faring → laring → trakea → bronkus → bronkiolus → alveolus.', 'Di alveolus terjadi pertukaran gas: oksigen masuk ke darah, karbon dioksida keluar dari darah.'], [['tempat pertukaran gas', 'alveolus']]),
    S('Mekanisme dan gangguan', ['Pernapasan dada digerakkan otot antartulang rusuk; pernapasan perut digerakkan diafragma. Saat menarik napas, diafragma mendatar sehingga rongga dada membesar dan udara masuk.', 'Gangguan: asma, bronkitis, pneumonia. Asap rokok merusak alveolus.'], [['inspirasi', 'diafragma mendatar, rongga dada membesar']], 'Bernapas lewat hidung membuat udara tersaring, hangat, dan lembap.'),
  ], [
    Q('Pertukaran oksigen dan karbon dioksida terjadi di …', ['trakea', 'bronkus', 'alveolus', 'laring'], 2, 'Alveolus berdinding tipis dan dikelilingi kapiler darah, tempat gas berpindah.', 1),
    Q('Saat menarik napas pada pernapasan perut, diafragma …', ['melengkung ke atas', 'mendatar sehingga rongga dada membesar', 'tidak bergerak', 'mengecil'], 1, 'Diafragma yang mendatar memperbesar rongga dada sehingga tekanan turun dan udara masuk.'),
    Q('Kebiasaan yang paling merusak alveolus adalah …', ['berolahraga', 'merokok', 'minum air putih', 'tidur cukup'], 1, 'Zat dalam asap rokok merusak dinding alveolus sehingga pertukaran gas terganggu.', 1),
  ]),
  'BIO.C26.D.ORGAN:PEREDARAN': K([
    S('Jantung, pembuluh, dan darah', ['Jantung memompa darah. **Arteri** membawa darah keluar dari jantung, **vena** membawa darah kembali ke jantung, **kapiler** tempat pertukaran zat.', 'Darah terdiri dari plasma, sel darah merah (mengangkut oksigen dengan hemoglobin), sel darah putih (melawan kuman), dan keping darah (pembekuan).'], [['sel darah merah', 'mengangkut oksigen']]),
    S('Peredaran darah ganda', ['Peredaran kecil: jantung → paru-paru → jantung, untuk mengambil oksigen. Peredaran besar: jantung → seluruh tubuh → jantung.', 'Gangguan: anemia (kekurangan hemoglobin), hipertensi (tekanan darah tinggi), dan penyumbatan pembuluh darah.'], [['peredaran kecil', 'jantung → paru-paru → jantung']], 'Arteri menjauhi jantung; vena menuju jantung.'),
  ], [
    Q('Sel darah yang berfungsi mengangkut oksigen adalah …', ['sel darah putih', 'sel darah merah', 'keping darah', 'plasma darah'], 1, 'Hemoglobin dalam sel darah merah mengikat oksigen.', 1),
    Q('Peredaran darah kecil adalah peredaran darah dari jantung ke …', ['seluruh tubuh lalu kembali ke jantung', 'paru-paru lalu kembali ke jantung', 'otak saja', 'ginjal saja'], 1, 'Peredaran kecil membawa darah ke paru-paru untuk mengambil oksigen.'),
    Q('Kekurangan hemoglobin sehingga mudah lelah dan pucat disebut …', ['anemia', 'hipertensi', 'leukemia', 'hemofilia'], 0, 'Anemia membuat darah kurang mampu mengangkut oksigen.'),
  ]),
  'BIO.C26.D.ORGAN:EKSKRESI': K([
    S('Organ ekskresi', ['**Ginjal** menyaring darah dan menghasilkan urine. **Kulit** mengeluarkan keringat. **Paru-paru** mengeluarkan karbon dioksida dan uap air. **Hati** menghasilkan empedu dan menguraikan zat beracun.'], [['ginjal', 'urine'], ['paru-paru', 'CO₂ dan uap air']]),
    S('Keseimbangan cairan', ['Ginjal mengatur jumlah air dalam tubuh: saat kurang minum urine pekat dan sedikit; saat banyak minum urine encer.', 'Gangguan: batu ginjal dan gagal ginjal. Minum air yang cukup dan batasi garam berlebih.'], [['kurang minum', 'urine sedikit dan pekat']], 'Urine berwarna kuning pekat dapat menjadi tanda tubuh kekurangan cairan.'),
  ], [
    Q('Organ yang menghasilkan urine adalah …', ['hati', 'ginjal', 'paru-paru', 'kulit'], 1, 'Ginjal menyaring darah dan membentuk urine.', 1),
    Q('Paru-paru termasuk organ ekskresi karena mengeluarkan …', ['urine', 'keringat', 'karbon dioksida dan uap air', 'empedu'], 2, 'Karbon dioksida dan uap air adalah sisa metabolisme yang dibuang lewat paru-paru.', 1),
    Q('Saat seseorang kurang minum, urinenya cenderung …', ['banyak dan encer', 'sedikit dan pekat', 'tidak berubah', 'berwarna biru'], 1, 'Ginjal menghemat air, sehingga urine yang dikeluarkan sedikit dan pekat.'),
  ]),
  // ---------- Ekosistem dan perubahan iklim ----------
  'BIO.C26.D.EKOLOGI:C1': K([
    S('Komponen ekosistem', ['Ekosistem terdiri dari komponen **biotik** (makhluk hidup) dan **abiotik** (air, tanah, cahaya, suhu) yang saling berinteraksi.', 'Peran komponen biotik: produsen (tumbuhan), konsumen (hewan), dan pengurai (bakteri, jamur).'], [['abiotik', 'air, tanah, cahaya, suhu']]),
    S('Pola interaksi', ['Simbiosis **mutualisme** (lebah dan bunga, keduanya untung), **komensalisme** (anggrek dan pohon, satu untung yang lain tidak terpengaruh), **parasitisme** (benalu dan pohon, satu untung yang lain rugi), serta **predasi** (elang memangsa tikus).', 'Energi mengalir dari Matahari → produsen → konsumen.'], [['aliran energi', 'Matahari → produsen → konsumen']], 'Energi mengalir satu arah dan berkurang di setiap tingkat; materi berdaur.'),
  ], [
    Q('Hubungan lebah dan bunga merupakan simbiosis …', ['mutualisme', 'komensalisme', 'parasitisme', 'predasi'], 0, 'Lebah mendapat nektar, bunga terbantu penyerbukannya; keduanya untung.', 1),
    Q('Benalu yang hidup di pohon mangga merupakan contoh simbiosis …', ['mutualisme', 'komensalisme', 'parasitisme', 'netralisme'], 2, 'Benalu mengambil air dan zat hara dari pohon mangga sehingga pohon dirugikan.', 1),
    Q('Sumber energi utama dalam ekosistem adalah …', ['tumbuhan', 'Matahari', 'tanah', 'air'], 1, 'Produsen mengubah energi cahaya Matahari menjadi energi kimia melalui fotosintesis.', 1),
  ], 4),
  'BIO.C26.D.EKOLOGI:C2': K([
    S('Pencemaran lingkungan', ['Pencemaran air (limbah pabrik, sampah), udara (asap kendaraan dan pabrik), dan tanah (plastik, pestisida berlebihan) mengganggu keseimbangan ekosistem.'], [['pencemaran udara', 'asap kendaraan dan pabrik']]),
    S('Perubahan iklim', ['Gas rumah kaca (CO₂, metana) dari pembakaran bahan bakar fosil dan penebangan hutan memerangkap panas, sehingga suhu rata-rata Bumi naik.', 'Dampaknya: cuaca ekstrem, es kutub mencair, dan permukaan laut naik. Tindakan: hemat energi, menanam pohon, mengurangi sampah plastik.'], [['gas rumah kaca utama', 'CO₂']], 'Kurangi, gunakan ulang, daur ulang (reduce, reuse, recycle).'),
  ], [
    Q('Gas utama penyebab efek rumah kaca dari kendaraan bermotor adalah …', ['oksigen', 'karbon dioksida', 'nitrogen', 'hidrogen'], 1, 'Pembakaran bensin menghasilkan karbon dioksida yang memerangkap panas di atmosfer.', 1),
    Q('Dampak pemanasan global adalah …', ['permukaan laut naik', 'es kutub bertambah', 'suhu Bumi turun', 'hujan selalu merata'], 0, 'Es kutub yang mencair dan air laut yang memuai membuat permukaan laut naik.', 1),
    Q('Tindakan siswa yang ikut mengurangi perubahan iklim adalah …', ['membakar sampah plastik', 'mematikan lampu yang tidak dipakai dan bersepeda ke sekolah', 'memakai kantong plastik sekali pakai', 'menebang pohon di halaman'], 1, 'Menghemat listrik dan bahan bakar mengurangi emisi karbon dioksida.'),
  ], 4),
  'BIO.C26.D.EKOLOGI:JEJARING': K([
    S('Rantai makanan', ['Rantai makanan menunjukkan urutan makan-dimakan: padi → tikus → ular → elang.', 'Produsen berada di awal, diikuti konsumen I, konsumen II, dan seterusnya. Pengurai menguraikan organisme yang mati.'], [['padi → tikus → ular → elang', 'produsen → konsumen I → II → III']]),
    S('Jaring makanan dan piramida energi', ['Jaring makanan adalah gabungan beberapa rantai makanan yang saling terhubung.', 'Pada piramida energi, energi makin kecil di tingkat atas; hanya sekitar 10% yang diteruskan. Jika satu populasi hilang, populasi lain ikut terpengaruh.'], [['energi yang diteruskan', '± 10% per tingkat']], 'Jika ular diburu habis, populasi tikus kemungkinan meningkat.'),
  ], [
    Q('Pada rantai makanan padi → tikus → ular → elang, ular berperan sebagai …', ['produsen', 'konsumen I', 'konsumen II', 'pengurai'], 2, 'Padi produsen, tikus konsumen I, ular konsumen II, elang konsumen III.', 1),
    Q('Jika populasi ular menurun drastis, yang kemungkinan terjadi adalah …', ['populasi tikus meningkat', 'populasi padi meningkat', 'populasi elang meningkat', 'tidak ada perubahan'], 0, 'Pemangsa tikus berkurang, sehingga tikus berkembang lebih banyak.'),
    Q('Energi paling kecil dalam piramida energi terdapat pada …', ['produsen', 'konsumen I', 'konsumen puncak', 'semua tingkat sama'], 2, 'Energi berkurang di setiap tingkat, jadi paling sedikit di puncak.'),
  ]),
  // ---------- Pewarisan sifat & bioteknologi SMP ----------
  'BIO.C26.D.GENETIKA:C1': K([
    S('Gen, DNA, dan kromosom', ['Sifat diturunkan dari orang tua melalui **gen**. Gen adalah bagian DNA yang terdapat pada kromosom di dalam inti sel.', 'Sel tubuh manusia memiliki 46 kromosom (23 pasang).'], [['manusia', '46 kromosom (23 pasang)']]),
    S('Variasi', ['Variasi adalah perbedaan sifat di antara individu sejenis, seperti warna kulit, golongan darah, dan bentuk rambut.', 'Sumbernya: gen dari kedua orang tua dan pengaruh lingkungan.'], [['variasi', 'gen + lingkungan']], 'Golongan darah ditentukan gen; berat badan dipengaruhi gen dan lingkungan.'),
  ], [
    Q('Pembawa sifat keturunan yang terdapat pada kromosom disebut …', ['gen', 'sel darah', 'hormon', 'enzim'], 0, 'Gen adalah bagian DNA pada kromosom yang membawa sifat.', 1),
    Q('Jumlah kromosom pada sel tubuh manusia adalah …', ['23', '46', '48', '92'], 1, 'Sel tubuh manusia memiliki 23 pasang atau 46 kromosom.', 1),
    Q('Contoh variasi yang terutama dipengaruhi lingkungan adalah …', ['golongan darah', 'warna mata', 'kulit menggelap karena sering terkena sinar Matahari', 'bentuk cuping telinga'], 2, 'Kulit menggelap karena paparan sinar Matahari, bukan karena gen yang berubah.'),
  ], 4),
  'BIO.C26.D.GENETIKA:C2': K([
    S('Bioteknologi konvensional', ['Bioteknologi konvensional memanfaatkan mikroorganisme untuk menghasilkan produk.', 'Ragi (*Saccharomyces*) → tapai dan roti. *Rhizopus* → tempe. *Lactobacillus* → yoghurt. *Acetobacter xylinum* → nata de coco.'], [['Rhizopus', 'tempe'], ['Lactobacillus', 'yoghurt']]),
    S('Proses fermentasi', ['Mikroorganisme mengubah gula menjadi zat lain, seperti alkohol, asam laktat, atau CO₂, dengan sedikit atau tanpa oksigen.', 'Syaratnya: alat bersih, suhu sesuai, dan wadah tertutup.'], [['fermentasi ragi', 'gula → alkohol + CO₂']], 'Kontaminasi mikroba lain dapat membuat fermentasi gagal; jaga kebersihan.'),
  ], [
    Q('Mikroorganisme yang berperan dalam pembuatan tempe adalah …', ['Lactobacillus', 'Rhizopus', 'Acetobacter', 'Saccharomyces'], 1, 'Jamur Rhizopus membentuk benang-benang yang mengikat kedelai menjadi tempe.', 1),
    Q('Adonan roti mengembang karena ragi menghasilkan gas …', ['oksigen', 'karbon dioksida', 'nitrogen', 'hidrogen'], 1, 'Gas CO₂ hasil fermentasi ragi terperangkap di adonan dan membuatnya mengembang.', 1),
    Q('Pembuatan yoghurt memanfaatkan bakteri yang mengubah gula susu menjadi …', ['alkohol', 'asam laktat', 'asam asetat', 'protein'], 1, 'Lactobacillus menghasilkan asam laktat yang membuat susu kental dan masam.'),
  ], 4),
  'BIO.C26.D.GENETIKA:FENOTIPE': K([
    S('Genotipe dan fenotipe', ['**Genotipe** adalah susunan gen, ditulis dengan huruf (TT, Tt, tt). **Fenotipe** adalah sifat yang tampak (tinggi atau pendek).', 'Alel dominan (T) menutupi alel resesif (t), jadi Tt tampak tinggi.'], [['genotipe', 'susunan gen'], ['fenotipe', 'sifat yang tampak']]),
    S('Persilangan monohibrid', ['Ercis tinggi (TT) disilangkan dengan pendek (tt): F1 semuanya Tt (tinggi).', 'F1 disilangkan sesamanya: F2 bergenotipe TT : Tt : tt = 1 : 2 : 1 dan berfenotipe tinggi : pendek = 3 : 1.'], [['F2 monohibrid', 'fenotipe 3 : 1']], 'Gunakan papan catur (diagram Punnett) untuk menghitung keturunan.'),
  ], [
    Q('Sifat yang tampak dari luar, seperti warna bunga, disebut …', ['genotipe', 'fenotipe', 'alel', 'kromosom'], 1, 'Fenotipe adalah sifat yang dapat diamati.', 1),
    Q('Persilangan Tt × Tt menghasilkan perbandingan fenotipe tinggi : pendek sebesar …', ['1 : 1', '3 : 1', '1 : 2 : 1', 'semua tinggi'], 1, 'Keturunannya TT, Tt, Tt, tt: tiga tinggi dan satu pendek. Rasio 1 : 2 : 1 adalah rasio genotipenya.'),
    Q('Persilangan TT × tt menghasilkan keturunan F1 dengan genotipe …', ['semua TT', 'semua Tt', 'semua tt', 'Tt dan tt'], 1, 'Setiap keturunan menerima T dari satu induk dan t dari induk lainnya.', 1),
  ]),
  // ---------- Koordinasi, reproduksi, dan homeostasis ----------
  'BIO.C26.D.KOORDINASI:C1': K([
    S('Sistem saraf', ['Sel saraf (neuron) menghantarkan impuls. Sistem saraf pusat terdiri dari otak dan sumsum tulang belakang.', 'Gerak sadar dikendalikan otak. Gerak refleks lebih cepat karena impulsnya tidak diolah otak terlebih dahulu, misalnya menarik tangan dari benda panas.'], [['gerak refleks', 'tidak melalui otak lebih dahulu']]),
    S('Alat indra', ['Mata (cahaya), telinga (bunyi dan keseimbangan), hidung (bau), lidah (rasa), dan kulit (sentuhan, suhu, nyeri).', 'Rangsang diterima reseptor, lalu impulsnya diteruskan ke sistem saraf pusat.'], [['indra keseimbangan', 'telinga bagian dalam']], 'Jalur refleks: reseptor → saraf sensorik → sumsum tulang belakang → saraf motorik → otot.'),
  ], [
    Q('Menarik tangan saat menyentuh setrika panas adalah contoh gerak …', ['sadar', 'refleks', 'lambat', 'terencana'], 1, 'Gerak ini terjadi otomatis dan cepat, tanpa dipikirkan dulu.', 1),
    Q('Bagian sistem saraf pusat adalah …', ['otak dan sumsum tulang belakang', 'jantung dan paru-paru', 'saraf di ujung jari', 'otot dan tulang'], 0, 'Otak dan sumsum tulang belakang adalah pusat pengolah impuls; saraf di ujung jari termasuk saraf tepi.', 1),
    Q('Organ yang juga berfungsi sebagai indra keseimbangan adalah …', ['mata', 'telinga', 'hidung', 'lidah'], 1, 'Telinga bagian dalam memiliki alat keseimbangan.'),
  ], 4),
  'BIO.C26.D.KOORDINASI:HORMON': K([
    S('Kelenjar endokrin', ['Hormon dihasilkan kelenjar endokrin dan dibawa darah ke organ sasaran.', 'Contoh: insulin (pankreas) menurunkan gula darah, tiroksin (tiroid) mengatur metabolisme, adrenalin (anak ginjal) saat panik, hormon pertumbuhan (hipofisis).'], [['insulin', 'menurunkan gula darah']]),
    S('Kerja hormon dan gangguannya', ['Kerja hormon lebih lambat daripada saraf, tetapi efeknya lebih lama.', 'Gangguan: kekurangan insulin menyebabkan diabetes melitus; kekurangan iodin dapat menyebabkan gondok.'], [['kekurangan iodin', 'gondok']], 'Saraf bekerja cepat dan singkat; hormon bekerja lambat dan lama.'),
  ], [
    Q('Hormon yang menurunkan kadar gula darah adalah …', ['adrenalin', 'insulin', 'tiroksin', 'estrogen'], 1, 'Insulin dari pankreas membantu sel menyerap gula dari darah.', 1),
    Q('Hormon disebarkan ke organ sasarannya melalui …', ['saraf', 'darah', 'udara', 'otot'], 1, 'Kelenjar endokrin tidak bersaluran; hormonnya langsung masuk ke darah.', 1),
    Q('Kekurangan iodin dalam makanan dapat menyebabkan …', ['diabetes', 'gondok', 'anemia', 'rabun'], 1, 'Iodin diperlukan kelenjar tiroid untuk membuat hormon tiroksin.'),
  ]),
  'BIO.C26.D.KOORDINASI:REPRODUKSI': K([
    S('Organ reproduksi', ['Laki-laki: testis menghasilkan sperma dan hormon testosteron. Perempuan: ovarium menghasilkan sel telur dan hormon estrogen; rahim tempat janin berkembang.', 'Fertilisasi adalah peleburan sel sperma dengan sel telur.'], [['fertilisasi', 'sperma + sel telur']]),
    S('Pubertas dan kesehatan reproduksi', ['Pubertas ditandai perubahan fisik, seperti tumbuh rambut, suara berubah, dan menstruasi, yang dipengaruhi hormon.', 'Jaga kebersihan organ reproduksi, kenali batasan tubuh, dan cari informasi dari tenaga kesehatan atau orang dewasa tepercaya.'], [['testosteron', 'ciri kelamin sekunder laki-laki']], 'Perubahan saat pubertas itu normal, dan waktunya bisa berbeda pada setiap orang.'),
  ], [
    Q('Organ yang menghasilkan sel telur adalah …', ['rahim', 'ovarium', 'testis', 'vagina'], 1, 'Ovarium menghasilkan sel telur dan hormon estrogen.', 1),
    Q('Peleburan sel sperma dengan sel telur disebut …', ['menstruasi', 'fertilisasi', 'ovulasi', 'pubertas'], 1, 'Fertilisasi menghasilkan zigot yang berkembang menjadi embrio.', 1),
    Q('Suara remaja laki-laki menjadi lebih berat saat pubertas karena pengaruh hormon …', ['estrogen', 'testosteron', 'insulin', 'tiroksin'], 1, 'Testosteron memicu ciri kelamin sekunder laki-laki, termasuk perubahan suara.'),
  ]),
  'BIO.C26.D.KOORDINASI:HOMEOSTASIS': K([
    S('Menjaga kondisi tetap stabil', ['Homeostasis adalah kemampuan tubuh menjaga kondisi di dalamnya tetap stabil, misalnya suhu tubuh sekitar 37 °C, kadar air, dan kadar gula darah.'], [['suhu tubuh normal', '± 37 °C']]),
    S('Kerja sama antarsistem', ['Saat kepanasan, otak memerintah kulit berkeringat dan pembuluh darah kulit melebar. Setelah makan, gula darah naik, lalu pankreas melepas insulin. Saat kurang minum, ginjal menghemat air.', 'Saraf, hormon, ekskresi, dan peredaran darah bekerja sama.'], [['umpan balik', 'perubahan → respons → kembali normal']], 'Homeostasis bekerja dengan umpan balik: perubahan memicu respons yang mengembalikan kondisi normal.'),
  ], [
    Q('Saat berolahraga dan tubuh terasa panas, respons tubuh untuk menurunkan suhu adalah …', ['berhenti berkeringat', 'berkeringat', 'menggigil', 'mengurangi aliran darah ke kulit'], 1, 'Keringat yang menguap dari kulit membawa panas keluar dari tubuh.', 1),
    Q('Setelah makan, kadar gula darah naik. Organ yang merespons dengan melepas insulin adalah …', ['hati', 'pankreas', 'ginjal', 'lambung'], 1, 'Pankreas melepas insulin agar gula darah kembali normal.'),
    Q('Saat cuaca dingin, tubuh menggigil. Tujuannya adalah …', ['mengeluarkan keringat', 'menghasilkan panas dari kontraksi otot', 'menurunkan suhu tubuh', 'menghemat air'], 1, 'Otot yang berkontraksi cepat menghasilkan panas untuk menghangatkan tubuh.'),
  ]),
  // ---------- Pertumbuhan dan perkembangan ----------
  'BIO.C26.D.TUMBUH:C1': K([
    S('Tumbuh atau berkembang?', ['**Pertumbuhan**: bertambahnya ukuran (tinggi, berat, volume) yang tidak dapat kembali; dapat diukur dengan angka.', '**Perkembangan**: proses menuju kedewasaan, misalnya kemampuan berpikir bertambah atau bunga menjadi buah; tidak diukur dengan angka.'], [['pertumbuhan', 'kuantitatif (dapat diukur)'], ['perkembangan', 'kualitatif (menuju dewasa)']]),
    S('Contoh', ['Tinggi badan bertambah 5 cm → pertumbuhan. Anak mulai bisa berbicara atau tumbuhan mulai berbunga → perkembangan.', 'Pada tumbuhan, pertumbuhan memanjang terjadi di jaringan meristem pada ujung akar dan ujung batang.'], [['pertumbuhan memanjang tumbuhan', 'meristem ujung akar dan batang']], 'Bisa diukur dengan penggaris atau timbangan → pertumbuhan.'),
  ], [
    Q('Contoh pertumbuhan adalah …', ['bayi mulai bisa berbicara', 'tinggi badan anak bertambah', 'tumbuhan mulai berbunga', 'remaja mengalami menstruasi'], 1, 'Tinggi badan dapat diukur dan bertambah, jadi termasuk pertumbuhan.', 1),
    Q('Perbedaan pertumbuhan dan perkembangan adalah …', ['pertumbuhan dapat diukur, sedangkan perkembangan adalah proses menuju kedewasaan', 'pertumbuhan tidak dapat diukur', 'perkembangan selalu menambah ukuran', 'keduanya sama saja'], 0, 'Pertumbuhan bersifat kuantitatif, perkembangan bersifat kualitatif.'),
    Q('Pertumbuhan memanjang pada tumbuhan terjadi di daerah …', ['meristem ujung akar dan batang', 'daun tua', 'kulit batang', 'akar serabut saja'], 0, 'Sel-sel meristem di ujung akar dan batang terus membelah.'),
  ], 4),
  'BIO.C26.D.TUMBUH:FAKTOR': K([
    S('Faktor internal', ['Faktor dari dalam: gen (keturunan) dan hormon.', 'Pada tumbuhan, auksin merangsang pemanjangan sel dan giberelin merangsang pertumbuhan batang. Pada manusia ada hormon pertumbuhan dari hipofisis.'], [['auksin', 'pemanjangan sel']]),
    S('Faktor eksternal', ['Faktor dari luar: nutrisi, air, cahaya, suhu, dan kelembapan.', 'Kecambah di tempat gelap tumbuh lebih cepat tinggi tetapi kurus dan pucat (etiolasi), karena auksin tidak terurai oleh cahaya.'], [['etiolasi', 'gelap → cepat tinggi, pucat']], 'Cahaya justru menghambat pemanjangan batang, tetapi diperlukan untuk fotosintesis.'),
  ], [
    Q('Kecambah yang tumbuh di tempat gelap menjadi lebih tinggi tetapi pucat. Peristiwa ini disebut …', ['fotosintesis', 'etiolasi', 'fototropisme', 'metamorfosis'], 1, 'Tanpa cahaya, auksin tidak terurai sehingga batang memanjang cepat, tetapi daun pucat karena kurang klorofil.'),
    Q('Contoh faktor internal pertumbuhan adalah …', ['cahaya', 'air', 'hormon', 'suhu'], 2, 'Hormon dihasilkan dari dalam tubuh; cahaya, air, dan suhu adalah faktor eksternal.', 1),
    Q('Anak yang kekurangan gizi dapat terhambat pertumbuhannya. Hal ini menunjukkan pengaruh faktor …', ['gen', 'nutrisi (eksternal)', 'hormon', 'umur'], 1, 'Nutrisi berasal dari makanan, yaitu faktor dari luar tubuh.', 1),
  ]),
  'BIO.C26.D.TUMBUH:DAURHIDUP': K([
    S('Metamorfosis', ['**Metamorfosis sempurna**: telur → larva → pupa → imago (kupu-kupu, nyamuk). **Metamorfosis tidak sempurna**: telur → nimfa → imago (belalang, kecoak).', 'Katak mengalami metamorfosis: telur → berudu → katak muda → katak dewasa.'], [['sempurna', 'telur → larva → pupa → imago'], ['tidak sempurna', 'telur → nimfa → imago']]),
    S('Daur hidup tumbuhan dan manfaatnya', ['Tumbuhan berbiji: biji → kecambah → tumbuhan muda → tumbuhan dewasa → berbunga → buah dan biji.', 'Memahami daur hidup membantu mengendalikan hama, misalnya memutus daur hidup nyamuk dengan menguras penampungan air (3M).'], [['3M', 'menguras, menutup, mendaur ulang']], 'Ada tahap pupa → metamorfosis sempurna.'),
  ], [
    Q('Urutan metamorfosis sempurna pada kupu-kupu adalah …', ['telur → nimfa → imago', 'telur → larva → pupa → imago', 'telur → pupa → larva → imago', 'larva → telur → pupa → imago'], 1, 'Kupu-kupu melewati tahap ulat (larva) dan kepompong (pupa).', 1),
    Q('Hewan yang mengalami metamorfosis tidak sempurna adalah …', ['nyamuk', 'kupu-kupu', 'belalang', 'lalat'], 2, 'Belalang tidak memiliki tahap pupa: telur → nimfa → imago.'),
    Q('Menguras bak mandi secara rutin dapat mencegah demam berdarah karena …', ['membunuh nyamuk dewasa', 'memutus daur hidup nyamuk pada tahap jentik', 'mengusir nyamuk dengan bau', 'menambah oksigen dalam air'], 1, 'Jentik (larva) nyamuk hidup di air; menguras bak membuat jentik tidak dapat berkembang menjadi nyamuk dewasa.'),
  ]),
};
