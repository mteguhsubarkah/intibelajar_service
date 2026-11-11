import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Biologi SMA (Fase F) untuk inti PLANNED dari audit kesenjangan materi (prioritas 2).
// Kunci = "KODE_TOPIK:ID_INTI" di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): Content => ({ slides, q, min });

export const SMA_BIO: Record<string, Content> = {
  // ---------- Sistem organ manusia ----------
  'BIO.C26.F.ORGAN:C1': K([
    S('Empat jaringan hewan', ['**Epitel** melapisi permukaan dan rongga (kulit, lapisan usus). **Ikat** menghubungkan dan menyokong (tulang, tulang rawan, darah). **Otot** berkontraksi. **Saraf** menghantarkan impuls.'], [['epitel', 'pelapis'], ['ikat', 'penyokong, penghubung']]),
    S('Struktur sesuai fungsi', ['Otot dibedakan menjadi otot lurik (rangka, bekerja sadar), otot polos (organ dalam, tak sadar), dan otot jantung (lurik, tak sadar).', 'Bentuk sel menyesuaikan fungsinya: epitel usus memiliki mikrovili untuk menyerap, dan neuron memiliki akson panjang untuk menghantar impuls.'], [['otot jantung', 'lurik, bekerja tak sadar']], 'Satu organ tersusun dari beberapa jaringan sekaligus; lambung punya epitel, otot polos, jaringan ikat, dan saraf.'),
  ], [
    Q('Darah digolongkan ke dalam jaringan …', ['ikat', 'epitel', 'otot', 'saraf'], 0, 'Darah adalah jaringan ikat dengan matriks cair, yaitu plasma.'),
    Q('Otot yang bekerja tidak sadar dan menyusun dinding usus adalah otot …', ['polos', 'lurik', 'jantung', 'rangka'], 0, 'Otot polos menyusun dinding organ dalam seperti usus dan bekerja di luar kendali kesadaran.', 1),
    Q('Sel epitel usus halus memiliki mikrovili. Fungsi struktur ini adalah …', ['memperluas permukaan penyerapan', 'menghantarkan impuls', 'menghasilkan hormon', 'mempercepat kontraksi'], 0, 'Mikrovili menambah luas permukaan sel sehingga penyerapan sari makanan lebih efisien.'),
  ], 4),
  'BIO.C26.F.ORGAN:PENCERNAAN': K([
    S('Enzim di sepanjang saluran', ['Mulut: amilase (ptialin) memecah amilum. Lambung: pepsin memecah protein menjadi pepton; HCl membunuh kuman dan mengaktifkan pepsinogen.', 'Usus halus: enzim pankreas (amilase, tripsin, lipase) bekerja bersama empedu dari hati yang mengemulsikan lemak.'], [['pepsin', 'protein → pepton'], ['lipase', 'lemak → asam lemak + gliserol']]),
    S('Penyerapan dan gangguan', ['Sari makanan diserap di usus halus: glukosa dan asam amino masuk ke kapiler darah, sedangkan asam lemak dan gliserol masuk ke pembuluh kil (limfa).', 'Gangguan: tukak lambung, apendisitis (radang usus buntu), dan malabsorpsi.'], [['asam lemak', 'diserap ke pembuluh kil (limfa)']], 'Empedu tidak mengandung enzim; ia memecah lemak menjadi butiran kecil agar lipase bekerja lebih cepat.'),
  ], [
    Q('Empedu membantu pencernaan lemak dengan cara …', ['mengemulsikan lemak menjadi butiran kecil', 'memecah lemak menjadi asam lemak', 'mengubah lemak menjadi glukosa', 'menyerap lemak ke darah'], 0, 'Empedu bukan enzim; ia memperluas permukaan lemak agar lipase dapat bekerja.'),
    Q('Enzim yang memecah protein di lambung adalah …', ['pepsin', 'amilase', 'lipase', 'tripsin'], 0, 'Pepsin yang diaktifkan HCl memecah protein menjadi pepton di lambung, sedangkan tripsin bekerja di usus halus.', 1),
    Q('Asam lemak dan gliserol hasil pencernaan diangkut melalui …', ['pembuluh kil (limfa)', 'kapiler darah bersama glukosa', 'saluran empedu', 'kantong empedu'], 0, 'Asam lemak dan gliserol diserap ke pembuluh kil di vili usus, lalu masuk ke sistem limfa.'),
  ]),
  'BIO.C26.F.ORGAN:SIRKULASI': K([
    S('Jantung dan peredaran ganda', ['Jantung manusia memiliki empat ruang: serambi kanan, bilik kanan, serambi kiri, dan bilik kiri. Katup mencegah darah mengalir balik.', 'Peredaran pulmonal: bilik kanan → arteri pulmonalis → paru-paru → vena pulmonalis → serambi kiri. Peredaran sistemik: bilik kiri → aorta → seluruh tubuh → vena kava → serambi kanan.'], [['arteri pulmonalis', 'membawa darah miskin O₂ ke paru-paru']]),
    S('Sistem limfa dan gangguan', ['Sistem limfa mengembalikan cairan jaringan ke darah, mengangkut lemak dari usus, dan menjadi bagian pertahanan tubuh di kelenjar limfa.', 'Gangguan sirkulasi: hipertensi, aterosklerosis (penyempitan pembuluh oleh plak lemak), varises, dan anemia.'], [['aterosklerosis', 'plak lemak di dinding arteri']], 'Arteri pulmonalis satu-satunya arteri yang membawa darah miskin oksigen, sedangkan vena pulmonalis membawa darah kaya oksigen.'),
  ], [
    Q('Pembuluh yang membawa darah kaya oksigen dari paru-paru ke jantung adalah …', ['vena pulmonalis', 'arteri pulmonalis', 'aorta', 'vena kava'], 0, 'Vena pulmonalis membawa darah yang baru mengambil oksigen di paru-paru ke serambi kiri.'),
    Q('Ruang jantung yang memompa darah ke seluruh tubuh adalah …', ['bilik kiri', 'bilik kanan', 'serambi kiri', 'serambi kanan'], 0, 'Bilik kiri memompa darah ke aorta; dindingnya paling tebal karena harus mendorong darah ke seluruh tubuh.', 1),
    Q('Penyempitan pembuluh arteri karena penumpukan plak lemak disebut …', ['aterosklerosis', 'varises', 'hipotensi', 'leukemia'], 0, 'Plak lemak di dinding arteri menyempitkan pembuluh dan mengurangi aliran darah.', 1),
  ]),
  'BIO.C26.F.ORGAN:RESPIRASI': K([
    S('Mekanisme pernapasan', ['Inspirasi pernapasan dada: otot antartulang rusuk luar berkontraksi, rusuk terangkat, dan rongga dada membesar. Inspirasi pernapasan perut: diafragma berkontraksi dan mendatar.', 'Rongga dada membesar → tekanan di paru-paru turun → udara masuk.'], [['inspirasi', 'volume naik, tekanan turun']]),
    S('Pertukaran dan pengangkutan gas', ['Di alveolus, O₂ berdifusi ke darah dan CO₂ berdifusi keluar, mengikuti perbedaan tekanan parsial.', 'O₂ diangkut terutama oleh hemoglobin sebagai oksihemoglobin. CO₂ diangkut terutama sebagai ion bikarbonat (HCO₃⁻) dalam plasma. Volume udara pernapasan biasa (volume tidal) sekitar 500 mL.'], [['angkut O₂', 'oksihemoglobin'], ['angkut CO₂', 'sebagian besar HCO₃⁻']], 'Gas berpindah dari tekanan parsial tinggi ke rendah; tidak ada pompa yang mendorongnya.'),
  ], [
    Q('Saat inspirasi pernapasan perut, yang terjadi adalah …', ['diafragma berkontraksi dan mendatar, rongga dada membesar', 'diafragma relaksasi dan melengkung, rongga dada mengecil', 'tulang rusuk turun', 'tekanan di paru-paru naik'], 0, 'Kontraksi diafragma memperbesar rongga dada sehingga tekanan turun dan udara masuk.'),
    Q('Sebagian besar CO₂ diangkut dari jaringan ke paru-paru dalam bentuk …', ['ion bikarbonat dalam plasma', 'oksihemoglobin', 'gas CO₂ terlarut saja', 'ikatan dengan zat besi'], 0, 'Sekitar 70% CO₂ diubah menjadi HCO₃⁻ dengan bantuan enzim karbonat anhidrase dan diangkut dalam plasma.'),
    Q('Volume udara yang keluar masuk paru-paru pada pernapasan biasa disebut …', ['volume tidal', 'kapasitas vital', 'volume residu', 'udara komplementer'], 0, 'Volume tidal adalah udara pernapasan biasa, sekitar 500 mL.', 1),
  ]),
  'BIO.C26.F.ORGAN:EKSKRESI': K([
    S('Pembentukan urine', ['Di nefron ginjal terjadi tiga tahap. **Filtrasi** di glomerulus menghasilkan urine primer. **Reabsorpsi** di tubulus kontortus proksimal menyerap kembali glukosa, asam amino, dan air, sehingga terbentuk urine sekunder. **Augmentasi** di tubulus distal menambahkan zat sisa, sehingga terbentuk urine sesungguhnya.'], [['filtrasi', 'glomerulus → urine primer'], ['reabsorpsi', 'tubulus proksimal → urine sekunder']]),
    S('Organ ekskresi lain dan gangguan', ['Hati merombak sel darah merah tua dan mengubah amonia menjadi urea. Kulit mengeluarkan keringat. Paru-paru mengeluarkan CO₂ dan uap air.', 'Gangguan: nefritis, batu ginjal, dan diabetes insipidus (kekurangan hormon ADH sehingga urine sangat banyak dan encer).'], [['ADH', 'meningkatkan penyerapan air']], 'Glukosa dalam urine (glukosuria) menandakan kadar gula darah melebihi kemampuan tubulus menyerap kembali glukosa.'),
  ], [
    Q('Urine primer dihasilkan melalui proses …', ['filtrasi di glomerulus', 'reabsorpsi di tubulus proksimal', 'augmentasi di tubulus distal', 'penampungan di kandung kemih'], 0, 'Darah disaring di glomerulus, dan hasilnya ditampung di kapsul Bowman sebagai urine primer.', 1),
    Q('Urine sekunder orang sehat tidak lagi mengandung glukosa karena glukosa …', ['diserap kembali pada tahap reabsorpsi', 'tidak ikut tersaring', 'diubah menjadi urea', 'dikeluarkan lewat keringat'], 0, 'Glukosa ikut tersaring di glomerulus, lalu diserap kembali di tubulus kontortus proksimal.'),
    Q('Seseorang mengeluarkan urine sangat banyak dan encer karena kekurangan hormon ADH. Gangguan ini disebut …', ['diabetes insipidus', 'diabetes melitus', 'nefritis', 'batu ginjal'], 0, 'Tanpa ADH, tubulus hanya menyerap sedikit air sehingga urine banyak dan encer.'),
  ]),
  'BIO.C26.F.ORGAN:KOORDINASI': K([
    S('Saraf dan impuls', ['Neuron terdiri dari dendrit (menerima impuls), badan sel, dan akson (meneruskan impuls). Impuls menyeberang antarneuron di **sinapsis** melalui neurotransmiter, misalnya asetilkolin.', 'Lengkung refleks: reseptor → neuron sensorik → neuron konektor di sumsum tulang belakang → neuron motorik → efektor.'], [['sinapsis', 'neurotransmiter'], ['refleks', 'tanpa diolah otak lebih dahulu']]),
    S('Hormon dan indra', ['Hipofisis disebut kelenjar induk karena hormonnya (TSH, FSH, LH) mengatur kelenjar lain; hipofisis juga menghasilkan hormon pertumbuhan (GH). Insulin dan glukagon dari pankreas mengatur kadar gula darah secara berlawanan.', 'Retina mata berisi sel batang (peka cahaya redup) dan sel kerucut (peka warna). Miopi dikoreksi dengan lensa cekung, hipermetropi dengan lensa cembung.'], [['insulin', 'menurunkan gula darah'], ['glukagon', 'menaikkan gula darah']], 'Saraf bekerja cepat lewat impuls; hormon bekerja lebih lambat lewat darah, tetapi efeknya lebih lama.'),
  ], [
    Q('Bagian neuron yang meneruskan impuls dari badan sel ke sel lain adalah …', ['akson', 'dendrit', 'sinapsis', 'nukleus'], 0, 'Dendrit menerima impuls, sedangkan akson membawa impuls keluar dari badan sel.', 1),
    Q('Saat kadar gula darah rendah, pankreas melepaskan hormon …', ['glukagon', 'insulin', 'tiroksin', 'ADH'], 0, 'Glukagon memicu hati memecah glikogen menjadi glukosa sehingga gula darah naik.'),
    Q('Penderita miopi dapat dibantu dengan kacamata berlensa …', ['cekung', 'cembung', 'bifokal', 'silinder'], 0, 'Pada miopi bayangan jatuh di depan retina; lensa cekung menyebarkan cahaya agar bayangan jatuh tepat di retina.'),
  ]),
  'BIO.C26.F.ORGAN:REPRODUKSI': K([
    S('Gametogenesis', ['**Spermatogenesis** di testis: satu spermatosit primer menghasilkan empat sperma. **Oogenesis** di ovarium: satu oosit primer menghasilkan satu ovum dan badan polar.', 'Keduanya melibatkan meiosis, sehingga gamet bersifat haploid (n = 23 kromosom pada manusia).'], [['spermatogenesis', '1 → 4 sperma'], ['oogenesis', '1 → 1 ovum + badan polar']]),
    S('Siklus menstruasi dan fertilisasi', ['Siklus sekitar 28 hari: fase menstruasi, fase folikel (FSH dan estrogen), ovulasi (dipicu lonjakan LH, sekitar hari ke-14), dan fase luteal (progesteron menebalkan dinding rahim).', 'Fertilisasi terjadi di tuba falopi (oviduk). Zigot membelah, lalu menempel (implantasi) di dinding rahim.'], [['ovulasi', 'dipicu lonjakan LH'], ['fertilisasi', 'di tuba falopi']], 'Jika tidak terjadi fertilisasi, progesteron turun dan dinding rahim luruh: menstruasi dimulai.'),
  ], [
    Q('Ovulasi dipicu oleh lonjakan hormon …', ['LH', 'FSH', 'progesteron', 'oksitosin'], 0, 'Kenaikan tajam LH di pertengahan siklus menyebabkan folikel matang melepaskan oosit.'),
    Q('Dari satu oosit primer, oogenesis menghasilkan …', ['satu ovum dan badan polar', 'empat ovum', 'dua ovum', 'empat sperma'], 0, 'Pembelahan meiosis pada oogenesis tidak merata, sehingga hanya satu sel yang menjadi ovum.', 1),
    Q('Fertilisasi pada manusia normalnya terjadi di …', ['tuba falopi', 'rahim', 'ovarium', 'vagina'], 0, 'Sperma bertemu ovum di tuba falopi; zigot kemudian bergerak ke rahim untuk berimplantasi.', 1),
  ]),
  // ---------- Pertumbuhan dan perkembangan ----------
  'BIO.C26.F.TUMBUH:C1': K([
    S('Dari satu sel menjadi banyak jenis', ['Zigot membelah berkali-kali secara mitosis. Sel-selnya lalu **berdiferensiasi**: berubah bentuk dan fungsi menjadi sel khusus, seperti sel otot, sel saraf, atau sel darah.', 'Semua sel tubuh membawa DNA yang sama; yang berbeda adalah gen mana yang aktif.'], [['diferensiasi', 'sel menjadi khusus'], ['dasarnya', 'ekspresi gen berbeda']]),
    S('Sel punca dan spesialisasi', ['**Sel punca** (stem cell) belum terdiferensiasi dan dapat menjadi berbagai jenis sel. Sel punca embrionik lebih fleksibel daripada sel punca dewasa, misalnya yang ada di sumsum tulang.', 'Pada tumbuhan, jaringan meristem tetap mampu membelah dan berdiferensiasi sepanjang hidupnya.'], [['sel punca', 'belum terdiferensiasi']], 'Pertumbuhan = bertambahnya ukuran dan jumlah sel; perkembangan = sel menjadi khusus dan menuju dewasa.'),
  ], [
    Q('Sel saraf dan sel otot pada satu orang memiliki DNA yang sama, tetapi bentuk dan fungsinya berbeda karena …', ['gen yang aktif pada kedua sel berbeda', 'DNA-nya bermutasi', 'jumlah kromosomnya berbeda', 'berasal dari zigot yang berbeda'], 0, 'Diferensiasi terjadi karena ekspresi gen yang berbeda, bukan karena DNA yang berbeda.'),
    Q('Sel yang belum terdiferensiasi dan dapat berkembang menjadi berbagai jenis sel disebut …', ['sel punca', 'sel gamet', 'sel somatik dewasa', 'sel kanker'], 0, 'Sel punca belum memiliki fungsi khusus dan dapat berdiferensiasi menjadi berbagai sel.', 1),
    Q('Berubahnya sel-sel embrio menjadi sel dengan struktur dan fungsi khusus disebut …', ['diferensiasi', 'fertilisasi', 'meiosis', 'regenerasi'], 0, 'Diferensiasi mengubah sel-sel yang mirip menjadi sel khusus seperti sel otot atau sel saraf.', 1),
  ], 4),
  'BIO.C26.F.TUMBUH:TUMBUHAN': K([
    S('Meristem dan perkecambahan', ['**Meristem apikal** di ujung akar dan batang menyebabkan tumbuh memanjang (pertumbuhan primer). **Kambium** menyebabkan batang tumbuhan dikotil membesar (pertumbuhan sekunder).', 'Perkecambahan **epigeal**: kotiledon terangkat ke atas tanah (kacang hijau). **Hipogeal**: kotiledon tetap di dalam tanah (kacang kapri, jagung).'], [['meristem apikal', 'memanjang'], ['kambium', 'membesar']]),
    S('Hormon tumbuhan', ['**Auksin**: pemanjangan sel dan dominansi apikal. **Giberelin**: pemanjangan batang dan perkecambahan biji. **Sitokinin**: merangsang pembelahan sel dan menunda penuaan.', '**Etilen**: pematangan buah. **Asam absisat**: menutup stomata saat kekeringan.'], [['etilen', 'pematangan buah'], ['asam absisat', 'menutup stomata']], 'Memotong pucuk tanaman menghilangkan dominansi apikal oleh auksin, sehingga tunas samping tumbuh.'),
  ], [
    Q('Hormon tumbuhan yang mempercepat pematangan buah adalah …', ['etilen', 'auksin', 'sitokinin', 'asam absisat'], 0, 'Etilen berupa gas yang memicu pematangan, misalnya saat buah diperam dalam wadah tertutup.', 1),
    Q('Pucuk tanaman dipotong agar tanaman tumbuh lebih rimbun. Prinsip yang dipakai adalah …', ['menghilangkan dominansi apikal oleh auksin', 'menambah giberelin', 'menghentikan fotosintesis', 'mempercepat penuaan daun'], 0, 'Auksin dari pucuk menghambat tunas samping; tanpa pucuk, tunas samping tumbuh.'),
    Q('Pertumbuhan sekunder yang membuat batang tumbuhan dikotil membesar disebabkan oleh aktivitas …', ['kambium', 'meristem apikal', 'epidermis', 'stomata'], 0, 'Kambium membelah ke arah dalam dan luar sehingga diameter batang bertambah.'),
  ]),
  'BIO.C26.F.TUMBUH:HEWAN': K([
    S('Tahap embrionik', ['Zigot → **morula** (bola sel padat) → **blastula** (bola berongga) → **gastrula** (terbentuk tiga lapisan lembaga) → organogenesis.', 'Tiga lapisan lembaga: **ektoderm** (kulit, sistem saraf), **mesoderm** (otot, tulang, darah, jantung), dan **endoderm** (lapisan saluran pencernaan dan pernapasan, hati).'], [['ektoderm', 'kulit, saraf'], ['mesoderm', 'otot, tulang, darah'], ['endoderm', 'saluran cerna, hati']]),
    S('Tahap pascaembrionik', ['Setelah lahir atau menetas terjadi pertumbuhan, **metamorfosis** (perubahan bentuk besar, misalnya pada katak dan serangga), dan **regenerasi** (menumbuhkan bagian yang hilang, misalnya ekor cicak).', 'Pertumbuhan hewan dipengaruhi gen, hormon (misalnya hormon pertumbuhan dan tiroksin), serta nutrisi.'], [['regenerasi', 'menumbuhkan bagian yang hilang']], 'Urutan tahap embrio: morula → blastula → gastrula. Gastrula ditandai tiga lapisan lembaga.'),
  ], [
    Q('Urutan tahap perkembangan embrio yang benar adalah …', ['zigot → morula → blastula → gastrula', 'zigot → blastula → morula → gastrula', 'morula → zigot → gastrula → blastula', 'zigot → gastrula → blastula → morula'], 0, 'Zigot membelah menjadi morula yang padat, lalu blastula yang berongga, kemudian gastrula dengan tiga lapisan lembaga.', 1),
    Q('Sistem saraf manusia berkembang dari lapisan lembaga …', ['ektoderm', 'mesoderm', 'endoderm', 'blastosol'], 0, 'Ektoderm membentuk kulit dan sistem saraf.'),
    Q('Cicak yang menumbuhkan kembali ekornya setelah putus menunjukkan kemampuan …', ['regenerasi', 'metamorfosis', 'diferensiasi embrio', 'gastrulasi'], 0, 'Regenerasi adalah kemampuan menumbuhkan kembali bagian tubuh yang hilang.', 1),
  ]),
  'BIO.C26.F.TUMBUH:EKSPERIMEN': K([
    S('Merancang percobaan', ['Contoh pertanyaan: apakah intensitas cahaya memengaruhi tinggi kecambah?', '**Variabel bebas**: yang sengaja diubah (intensitas cahaya). **Variabel terikat**: yang diukur (tinggi kecambah). **Variabel kontrol**: yang dibuat sama (jenis biji, air, media, suhu, lama pengamatan).'], [['bebas', 'diubah'], ['terikat', 'diukur'], ['kontrol', 'dibuat sama']]),
    S('Membaca data pertumbuhan', ['Ukur pada waktu yang sama setiap hari, pakai beberapa biji untuk tiap perlakuan, lalu hitung rata-ratanya.', 'Kurva pertumbuhan umumnya berbentuk S (sigmoid): lambat di awal, cepat di tengah, lalu melambat dan konstan.'], [['kurva pertumbuhan', 'sigmoid (S)']], 'Satu perlakuan dengan satu biji saja belum bisa dipercaya; ulangan mengurangi pengaruh kebetulan.'),
  ], [
    Q('Pada percobaan pengaruh pupuk terhadap tinggi tanaman, variabel terikatnya adalah …', ['tinggi tanaman', 'jenis pupuk', 'jenis tanaman', 'banyak air yang diberikan'], 0, 'Variabel terikat adalah hasil yang diukur, yaitu tinggi tanaman.', 1),
    Q('Dalam percobaan pengaruh cahaya terhadap kecambah, banyak air siraman harus …', ['dibuat sama untuk semua perlakuan', 'dibedakan untuk tiap perlakuan', 'ditiadakan', 'diubah secara acak setiap hari'], 0, 'Air adalah variabel kontrol. Jika berbeda, perbedaan tinggi tidak bisa dipastikan berasal dari cahaya.'),
    Q('Kurva pertumbuhan kecambah yang lambat di awal, cepat di tengah, lalu melambat disebut kurva …', ['sigmoid', 'linear', 'menurun', 'acak'], 0, 'Bentuk S (sigmoid) menggambarkan fase lambat, fase cepat, lalu fase yang hampir tetap.', 1),
  ]),
  // ---------- Evolusi ----------
  'BIO.C26.F.EVOLUSI:C1': K([
    S('Sumber variasi', ['Individu dalam satu spesies berbeda-beda (variasi). Variasi yang diwariskan berasal dari **mutasi** (perubahan DNA) dan **rekombinasi gen** saat meiosis dan fertilisasi, misalnya pindah silang dan pemilahan bebas kromosom.'], [['sumber variasi baru', 'mutasi'], ['pengacakan', 'rekombinasi gen']]),
    S('Variasi yang diwariskan', ['Variasi akibat lingkungan saja, misalnya otot yang membesar karena latihan, **tidak diwariskan** ke keturunan.', 'Hanya variasi pada gen, terutama yang terjadi di sel kelamin, yang dapat diturunkan dan menjadi bahan evolusi.'], [['bahan evolusi', 'variasi genetik yang diwariskan']], 'Tanpa variasi genetik, seleksi alam tidak punya apa pun untuk dipilih.'),
  ], [
    Q('Sumber utama munculnya alel baru dalam populasi adalah …', ['mutasi', 'latihan fisik', 'pengaruh makanan', 'perubahan cuaca harian'], 0, 'Mutasi mengubah urutan DNA sehingga dapat memunculkan alel yang belum pernah ada.', 1),
    Q('Variasi berikut yang dapat diwariskan adalah …', ['golongan darah', 'otot besar karena latihan', 'kulit gelap karena berjemur', 'bekas luka'], 0, 'Golongan darah ditentukan gen; variasi lainnya disebabkan lingkungan dan tidak diwariskan.', 1),
    Q('Pindah silang (crossing over) saat meiosis meningkatkan variasi karena …', ['menghasilkan kombinasi alel baru pada kromosom', 'menambah jumlah kromosom', 'menghapus gen yang merugikan', 'mengubah semua gen menjadi dominan'], 0, 'Pertukaran segmen antarkromosom homolog menghasilkan kombinasi alel yang berbeda dari induknya.'),
  ], 4),
  'BIO.C26.F.EVOLUSI:SELEKSI': K([
    S('Seleksi alam', ['Dalam populasi ada variasi, keturunan yang lahir lebih banyak daripada yang dapat bertahan, dan sifat-sifat diwariskan.', 'Individu dengan sifat yang lebih cocok dengan lingkungannya lebih banyak bertahan dan bereproduksi, sehingga frekuensi sifat itu meningkat dari generasi ke generasi.'], [['seleksi alam', 'sifat cocok → lebih banyak keturunan']]),
    S('Contoh dan adaptasi', ['Ngengat *Biston betularia* berwarna gelap meningkat ketika batang pohon menghitam oleh polusi pada masa Revolusi Industri di Inggris. Bakteri yang tahan antibiotik bertambah jika antibiotik dipakai sembarangan.', '**Adaptasi** adalah sifat hasil seleksi yang membuat organisme cocok dengan lingkungannya, berupa adaptasi morfologi, fisiologi, atau tingkah laku.'], [['adaptasi', 'morfologi, fisiologi, tingkah laku']], 'Individu tidak berubah karena membutuhkan; populasi berubah karena individu yang cocok lebih banyak berketurunan.'),
  ], [
    Q('Setelah antibiotik dipakai berulang kali, bakteri yang resisten makin banyak. Penjelasan yang tepat adalah …', ['bakteri yang sudah resisten bertahan dan berkembang biak, sedangkan yang peka mati', 'bakteri belajar melawan antibiotik', 'antibiotik mengubah semua bakteri menjadi kuat', 'bakteri resisten selalu datang dari luar tubuh'], 0, 'Antibiotik menyeleksi bakteri: yang membawa sifat resisten bertahan dan mewariskan sifat itu.'),
    Q('Menurut teori seleksi alam, jerapah berleher panjang menjadi umum karena …', ['jerapah berleher lebih panjang lebih mampu bertahan dan berketurunan', 'leher jerapah memanjang karena sering dijulurkan', 'jerapah ingin mencapai daun yang tinggi', 'leher panjang didapat dari makanan'], 0, 'Variasi panjang leher sudah ada; yang lehernya lebih panjang lebih berhasil mendapat makanan dan berketurunan. Sifat yang diperoleh selama hidup tidak diwariskan.'),
    Q('Bentuk paruh burung yang sesuai dengan jenis makanannya merupakan contoh adaptasi …', ['morfologi', 'fisiologi', 'tingkah laku', 'kimiawi'], 0, 'Adaptasi morfologi berupa bentuk tubuh atau alat tubuh, seperti bentuk paruh.', 1),
  ]),
  'BIO.C26.F.EVOLUSI:BUKTI': K([
    S('Fosil dan anatomi', ['**Fosil** menunjukkan makhluk hidup berubah dari waktu ke waktu; lapisan batuan yang lebih dalam umumnya lebih tua.', '**Organ homolog**: asal-usulnya sama, fungsinya bisa berbeda (tangan manusia, sayap kelelawar, sirip paus). **Organ analog**: fungsinya sama, asal-usulnya berbeda (sayap burung dan sayap serangga).'], [['homolog', 'asal sama, fungsi bisa beda'], ['analog', 'fungsi sama, asal beda']]),
    S('Embriologi dan molekuler', ['Embrio vertebrata pada tahap awal tampak mirip, misalnya sama-sama memiliki celah faring dan ekor.', 'Makin mirip urutan DNA atau protein (misalnya sitokrom c) dua spesies, makin dekat hubungan kekerabatannya.'], [['bukti molekuler', 'kemiripan DNA dan protein']], 'Organ homolog adalah bukti kekerabatan; organ analog bukan.'),
  ], [
    Q('Tangan manusia dan sayap kelelawar merupakan contoh organ …', ['homolog', 'analog', 'vestigial', 'buatan'], 0, 'Keduanya tersusun dari tulang dengan pola yang sama walaupun fungsinya berbeda.', 1),
    Q('Sayap burung dan sayap kupu-kupu disebut organ analog karena …', ['fungsinya sama, tetapi asal-usul strukturnya berbeda', 'asal-usulnya sama', 'keduanya tidak berfungsi', 'keduanya tersusun dari tulang'], 0, 'Sayap serangga bukan modifikasi anggota tubuh bertulang; kesamaannya hanya pada fungsi terbang.'),
    Q('Urutan DNA simpanse lebih mirip dengan manusia daripada dengan kuda. Kesimpulan yang tepat adalah …', ['manusia dan simpanse berkerabat lebih dekat', 'manusia berasal dari simpanse modern', 'kuda bukan mamalia', 'DNA tidak berhubungan dengan kekerabatan'], 0, 'Kemiripan molekuler menunjukkan nenek moyang bersama yang lebih baru, bukan bahwa satu spesies modern berasal dari spesies modern lainnya.'),
  ]),
  'BIO.C26.F.EVOLUSI:SPESIASI': K([
    S('Isolasi reproduksi', ['Spesies baru terbentuk jika satu populasi terpisah lalu tidak lagi dapat saling kawin dan menghasilkan keturunan fertil.', 'Isolasi **geografis** (sungai, gunung, laut) memisahkan populasi; lama-kelamaan perbedaan genetiknya bertambah karena mutasi dan seleksi yang berbeda.'], [['spesiasi alopatrik', 'didahului isolasi geografis']]),
    S('Mekanisme isolasi dan keanekaragaman', ['Isolasi reproduksi bisa berupa perbedaan waktu kawin, tingkah laku kawin, bentuk alat kelamin, atau keturunan hibrida yang mandul, seperti bagal dari kuda dan keledai.', 'Contoh terkenal adalah burung finch di Kepulauan Galapagos dengan bentuk paruh yang berbeda di tiap pulau.'], [['bagal', 'hibrida mandul']], 'Dua populasi dianggap spesies berbeda jika tidak dapat menghasilkan keturunan yang fertil.'),
  ], [
    Q('Kuda dan keledai dapat kawin dan menghasilkan bagal yang mandul. Hal ini menunjukkan bahwa kuda dan keledai …', ['spesies yang berbeda', 'spesies yang sama', 'satu populasi', 'tidak memiliki isolasi reproduksi'], 0, 'Keturunannya tidak fertil, jadi ada isolasi reproduksi dan keduanya termasuk spesies berbeda.', 1),
    Q('Populasi tupai terpisah oleh ngarai besar selama ribuan tahun dan kini tidak dapat saling kawin. Proses ini disebut …', ['spesiasi alopatrik', 'seleksi buatan', 'mutasi titik', 'adaptasi tingkah laku'], 0, 'Spesiasi alopatrik diawali isolasi geografis yang memisahkan populasi.'),
    Q('Dua spesies katak hidup di kolam yang sama, tetapi satu kawin di awal musim hujan dan yang lain di akhir musim hujan. Jenis isolasinya adalah isolasi …', ['waktu (musim kawin)', 'geografis', 'mekanik', 'hibrida mandul'], 0, 'Perbedaan waktu kawin mencegah perkawinan walaupun keduanya tinggal di tempat yang sama.'),
  ]),
};
