import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Kimia SMA (Fase F) untuk inti PLANNED dari audit kesenjangan materi (prioritas 2).
// Kunci = "KODE_TOPIK:ID_INTI" di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): Content => ({ slides, q, min });

export const SMA_KIM: Record<string, Content> = {
  // ---------- Larutan elektrolit ----------
  'KIM.C26.F.ELEKTROLIT:C1': K([
    S('Dari mana ion dalam larutan', ['Senyawa ion seperti NaCl **terdisosiasi** di dalam air: ion-ionnya terlepas, NaCl → Na⁺ + Cl⁻.', 'Senyawa kovalen polar seperti HCl **terionisasi** saat bereaksi dengan air: HCl → H⁺ + Cl⁻.'], [['NaCl(aq)', 'Na⁺ + Cl⁻'], ['HCl(aq)', 'H⁺ + Cl⁻']]),
    S('Yang tidak menghasilkan ion', ['Gula (C₁₂H₂₂O₁₁), urea, dan alkohol larut sebagai molekul utuh, sehingga tidak ada ion yang terbentuk.', 'Saat menulis reaksi ionisasi, hitung jumlah ionnya. Contoh: CaCl₂ → Ca²⁺ + 2Cl⁻ menghasilkan 3 ion.'], [['CaCl₂', 'Ca²⁺ + 2Cl⁻ (3 ion)']], 'Jumlah muatan positif dan negatif hasil ionisasi selalu seimbang.'),
  ], [
    Q('Reaksi ionisasi Al₂(SO₄)₃ yang benar adalah …', ['Al₂(SO₄)₃ → 2Al³⁺ + 3SO₄²⁻', 'Al₂(SO₄)₃ → Al³⁺ + SO₄²⁻', 'Al₂(SO₄)₃ → 2Al²⁺ + 3SO₄³⁻', 'Al₂(SO₄)₃ → 3Al³⁺ + 2SO₄²⁻'], 0, 'Dua ion Al³⁺ (muatan +6) diimbangi tiga ion SO₄²⁻ (muatan −6).'),
    Q('Zat berikut yang larut dalam air tanpa menghasilkan ion adalah …', ['glukosa', 'NaOH', 'HCl', 'KCl'], 0, 'Glukosa adalah senyawa kovalen yang larut sebagai molekul utuh.', 1),
    Q('Banyak ion yang dihasilkan dari ionisasi sempurna satu satuan rumus Mg(NO₃)₂ adalah …', ['3', '2', '5', '9'], 0, 'Mg(NO₃)₂ → Mg²⁺ + 2NO₃⁻, jadi ada 1 + 2 = 3 ion.'),
  ], 4),
  'KIM.C26.F.ELEKTROLIT:C2': K([
    S('Derajat ionisasi', ['**Derajat ionisasi α** = banyak zat yang terionisasi dibagi banyak zat mula-mula.', 'Elektrolit **kuat**: α ≈ 1 (terionisasi sempurna). Elektrolit **lemah**: 0 < α < 1. **Nonelektrolit**: α = 0.'], [['derajat ionisasi', 'α = terionisasi / mula-mula']]),
    S('Contoh tiap kelompok', ['Kuat: asam kuat (HCl, H₂SO₄, HNO₃), basa kuat (NaOH, KOH), dan sebagian besar garam (NaCl).', 'Lemah: asam lemah (CH₃COOH, HF) dan basa lemah (NH₃ atau NH₄OH). Nonelektrolit: gula, urea, alkohol.'], [['kuat', 'HCl, NaOH, NaCl'], ['lemah', 'CH₃COOH, NH₄OH']], 'Kuat-lemahnya elektrolit ditentukan jenis zatnya, bukan seberapa pekat larutannya.'),
  ], [
    Q('Kelompok zat berikut yang semuanya elektrolit kuat adalah …', ['HCl, NaOH, KNO₃', 'CH₃COOH, NaCl, urea', 'NH₄OH, HF, gula', 'HCl, alkohol, NaCl'], 0, 'HCl (asam kuat), NaOH (basa kuat), dan KNO₃ (garam) terionisasi sempurna dalam air.'),
    Q('Dari 0,2 mol asam lemah HA, sebanyak 0,01 mol terionisasi. Derajat ionisasinya adalah …', ['0,05', '0,01', '0,2', '0,5'], 0, 'α = 0,01 / 0,2 = 0,05.', 1),
    Q('Larutan cuka (CH₃COOH) termasuk elektrolit lemah karena …', ['hanya sebagian molekulnya terionisasi', 'tidak menghasilkan ion sama sekali', 'terionisasi sempurna', 'merupakan senyawa ion'], 0, 'Asam asetat adalah asam lemah, sehingga hanya sebagian kecil molekulnya yang terionisasi (0 < α < 1).'),
  ], 4),
  'KIM.C26.F.ELEKTROLIT:DAYAHANTAR': K([
    S('Uji daya hantar', ['Alat uji: dua elektrode dicelupkan ke larutan dan dihubungkan dengan lampu dan baterai.', 'Elektrolit kuat: lampu **menyala terang** dan banyak gelembung gas. Elektrolit lemah: lampu **redup atau tidak menyala**, tetapi ada gelembung. Nonelektrolit: lampu tidak menyala dan tidak ada gelembung.'], [['kuat', 'lampu terang + banyak gelembung'], ['lemah', 'redup/mati + sedikit gelembung'], ['nonelektrolit', 'mati, tanpa gelembung']]),
    S('Mengapa larutan menghantar', ['Arus listrik dalam larutan dibawa oleh **ion-ion yang bergerak bebas**, bukan oleh elektron.', 'NaCl padat tidak menghantar karena ionnya terikat dalam kisi kristal; lelehan atau larutan NaCl menghantar karena ionnya bebas bergerak.'], [['pembawa muatan', 'ion yang bebas bergerak']], 'Gelembung gas di elektrode menandakan ada reaksi, jadi ada ion, walaupun lampu tidak menyala.'),
  ], [
    Q('Hasil uji: larutan P lampu tidak menyala tetapi ada gelembung; larutan Q lampu menyala terang dengan banyak gelembung. Kesimpulan yang tepat adalah …', ['P elektrolit lemah, Q elektrolit kuat', 'P nonelektrolit, Q elektrolit kuat', 'P elektrolit kuat, Q elektrolit lemah', 'keduanya nonelektrolit'], 0, 'Gelembung pada P menunjukkan ada ion walaupun sedikit (lemah). Q menyala terang, jadi elektrolit kuat.'),
    Q('Kristal garam dapur kering tidak menghantarkan listrik karena …', ['ion-ionnya tidak dapat bergerak bebas', 'tidak memiliki ion', 'merupakan senyawa kovalen', 'bersifat asam'], 0, 'Dalam padatan, ion Na⁺ dan Cl⁻ terikat kuat pada kisi kristal sehingga tidak bisa membawa arus.'),
    Q('Larutan yang lampunya tidak menyala dan tidak menghasilkan gelembung adalah larutan …', ['gula', 'HCl', 'NaOH', 'cuka'], 0, 'Gula adalah nonelektrolit: tidak ada ion yang membawa arus atau bereaksi di elektrode.', 1),
  ], 4),
  // ---------- Sifat koligatif larutan ----------
  'KIM.C26.F.KOLIGATIF:C1': K([
    S('Molalitas', ['**Molalitas m** = mol zat terlarut per **kilogram pelarut**, atau m = (massa / Mr) × (1000 / p), dengan p massa pelarut dalam gram.', 'Molalitas tidak berubah oleh suhu karena memakai massa, bukan volume.'], [['molalitas', 'm = (g / Mr) × (1000 / p)']]),
    S('Fraksi mol', ['**Fraksi mol** zat terlarut: X_t = n_t / (n_t + n_p). Fraksi mol pelarut: X_p = n_p / (n_t + n_p).', 'Jumlah semua fraksi mol dalam larutan selalu 1: X_t + X_p = 1.'], [['fraksi mol', 'X_t = n_t / (n_t + n_p)'], ['jumlah', 'X_t + X_p = 1']], 'Molalitas memakai massa pelarut, bukan massa larutan dan bukan volume larutan.'),
  ], [
    Q('Sebanyak 6 g urea (Mr = 60) dilarutkan dalam 250 g air. Molalitas larutan adalah …', ['0,4 m', '0,1 m', '0,025 m', '2,5 m'], 0, 'n = 6/60 = 0,1 mol, jadi m = 0,1 × 1000/250 = 0,4 m.'),
    Q('Sebuah larutan berisi 0,2 mol glukosa dan 9,8 mol air. Fraksi mol glukosa adalah …', ['0,02', '0,98', '0,2', '0,04'], 0, 'X = 0,2 / (0,2 + 9,8) = 0,2 / 10 = 0,02.', 1),
    Q('Fraksi mol zat terlarut dalam suatu larutan adalah 0,15. Fraksi mol pelarutnya adalah …', ['0,85', '0,15', '1,15', '0,30'], 0, 'X_t + X_p = 1, jadi X_p = 1 − 0,15 = 0,85.', 1),
  ]),
  'KIM.C26.F.KOLIGATIF:UAP': K([
    S('Hukum Raoult', ['Zat terlarut yang tidak mudah menguap mengurangi banyak molekul pelarut di permukaan, sehingga tekanan uap larutan turun.', 'Hukum Raoult: **P = X_p · P°**, dengan P° tekanan uap pelarut murni.'], [['tekanan uap larutan', 'P = X_p · P°']]),
    S('Besar penurunannya', ['Penurunan tekanan uap: **ΔP = P° − P = X_t · P°**.', 'Contoh: P° air = 30 mmHg dan X_t = 0,1, maka ΔP = 3 mmHg dan P = 27 mmHg.'], [['penurunan', 'ΔP = X_t · P°']], 'Sifat koligatif hanya bergantung pada banyaknya partikel zat terlarut, bukan jenisnya.'),
  ], [
    Q('Tekanan uap air murni pada suhu tertentu 32 mmHg. Tekanan uap larutan dengan fraksi mol zat terlarut 0,25 adalah …', ['24 mmHg', '8 mmHg', '32 mmHg', '40 mmHg'], 0, 'X_p = 1 − 0,25 = 0,75, jadi P = 0,75 × 32 = 24 mmHg.'),
    Q('Besarnya penurunan tekanan uap larutan bergantung pada …', ['banyaknya partikel zat terlarut', 'warna zat terlarut', 'jenis zat terlarut', 'bentuk wadah'], 0, 'Penurunan tekanan uap adalah sifat koligatif, yang ditentukan banyaknya partikel, bukan jenisnya.', 1),
    Q('Pada 25 °C tekanan uap air murni 24 mmHg. Penurunan tekanan uap larutan dengan fraksi mol zat terlarut 0,05 adalah …', ['1,2 mmHg', '22,8 mmHg', '0,05 mmHg', '2,4 mmHg'], 0, 'ΔP = X_t · P° = 0,05 × 24 = 1,2 mmHg.'),
  ]),
  'KIM.C26.F.KOLIGATIF:DIDIHBEKU': K([
    S('Titik didih naik, titik beku turun', ['Larutan mendidih pada suhu lebih tinggi dan membeku pada suhu lebih rendah daripada pelarut murninya.', '**ΔTb = Kb · m** dan **ΔTf = Kf · m**. Untuk air: Kb = 0,52 °C/m dan Kf = 1,86 °C/m.'], [['kenaikan titik didih', 'ΔTb = Kb · m'], ['penurunan titik beku', 'ΔTf = Kf · m']]),
    S('Menghitung titik didih dan titik beku', ['Titik didih larutan = titik didih pelarut + ΔTb. Titik beku larutan = titik beku pelarut − ΔTf.', 'Contoh: larutan urea 0,5 m dalam air memiliki ΔTf = 1,86 × 0,5 = 0,93 °C, jadi titik bekunya −0,93 °C.'], [['air', 'Kb = 0,52; Kf = 1,86 °C/m']], 'Penerapannya: garam ditaburkan di jalan bersalju dan etilen glikol dicampurkan ke air radiator agar tidak cepat membeku.'),
  ], [
    Q('Larutan glukosa 0,2 m dalam air (Kb = 0,52 °C/m) mendidih pada suhu …', ['100,104 °C', '100,52 °C', '99,896 °C', '100,2 °C'], 0, 'ΔTb = 0,52 × 0,2 = 0,104 °C, jadi titik didihnya 100 + 0,104 = 100,104 °C.'),
    Q('Sebanyak 18 g glukosa (Mr = 180) dilarutkan dalam 500 g air (Kf = 1,86 °C/m). Titik beku larutan adalah …', ['−0,372 °C', '−0,186 °C', '0,372 °C', '−3,72 °C'], 0, 'm = (18/180) × (1000/500) = 0,2 m. ΔTf = 1,86 × 0,2 = 0,372 °C, jadi titik bekunya −0,372 °C.', 3),
    Q('Garam ditaburkan di jalan bersalju karena …', ['menurunkan titik beku air sehingga es mencair pada suhu di bawah 0 °C', 'menaikkan titik beku air', 'menaikkan suhu udara', 'membuat es lebih keras'], 0, 'Larutan garam membeku pada suhu di bawah 0 °C, sehingga es dapat mencair walaupun udara di bawah 0 °C.', 1),
  ]),
  'KIM.C26.F.KOLIGATIF:OSMOSIS': K([
    S('Tekanan osmosis', ['Osmosis adalah perpindahan pelarut melalui membran semipermeabel dari larutan encer ke larutan pekat.', 'Tekanan osmosis adalah tekanan yang diperlukan untuk menghentikan osmosis: **π = M · R · T**, dengan R = 0,082 L·atm/(mol·K) dan T dalam kelvin.'], [['tekanan osmosis', 'π = MRT'], ['R', '0,082 L·atm/(mol·K)']]),
    S('Isotonik, hipotonik, hipertonik', ['Larutan **isotonik** memiliki tekanan osmosis yang sama. Cairan infus dibuat isotonik dengan darah.', 'Sel darah merah dalam larutan **hipertonik** mengerut karena air keluar; dalam larutan **hipotonik** menggembung, bahkan pecah, karena air masuk.'], [['hipertonik', 'air keluar dari sel'], ['hipotonik', 'air masuk ke sel']], 'Ubah suhu ke kelvin: T = °C + 273.'),
  ], [
    Q('Tekanan osmosis larutan glukosa 0,1 M pada 27 °C (R = 0,082 L·atm/mol·K) adalah …', ['2,46 atm', '0,22 atm', '24,6 atm', '0,246 atm'], 0, 'T = 27 + 273 = 300 K, jadi π = 0,1 × 0,082 × 300 = 2,46 atm.'),
    Q('Cairan infus harus bersifat isotonik dengan darah agar …', ['sel darah tidak mengerut atau pecah', 'infus lebih cepat habis', 'darah menjadi lebih encer', 'sel darah membelah'], 0, 'Tekanan osmosis yang sama membuat air tidak berpindah berlebihan masuk atau keluar sel darah.', 1),
    Q('Sayuran yang direndam dalam larutan garam pekat menjadi layu karena …', ['air keluar dari sel sayuran ke larutan yang lebih pekat', 'garam masuk dan mengeringkan sel', 'sel menyerap terlalu banyak air', 'suhu larutan turun'], 0, 'Larutan garam pekat bersifat hipertonik, sehingga air berpindah keluar dari sel secara osmosis.'),
  ]),
  'KIM.C26.F.KOLIGATIF:VANTHOFF': K([
    S('Elektrolit menghasilkan lebih banyak partikel', ['Satu satuan NaCl dalam air menjadi dua ion, sehingga efek koligatifnya hampir dua kali larutan nonelektrolit dengan molalitas yang sama.', 'Faktor van \'t Hoff: **i = 1 + (n − 1)α**, dengan n = banyak ion dan α = derajat ionisasi.'], [['faktor van \'t Hoff', 'i = 1 + (n − 1)α']]),
    S('Rumus untuk larutan elektrolit', ['Semua rumus koligatif dikalikan i: **ΔTb = Kb · m · i**, **ΔTf = Kf · m · i**, dan **π = MRTi**.', 'Elektrolit kuat (α = 1): i = n. Contoh: NaCl → i = 2, CaCl₂ → i = 3. Nonelektrolit: i = 1.'], [['elektrolit kuat', 'i = n']], 'Untuk membandingkan larutan, hitung m × i, yaitu banyaknya partikel.'),
  ], [
    Q('Larutan NaCl 0,2 m (α = 1) dalam air (Kf = 1,86 °C/m) membeku pada suhu …', ['−0,744 °C', '−0,372 °C', '−0,186 °C', '−1,116 °C'], 0, 'Untuk NaCl, i = 2. ΔTf = 1,86 × 0,2 × 2 = 0,744 °C, jadi titik bekunya −0,744 °C.'),
    Q('Larutan berikut yang memiliki titik didih paling tinggi adalah …', ['CaCl₂ 0,1 m', 'NaCl 0,1 m', 'glukosa 0,2 m', 'urea 0,1 m'], 0, 'Bandingkan m × i: CaCl₂ 0,1 × 3 = 0,3; NaCl 0,1 × 2 = 0,2; glukosa 0,2 × 1 = 0,2; urea 0,1. Yang terbesar CaCl₂.', 3),
    Q('Elektrolit biner lemah dengan derajat ionisasi 0,4 memiliki faktor van \'t Hoff sebesar …', ['1,4', '2,4', '0,4', '0,8'], 0, 'i = 1 + (n − 1)α = 1 + (2 − 1) × 0,4 = 1,4.'),
  ]),
  // ---------- Redoks dan elektrokimia ----------
  'KIM.C26.F.REDOKS:C1': K([
    S('Aturan bilangan oksidasi', ['Unsur bebas memiliki biloks 0 (Na, O₂, Fe). Ion tunggal biloksnya sama dengan muatannya (Na⁺ = +1). O umumnya −2 dan H umumnya +1.', 'Jumlah biloks dalam senyawa netral = 0; dalam ion poliatom = muatan ionnya.'], [['unsur bebas', '0'], ['O dan H', '−2 dan +1 (umumnya)']]),
    S('Oksidasi, reduksi, oksidator, reduktor', ['**Oksidasi**: biloks naik (melepas elektron). **Reduksi**: biloks turun (menerima elektron).', '**Oksidator** adalah zat yang mengalami reduksi; **reduktor** adalah zat yang mengalami oksidasi.'], [['oksidasi', 'biloks naik'], ['reduksi', 'biloks turun']], 'Oksidator mengoksidasi zat lain, jadi dirinya sendiri yang tereduksi.'),
  ], [
    Q('Bilangan oksidasi Mn dalam KMnO₄ adalah …', ['+7', '+6', '+4', '+2'], 0, '(+1) + Mn + 4(−2) = 0, jadi Mn = +7.', 1),
    Q('Pada reaksi Zn + Cu²⁺ → Zn²⁺ + Cu, zat yang bertindak sebagai reduktor adalah …', ['Zn', 'Cu²⁺', 'Zn²⁺', 'Cu'], 0, 'Biloks Zn naik dari 0 menjadi +2 (oksidasi), sehingga Zn adalah reduktor.'),
    Q('Bilangan oksidasi S dalam ion SO₄²⁻ adalah …', ['+6', '+4', '+8', '−2'], 0, 'S + 4(−2) = −2, jadi S = +6.'),
  ]),
  'KIM.C26.F.REDOKS:SETARA': K([
    S('Metode setengah reaksi (suasana asam)', ['1) Pisahkan reaksi oksidasi dan reduksi. 2) Setarakan atom selain O dan H. 3) Tambahkan H₂O untuk menyetarakan O, lalu H⁺ untuk menyetarakan H. 4) Tambahkan elektron untuk menyetarakan muatan.', '5) Samakan banyak elektron di kedua setengah reaksi, lalu jumlahkan.'], [['kekurangan O', 'tambah H₂O'], ['kekurangan H', 'tambah H⁺ (suasana asam)']]),
    S('Metode perubahan bilangan oksidasi', ['Tentukan kenaikan dan penurunan biloks, lalu samakan dengan mengalikan koefisien.', 'Contoh: Mn pada MnO₄⁻ → Mn²⁺ turun 5, sedangkan Fe²⁺ → Fe³⁺ naik 1. Perbandingannya 1 MnO₄⁻ : 5 Fe²⁺, sehingga MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O.'], [['MnO₄⁻ → Mn²⁺', 'biloks Mn turun 5']], 'Periksa di akhir: jumlah atom dan jumlah muatan di ruas kiri dan kanan harus sama.'),
  ], [
    Q('Setengah reaksi MnO₄⁻ → Mn²⁺ dalam suasana asam yang setara adalah …', ['MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O', 'MnO₄⁻ + 4H⁺ + 3e⁻ → Mn²⁺ + 2H₂O', 'MnO₄⁻ + 8H⁺ → Mn²⁺ + 4H₂O + 5e⁻', 'MnO₄⁻ + 8H⁺ + 7e⁻ → Mn²⁺ + 4H₂O'], 0, 'O disetarakan dengan 4H₂O dan H dengan 8H⁺. Muatan kiri −1 + 8 = +7 harus menjadi +2, jadi perlu 5 elektron di ruas kiri.'),
    Q('Pada reaksi Cr₂O₇²⁻ + Fe²⁺ → Cr³⁺ + Fe³⁺ (suasana asam), perbandingan koefisien Cr₂O₇²⁻ : Fe²⁺ setelah disetarakan adalah …', ['1 : 6', '1 : 3', '2 : 3', '1 : 2'], 0, 'Setiap Cr turun dari +6 ke +3 (3 elektron) dan ada 2 Cr, jadi 6 elektron. Setiap Fe²⁺ melepas 1 elektron, sehingga perlu 6 Fe²⁺.', 3),
    Q('Dalam metode setengah reaksi suasana asam, kekurangan atom O di salah satu ruas disetarakan dengan menambahkan …', ['H₂O', 'H⁺', 'OH⁻', 'O₂'], 0, 'Kekurangan O ditutup dengan H₂O, lalu kelebihan H disetarakan dengan H⁺.', 1),
  ], 6),
  'KIM.C26.F.REDOKS:VOLTA': K([
    S('Sel volta', ['Sel volta mengubah energi reaksi redoks spontan menjadi energi listrik. **Anode** (kutub −) tempat oksidasi, **katode** (kutub +) tempat reduksi.', 'Notasi sel: anode | ion anode || ion katode | katode, misalnya Zn | Zn²⁺ || Cu²⁺ | Cu.'], [['anode', 'oksidasi (−)'], ['katode', 'reduksi (+)']]),
    S('Potensial sel', ['**E°sel = E°katode − E°anode**, keduanya potensial reduksi standar. Reaksi spontan jika E°sel > 0.', 'Logam dengan E° lebih kecil menjadi anode. Contoh: E° Zn = −0,76 V dan E° Cu = +0,34 V, jadi E°sel = 0,34 − (−0,76) = 1,10 V.'], [['potensial sel', 'E° katode − E° anode']], 'Dalam deret Volta (Li, K, Ba, Ca, Na, Mg, Al, Mn, Zn, Cr, Fe, …), logam di kiri lebih mudah teroksidasi.'),
  ], [
    Q('Diketahui E° Mg²⁺/Mg = −2,37 V dan E° Ag⁺/Ag = +0,80 V. Potensial sel Mg | Mg²⁺ || Ag⁺ | Ag adalah …', ['3,17 V', '1,57 V', '−3,17 V', '2,37 V'], 0, 'E°sel = E°katode − E°anode = 0,80 − (−2,37) = 3,17 V.'),
    Q('Pada sel volta Zn | Zn²⁺ || Cu²⁺ | Cu, elektron mengalir dari …', ['Zn ke Cu melalui kawat', 'Cu ke Zn melalui kawat', 'Zn ke Cu melalui jembatan garam', 'katode ke anode'], 0, 'Elektron dilepas di anode (Zn, tempat oksidasi) dan mengalir lewat kawat ke katode (Cu).'),
    Q('Diketahui E° Fe²⁺/Fe = −0,44 V dan E° Pb²⁺/Pb = −0,13 V. Reaksi yang berlangsung spontan adalah …', ['Fe + Pb²⁺ → Fe²⁺ + Pb', 'Pb + Fe²⁺ → Pb²⁺ + Fe', 'Fe²⁺ + Pb²⁺ → Fe + Pb', 'tidak ada yang spontan'], 0, 'Fe memiliki E° lebih kecil sehingga teroksidasi: E°sel = −0,13 − (−0,44) = +0,31 V, lebih dari nol.', 3),
  ], 6),
  'KIM.C26.F.REDOKS:ELEKTROLISIS': K([
    S('Reaksi di elektrode', ['Elektrolisis memakai listrik untuk menjalankan reaksi redoks yang tidak spontan. **Katode** (kutub −) tempat reduksi, **anode** (kutub +) tempat oksidasi.', 'Larutan berair: di katode, ion logam aktif (golongan IA, IIA, Al, Mn) tidak tereduksi, melainkan air yang tereduksi menjadi H₂. Di anode inert, ion sisa asam oksi (SO₄²⁻, NO₃⁻) tidak teroksidasi, melainkan air yang teroksidasi menjadi O₂.'], [['katode', 'reduksi (−)'], ['anode', 'oksidasi (+)']]),
    S('Hukum Faraday', ['Massa zat yang dihasilkan sebanding dengan muatan listrik: **w = (e · i · t) / 96.500**, dengan e = Ar / banyak elektron.', '1 faraday = 96.500 C, yaitu muatan 1 mol elektron.'], [['hukum Faraday I', 'w = e · i · t / 96.500'], ['1 F', '96.500 C']], 'Ion Cl⁻ tetap teroksidasi menjadi Cl₂ di anode walaupun larutannya berair.'),
  ], [
    Q('Pada elektrolisis larutan CuSO₄ dengan elektrode karbon, zat yang dihasilkan di katode adalah …', ['logam Cu', 'gas H₂', 'gas O₂', 'gas SO₂'], 0, 'Cu²⁺ bukan ion logam aktif, sehingga ion inilah yang tereduksi menjadi Cu di katode.'),
    Q('Arus 10 A dialirkan selama 965 detik ke larutan AgNO₃ (Ar Ag = 108). Massa perak yang mengendap adalah …', ['10,8 g', '1,08 g', '21,6 g', '5,4 g'], 0, 'Muatan = 10 × 965 = 9.650 C = 0,1 F. Ag⁺ + e⁻ → Ag, jadi terbentuk 0,1 mol Ag = 10,8 g.', 3),
    Q('Pada elektrolisis larutan Na₂SO₄ dengan elektrode inert, zat yang terbentuk di katode adalah …', ['gas H₂', 'logam Na', 'gas O₂', 'gas SO₂'], 0, 'Na⁺ adalah ion logam aktif, sehingga yang tereduksi adalah air: 2H₂O + 2e⁻ → H₂ + 2OH⁻.'),
  ], 6),
  'KIM.C26.F.REDOKS:KOROSI': K([
    S('Perkaratan besi', ['Korosi adalah reaksi redoks logam dengan lingkungannya. Besi berkarat jika ada **oksigen dan air**; karat besi adalah Fe₂O₃ · xH₂O.', 'Pada permukaan besi, Fe teroksidasi menjadi Fe²⁺ (bagian anode), dan O₂ tereduksi dengan bantuan air (bagian katode). Garam dan asam mempercepat korosi.'], [['syarat korosi besi', 'O₂ + H₂O'], ['karat', 'Fe₂O₃ · xH₂O']]),
    S('Cara mencegah', ['**Pelapisan**: cat, oli, plastik, atau logam lain (timah pada kaleng, krom pada stang sepeda). **Galvanisasi**: melapisi besi dengan seng.', '**Perlindungan katodik**: menghubungkan besi dengan logam yang lebih mudah teroksidasi, misalnya Mg atau Zn, sebagai logam korban.'], [['logam korban', 'Mg, Zn (E° lebih kecil dari Fe)']], 'Lapisan timah melindungi selama utuh. Jika tergores, besi justru lebih cepat berkarat karena timah kurang aktif dibanding besi.'),
  ], [
    Q('Paku yang paling cepat berkarat adalah paku yang diletakkan di …', ['air garam terbuka', 'minyak goreng', 'udara kering dalam wadah tertutup berisi kapur tohor', 'air yang sudah dididihkan dan ditutup minyak'], 0, 'Air garam menyediakan air, oksigen, dan ion yang mempercepat korosi.', 1),
    Q('Pipa besi di dalam tanah dihubungkan dengan batang magnesium untuk mencegah korosi. Cara ini disebut …', ['perlindungan katodik', 'pelapisan dengan cat', 'galvanisasi', 'elektrolisis'], 0, 'Mg lebih mudah teroksidasi daripada besi, sehingga Mg yang berkarat sebagai logam korban dan besi terlindungi.'),
    Q('Kaleng besi berlapis timah lebih cepat berkarat setelah tergores karena …', ['besi lebih mudah teroksidasi daripada timah, sehingga besi menjadi anode', 'timah bereaksi dengan oksigen lebih dulu', 'goresan mengubah timah menjadi besi', 'timah menarik air dari udara'], 0, 'E° besi lebih kecil daripada E° timah. Saat keduanya bersentuhan dan terbuka, besi yang teroksidasi.', 3),
  ]),
};
