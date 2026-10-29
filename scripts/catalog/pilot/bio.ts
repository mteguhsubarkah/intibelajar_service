import type { PilotCore, PilotQuestion, PilotRelation, PilotSlide, PilotTopic } from './types.js';
// Biologi fase E dan F, mengikuti topik dan inti peta IntiVerse.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2, src: PilotQuestion['src'] = 'UN'): PilotQuestion => ({ p, o, a, why, d, src });
const C = (id: string, title: string, slides: [PilotSlide, PilotSlide], q: PilotQuestion[], extra: Partial<PilotCore> = {}): PilotCore => ({ id, title, slides, q, ...extra });

const BIODIVERSITAS: PilotTopic = {
  code: 'BIO.C26.E.BIODIVERSITAS', subject: 'BIO', title: 'Keanekaragaman dan konservasi', subtitle: 'Tingkat keanekaragaman, konservasi, klasifikasi', phase: 'E', alias: 'keanekaragaman-hayati',
  bekal: ['ciri makhluk hidup', 'klasifikasi sederhana'],
  cores: [
    C('C1', 'Tingkat keanekaragaman', [
      S('Tiga tingkat', ['**Gen**: variasi dalam satu spesies (warna bunga mawar, jenis mangga). **Spesies**: perbedaan antarspesies dalam satu kelompok (harimau, singa, kucing). **Ekosistem**: perbedaan lingkungan beserta penghuninya (hutan hujan, padang rumput, terumbu karang).'], [['satu spesies, bervariasi', 'tingkat gen'], ['beda spesies', 'tingkat spesies']]),
      S('Cara cepat membedakan', ['Tanyakan: apakah semuanya satu spesies? Jika ya ⇒ gen. Jika berbeda spesies ⇒ spesies. Jika yang dibandingkan lingkungan utuh ⇒ ekosistem.'], [['lingkungan berbeda', 'tingkat ekosistem']], 'Varietas atau kultivar (mangga harum manis, mangga golek) selalu tingkat gen.'),
    ], [
      Q('Bunga mawar berwarna merah, putih, dan kuning menunjukkan keanekaragaman tingkat …', ['gen', 'spesies', 'ekosistem', 'bioma'], 0, 'Semuanya mawar dari spesies yang sama; perbedaan warnanya berasal dari variasi gen.', 1),
      Q('Harimau, singa, dan kucing yang tergolong satu famili Felidae menunjukkan keanekaragaman tingkat …', ['gen', 'spesies', 'ekosistem', 'populasi'], 1, 'Ketiganya spesies berbeda dalam satu famili, jadi keanekaragaman tingkat spesies.', 1),
      Q('Contoh keanekaragaman tingkat ekosistem adalah …', ['variasi warna kulit manusia', 'mangga harum manis dan mangga golek', 'hutan hujan tropis, padang rumput, dan terumbu karang', 'kelapa gading dan kelapa hijau'], 2, 'Yang dibandingkan adalah lingkungan utuh beserta makhluk hidupnya, yaitu ekosistem.'),
    ], { min: 4 }),
    C('C2', 'Strategi konservasi', [
      S('In situ dan ex situ', ['**In situ**: perlindungan di habitat aslinya, misalnya taman nasional, cagar alam, suaka margasatwa.', '**Ex situ**: perlindungan di luar habitat asli, misalnya kebun raya, kebun binatang, bank biji, penangkaran.'], [['in situ', 'di habitat asli'], ['ex situ', 'di luar habitat asli']]),
      S('Contoh di Indonesia', ['Taman Nasional **Ujung Kulon** melindungi badak jawa; Taman Nasional **Komodo** melindungi komodo (hewan endemik NTT). Kebun Raya Bogor adalah konservasi ex situ.'], [['endemik', 'hanya ada di daerah tertentu']], 'Kata kunci "taman nasional" atau "cagar alam" ⇒ in situ.'),
    ], [
      Q('Contoh konservasi in situ adalah …', ['Kebun Raya Bogor', 'Taman Nasional Ujung Kulon untuk badak jawa', 'Kebun Binatang Ragunan', 'bank biji tanaman pangan'], 1, 'Taman nasional melindungi badak jawa di habitat aslinya, jadi in situ. Pilihan lain di luar habitat asli.', 1),
      Q('Hewan endemik Indonesia yang dilindungi di habitat aslinya di Nusa Tenggara Timur adalah …', ['komodo', 'harimau benggala', 'panda raksasa', 'gajah afrika'], 0, 'Komodo hanya hidup secara alami di beberapa pulau di NTT dan dilindungi di Taman Nasional Komodo.', 1, 'KM'),
    ], { min: 4 }),
    C('IDENTIFIKASI', 'Kunci determinasi', [
      S('Klasifikasi dan nama ilmiah', ['Urutan takson: **kingdom – filum – kelas – ordo – famili – genus – spesies**. Makin rendah takson, makin banyak persamaan ciri.', 'Nama ilmiah (binomial nomenklatur): **Genus** huruf besar, **spesies** huruf kecil, dicetak miring. Contoh: *Oryza sativa* (padi).'], [['binomial', 'Genus spesies']]),
      S('Kunci dikotom', ['Kunci determinasi berisi **pasangan ciri yang berlawanan**. Ikuti nomor yang sesuai sampai menemukan nama organisme.', 'Contoh: 1a bersayap → 2; 1b tidak bersayap → laba-laba. 2a sayap bersisik → kupu-kupu; 2b sayap tidak bersisik → lalat.'], [['dikotom', 'dua pilihan berlawanan']], 'Baca setiap pasangan sampai habis sebelum memilih.'),
    ], [
      Q('Penulisan nama ilmiah padi yang benar adalah …', ['Oryza sativa', 'oryza sativa', 'Oryza Sativa', 'ORYZA SATIVA'], 0, 'Genus diawali huruf besar dan nama spesies huruf kecil seluruhnya (dicetak miring atau digarisbawahi).', 1),
      Q('Urutan takson dari tingkat tertinggi ke terendah yang benar adalah …', ['kingdom – kelas – filum – ordo – famili – genus – spesies', 'kingdom – filum – kelas – ordo – famili – genus – spesies', 'kingdom – filum – ordo – kelas – genus – famili – spesies', 'filum – kingdom – kelas – ordo – famili – spesies – genus'], 1, 'Urutannya kingdom, filum, kelas, ordo, famili, genus, spesies.'),
      Q('Perhatikan kunci dikotom: 1a bersayap → 2; 1b tidak bersayap → laba-laba; 2a sayap bersisik → kupu-kupu; 2b sayap tidak bersisik → lalat. Hewan bersayap yang sayapnya tidak bersisik adalah …', ['laba-laba', 'kupu-kupu', 'lalat', 'tidak dapat ditentukan'], 2, 'Bersayap ⇒ ke nomor 2. Sayap tidak bersisik ⇒ 2b, yaitu lalat.', 2, 'SNBT'),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'IDENTIFIKASI', 'S']],
};

const MIKROBA: PilotTopic = {
  code: 'BIO.C26.E.MIKROBA', subject: 'BIO', title: 'Virus, bakteri, dan jamur', subtitle: 'Struktur, reproduksi, dan peran mikroorganisme', phase: 'E', alias: 'mikroorganisme',
  bekal: ['sel', 'klasifikasi makhluk hidup'],
  cores: [
    C('C1', 'Bakteri: struktur dan reproduksi', [
      S('Sel prokariotik', ['Bakteri adalah organisme **prokariotik**: tidak memiliki **membran inti**; materi genetiknya berada di sitoplasma. Dinding selnya mengandung peptidoglikan.', 'Bentuk bakteri: **kokus** (bulat), **basil** (batang), **spiral**.'], [['prokariotik', 'tanpa membran inti']]),
      S('Berkembang biak dengan cepat', ['Bakteri bereproduksi aseksual dengan **pembelahan biner**: satu sel membelah menjadi dua.', 'Pertukaran materi genetik bisa terjadi lewat konjugasi, transformasi, dan transduksi.'], [['reproduksi', 'pembelahan biner']], 'Karena membelah dua, jumlah bakteri bertambah secara eksponensial.'),
    ], [
      Q('Ciri khas bakteri yang membedakannya dari jamur adalah …', ['memiliki dinding sel', 'tidak memiliki membran inti', 'berkembang biak', 'bersifat heterotrof'], 1, 'Bakteri prokariotik, tidak memiliki membran inti. Jamur eukariotik.', 1),
      Q('Bakteri berkembang biak secara aseksual dengan cara …', ['bertunas', 'membentuk spora seksual', 'pembelahan biner', 'fragmentasi hifa'], 2, 'Bakteri membelah diri menjadi dua sel anak yang identik (pembelahan biner).', 1),
    ], { min: 4 }),
    C('C2', 'Peran mikroorganisme', [
      S('Menguntungkan', ['*Lactobacillus* → yoghurt. *Acetobacter xylinum* → nata de coco. *Rhizobium* → mengikat nitrogen di bintil akar kacang-kacangan. Bakteri pengurai mengembalikan unsur hara ke tanah.'], [['Acetobacter xylinum', 'nata de coco'], ['Rhizobium', 'fiksasi nitrogen']]),
      S('Merugikan', ['*Salmonella typhi* → tifus. *Mycobacterium tuberculosis* → TBC. Beberapa bakteri merusak makanan atau menyebabkan penyakit tanaman.'], [['Mycobacterium tuberculosis', 'TBC']], 'Hafalkan pasangan nama bakteri dan perannya; sering muncul langsung di soal.'),
    ], [
      Q('Bakteri yang dimanfaatkan dalam pembuatan nata de coco adalah …', ['Lactobacillus bulgaricus', 'Acetobacter xylinum', 'Rhizobium leguminosarum', 'Escherichia coli'], 1, 'Acetobacter xylinum mengubah gula dalam air kelapa menjadi selulosa (nata).', 1),
      Q('Bakteri yang bersimbiosis dengan akar kacang-kacangan dan mengikat nitrogen dari udara adalah …', ['Rhizobium', 'Salmonella', 'Streptococcus', 'Clostridium'], 0, 'Rhizobium membentuk bintil akar dan mengikat N₂ sehingga tanah lebih subur.', 1),
    ], { min: 4 }),
    C('VIRUS', 'Struktur dan replikasi virus', [
      S('Aseluler', ['Virus **tidak memiliki struktur sel**: hanya asam nukleat (DNA atau RNA) yang diselubungi protein (**kapsid**). Virus hanya dapat bereplikasi di dalam **sel hidup** (parasit obligat).'], [['virus', 'asam nukleat + kapsid']]),
      S('Siklus litik', ['Urutan: **adsorpsi** (menempel) → **penetrasi** (memasukkan materi genetik) → **sintesis** (membuat komponen virus) → **perakitan** → **lisis** (sel pecah, virus baru keluar).', 'Pada siklus lisogenik, materi genetik virus bergabung dengan DNA inang dan ikut terbawa saat sel membelah.'], [['litik', 'A → P → S → P → L']], 'Litik diakhiri sel pecah; lisogenik "bersembunyi" dulu di DNA inang.'),
    ], [
      Q('Virus disebut aseluler karena …', ['berukuran sangat kecil', 'tidak memiliki struktur sel', 'dapat dikristalkan', 'hanya memiliki DNA'], 1, 'Virus hanya terdiri dari asam nukleat dan selubung protein, tanpa membran sel, sitoplasma, atau organel.', 1),
      Q('Urutan tahap siklus litik virus yang benar adalah …', ['penetrasi – adsorpsi – sintesis – perakitan – lisis', 'adsorpsi – penetrasi – sintesis – perakitan – lisis', 'adsorpsi – sintesis – penetrasi – lisis – perakitan', 'sintesis – adsorpsi – penetrasi – perakitan – lisis'], 1, 'Virus menempel dulu (adsorpsi), memasukkan materi genetik (penetrasi), membuat komponen (sintesis), merakit, lalu sel pecah (lisis).'),
    ], { min: 5 }),
    C('JAMUR', 'Ciri dan peran jamur', [
      S('Ciri jamur', ['Jamur **eukariotik**, **heterotrof** (tidak berklorofil), dinding selnya tersusun atas **kitin**. Tubuhnya berupa benang **hifa** yang membentuk **miselium**, kecuali ragi yang bersel satu.'], [['dinding sel jamur', 'kitin'], ['heterotrof', 'tidak membuat makanan sendiri']]),
      S('Peran jamur', ['*Saccharomyces cerevisiae* (ragi) → roti dan tapai. *Rhizopus* → tempe. Jamur merang dan tiram → bahan pangan. *Penicillium notatum* → antibiotik penisilin.', 'Merugikan: panu, kutu air, dan racun aflatoksin dari *Aspergillus flavus*.'], [['Rhizopus', 'tempe'], ['Saccharomyces', 'roti dan tapai']], 'Jamur ≠ tumbuhan: tidak berklorofil dan dinding selnya kitin, bukan selulosa.'),
    ], [
      Q('Ragi (Saccharomyces cerevisiae) dimanfaatkan dalam pembuatan …', ['tempe', 'roti dan tapai', 'yoghurt', 'nata de coco'], 1, 'Ragi memfermentasi gula menjadi CO₂ dan alkohol: CO₂ mengembangkan roti, alkohol memberi rasa tapai.', 1),
      Q('Dinding sel jamur tersusun atas …', ['selulosa', 'peptidoglikan', 'kitin', 'pektin'], 2, 'Dinding sel jamur mengandung kitin. Selulosa pada tumbuhan, peptidoglikan pada bakteri.', 1),
      Q('Jamur bersifat heterotrof, artinya jamur …', ['dapat berfotosintesis', 'tidak dapat membuat makanan sendiri', 'hidup di tempat kering', 'berkembang biak secara seksual saja'], 1, 'Jamur tidak memiliki klorofil sehingga memperoleh makanan dari organisme lain atau sisa organik.', 1),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'VIRUS', 'S'], ['C1', 'JAMUR', 'S']],
};

const EKOSISTEM: PilotTopic = {
  code: 'BIO.C26.E.EKOSISTEM', subject: 'BIO', title: 'Keseimbangan ekosistem dan iklim', subtitle: 'Jaring makanan, siklus karbon, daya dukung', phase: 'E', alias: 'ekosistem',
  bekal: ['komponen biotik dan abiotik'],
  cores: [
    C('C1', 'Jaring makanan & populasi', [
      S('Tingkat trofik', ['**Produsen** (tumbuhan) → **konsumen I** (herbivora) → **konsumen II** → **konsumen III**. **Pengurai** menguraikan sisa makhluk hidup.', 'Contoh: padi → tikus → ular → elang. Ular adalah konsumen II.'], [['padi → tikus → ular → elang', 'ular = konsumen II']]),
      S('Aliran energi', ['Hanya sekitar **10%** energi berpindah ke tingkat trofik berikutnya; sisanya hilang sebagai panas.', 'Contoh: produsen 10.000 kkal ⇒ konsumen I 1.000 kkal ⇒ konsumen II 100 kkal.'], [['energi tingkat berikut', '≈ 10%']], 'Itulah sebabnya piramida energi selalu mengecil ke atas.'),
    ], [
      Q('Pada rantai makanan padi → tikus → ular → elang, yang berperan sebagai konsumen tingkat II adalah …', ['padi', 'tikus', 'ular', 'elang'], 2, 'Padi produsen, tikus konsumen I, ular konsumen II, elang konsumen III.', 1),
      Q('Energi pada produsen 10.000 kkal. Jika efisiensi perpindahan energi 10%, energi yang diterima konsumen tingkat II adalah …', ['10 kkal', '100 kkal', '1.000 kkal', '5.000 kkal'], 1, 'Konsumen I: 10% × 10.000 = 1.000 kkal. Konsumen II: 10% × 1.000 = 100 kkal.'),
    ], { min: 4 }),
    C('C2', 'Siklus karbon & lingkungan', [
      S('Perjalanan karbon', ['**Fotosintesis** memindahkan CO₂ dari udara ke tumbuhan. **Respirasi**, **pembusukan**, dan **pembakaran** mengembalikan CO₂ ke udara.', 'Bahan bakar fosil adalah karbon yang tersimpan jutaan tahun.'], [['fotosintesis', 'menyerap CO₂'], ['pembakaran', 'melepas CO₂']]),
      S('Perubahan iklim', ['CO₂ berlebih memperkuat **efek rumah kaca** sehingga suhu bumi naik.', 'Penebangan hutan memperparah: penyerap CO₂ berkurang, dan kayu yang dibakar atau membusuk melepaskan karbon.'], [['deforestasi', 'CO₂ atmosfer naik']], 'Hutan adalah penyimpan karbon; kehilangannya berdampak dua kali.'),
    ], [
      Q('Proses yang memindahkan karbon dari atmosfer ke dalam tubuh tumbuhan adalah …', ['respirasi', 'fotosintesis', 'pembakaran', 'dekomposisi'], 1, 'Tumbuhan menyerap CO₂ dan mengubahnya menjadi glukosa melalui fotosintesis.', 1),
      Q('Penebangan hutan secara besar-besaran meningkatkan kadar CO₂ di atmosfer karena …', ['hutan menghasilkan CO₂ saat tumbuh', 'fotosintesis berkurang dan karbon dari kayu dilepaskan saat dibakar atau membusuk', 'tanah menyerap lebih banyak CO₂', 'hewan hutan berhenti bernapas'], 1, 'Penyerap CO₂ berkurang, sementara karbon yang tersimpan di kayu kembali ke udara.', 2, 'SNBT'),
    ], { min: 4 }),
    C('DAYA_DUKUNG', 'Faktor pembatas populasi', [
      S('Daya dukung', ['Populasi tidak tumbuh tanpa batas. **Faktor pembatas** seperti makanan, ruang, predator, dan penyakit membuat pertumbuhan melambat hingga stabil pada **daya dukung (K)**.', 'Grafiknya berbentuk huruf S (kurva logistik).'], [['daya dukung', 'populasi maksimum yang didukung lingkungan']]),
      S('Gangguan pada jaring makanan', ['Hilangnya satu populasi memengaruhi populasi lain.', 'Contoh: padi → tikus → ular → elang. Bila elang diburu habis, populasi ular **meningkat**, lalu tikus menurun karena dimangsa lebih banyak.'], [['predator hilang', 'mangsa meningkat']], 'Telusuri dampaknya satu langkah demi satu langkah.'),
    ], [
      Q('Populasi rusa di sebuah pulau meningkat pesat lalu stabil pada jumlah tertentu. Jumlah maksimum yang dapat didukung lingkungan itu disebut …', ['densitas', 'daya dukung', 'natalitas', 'mortalitas'], 1, 'Daya dukung adalah jumlah populasi maksimum yang dapat dipertahankan oleh sumber daya lingkungan.', 1),
      Q('Pada rantai makanan padi → tikus → ular → elang, elang diburu hingga habis. Dampak yang paling cepat terjadi adalah populasi ular …', ['meningkat', 'menurun', 'tetap', 'punah'], 0, 'Elang adalah pemangsa ular. Tanpa elang, ular tidak lagi dimangsa sehingga populasinya meningkat.', 2, 'SNBT'),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'DAYA_DUKUNG', 'S']],
};

const SEL: PilotTopic = {
  code: 'BIO.C26.F.SEL', subject: 'BIO', title: 'Struktur sel dan bioproses', subtitle: 'Organel, enzim, transpor membran, respirasi', phase: 'F', alias: 'sel',
  bekal: ['sel sebagai unit kehidupan'],
  cores: [
    C('C1', 'Organel sel', [
      S('Fungsi organel', ['**Mitokondria**: respirasi sel, menghasilkan ATP. **Ribosom**: sintesis protein. **Retikulum endoplasma**: transpor dan sintesis. **Badan Golgi**: sekresi. **Lisosom**: pencernaan intrasel. **Nukleus**: pengendali sel.'], [['mitokondria', 'respirasi, ATP'], ['ribosom', 'sintesis protein']]),
      S('Sel hewan dan tumbuhan', ['Hanya sel tumbuhan: **dinding sel**, **kloroplas**, **vakuola besar**. Hanya sel hewan: **sentriol** dan lisosom yang menonjol.'], [['khas tumbuhan', 'dinding sel, kloroplas, vakuola besar']], 'Mitokondria ada di sel hewan dan tumbuhan.'),
    ], [
      Q('Organel tempat berlangsungnya respirasi sel untuk menghasilkan ATP adalah …', ['ribosom', 'mitokondria', 'badan Golgi', 'lisosom'], 1, 'Mitokondria adalah "pembangkit energi" sel tempat respirasi aerob menghasilkan ATP.', 1),
      Q('Organel yang hanya dimiliki sel tumbuhan dan tidak dimiliki sel hewan adalah …', ['mitokondria', 'ribosom', 'kloroplas', 'nukleus'], 2, 'Kloroplas, tempat fotosintesis, hanya ada pada sel tumbuhan. Organel lain ada di keduanya.', 1),
    ], { min: 4 }),
    C('C2', 'Enzim dan metabolisme', [
      S('Biokatalis', ['**Enzim** adalah protein yang mempercepat reaksi metabolisme tanpa ikut bereaksi. Enzim bekerja **spesifik**: satu enzim untuk substrat tertentu (model gembok–kunci).', 'Contoh: amilase menguraikan amilum, tetapi tidak menguraikan protein.'], [['enzim', 'protein, spesifik']]),
      S('Faktor yang memengaruhi', ['Suhu, pH, konsentrasi substrat, dan inhibitor. Suhu terlalu tinggi menyebabkan **denaturasi** (struktur protein rusak), sehingga enzim tidak berfungsi lagi.'], [['suhu tinggi', 'denaturasi']], 'Setiap enzim punya suhu dan pH optimum.'),
    ], [
      Q('Enzim rusak (mengalami denaturasi) pada suhu tinggi karena enzim tersusun atas …', ['lemak', 'karbohidrat', 'protein', 'asam nukleat'], 2, 'Enzim adalah protein; panas merusak struktur tiga dimensinya.', 1),
      Q('Amilase dapat menguraikan amilum tetapi tidak dapat menguraikan protein. Hal ini menunjukkan sifat enzim yang …', ['bekerja bolak-balik', 'bekerja secara spesifik', 'tidak tahan panas', 'diperlukan dalam jumlah sedikit'], 1, 'Enzim hanya bekerja pada substrat yang bentuknya cocok dengan sisi aktifnya: spesifik.'),
    ], { min: 4 }),
    C('TRANSPORT', 'Transport membran', [
      S('Transpor pasif', ['**Difusi**: zat berpindah dari konsentrasi tinggi ke rendah. **Osmosis**: perpindahan **air** melalui membran semipermeabel dari larutan **hipotonis** (encer) ke **hipertonis** (pekat). Tidak memerlukan energi.'], [['osmosis', 'air: hipotonis → hipertonis']]),
      S('Transpor aktif', ['**Transpor aktif** memindahkan zat **melawan gradien konsentrasi** dan **memerlukan ATP**, misalnya pompa natrium–kalium.', 'Sel darah merah di air murni menggembung lalu pecah (lisis) karena air terus masuk.'], [['transpor aktif', 'melawan gradien, perlu ATP']], 'Air selalu bergerak menuju larutan yang lebih pekat.'),
    ], [
      Q('Sel darah merah dimasukkan ke dalam air murni. Yang akan terjadi adalah sel …', ['mengerut karena air keluar', 'menggembung lalu pecah karena air masuk', 'tetap karena tidak ada perpindahan', 'membelah diri'], 1, 'Air murni hipotonis terhadap sel, sehingga air masuk secara osmosis sampai sel pecah (lisis).'),
      Q('Perbedaan transpor aktif dengan difusi adalah transpor aktif …', ['tidak memerlukan energi', 'memerlukan ATP dan dapat melawan gradien konsentrasi', 'hanya memindahkan air', 'hanya terjadi pada tumbuhan'], 1, 'Transpor aktif memakai energi ATP untuk memindahkan zat dari konsentrasi rendah ke tinggi.', 1),
    ], { min: 5 }),
    C('RESPIRASI', 'Respirasi sel dan ATP', [
      S('Empat tahap respirasi aerob', ['**Glikolisis** (sitoplasma) → **dekarboksilasi oksidatif** → **siklus Krebs** (matriks mitokondria) → **transpor elektron** (membran dalam mitokondria).', 'ATP terbanyak dihasilkan pada **transpor elektron**; totalnya sekitar 36–38 ATP per glukosa.'], [['glikolisis', 'sitoplasma'], ['ATP terbanyak', 'transpor elektron']]),
      S('Tanpa oksigen: fermentasi', ['Jika oksigen kurang, sel melakukan **fermentasi**. Pada otot manusia menghasilkan **asam laktat** (pegal). Pada ragi menghasilkan **alkohol** dan CO₂.'], [['otot kekurangan O₂', 'asam laktat']], 'Fermentasi hanya menghasilkan 2 ATP dari glikolisis.'),
    ], [
      Q('Tahap respirasi aerob yang menghasilkan ATP paling banyak adalah …', ['glikolisis', 'dekarboksilasi oksidatif', 'siklus Krebs', 'transpor elektron'], 3, 'Transpor elektron di membran dalam mitokondria menghasilkan sebagian besar ATP (sekitar 32–34).'),
      Q('Glikolisis berlangsung di …', ['sitoplasma', 'matriks mitokondria', 'membran dalam mitokondria', 'nukleus'], 0, 'Glikolisis memecah glukosa menjadi asam piruvat di sitoplasma.', 1),
      Q('Otot yang bekerja berat dan kekurangan oksigen melakukan fermentasi yang menghasilkan …', ['alkohol', 'asam laktat', 'asam asetat', 'glukosa'], 1, 'Fermentasi pada sel otot manusia menghasilkan asam laktat yang menyebabkan rasa pegal.', 1),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'C2', 'S'], ['C1', 'TRANSPORT', 'S'], ['C1', 'RESPIRASI', 'S']],
};

const GENETIKA: PilotTopic = {
  code: 'BIO.C26.F.GENETIKA', subject: 'BIO', title: 'Pewarisan sifat & informasi genetik', subtitle: 'DNA, pembelahan sel, Mendel, sintesis protein', phase: 'F', alias: 'genetika',
  bekal: ['sel', 'peluang sederhana'],
  cores: [
    C('C1', 'DNA, gen, dan kromosom', [
      S('Struktur DNA', ['DNA berbentuk **heliks ganda**. Basa nitrogennya berpasangan: **A dengan T**, **G dengan C**. **Gen** adalah segmen DNA yang membawa informasi satu sifat; DNA tergulung dalam **kromosom**.'], [['pasangan basa', 'A–T, G–C']]),
      S('Untai komplemen', ['Untai pasangan ditulis dengan mengganti setiap basa dengan pasangannya.', 'Contoh: ATG CCA ⇒ TAC GGT.'], [['ATG CCA', 'TAC GGT']], 'Pada RNA, T diganti U (urasil).'),
    ], [
      Q('Pasangan basa nitrogen yang benar pada DNA adalah …', ['A–G dan T–C', 'A–T dan G–C', 'A–C dan G–T', 'A–U dan G–C'], 1, 'Adenin berpasangan dengan timin, guanin dengan sitosin.', 1),
      Q('Jika urutan basa salah satu untai DNA adalah ATG CCA, urutan basa untai komplemennya adalah …', ['TAC GGT', 'UAC GGU', 'ATG CCA', 'GCA TTG'], 0, 'A ↔ T dan G ↔ C: ATG CCA menjadi TAC GGT.', 1),
    ], { min: 4 }),
    C('C2', 'Pola pewarisan', [
      S('Hukum Mendel', ['**Monohibrid**: BB × bb ⇒ F1 semua Bb (bulat). F1 × F1 ⇒ F2 fenotipe **3 bulat : 1 keriput**.', '**Dihibrid**: BbKk × BbKk ⇒ fenotipe **9 : 3 : 3 : 1**.'], [['F2 monohibrid', '3 : 1'], ['F2 dihibrid', '9 : 3 : 3 : 1']]),
      S('Pewarisan terpaut kromosom X', ['Buta warna terpaut kromosom X. Ibu carrier (XᴮXᵇ) × ayah normal (XᴮY): anak perempuan normal semua (setengahnya carrier), **50% anak laki-laki buta warna**.'], [['XᴮXᵇ × XᴮY', 'anak laki-laki 50% buta warna']], 'Buat papan Punnett; jangan menebak dari pola.'),
    ], [
      Q('Kacang ercis bulat (BB) disilangkan dengan keriput (bb). F1 disilangkan sesamanya. Perbandingan fenotipe F2 adalah …', ['1 bulat : 1 keriput', '3 bulat : 1 keriput', '1 bulat : 2 keriput', 'semua bulat'], 1, 'F1 Bb × Bb menghasilkan BB : Bb : bb = 1 : 2 : 1, fenotipe 3 bulat : 1 keriput.', 1),
      Q('Persilangan dua individu bergenotipe BbKk × BbKk (dominan penuh) menghasilkan perbandingan fenotipe …', ['3 : 1', '1 : 2 : 1', '9 : 3 : 3 : 1', '1 : 1 : 1 : 1'], 2, 'Persilangan dihibrid heterozigot menghasilkan fenotipe 9 : 3 : 3 : 1.'),
      Q('Seorang ibu carrier buta warna (XᴮXᵇ) menikah dengan laki-laki normal (XᴮY). Kemungkinan anak laki-laki mereka buta warna adalah …', ['0%', '25%', '50%', '100%'], 2, 'Anak laki-laki menerima Y dari ayah dan salah satu X dari ibu: Xᴮ atau Xᵇ, masing-masing 50%.', 3),
    ], { min: 5 }),
    C('MEIOSIS', 'Mitosis dan meiosis', [
      S('Mitosis', ['Mitosis menghasilkan **2 sel anak diploid (2n)** yang identik dengan induk. Terjadi pada sel tubuh untuk pertumbuhan dan perbaikan jaringan.'], [['mitosis', '2 sel, 2n, identik']]),
      S('Meiosis', ['Meiosis menghasilkan **4 sel anak haploid (n)** dan terjadi pada pembentukan gamet. Terjadi **pindah silang** yang menambah variasi.', 'Sel tubuh manusia 46 kromosom (2n) ⇒ sperma dan ovum 23 kromosom (n).'], [['meiosis', '4 sel, n'], ['gamet manusia', '23 kromosom']], 'Meiosis mengurangi jumlah kromosom menjadi setengah.'),
    ], [
      Q('Hasil akhir pembelahan meiosis adalah …', ['2 sel anak diploid', '2 sel anak haploid', '4 sel anak haploid', '4 sel anak diploid'], 2, 'Meiosis terdiri dari dua kali pembelahan dan menghasilkan 4 sel haploid (n).', 1),
      Q('Sel tubuh manusia memiliki 46 kromosom. Jumlah kromosom pada sel sperma adalah …', ['92', '46', '23', '22'], 2, 'Sperma terbentuk melalui meiosis sehingga jumlah kromosomnya setengah, yaitu 23.', 1),
    ], { min: 4 }),
    C('EKSPRESI', 'Transkripsi dan translasi', [
      S('Dari DNA ke mRNA', ['**Transkripsi** di **nukleus**: DNA cetakan disalin menjadi mRNA. Pasangan basanya sama, kecuali **A pada DNA berpasangan dengan U** pada RNA.', 'Contoh: DNA cetakan TAC GGA ⇒ mRNA AUG CCU.'], [['transkripsi', 'DNA → mRNA (nukleus)']]),
      S('Dari mRNA ke protein', ['**Translasi** di **ribosom**: setiap **kodon** (3 basa mRNA) diterjemahkan menjadi satu asam amino, dibawa oleh tRNA. AUG adalah kodon awal.'], [['translasi', 'mRNA → protein (ribosom)'], ['kodon', '3 basa']], 'Transkripsi = menyalin; translasi = menerjemahkan.'),
    ], [
      Q('Urutan DNA cetakan TAC GGA akan menghasilkan mRNA dengan urutan …', ['ATG CCT', 'AUG CCU', 'UAC GGA', 'TAC GGA'], 1, 'T → A, A → U, C → G, G → C. Jadi TAC GGA menjadi AUG CCU.'),
      Q('Proses translasi dalam sintesis protein berlangsung di …', ['nukleus', 'ribosom', 'mitokondria', 'lisosom'], 1, 'Ribosom membaca kodon mRNA dan merangkai asam amino menjadi protein.', 1),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'C2', 'S'], ['C1', 'MEIOSIS', 'S'], ['C1', 'EKSPRESI', 'S']],
};

const BIOTEK: PilotTopic = {
  code: 'BIO.C26.F.BIOTEK', subject: 'BIO', title: 'Bioteknologi modern', subtitle: 'DNA rekombinan, PCR, manfaat dan dampak', phase: 'F', alias: 'bioteknologi',
  bekal: ['DNA dan gen', 'mikroorganisme'],
  cores: [
    C('C1', 'Rekayasa dan analisis DNA', [
      S('DNA rekombinan', ['Gen yang diinginkan dipotong dengan **enzim restriksi**, disisipkan ke **plasmid** bakteri, lalu disambung dengan **enzim ligase**. Bakteri yang membawa plasmid itu memproduksi protein yang diinginkan.', 'Contoh: insulin manusia diproduksi oleh *E. coli*.'], [['enzim restriksi', 'memotong DNA'], ['ligase', 'menyambung DNA']]),
      S('Analisis DNA', ['Potongan DNA dipisahkan dengan **elektroforesis** menurut ukurannya. Pola pita DNA dipakai untuk tes paternitas dan forensik.'], [['elektroforesis', 'memisahkan potongan DNA']], 'Bioteknologi modern memanipulasi gen; bioteknologi konvensional memakai organisme apa adanya (tempe, tapai).'),
    ], [
      Q('Enzim yang digunakan untuk memotong DNA pada urutan basa tertentu dalam rekayasa genetika adalah …', ['ligase', 'enzim restriksi', 'amilase', 'DNA polimerase'], 1, 'Enzim restriksi (endonuklease) memotong DNA pada urutan pengenalan tertentu.', 1),
      Q('Produksi insulin manusia oleh bakteri Escherichia coli memanfaatkan teknik …', ['kultur jaringan', 'fermentasi konvensional', 'DNA rekombinan', 'hibridisasi'], 2, 'Gen insulin manusia disisipkan ke plasmid bakteri sehingga bakteri memproduksi insulin.', 1),
    ], { min: 5 }),
    C('PCR', 'Prinsip PCR', [
      S('Memperbanyak DNA', ['**PCR (Polymerase Chain Reaction)** menggandakan DNA dalam siklus berulang: **denaturasi** (±94°C, untai terpisah) → **annealing** (±55°C, primer menempel) → **ekstensi** (±72°C, DNA polimerase tahan panas memperpanjang untai).'], [['siklus PCR', 'denaturasi → annealing → ekstensi']]),
      S('Pertumbuhan berlipat', ['Setiap siklus ideal **menggandakan** jumlah DNA: setelah n siklus ada **2ⁿ** kali lipat.', 'Contoh: 1 molekul setelah 5 siklus ⇒ 32 molekul. Dipakai untuk tes diagnosis penyakit dan forensik.'], [['jumlah DNA', '2ⁿ']], 'Enzim yang dipakai harus tahan panas (misalnya Taq polimerase).'),
    ], [
      Q('Urutan tahap dalam satu siklus PCR yang benar adalah …', ['annealing – denaturasi – ekstensi', 'denaturasi – annealing – ekstensi', 'ekstensi – denaturasi – annealing', 'denaturasi – ekstensi – annealing'], 1, 'Untai dipisahkan dulu (denaturasi), primer menempel (annealing), lalu untai diperpanjang (ekstensi).'),
      Q('Dari satu molekul DNA, jumlah molekul DNA setelah 5 siklus PCR yang ideal adalah …', ['10', '16', '25', '32'], 3, 'Setiap siklus menggandakan DNA: 2⁵ = 32 molekul.'),
    ], { min: 5 }),
    C('C2', 'Evaluasi manfaat dan dampak', [
      S('Manfaat', ['Tanaman **transgenik** tahan hama (misalnya jagung Bt) mengurangi penggunaan pestisida. Obat seperti insulin dan vaksin rekombinan menjadi lebih mudah diproduksi.'], [['transgenik', 'organisme dengan gen sisipan']]),
      S('Dampak dan etika', ['Kekhawatiran: gen sisipan **menyebar ke tumbuhan liar**, hama menjadi resisten, berkurangnya keanekaragaman varietas lokal, dan isu keamanan pangan.', 'Karena itu produk transgenik harus melalui uji keamanan hayati sebelum dilepas.'], [['risiko', 'penyebaran gen ke alam']], 'Evaluasi yang baik menimbang manfaat dan risiko, tidak hanya salah satunya.'),
    ], [
      Q('Contoh penerapan bioteknologi modern adalah …', ['pembuatan tempe', 'pembuatan yoghurt', 'jagung transgenik tahan hama', 'pembuatan tapai'], 2, 'Tanaman transgenik dibuat dengan rekayasa genetika (bioteknologi modern). Tempe, yoghurt, dan tapai adalah bioteknologi konvensional.', 1),
      Q('Kekhawatiran utama penanaman tanaman transgenik di alam terbuka adalah …', ['tanaman menjadi lebih kecil', 'gen sisipan dapat menyebar ke tumbuhan liar dan mengganggu ekosistem', 'tanaman tidak dapat berfotosintesis', 'hasil panen pasti menurun'], 1, 'Penyerbukan silang dapat memindahkan gen sisipan ke kerabat liar dengan dampak yang sulit dikendalikan.', 2, 'SNBT'),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'PCR', 'S'], ['C1', 'C2', 'S']],
};

export const BIO_TOPICS: PilotTopic[] = [BIODIVERSITAS, MIKROBA, EKOSISTEM, SEL, GENETIKA, BIOTEK];
export const BIO_RELATIONS: PilotRelation[] = [
  { from: 'BIO.C26.E.BIODIVERSITAS', to: 'BIO.C26.E.MIKROBA', kind: 'REQUIRES', label: 'klasifikasi → mikroorganisme' },
  { from: 'BIO.C26.F.SEL', to: 'BIO.C26.F.GENETIKA', kind: 'REQUIRES', label: 'sel dan nukleus → informasi genetik' },
  { from: 'BIO.C26.F.GENETIKA', to: 'BIO.C26.F.BIOTEK', kind: 'REQUIRES', label: 'DNA dan gen → rekayasa genetika' },
  { from: 'BIO.C26.E.MIKROBA', to: 'BIO.C26.F.BIOTEK', kind: 'REQUIRES', label: 'bakteri dan plasmid → DNA rekombinan' },
  { from: 'BIO.C26.F.SEL', to: 'KIM.C26.F.KARBON', kind: 'RELATED', label: 'enzim dan biomolekul ↔ senyawa karbon' },
  { from: 'BIO.C26.E.EKOSISTEM', to: 'FIS.C26.E.ENERGI', kind: 'RELATED', label: 'siklus karbon ↔ energi dan iklim' },
];
