import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Biologi untuk bab yang belum ada di katalog menurut pemeriksaan per kelas 12 November 2026:
// IPA kelas X (klasifikasi, pencemaran dan limbah), Biologi XI (jaringan dan transpor tumbuhan, sistem gerak, sistem imun),
// dan Biologi XII (pola hereditas, mutasi). Kunci = "KODE_TOPIK:ID_INTI" di planned.ts.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 4): Content => ({ slides, q, min });

export const BIOLOGI_LENGKAP: Record<string, Content> = {
  // ---------- Klasifikasi makhluk hidup (kelas 10) ----------
  'BIO.C26.E.KLASIFIKASI:C1': K([
    S('Mengapa diklasifikasikan', ['**Klasifikasi** mengelompokkan makhluk hidup berdasarkan persamaan dan perbedaan ciri, sehingga keanekaragamannya lebih mudah dipelajari.', '**Takson** dari yang tertinggi: domain, kingdom, filum (divisio untuk tumbuhan), kelas, ordo, famili, genus, spesies.'], [['urutan takson', 'kingdom → filum → kelas → ordo → famili → genus → spesies']]),
    S('Makin rendah takson', ['Makin rendah tingkat takson, makin banyak persamaan ciri anggotanya tetapi makin sedikit jumlah anggotanya.', 'Spesies adalah kelompok yang anggotanya dapat kawin dan menghasilkan keturunan fertil.'], undefined, 'Kucing rumah dan harimau satu famili (Felidae), tetapi berbeda genus.'),
  ], [
    Q('Takson yang anggotanya paling banyak memiliki persamaan ciri adalah …', ['spesies', 'kingdom', 'kelas', 'famili'], 0, 'Spesies adalah takson terendah, sehingga anggotanya paling mirip satu sama lain.', 1),
    Q('Urutan takson yang benar dari tinggi ke rendah adalah …', ['kelas – ordo – famili – genus', 'ordo – kelas – genus – famili', 'famili – ordo – kelas – genus', 'genus – famili – ordo – kelas'], 0, 'Ordo berada di bawah kelas, famili di bawah ordo, dan genus di bawah famili.', 1),
    Q('Kuda dan keledai dapat kawin dan menghasilkan bagal yang mandul. Hal ini menunjukkan kuda dan keledai …', ['berbeda spesies', 'satu spesies', 'berbeda kingdom', 'berbeda filum'], 0, 'Anggota satu spesies menghasilkan keturunan fertil; bagal yang mandul menunjukkan induknya berbeda spesies.'),
  ]),
  'BIO.C26.E.KLASIFIKASI:C2': K([
    S('Nama ganda Linnaeus', ['**Carolus Linnaeus** memperkenalkan **tata nama ganda (binomial nomenklatur)**: nama ilmiah terdiri atas dua kata, yaitu nama genus dan penunjuk spesies.', 'Contoh: Oryza sativa (padi) dan Homo sapiens (manusia).']),
    S('Aturan penulisan', ['Huruf pertama nama genus kapital, penunjuk spesies huruf kecil semua, dan seluruh nama dicetak miring atau digarisbawahi terpisah.', 'Nama ilmiah memakai bahasa Latin atau yang dilatinkan, sehingga berlaku sama di seluruh dunia.'], undefined, 'Dua makhluk dengan kata pertama nama ilmiah yang sama berarti satu genus.'),
  ], [
    Q('Penulisan nama ilmiah jagung yang benar adalah …', ['Zea mays, dicetak miring', 'zea mays, dicetak miring', 'Zea Mays, dicetak miring', 'ZEA MAYS, huruf tegak'], 0, 'Genus diawali huruf kapital, penunjuk spesies huruf kecil, dan seluruh nama dicetak miring.', 1),
    Q('Padi (Oryza sativa) dan padi liar (Oryza rufipogon) berkerabat dekat karena …', ['satu genus', 'satu spesies', 'berbeda famili', 'berbeda kingdom'], 0, 'Kata pertama nama ilmiahnya sama, yaitu Oryza, sehingga keduanya satu genus.'),
    Q('Manfaat utama nama ilmiah dibanding nama daerah adalah …', ['berlaku sama di seluruh dunia sehingga tidak menimbulkan salah paham', 'lebih mudah diucapkan', 'menunjukkan ukuran tubuh makhluk hidup', 'menunjukkan tempat hidup makhluk hidup'], 0, 'Satu makhluk bisa punya banyak nama daerah, tetapi hanya satu nama ilmiah yang disepakati.', 1),
  ]),
  'BIO.C26.E.KLASIFIKASI:KINGDOM': K([
    S('Lima kingdom (Whittaker)', ['**Monera** (prokariota, misalnya bakteri), **Protista** (eukariota sederhana, misalnya amoeba dan alga), **Fungi** (jamur, heterotrof, dinding sel kitin), **Plantae** (berfotosintesis), dan **Animalia** (heterotrof, tanpa dinding sel).', 'Dasar pengelompokannya: ada tidaknya membran inti, jumlah sel, dan cara memperoleh makanan.']),
    S('Tiga domain (Woese)', ['Berdasarkan RNA ribosom, makhluk hidup dibagi menjadi tiga domain: **Bacteria**, **Archaea**, dan **Eukarya**.', 'Archaea sering hidup di lingkungan ekstrem seperti sumber air panas, dan secara molekuler lebih dekat dengan Eukarya daripada dengan Bacteria.'], undefined, 'Sistem klasifikasi berubah seiring bertambahnya data, terutama data molekuler.'),
  ], [
    Q('Makhluk hidup bersel satu yang tidak memiliki membran inti dikelompokkan ke dalam kingdom …', ['Monera', 'Protista', 'Fungi', 'Plantae'], 0, 'Tidak adanya membran inti berarti prokariota, yang dalam sistem lima kingdom masuk Monera.', 1),
    Q('Jamur dipisahkan dari tumbuhan karena jamur …', ['heterotrof dan dinding selnya tersusun kitin', 'memiliki klorofil', 'tidak memiliki dinding sel', 'prokariota'], 0, 'Jamur tidak berfotosintesis dan dinding selnya kitin, berbeda dengan tumbuhan yang dinding selnya selulosa.'),
    Q('Dasar pembagian makhluk hidup menjadi tiga domain adalah …', ['perbedaan RNA ribosom', 'bentuk tubuh', 'tempat hidup', 'cara bergerak'], 0, 'Carl Woese membandingkan urutan RNA ribosom dan menemukan tiga kelompok besar.'),
  ]),
  // ---------- Pencemaran dan pengelolaan limbah (kelas 10) ----------
  'BIO.C26.E.LIMBAH:C1': K([
    S('Pencemaran dan polutan', ['**Pencemaran** adalah masuknya zat, energi, atau makhluk hidup ke lingkungan sehingga kualitas lingkungan turun. Zat pencemarnya disebut **polutan**.', 'Jenisnya: pencemaran **air** (limbah industri, deterjen), **tanah** (plastik, pestisida), dan **udara** (asap kendaraan, pembakaran sampah).']),
    S('Eutrofikasi dan indikator', ['Limbah pupuk dan deterjen kaya fosfat memicu **eutrofikasi**: alga tumbuh berlebihan, lalu mati dan diuraikan bakteri, sehingga oksigen terlarut habis dan ikan mati.', 'Kualitas air dapat dinilai dari kadar oksigen terlarut (DO), BOD, dan keberadaan hewan indikator seperti larva capung.'], [['BOD tinggi', 'banyak bahan organik → oksigen cepat habis']], 'Lumut kerak jarang tumbuh di udara yang tercemar belerang dioksida.'),
  ], [
    Q('Ledakan populasi alga di danau akibat limbah pupuk disebut …', ['eutrofikasi', 'biomagnifikasi', 'fotosintesis', 'reboisasi'], 0, 'Nutrien berlebih, terutama fosfat dan nitrat, menyuburkan alga secara berlebihan.', 1),
    Q('Ikan di sungai mati setelah terjadi ledakan alga terutama karena …', ['oksigen terlarut habis saat alga mati diuraikan bakteri', 'suhu air turun', 'air menjadi terlalu jernih', 'alga memakan ikan'], 0, 'Bakteri pengurai memakai banyak oksigen, sehingga kadar oksigen terlarut turun drastis.'),
    Q('Banyaknya larva capung di sungai menunjukkan bahwa air sungai …', ['relatif bersih', 'sangat tercemar', 'mengandung limbah minyak', 'tidak mengandung oksigen'], 0, 'Larva capung membutuhkan air yang kaya oksigen, sehingga menjadi indikator air yang relatif bersih.'),
  ]),
  'BIO.C26.E.LIMBAH:C2': K([
    S('Organik dan anorganik', ['Berdasarkan sifatnya, limbah dibagi menjadi **organik** (mudah terurai, seperti sisa makanan dan daun) dan **anorganik** (sulit terurai, seperti plastik, kaca, dan logam).', 'Berdasarkan wujudnya, ada limbah padat, cair, dan gas.']),
    S('Limbah B3', ['**Limbah B3** (bahan berbahaya dan beracun) bersifat mudah meledak, mudah terbakar, beracun, korosif, atau infeksius. Contohnya baterai bekas, oli bekas, lampu neon, dan limbah medis.', 'Limbah B3 tidak boleh dicampur dengan sampah biasa dan harus diserahkan ke pengelola khusus.'], undefined, 'Plastik dapat bertahan ratusan tahun dan pecah menjadi mikroplastik.'),
  ], [
    Q('Yang termasuk limbah organik adalah …', ['kulit buah', 'botol kaca', 'kaleng minuman', 'kantong plastik'], 0, 'Kulit buah berasal dari makhluk hidup dan mudah diuraikan mikroorganisme.', 1),
    Q('Baterai bekas tergolong limbah B3 karena …', ['mengandung logam berat yang beracun', 'mudah terurai', 'berasal dari tumbuhan', 'tidak berbahaya'], 0, 'Merkuri, kadmium, atau timbal dalam baterai dapat mencemari tanah dan air.'),
    Q('Cara penanganan oli bekas bengkel yang tepat adalah …', ['dikumpulkan dan diserahkan ke pengelola limbah B3 berizin', 'dibuang ke selokan', 'dicampur sampah rumah tangga', 'dibakar di tempat terbuka'], 0, 'Oli bekas termasuk limbah B3 yang harus dikelola khusus agar tidak mencemari air dan tanah.'),
  ]),
  'BIO.C26.E.LIMBAH:DAURULANG': K([
    S('Prinsip 3R', ['**Reduce** (mengurangi), **Reuse** (memakai ulang), dan **Recycle** (mendaur ulang). Urutannya menunjukkan prioritas: mengurangi paling utama.', 'Pemilahan sampah dari rumah memudahkan daur ulang dan pengomposan.']),
    S('Mengolah limbah', ['Limbah organik diolah menjadi **kompos** atau pakan maggot (larva lalat tentara hitam). Limbah plastik, kertas, dan logam dikumpulkan di **bank sampah** untuk didaur ulang.', 'Limbah cair diolah di **IPAL** (instalasi pengolahan air limbah) sebelum dibuang ke sungai.'], undefined, 'Membakar sampah di tempat terbuka bukan pengelolaan; asapnya mencemari udara.'),
  ], [
    Q('Membawa tas belanja sendiri agar tidak memakai kantong plastik termasuk prinsip …', ['reduce', 'reuse', 'recycle', 'recovery'], 0, 'Tindakan ini mengurangi sampah sejak awal (reduce).', 1),
    Q('Pengolahan sisa sayuran menjadi pupuk memanfaatkan proses …', ['pengomposan oleh mikroorganisme', 'pembakaran', 'pelelehan', 'sterilisasi'], 0, 'Mikroorganisme menguraikan bahan organik menjadi kompos yang menyuburkan tanah.'),
    Q('Botol plastik bekas yang dilelehkan dan dibuat menjadi biji plastik baru adalah contoh …', ['recycle', 'reduce', 'reuse', 'pengomposan'], 0, 'Bahan diolah kembali menjadi bahan baku baru, sehingga termasuk daur ulang.', 1),
  ]),
  // ---------- Jaringan dan transpor pada tumbuhan (kelas 11) ----------
  'BIO.C26.F.TUMBUHAN:C1': K([
    S('Meristem dan jaringan dewasa', ['**Jaringan meristem** terus membelah dan menyebabkan pertumbuhan: meristem apikal di ujung akar dan batang (tumbuh memanjang), kambium (tumbuh membesar).', '**Jaringan dewasa**: epidermis (pelindung), parenkim (pengisi dan penyimpan), jaringan penguat (kolenkim, sklerenkim), dan jaringan pengangkut (xilem, floem).']),
    S('Xilem dan floem', ['**Xilem** mengangkut air dan mineral dari akar ke daun. **Floem** mengangkut hasil fotosintesis dari daun ke seluruh bagian tumbuhan.', 'Pada dikotil, xilem dan floem tersusun melingkar dengan kambium di antaranya; pada monokotil berkas pengangkutnya tersebar.'], undefined, 'Stomata pada epidermis daun mengatur pertukaran gas dan penguapan air.'),
  ], [
    Q('Jaringan yang menyebabkan batang tumbuhan dikotil bertambah besar adalah …', ['kambium', 'meristem apikal', 'epidermis', 'parenkim'], 0, 'Kambium membelah ke arah dalam membentuk xilem dan ke arah luar membentuk floem, sehingga batang membesar.'),
    Q('Fungsi floem adalah …', ['mengangkut hasil fotosintesis ke seluruh tubuh tumbuhan', 'mengangkut air dari akar', 'melindungi permukaan daun', 'memperkuat batang'], 0, 'Floem membawa gula hasil fotosintesis dari daun ke bagian yang membutuhkan.', 1),
    Q('Ciri batang monokotil adalah …', ['berkas pengangkut tersebar dan tidak berkambium', 'berkas pengangkut melingkar dengan kambium', 'memiliki lingkaran tahun', 'tidak memiliki xilem'], 0, 'Pada monokotil berkas pengangkut tersebar dan tidak ada kambium, sehingga batangnya tidak membesar seperti dikotil.'),
  ]),
  'BIO.C26.F.TUMBUHAN:C2': K([
    S('Akar, batang, daun', ['**Akar** menyerap air dan mineral serta menambatkan tumbuhan. Rambut akar memperluas permukaan penyerapan.', '**Batang** menyangga tubuh dan menjadi jalur pengangkutan; **daun** adalah tempat utama fotosintesis dan penguapan.']),
    S('Struktur daun', ['Daun tersusun atas epidermis atas dan bawah, **jaringan palisade** (banyak kloroplas), **jaringan bunga karang** (banyak ruang antarsel), serta tulang daun berisi xilem dan floem.', 'Stomata umumnya lebih banyak di epidermis bawah dan dijaga sel penjaga yang mengatur bukaannya.'], undefined, 'Bunga, buah, dan biji adalah organ reproduksi generatif tumbuhan.'),
  ], [
    Q('Bagian akar yang memperluas bidang penyerapan air adalah …', ['rambut akar', 'tudung akar', 'kambium', 'endodermis'], 0, 'Rambut akar adalah tonjolan sel epidermis yang menambah luas permukaan.', 1),
    Q('Jaringan daun yang paling banyak mengandung kloroplas adalah …', ['jaringan palisade', 'jaringan bunga karang', 'epidermis', 'xilem'], 0, 'Sel palisade tersusun rapat di bawah epidermis atas dan kaya kloroplas untuk menangkap cahaya.'),
    Q('Ruang antarsel yang banyak pada jaringan bunga karang berfungsi untuk …', ['pertukaran gas', 'menyimpan cadangan makanan', 'mengangkut air', 'melindungi daun'], 0, 'Ruang antarsel memudahkan CO₂ masuk dan O₂ serta uap air keluar melalui stomata.'),
  ]),
  'BIO.C26.F.TUMBUHAN:AIR': K([
    S('Dari tanah ke daun', ['Air masuk ke akar secara **osmosis**, lalu bergerak melewati korteks dan endodermis menuju xilem.', 'Di xilem, air naik ke daun karena tarikan **transpirasi** (penguapan di daun), daya **kohesi** antarmolekul air, dan **adhesi** air pada dinding pembuluh.'], [['pendorong utama', 'tarikan transpirasi']]),
    S('Faktor transpirasi', ['Transpirasi meningkat bila cahaya terang, suhu tinggi, angin kencang, dan kelembapan udara rendah.', '**Tekanan akar** juga membantu, terlihat dari gutasi: tetesan air di tepi daun pada pagi hari.'], undefined, 'Daun yang layu saat siang terik menunjukkan transpirasi lebih cepat daripada penyerapan air.'),
  ], [
    Q('Gaya utama yang menarik air dari akar ke daun pada pohon tinggi adalah …', ['tarikan transpirasi', 'gravitasi', 'fotosintesis', 'respirasi akar'], 0, 'Penguapan di daun menciptakan tarikan yang diteruskan sepanjang kolom air berkat kohesi.'),
    Q('Transpirasi paling cepat terjadi pada kondisi …', ['panas, berangin, dan udara kering', 'gelap dan lembap', 'dingin dan tanpa angin', 'hujan lebat'], 0, 'Suhu tinggi, angin, dan udara kering memperbesar perbedaan uap air antara daun dan udara.'),
    Q('Air masuk dari tanah ke dalam sel rambut akar melalui proses …', ['osmosis', 'fotosintesis', 'transpirasi', 'gutasi'], 0, 'Air berpindah dari tanah yang lebih encer ke sel akar yang lebih pekat melalui membran.', 1),
  ]),
  'BIO.C26.F.TUMBUHAN:FLOEM': K([
    S('Dari sumber ke penerima', ['Hasil fotosintesis diangkut dalam bentuk **sukrosa** melalui floem dari **sumber** (source, misalnya daun) ke **penerima** (sink, misalnya akar, buah, dan umbi).', 'Proses ini disebut **translokasi** dan dapat berlangsung ke atas maupun ke bawah.'], [['arah', 'sumber (daun) → penerima (buah, akar, umbi)']]),
    S('Bukti cincin batang', ['Jika kulit batang dikupas melingkar sehingga floem terputus, bagian di atas kupasan membengkak karena gula menumpuk, sedangkan bagian bawah kekurangan makanan.', 'Xilem di bagian kayu tetap utuh, sehingga daun tidak langsung layu.'], undefined, 'Umbi kentang dan buah adalah sink yang menyimpan hasil translokasi.'),
  ], [
    Q('Bentuk utama hasil fotosintesis yang diangkut melalui floem adalah …', ['sukrosa', 'amilum', 'protein', 'lemak'], 0, 'Gula diangkut sebagai sukrosa yang larut dan relatif tidak reaktif.', 1),
    Q('Kulit batang sebuah pohon dikupas melingkar. Beberapa minggu kemudian bagian di atas kupasan membengkak karena …', ['hasil fotosintesis menumpuk karena floem terputus', 'air menumpuk karena xilem terputus', 'sel kambium mati', 'akar tumbuh di bagian itu'], 0, 'Floem berada di kulit batang, sehingga gula dari daun tertahan di atas kupasan.'),
    Q('Pada musim berbuah, organ yang berperan sebagai penerima (sink) utama hasil fotosintesis adalah …', ['buah', 'daun dewasa', 'stomata', 'xilem'], 0, 'Buah yang sedang berkembang menerima dan menyimpan banyak gula dari daun.'),
  ]),
  // ---------- Sistem gerak manusia (kelas 11) ----------
  'BIO.C26.F.GERAK:C1': K([
    S('Fungsi rangka', ['Rangka manusia menegakkan tubuh, melindungi organ (tengkorak melindungi otak, rusuk melindungi jantung dan paru-paru), menjadi tempat melekat otot, dan tempat pembentukan sel darah di sumsum merah.', 'Rangka dibagi menjadi **rangka aksial** (tengkorak, tulang belakang, rusuk) dan **rangka apendikular** (anggota gerak beserta gelangnya).']),
    S('Jenis tulang', ['**Tulang rawan** (kartilago) lentur, misalnya di daun telinga dan ujung hidung. **Tulang keras** kaku karena mengandung kalsium fosfat.', 'Pembentukan tulang keras dari tulang rawan disebut **osifikasi**, yang memerlukan kalsium dan vitamin D.'], undefined, 'Tulang pipa (lengan, paha) bertambah panjang di cakram epifisis selama masa pertumbuhan.'),
  ], [
    Q('Tulang yang termasuk rangka aksial adalah …', ['tulang belakang', 'tulang paha', 'tulang lengan atas', 'tulang betis'], 0, 'Rangka aksial adalah sumbu tubuh: tengkorak, tulang belakang, dan rusuk.', 1),
    Q('Sel darah merah dibentuk di …', ['sumsum merah tulang', 'tulang rawan', 'sendi', 'otot'], 0, 'Sumsum merah di tulang pipih dan ujung tulang pipa adalah tempat pembentukan sel darah.'),
    Q('Proses pembentukan tulang keras dari tulang rawan disebut …', ['osifikasi', 'fermentasi', 'fotosintesis', 'difusi'], 0, 'Pada osifikasi, osteoblas mengendapkan kalsium sehingga tulang rawan mengeras.', 1),
  ]),
  'BIO.C26.F.GERAK:C2': K([
    S('Keleluasaan gerak sendi', ['**Sendi** adalah hubungan antartulang. Menurut keleluasaan geraknya ada **sinartrosis** (tidak dapat digerakkan, misalnya pada tengkorak), **amfiartrosis** (gerak terbatas, misalnya antar-ruas tulang belakang), dan **diartrosis** (gerak bebas).', 'Diartrosis dilumasi **cairan sinovial** sehingga gesekan berkurang.']),
    S('Jenis diartrosis', ['**Sendi engsel**: gerak satu arah, misalnya siku dan lutut. **Sendi peluru**: gerak ke segala arah, misalnya bahu dan pangkal paha.', '**Sendi putar**: tulang berputar pada tulang lain, misalnya antara tulang atlas dan tulang pemutar. **Sendi pelana**: gerak dua arah, misalnya pangkal ibu jari.'], undefined, 'Ligamen menghubungkan tulang dengan tulang; tendon menghubungkan otot dengan tulang.'),
  ], [
    Q('Hubungan tulang pada siku termasuk sendi …', ['engsel', 'peluru', 'putar', 'pelana'], 0, 'Siku hanya bisa ditekuk dan diluruskan ke satu arah, seperti engsel pintu.', 1),
    Q('Sendi yang memungkinkan lengan berputar ke segala arah adalah sendi …', ['peluru', 'engsel', 'pelana', 'putar'], 0, 'Kepala tulang lengan atas berbentuk bulat dan masuk ke lekukan gelang bahu.'),
    Q('Cairan sinovial pada sendi berfungsi untuk …', ['mengurangi gesekan antartulang', 'membentuk sel darah', 'mengikat otot ke tulang', 'menyimpan kalsium'], 0, 'Cairan sinovial melumasi ujung-ujung tulang sehingga gerakan lancar.', 1),
  ]),
  'BIO.C26.F.GERAK:OTOT': K([
    S('Jenis otot', ['Ada tiga jenis otot: **otot rangka** (lurik, sadar), **otot polos** (pada organ dalam, tidak sadar), dan **otot jantung** (lurik, tidak sadar).', 'Otot rangka bekerja berpasangan secara **antagonis**: saat biseps berkontraksi lengan menekuk, saat trisep berkontraksi lengan lurus.']),
    S('Mekanisme kontraksi', ['Serabut otot berisi filamen **aktin** dan **miosin**. Saat kontraksi, aktin bergeser di antara miosin sehingga otot memendek (teori pergeseran filamen).', 'Energinya berasal dari **ATP**. Bila oksigen kurang, terbentuk asam laktat yang dapat menyebabkan rasa lelah.'], undefined, 'Otot hanya dapat menarik, tidak dapat mendorong; karena itu dibutuhkan pasangan antagonis.'),
  ], [
    Q('Otot yang bekerja tanpa disadari dan terdapat pada dinding usus adalah …', ['otot polos', 'otot rangka', 'otot lurik lengan', 'otot paha'], 0, 'Otot polos menyusun dinding organ dalam dan bekerja di luar kehendak.', 1),
    Q('Saat lengan diluruskan, otot yang berkontraksi adalah …', ['trisep', 'biseps', 'otot jantung', 'diafragma'], 0, 'Trisep di belakang lengan atas menarik lengan bawah sehingga lengan lurus.'),
    Q('Rasa pegal setelah lari jauh berkaitan dengan …', ['penumpukan asam laktat akibat kekurangan oksigen', 'berlebihnya oksigen di otot', 'bertambahnya kalsium tulang', 'berhentinya kerja aktin dan miosin'], 0, 'Saat oksigen tidak mencukupi, otot memperoleh energi secara anaerob yang menghasilkan asam laktat.'),
  ]),
  'BIO.C26.F.GERAK:GANGGUAN': K([
    S('Kelainan tulang', ['**Osteoporosis**: tulang keropos karena kekurangan kalsium, sering pada lansia. **Rakitis**: tulang lunak dan bengkok karena kekurangan vitamin D pada anak.', 'Kelainan tulang belakang akibat sikap tubuh yang salah: **skoliosis** (melengkung ke samping), **kifosis** (bungkuk), dan **lordosis** (terlalu melengkung ke depan di bagian pinggang).']),
    S('Gangguan sendi dan otot', ['**Dislokasi**: sendi bergeser dari tempatnya. **Artritis**: radang sendi. **Kram**: otot berkontraksi terus-menerus.', 'Pencegahan: cukupi kalsium dan vitamin D, duduk dengan sikap tegak, berolahraga teratur, dan melakukan pemanasan sebelum berolahraga.'], undefined, 'Membawa tas berat di satu bahu dalam waktu lama dapat memicu skoliosis.'),
  ], [
    Q('Tulang belakang yang melengkung ke samping disebut …', ['skoliosis', 'kifosis', 'lordosis', 'osteoporosis'], 0, 'Skoliosis adalah kelengkungan tulang belakang ke kiri atau ke kanan.', 1),
    Q('Rakitis pada anak disebabkan kekurangan …', ['vitamin D', 'vitamin C', 'zat besi', 'serat'], 0, 'Vitamin D dibutuhkan untuk menyerap kalsium; tanpanya tulang anak menjadi lunak dan bengkok.'),
    Q('Upaya yang paling tepat untuk mencegah osteoporosis di usia tua adalah …', ['mencukupi kalsium dan vitamin D serta rutin berolahraga sejak muda', 'menghindari semua jenis olahraga', 'mengurangi minum susu', 'membawa beban berat di satu sisi tubuh'], 0, 'Massa tulang dibangun sejak muda melalui asupan kalsium, vitamin D, dan latihan beban.'),
  ]),
  // ---------- Sistem pertahanan tubuh (kelas 11) ----------
  'BIO.C26.F.IMUN:C1': K([
    S('Dua lapis pertahanan', ['**Pertahanan nonspesifik** melawan semua jenis patogen tanpa membedakan. Lapis pertamanya: kulit, selaput lendir, rambut hidung, air mata, dan asam lambung.', 'Lapis keduanya: **fagositosis** oleh sel darah putih (neutrofil dan makrofag), **inflamasi** (peradangan), dan demam.']),
    S('Inflamasi', ['Saat jaringan terluka, sel melepas **histamin** yang melebarkan pembuluh darah. Daerah luka menjadi merah, hangat, bengkak, dan nyeri.', 'Aliran darah yang meningkat membawa lebih banyak fagosit ke tempat infeksi.'], undefined, 'Nanah adalah kumpulan sel darah putih yang mati bersama patogen dan sel rusak.'),
  ], [
    Q('Contoh pertahanan tubuh lapis pertama adalah …', ['kulit dan selaput lendir', 'antibodi', 'sel T pembunuh', 'vaksin'], 0, 'Kulit dan selaput lendir menghalangi patogen masuk sebelum respons di dalam tubuh bekerja.', 1),
    Q('Sel darah putih yang menelan dan mencerna patogen disebut …', ['fagosit', 'trombosit', 'eritrosit', 'sel plasma'], 0, 'Fagosit, seperti neutrofil dan makrofag, menelan patogen melalui fagositosis.'),
    Q('Daerah luka yang meradang tampak merah dan hangat karena …', ['pembuluh darah melebar akibat histamin', 'sel darah merah rusak', 'tidak ada aliran darah', 'antibodi menempel di kulit'], 0, 'Pelebaran pembuluh membuat lebih banyak darah mengalir ke daerah luka, sehingga terasa hangat dan kemerahan.'),
  ]),
  'BIO.C26.F.IMUN:C2': K([
    S('Limfosit B dan T', ['**Pertahanan spesifik** mengenali **antigen** tertentu dan bekerja melalui limfosit.', '**Limfosit B** membentuk sel plasma yang menghasilkan **antibodi** (respons humoral). **Limfosit T** terdiri atas sel T pembantu dan sel T pembunuh yang menghancurkan sel terinfeksi (respons seluler).'], [['antibodi', 'dibuat oleh sel plasma (dari sel B)']]),
    S('Sel memori', ['Setelah infeksi pertama, terbentuk **sel memori**. Jika antigen yang sama datang lagi, respons sekunder berlangsung lebih cepat dan lebih kuat.', 'Inilah alasan seseorang biasanya tidak terkena cacar air dua kali.'], undefined, 'Antibodi bekerja dengan menetralkan, menggumpalkan, atau menandai antigen agar mudah difagosit.'),
  ], [
    Q('Sel yang menghasilkan antibodi adalah …', ['sel plasma', 'sel T pembunuh', 'neutrofil', 'trombosit'], 0, 'Limfosit B yang aktif berdiferensiasi menjadi sel plasma penghasil antibodi.'),
    Q('Respons imun yang lebih cepat saat terkena antigen yang sama untuk kedua kalinya disebabkan oleh …', ['sel memori', 'histamin', 'asam lambung', 'sel darah merah'], 0, 'Sel memori sudah mengenali antigen sehingga langsung memicu produksi antibodi dalam jumlah besar.', 1),
    Q('Sel yang langsung menghancurkan sel tubuh yang terinfeksi virus adalah …', ['sel T pembunuh', 'sel B', 'sel plasma', 'eritrosit'], 0, 'Sel T pembunuh mengenali sel yang menampilkan antigen virus dan menghancurkannya.'),
  ]),
  'BIO.C26.F.IMUN:VAKSIN': K([
    S('Kekebalan aktif dan pasif', ['**Kekebalan aktif** terbentuk saat tubuh membuat antibodinya sendiri, baik karena sakit (alami) maupun karena **vaksinasi** (buatan).', '**Kekebalan pasif** berasal dari antibodi yang diterima dari luar, misalnya antibodi ibu lewat plasenta atau ASI (alami) dan suntikan serum antibodi (buatan).']),
    S('Cara kerja vaksin', ['**Vaksin** berisi antigen yang dilemahkan, dimatikan, atau bagiannya saja, sehingga merangsang pembentukan sel memori tanpa menimbulkan penyakit berat.', 'Jika banyak orang divaksin, penularan terhambat dan orang yang tidak bisa divaksin ikut terlindungi (**kekebalan kelompok**).'], undefined, 'Kekebalan pasif bekerja cepat tetapi tidak bertahan lama karena tidak membentuk sel memori.'),
  ], [
    Q('Bayi yang mendapat antibodi dari ASI memiliki kekebalan …', ['pasif alami', 'aktif alami', 'aktif buatan', 'pasif buatan'], 0, 'Antibodi berasal dari ibu, bukan dibuat sendiri, dan diperoleh secara alami.', 1),
    Q('Vaksin melindungi tubuh karena …', ['merangsang pembentukan sel memori terhadap antigen tertentu', 'langsung membunuh semua bakteri', 'menggantikan sel darah putih', 'memberikan antibodi siap pakai'], 0, 'Antigen dalam vaksin melatih sistem imun sehingga terbentuk sel memori tanpa sakit berat.'),
    Q('Suntikan serum antibisa ular memberikan kekebalan …', ['pasif buatan', 'aktif buatan', 'aktif alami', 'pasif alami'], 0, 'Antibodi siap pakai disuntikkan dari luar, sehingga kekebalannya pasif dan buatan.'),
  ]),
  'BIO.C26.F.IMUN:GANGGUAN': K([
    S('Alergi dan autoimun', ['**Alergi**: respons imun berlebihan terhadap zat yang sebenarnya tidak berbahaya (alergen), seperti debu atau udang, sehingga histamin dilepaskan.', '**Autoimun**: sistem imun menyerang sel tubuh sendiri, misalnya pada lupus dan diabetes tipe 1.']),
    S('Imunodefisiensi', ['**HIV** menyerang sel T pembantu, sehingga sistem imun melemah. Tahap lanjut infeksinya disebut **AIDS**, ketika tubuh mudah terserang infeksi lain.', 'HIV menular lewat darah, hubungan seksual, dan dari ibu ke bayi; tidak menular lewat bersalaman atau berbagi alat makan.'], undefined, 'Antihistamin meredakan gejala alergi dengan menghambat kerja histamin.'),
  ], [
    Q('Bersin-bersin setiap kali terkena debu adalah contoh …', ['alergi', 'autoimun', 'AIDS', 'vaksinasi'], 0, 'Sistem imun bereaksi berlebihan terhadap debu yang sebenarnya tidak berbahaya.', 1),
    Q('HIV melemahkan sistem imun karena menyerang …', ['sel T pembantu', 'sel darah merah', 'trombosit', 'sel otot'], 0, 'Sel T pembantu mengoordinasi respons imun, sehingga kerusakannya melemahkan pertahanan tubuh.'),
    Q('Lupus termasuk penyakit autoimun karena …', ['sistem imun menyerang jaringan tubuh sendiri', 'disebabkan virus HIV', 'merupakan reaksi terhadap debu', 'terjadi karena kekurangan vitamin'], 0, 'Pada penyakit autoimun, sistem imun gagal membedakan sel sendiri dari benda asing.'),
  ]),
  // ---------- Pola hereditas (kelas 12) ----------
  'BIO.C26.F.HEREDITAS:C1': K([
    S('Interaksi gen', ['Pada **penyimpangan semu**, perbandingan fenotipe F₂ tidak 9 : 3 : 3 : 1 karena gen-gen saling berinteraksi, tetapi pewarisan gennya tetap mengikuti Mendel.', '**Epistasis–hipostasis**: satu gen menutupi ekspresi gen lain yang bukan alelnya, misalnya warna kulit biji gandum dengan F₂ 12 : 3 : 1.'], [['epistasis dominan', '12 : 3 : 1']]),
    S('Interaksi lain', ['**Kriptomeri** (bunga Linaria maroccana): 9 : 3 : 4. **Komplementer** (bunga Lathyrus odoratus): 9 : 7, karena warna muncul hanya jika kedua gen dominan hadir.', '**Polimeri** (warna biji gandum merah): 15 : 1, karena beberapa gen menambah sifat yang sama.'], [['komplementer', '9 : 7'], ['polimeri', '15 : 1']], 'Semua perbandingan ini tetap berjumlah 16 dari persilangan dihibrid.'),
  ], [
    Q('Perbandingan fenotipe F₂ 9 : 7 terjadi pada peristiwa …', ['komplementer', 'polimeri', 'epistasis', 'kriptomeri'], 0, 'Pada komplementer, sifat hanya muncul bila kedua gen dominan hadir bersama (9), sisanya (3 + 3 + 1 = 7) tidak.', 1),
    Q('Persilangan dihibrid menghasilkan F₂ dengan perbandingan 15 : 1. Peristiwa ini disebut …', ['polimeri', 'komplementer', 'kriptomeri', 'pautan'], 0, 'Satu gen dominan saja sudah memunculkan sifat, sehingga hanya homozigot resesif ganda (1/16) yang berbeda.'),
    Q('Persilangan AaBb × AaBb dengan epistasis dominan menghasilkan 160 tanaman. Jumlah tanaman pada kelompok fenotipe yang paling sedikit adalah …', ['10', '30', '120', '40'], 0, 'Perbandingan 12 : 3 : 1 berarti kelompok terkecil 1/16 × 160 = 10 tanaman.', 3),
  ]),
  'BIO.C26.F.HEREDITAS:C2': K([
    S('Pautan', ['**Pautan** (linkage) terjadi bila dua gen atau lebih terletak pada kromosom yang sama sehingga cenderung diwariskan bersama.', 'Akibatnya, kombinasi seperti induk (parental) muncul lebih banyak daripada perkiraan hukum Mendel II.']),
    S('Pindah silang', ['**Pindah silang** (crossing over) adalah pertukaran segmen kromatid kromosom homolog saat meiosis, yang menghasilkan kombinasi baru (rekombinan).', '**Nilai pindah silang** = jumlah rekombinan ÷ jumlah seluruh keturunan × 100%. Makin jauh jarak dua gen, makin besar peluang pindah silang.'], [['nilai pindah silang', 'rekombinan ÷ total × 100%']], 'Nilai pindah silang tidak pernah lebih dari 50%.'),
  ], [
    Q('Gen-gen yang terletak pada satu kromosom dan cenderung diwariskan bersama disebut …', ['pautan', 'pindah silang', 'gagal berpisah', 'epistasis'], 0, 'Gen yang tertaut berada pada kromosom yang sama sehingga ikut berpindah bersama saat meiosis.', 1),
    Q('Dari 1.000 keturunan, terdapat 150 individu rekombinan. Nilai pindah silangnya adalah …', ['15%', '85%', '30%', '1,5%'], 0, 'Nilai pindah silang = 150/1.000 × 100% = 15%.'),
    Q('Pindah silang terjadi pada tahap …', ['profase I meiosis', 'metafase mitosis', 'anafase II meiosis', 'interfase'], 0, 'Pada profase I, kromosom homolog berpasangan dan kromatidnya dapat saling bertukar segmen.'),
  ]),
  'BIO.C26.F.HEREDITAS:SEKS': K([
    S('Kromosom kelamin', ['Pada manusia, perempuan memiliki kromosom kelamin **XX** dan laki-laki **XY**. Sel telur selalu membawa X, sedangkan sperma membawa X atau Y, sehingga peluang anak laki-laki atau perempuan 50%.', '**Pautan seks** terjadi bila gen terletak pada kromosom kelamin, terutama kromosom X.']),
    S('Buta warna dan hemofilia', ['**Buta warna** dan **hemofilia** disebabkan gen resesif tertaut X. Perempuan bisa normal, **karier** (XᴺXⁿ), atau penderita (XⁿXⁿ); laki-laki hanya normal (XᴺY) atau penderita (XⁿY).', 'Karena itu penderita laki-laki lebih banyak: satu alel resesif di kromosom X sudah cukup.'], [['perempuan karier', 'XᴺXⁿ']], 'Ayah tidak menurunkan kromosom X kepada anak laki-lakinya.'),
  ], [
    Q('Seorang ibu karier buta warna menikah dengan laki-laki normal. Peluang seorang anak laki-laki mereka buta warna adalah …', ['50%', '25%', '0%', '100%'], 0, 'Anak laki-laki menerima kromosom X dari ibu, dan separuh sel telur ibu membawa Xⁿ, sehingga peluangnya 50%.'),
    Q('Laki-laki penderita hemofilia menikah dengan perempuan normal homozigot. Anak perempuan mereka …', ['semuanya karier', 'semuanya hemofilia', 'semuanya normal homozigot', '50% hemofilia'], 0, 'Setiap anak perempuan menerima Xⁿ dari ayah dan Xᴺ dari ibu, sehingga semuanya XᴺXⁿ (karier).', 3),
    Q('Jenis kelamin anak manusia ditentukan oleh …', ['kromosom kelamin yang dibawa sperma', 'kromosom kelamin yang dibawa sel telur', 'jumlah autosom', 'golongan darah ibu'], 0, 'Sel telur selalu membawa X, sedangkan sperma membawa X atau Y.', 1),
  ]),
  'BIO.C26.F.HEREDITAS:MANUSIA': K([
    S('Golongan darah ABO', ['Golongan darah ABO ditentukan alel ganda Iᴬ, Iᴮ, dan i. Iᴬ dan Iᴮ **kodominan**, dan keduanya dominan terhadap i.', 'Genotipe: A = IᴬIᴬ atau Iᴬi; B = IᴮIᴮ atau Iᴮi; AB = IᴬIᴮ; O = ii.'], [['golongan AB', 'IᴬIᴮ'], ['golongan O', 'ii']]),
    S('Membaca peta silsilah', ['**Peta silsilah** (pedigree) menelusuri sifat dalam keluarga. Kotak = laki-laki, bulat = perempuan, simbol diarsir = penderita.', 'Jika dua orang tua normal memiliki anak penderita, sifat itu resesif dan kedua orang tua adalah pembawa.'], undefined, 'Albinisme diwariskan sebagai sifat resesif autosomal, sehingga dapat muncul pada anak laki-laki maupun perempuan.'),
  ], [
    Q('Ayah bergolongan darah A heterozigot dan ibu bergolongan darah B heterozigot. Golongan darah anak yang mungkin adalah …', ['A, B, AB, dan O', 'hanya A dan B', 'hanya AB', 'hanya O'], 0, 'Persilangan Iᴬi × Iᴮi menghasilkan IᴬIᴮ, Iᴬi, Iᴮi, dan ii dengan peluang yang sama.'),
    Q('Seorang anak bergolongan darah O. Kemungkinan genotipe kedua orang tuanya adalah …', ['Iᴬi dan Iᴮi', 'IᴬIᴮ dan ii', 'IᴬIᴬ dan Iᴮi', 'IᴬIᴮ dan IᴬIᴮ'], 0, 'Anak O (ii) harus menerima alel i dari ayah dan ibu; di antara pilihan, hanya Iᴬi × Iᴮi yang keduanya membawa i.', 3),
    Q('Dua orang tua normal memiliki anak albino. Kesimpulan yang tepat adalah …', ['albino bersifat resesif dan kedua orang tua pembawa', 'albino bersifat dominan', 'hanya ayah yang pembawa', 'albino tertaut kromosom Y'], 0, 'Sifat yang muncul pada anak tetapi tidak tampak pada kedua orang tua adalah sifat resesif yang dibawa keduanya.'),
  ]),
  // ---------- Mutasi (kelas 12) ----------
  'BIO.C26.F.MUTASI:C1': K([
    S('Perubahan basa DNA', ['**Mutasi** adalah perubahan materi genetik yang dapat diwariskan. **Mutasi gen** (mutasi titik) mengubah satu atau beberapa basa nitrogen DNA.', 'Jenisnya: **substitusi** (basa diganti), **insersi** (basa disisipkan), dan **delesi** (basa hilang).']),
    S('Akibat pada protein', ['Substitusi dapat tidak berpengaruh (kodon baru menyandi asam amino yang sama), mengubah satu asam amino, atau membentuk kodon stop.', 'Insersi dan delesi menggeser kerangka baca (**frameshift**), sehingga seluruh asam amino setelahnya bisa berubah.'], undefined, 'Mutasi pada sel kelamin dapat diwariskan, sedangkan mutasi pada sel tubuh tidak.'),
  ], [
    Q('Penggantian satu basa nitrogen dengan basa lain pada DNA disebut …', ['substitusi', 'insersi', 'delesi', 'translokasi'], 0, 'Substitusi menukar satu basa dengan basa lain tanpa mengubah panjang urutan DNA.', 1),
    Q('Mutasi yang paling mungkin mengubah banyak asam amino sekaligus adalah …', ['delesi satu basa di awal gen', 'substitusi yang menghasilkan kodon sinonim', 'substitusi di akhir gen', 'mutasi pada sel kulit'], 0, 'Delesi satu basa menggeser kerangka baca, sehingga semua kodon sesudahnya berubah.'),
    Q('Anemia sel sabit disebabkan oleh …', ['substitusi satu basa pada gen hemoglobin', 'delesi kromosom', 'kelebihan kromosom 21', 'infeksi virus'], 0, 'Satu basa yang tertukar mengubah asam amino glutamat menjadi valin pada hemoglobin, sehingga sel darah merah berbentuk sabit.'),
  ]),
  'BIO.C26.F.MUTASI:C2': K([
    S('Perubahan struktur kromosom', ['Mutasi kromosom mengubah struktur atau jumlah kromosom. Perubahan struktur: **delesi** (bagian hilang), **duplikasi** (bagian berulang), **inversi** (bagian terbalik), dan **translokasi** (bagian pindah ke kromosom lain).', 'Contoh: sindrom cri du chat disebabkan delesi pada kromosom 5.']),
    S('Perubahan jumlah kromosom', ['**Aneuploidi** adalah kelebihan atau kekurangan satu kromosom akibat **gagal berpisah** (nondisjunction) saat meiosis. Contoh: sindrom Down (trisomi 21, 47 kromosom) dan sindrom Turner (45, X).', '**Poliploidi** adalah kelipatan set kromosom (3n, 4n), yang dimanfaatkan untuk buah tanpa biji seperti semangka triploid.'], [['sindrom Down', 'trisomi 21 (47 kromosom)']], 'Kolkisin dipakai untuk membuat tanaman poliploid.'),
  ], [
    Q('Sindrom Down disebabkan oleh …', ['kelebihan satu kromosom nomor 21', 'kekurangan kromosom X', 'delesi kromosom 5', 'substitusi satu basa'], 0, 'Penderita sindrom Down memiliki tiga kromosom 21 (trisomi), sehingga jumlah kromosomnya 47.', 1),
    Q('Peristiwa gagal berpisahnya kromosom homolog saat meiosis disebut …', ['nondisjunction', 'pindah silang', 'inversi', 'pautan'], 0, 'Nondisjunction membuat sel kelamin kelebihan atau kekurangan kromosom.'),
    Q('Semangka tanpa biji dibuat dengan memanfaatkan …', ['poliploidi', 'aneuploidi', 'delesi', 'translokasi'], 0, 'Semangka triploid (3n) tidak dapat membentuk biji yang normal karena meiosisnya terganggu.'),
  ]),
  'BIO.C26.F.MUTASI:PENYEBAB': K([
    S('Mutagen', ['Mutasi dapat terjadi secara spontan atau dipicu **mutagen**: fisik (sinar UV, sinar X, radiasi radioaktif), kimia (zat dalam asap rokok, pestisida tertentu), dan biologi (beberapa virus).', 'Paparan sinar UV berlebihan dapat merusak DNA sel kulit dan meningkatkan risiko kanker kulit.']),
    S('Merugikan dan menguntungkan', ['Sebagian besar mutasi netral atau merugikan, misalnya kanker dan penyakit genetik.', 'Namun mutasi juga menjadi sumber **variasi** bagi evolusi dan dimanfaatkan dalam pemuliaan, misalnya varietas tanaman unggul hasil iradiasi.'], undefined, 'Tabir surya mengurangi paparan UV yang dapat menyebabkan mutasi pada sel kulit.'),
  ], [
    Q('Yang termasuk mutagen fisik adalah …', ['sinar ultraviolet', 'asap rokok', 'virus hepatitis B', 'pestisida'], 0, 'Sinar UV adalah radiasi, sehingga termasuk mutagen fisik; pilihan lain adalah mutagen kimia atau biologi.', 1),
    Q('Mutasi dianggap penting bagi evolusi karena …', ['menjadi sumber variasi genetik baru', 'selalu menguntungkan', 'tidak dapat diwariskan', 'menghentikan seleksi alam'], 0, 'Variasi baru dari mutasi menjadi bahan yang diseleksi oleh alam.'),
    Q('Pemanfaatan mutasi yang menguntungkan bagi manusia adalah …', ['pembuatan varietas padi unggul melalui iradiasi', 'munculnya kanker kulit', 'munculnya sindrom Down', 'kebalnya bakteri terhadap antibiotik'], 0, 'Iradiasi terkendali menghasilkan mutan yang kemudian diseleksi, misalnya padi yang lebih cepat panen.'),
  ]),
};
