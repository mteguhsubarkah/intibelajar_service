import type { PilotCore, PilotQuestion, PilotRelation, PilotSlide, PilotTopic } from './types.js';
// Kimia fase E dan F, mengikuti topik dan inti peta IntiVerse.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2, src: PilotQuestion['src'] = 'UN'): PilotQuestion => ({ p, o, a, why, d, src });
const C = (id: string, title: string, slides: [PilotSlide, PilotSlide], q: PilotQuestion[], extra: Partial<PilotCore> = {}): PilotCore => ({ id, title, slides, q, ...extra });

const ATOM: PilotTopic = {
  code: 'KIM.C26.E.ATOM', subject: 'KIM', title: 'Partikel penyusun materi', subtitle: 'Atom, ion, molekul, rumus kimia, isotop', phase: 'E', alias: 'atom',
  bekal: ['unsur, senyawa, campuran'],
  cores: [
    C('C1', 'Atom, ion, dan molekul', [
      S('Tiga jenis partikel', ['**Atom** adalah partikel terkecil unsur dan netral. **Ion** adalah atom yang bermuatan karena melepas atau menerima elektron. **Molekul** adalah gabungan dua atom atau lebih.', 'Melepas elektron ⇒ ion positif (**kation**), misalnya Na⁺. Menerima elektron ⇒ ion negatif (**anion**), misalnya Cl⁻.'], [['kation', 'melepas elektron'], ['anion', 'menerima elektron']]),
      S('Molekul unsur dan molekul senyawa', ['**Molekul unsur** tersusun atas atom sejenis (O₂, N₂). **Molekul senyawa** tersusun atas atom berbeda jenis (H₂O, CO₂).'], [['O₂', 'molekul unsur'], ['H₂O', 'molekul senyawa']], 'Logam seperti Fe ditulis sebagai atom, bukan molekul.'),
    ], [
      Q('Ion Na⁺ terbentuk ketika atom natrium …', ['menerima 1 elektron', 'melepas 1 elektron', 'menerima 1 proton', 'melepas 1 neutron'], 1, 'Muatan positif muncul karena atom kehilangan elektron; Na melepas 1 elektron menjadi Na⁺.', 1, 'KM'),
      Q('Zat berikut yang merupakan molekul senyawa adalah …', ['O₂', 'H₂O', 'N₂', 'Fe'], 1, 'H₂O tersusun atas atom H dan O yang berbeda jenis. O₂ dan N₂ adalah molekul unsur, Fe adalah atom logam.', 1, 'KM'),
    ], { min: 4 }),
    C('C2', 'Rumus kimia', [
      S('Rumus senyawa ion', ['Jumlah muatan positif dan negatif harus **nol**. Silangkan angka muatan sebagai indeks.', 'Contoh: Al³⁺ dan O²⁻ ⇒ Al₂O₃ (2 × 3 = 6 dan 3 × 2 = 6).'], [['Al³⁺ + O²⁻', 'Al₂O₃']]),
      S('Rumus molekul dan rumus empiris', ['**Rumus molekul** menyatakan jumlah atom sebenarnya. **Rumus empiris** adalah perbandingan paling sederhana.', 'Contoh: glukosa C₆H₁₂O₆ memiliki rumus empiris CH₂O.'], [['C₆H₁₂O₆', 'empiris CH₂O']], 'Bagi semua indeks dengan FPB-nya untuk mendapat rumus empiris.'),
    ], [
      Q('Rumus senyawa yang terbentuk dari ion Al³⁺ dan O²⁻ adalah …', ['AlO', 'Al₃O₂', 'Al₂O₃', 'AlO₃'], 2, 'Muatan total harus nol: 2 × (+3) + 3 × (−2) = 0, jadi Al₂O₃.'),
      Q('Rumus empiris dari glukosa (C₆H₁₂O₆) adalah …', ['CHO', 'CH₂O', 'C₂H₄O₂', 'C₆H₁₂O₆'], 1, 'Semua indeks dibagi 6: C₁H₂O₁ = CH₂O.', 1),
    ], { min: 4 }),
    C('ISOTOP', 'Nomor atom dan isotop', [
      S('Membaca lambang atom', ['Pada lambang ᴬ_Z X: **Z (nomor atom) = jumlah proton**, **A (nomor massa) = proton + neutron**. Atom netral: elektron = proton.', 'Ion: elektron = proton − muatan. Contoh S²⁻ (Z = 16) punya 18 elektron.'], [['neutron', 'A − Z'], ['elektron ion', 'Z − muatan']]),
      S('Isotop dan massa atom relatif', ['**Isotop**: nomor atom sama, nomor massa berbeda (jumlah neutron berbeda).', 'Ar adalah rata-rata berbobot kelimpahan. Contoh: 75% ³⁵Cl dan 25% ³⁷Cl ⇒ Ar = 0,75 × 35 + 0,25 × 37 = 35,5.'], [['Ar', 'Σ(kelimpahan × massa isotop)']], 'Muatan negatif berarti elektron bertambah; positif berarti berkurang.'),
    ], [
      Q('Atom ²³₁₁Na memiliki jumlah proton, elektron, dan neutron berturut-turut …', ['11, 11, 12', '11, 12, 11', '12, 11, 11', '23, 11, 12'], 0, 'Proton = Z = 11, elektron = 11 (netral), neutron = 23 − 11 = 12.', 1),
      Q('Ion ³²₁₆S²⁻ memiliki jumlah proton, elektron, dan neutron berturut-turut …', ['16, 16, 16', '16, 18, 16', '16, 14, 16', '18, 16, 14'], 1, 'Proton 16, elektron 16 + 2 = 18 (muatan 2−), neutron 32 − 16 = 16.'),
      Q('Klorin di alam terdiri atas 75% ³⁵Cl dan 25% ³⁷Cl. Massa atom relatif klorin adalah …', ['35,0', '35,5', '36,0', '36,5'], 1, 'Ar = 0,75 × 35 + 0,25 × 37 = 26,25 + 9,25 = 35,5.', 3),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'ISOTOP', 'S']],
};

const STOIK: PilotTopic = {
  code: 'KIM.C26.E.STOIK', subject: 'KIM', title: 'Stoikiometri dan reaksi kimia', subtitle: 'Mol, persamaan reaksi, pereaksi pembatas', phase: 'E', alias: 'stoikiometri',
  bekal: ['rumus kimia', 'perbandingan'],
  cores: [
    C('C1', 'Mol dan massa molar', [
      S('Mol sebagai jembatan', ['**Mol** menghubungkan massa, jumlah partikel, dan volume gas: **n = m / Mr**, **n = N / (6,02 × 10²³)**, dan pada STP **V = n × 22,4 L**.', 'Mr adalah jumlah Ar semua atom. Contoh: Mr H₂SO₄ = 2(1) + 32 + 4(16) = 98.'], [['n', 'm / Mr'], ['V (STP)', 'n × 22,4 L']]),
      S('Contoh cepat', ['9 g air (Mr = 18) = 0,5 mol. 0,25 mol CO₂ pada STP = 0,25 × 22,4 = 5,6 L.'], [['9 g H₂O', '0,5 mol']], 'Ubah semua besaran ke mol dulu, baru ke besaran lain.'),
    ], [
      Q('Jumlah mol 9 gram air (Mr = 18) adalah …', ['0,2 mol', '0,5 mol', '2 mol', '162 mol'], 1, 'n = 9 / 18 = 0,5 mol.', 1),
      Q('Volume 0,25 mol gas CO₂ pada keadaan standar (STP) adalah …', ['2,24 L', '5,6 L', '11,2 L', '22,4 L'], 1, 'V = 0,25 × 22,4 = 5,6 L.', 1),
      Q('Massa molekul relatif H₂SO₄ (Ar H = 1, S = 32, O = 16) adalah …', ['49', '96', '98', '100'], 2, 'Mr = 2 × 1 + 32 + 4 × 16 = 98.', 1),
    ], { min: 4 }),
    C('SETARA', 'Menyetarakan reaksi', [
      S('Jumlah atom harus sama', ['Hukum kekekalan massa: jumlah setiap jenis atom di ruas kiri **sama** dengan di ruas kanan. Yang diubah hanya **koefisien**, bukan indeks rumus.'], [['kekekalan massa', 'atom kiri = atom kanan']]),
      S('Urutan menyetarakan', ['Setarakan atom selain O dan H dulu, lalu H, terakhir O.', 'Contoh: C₃H₈ + 5O₂ → 3CO₂ + 4H₂O (C: 3, H: 8, O: 10).'], [['C₃H₈ + 5O₂', '3CO₂ + 4H₂O']], 'Hitung ulang semua atom setelah selesai.'),
    ], [
      Q('Pada reaksi pembakaran propana: C₃H₈ + b O₂ → 3CO₂ + 4H₂O, nilai b agar reaksi setara adalah …', ['3', '4', '5', '7'], 2, 'Di kanan ada 3 × 2 + 4 × 1 = 10 atom O, jadi b = 5.'),
      Q('Koefisien reaksi a Fe + b O₂ → c Fe₂O₃ yang setara adalah …', ['a = 2, b = 3, c = 1', 'a = 4, b = 3, c = 2', 'a = 2, b = 1, c = 1', 'a = 4, b = 6, c = 2'], 1, '4Fe + 3O₂ → 2Fe₂O₃: Fe 4 = 4, O 6 = 6.'),
    ], { min: 4 }),
    C('C2', 'Perhitungan dari persamaan reaksi', [
      S('Koefisien = perbandingan mol', ['Dalam persamaan setara, **perbandingan koefisien = perbandingan mol**.', 'Contoh: N₂ + 3H₂ → 2NH₃. 3 mol H₂ menghasilkan 2 mol NH₃.'], [['mol B', '(koef B / koef A) × mol A']]),
      S('Massa ke massa', ['Massa A → mol A → (perbandingan koefisien) → mol B → massa B.', 'Contoh: 2H₂ + O₂ → 2H₂O. 8 g O₂ = 0,25 mol ⇒ H₂O = 0,5 mol = 9 g.'], [['8 g O₂', '9 g H₂O']], 'Jangan membandingkan massa langsung; yang sebanding adalah mol.'),
    ], [
      Q('Pada reaksi N₂ + 3H₂ → 2NH₃, sebanyak 3 mol H₂ bereaksi habis. Jumlah NH₃ yang terbentuk adalah …', ['1 mol', '2 mol', '3 mol', '6 mol'], 1, 'Perbandingan H₂ : NH₃ = 3 : 2, jadi 3 mol H₂ menghasilkan 2 mol NH₃.', 1),
      Q('Pada reaksi 2H₂ + O₂ → 2H₂O, sebanyak 8 gram O₂ (Mr = 32) bereaksi habis. Massa air yang terbentuk (Mr = 18) adalah …', ['4,5 g', '9 g', '18 g', '36 g'], 1, 'n O₂ = 8/32 = 0,25 mol. n H₂O = 2 × 0,25 = 0,5 mol = 0,5 × 18 = 9 g.'),
    ], { min: 5 }),
    C('BATAS', 'Pereaksi pembatas dan hasil', [
      S('Siapa yang habis duluan?', ['Bagi mol setiap pereaksi dengan koefisiennya. **Hasil bagi terkecil = pereaksi pembatas** (habis), yang lain bersisa.', 'Contoh: 2H₂ + O₂ → 2H₂O dengan 2 mol H₂ dan 2 mol O₂: H₂ → 2/2 = 1, O₂ → 2/1 = 2. H₂ pembatas.'], [['pembatas', 'mol/koefisien terkecil']]),
      S('Hitung hasil dari pembatas', ['Semua produk dihitung dari pereaksi pembatas. Dari contoh tadi: H₂O = 2 mol, O₂ terpakai 1 mol, sisa O₂ 1 mol.'], [['produk', 'dari pereaksi pembatas']], 'Tabel mula–reaksi–sisa (MRS) membantu agar tidak salah hitung.'),
    ], [
      Q('Sebanyak 2 mol H₂ direaksikan dengan 2 mol O₂ menurut reaksi 2H₂ + O₂ → 2H₂O. Pereaksi pembatas dan sisa pereaksinya adalah …', ['H₂, sisa O₂ 1 mol', 'O₂, sisa H₂ 1 mol', 'H₂, tidak ada sisa', 'O₂, sisa H₂ 2 mol'], 0, 'H₂: 2/2 = 1, O₂: 2/1 = 2. H₂ habis dan memakai 1 mol O₂, jadi O₂ bersisa 1 mol.'),
      Q('Sebanyak 5,4 g aluminium (Ar = 27) direaksikan dengan 0,9 mol HCl: 2Al + 6HCl → 2AlCl₃ + 3H₂. Volume gas H₂ yang terbentuk pada STP adalah …', ['2,24 L', '4,48 L', '6,72 L', '10,08 L'], 2, 'Al = 0,2 mol (0,2/2 = 0,1) dan HCl 0,9/6 = 0,15, jadi Al pembatas. H₂ = 3/2 × 0,2 = 0,3 mol = 6,72 L.', 3),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'SETARA', 'S'], ['C1', 'C2', 'S'], ['C1', 'BATAS', 'S']],
};

const STRUKTUR: PilotTopic = {
  code: 'KIM.C26.F.STRUKTUR', subject: 'KIM', title: 'Struktur atom, periodisitas & ikatan', subtitle: 'Konfigurasi elektron, tren periodik, ikatan, bentuk molekul', phase: 'F', alias: 'ikatan-kimia',
  bekal: ['partikel penyusun atom'],
  cores: [
    C('C1', 'Struktur elektron & periodik', [
      S('Konfigurasi elektron', ['Elektron mengisi subkulit dengan urutan energi: **1s 2s 2p 3s 3p 4s 3d 4p …** (s maks 2, p maks 6, d maks 10).', 'Contoh: ₁₂Mg = 1s² 2s² 2p⁶ 3s².'], [['urutan', '1s 2s 2p 3s 3p 4s 3d']]),
      S('Letak dalam tabel periodik', ['**Periode** = nomor kulit terbesar. **Golongan A** = jumlah elektron valensi (s + p kulit terluar).', 'Contoh: ₁₇Cl = 1s² 2s² 2p⁶ 3s² 3p⁵ ⇒ periode 3, golongan VIIA.'], [['periode', 'kulit terbesar'], ['golongan A', 'elektron valensi']], 'Pastikan jumlah semua elektron sama dengan nomor atom.'),
    ], [
      Q('Konfigurasi elektron atom ₁₂Mg adalah …', ['1s² 2s² 2p⁶ 3s²', '1s² 2s² 2p⁸', '1s² 2s² 2p⁶ 3p²', '1s² 2s⁶ 2p⁴'], 0, '12 elektron: 1s² (2), 2s² (4), 2p⁶ (10), 3s² (12).', 1),
      Q('Unsur ₁₇Cl dalam tabel periodik terletak pada …', ['golongan VA, periode 3', 'golongan VIIA, periode 3', 'golongan VIIA, periode 2', 'golongan IIIA, periode 3'], 1, '1s² 2s² 2p⁶ 3s² 3p⁵: kulit terbesar 3 (periode 3), elektron valensi 7 (golongan VIIA).'),
    ], { min: 5 }),
    C('PERIODIK', 'Tren periodik', [
      S('Jari-jari atom', ['Dalam satu **periode** (kiri → kanan), jari-jari **mengecil** karena muatan inti bertambah. Dalam satu **golongan** (atas → bawah), jari-jari **membesar** karena kulit bertambah.'], [['periode →', 'jari-jari mengecil'], ['golongan ↓', 'jari-jari membesar']]),
      S('Energi ionisasi dan keelektronegatifan', ['Keduanya berlawanan dengan jari-jari: makin besar ke kanan, makin kecil ke bawah.', 'Unsur paling elektronegatif adalah **fluorin (F)**.'], [['keelektronegatifan tertinggi', 'F']], 'Atom kecil memegang elektronnya lebih kuat.'),
    ], [
      Q('Dalam satu periode dari kiri ke kanan, jari-jari atom …', ['makin besar', 'makin kecil', 'tetap', 'naik lalu turun'], 1, 'Muatan inti bertambah sedangkan jumlah kulit tetap, sehingga elektron ditarik lebih dekat.', 1),
      Q('Di antara unsur berikut, yang memiliki keelektronegatifan paling besar adalah …', ['Na', 'Cl', 'F', 'I'], 2, 'Keelektronegatifan makin besar ke kanan dan ke atas; F berada di kanan atas (tanpa gas mulia).'),
    ], { min: 4 }),
    C('C2', 'Ikatan & gaya antarmolekul', [
      S('Ion atau kovalen', ['**Ikatan ion**: serah-terima elektron, biasanya logam + nonlogam (NaCl). **Ikatan kovalen**: pemakaian bersama pasangan elektron, nonlogam + nonlogam (H₂O, CO₂).'], [['logam + nonlogam', 'ikatan ion'], ['nonlogam + nonlogam', 'ikatan kovalen']]),
      S('Ikatan hidrogen', ['Molekul yang memiliki H terikat pada **F, O, atau N** membentuk **ikatan hidrogen** antarmolekul yang kuat, sehingga titik didihnya tinggi.', 'Itulah sebabnya H₂O (100°C) mendidih jauh di atas H₂S.'], [['ikatan hidrogen', 'H–F, H–O, H–N']], 'Gaya antarmolekul memengaruhi titik didih; ikatan dalam molekul tidak putus saat mendidih.'),
    ], [
      Q('Pasangan unsur yang membentuk ikatan ion adalah …', ['₁H dan ₁₇Cl', '₁₁Na dan ₁₇Cl', '₆C dan ₈O', '₇N dan ₁H'], 1, 'Na adalah logam yang mudah melepas elektron, Cl nonlogam yang mudah menerima elektron: ikatan ion.'),
      Q('Titik didih air jauh lebih tinggi daripada H₂S karena …', ['massa molekul air lebih besar', 'ada ikatan hidrogen antarmolekul air', 'air merupakan senyawa ion', 'ikatan O–H lebih lemah'], 1, 'H yang terikat pada O membentuk ikatan hidrogen antarmolekul. H₂S tidak, padahal massanya lebih besar.'),
    ], { min: 5 }),
    C('BENTUK', 'Bentuk molekul & kepolaran', [
      S('Teori VSEPR', ['Pasangan elektron di sekitar atom pusat saling tolak sejauh mungkin. Hitung **PEI** (pasangan terikat) dan **PEB** (pasangan bebas).', '4 PEI, 0 PEB: tetrahedral (CH₄). 3 PEI, 1 PEB: piramida trigonal (NH₃). 2 PEI, 2 PEB: bentuk V (H₂O).'], [['CH₄', 'tetrahedral'], ['NH₃', 'piramida trigonal'], ['H₂O', 'bentuk V']]),
      S('Polar atau nonpolar', ['Molekul **polar** bila bentuknya tidak simetris sehingga momen dipol tidak saling meniadakan (H₂O, NH₃).', 'Molekul simetris seperti CH₄ dan CO₂ **nonpolar** walau ikatannya polar.'], [['tidak simetris', 'polar']], 'Pasangan elektron bebas pada atom pusat biasanya membuat molekul tidak simetris.'),
    ], [
      Q('Bentuk molekul CH₄ adalah …', ['linear', 'segitiga datar', 'tetrahedral', 'bentuk V'], 2, 'C memiliki 4 pasangan elektron ikatan tanpa pasangan bebas, sehingga bentuknya tetrahedral.', 1),
      Q('Molekul H₂O bersifat polar karena …', ['bentuknya linear', 'bentuknya V sehingga momen dipol tidak saling meniadakan', 'tidak memiliki pasangan elektron bebas', 'merupakan senyawa ion'], 1, 'Dua PEB pada O membuat molekul berbentuk V, sehingga dipolnya tidak saling meniadakan.'),
      Q('Molekul NH₃ (3 PEI dan 1 PEB pada atom N) memiliki bentuk …', ['tetrahedral', 'piramida trigonal', 'segitiga datar', 'linear'], 1, 'Tiga pasangan terikat dan satu pasangan bebas memberi bentuk piramida trigonal.'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'PERIODIK', 'S'], ['C1', 'C2', 'S'], ['C1', 'BENTUK', 'S']],
};

const TERMOKIMIA: PilotTopic = {
  code: 'KIM.C26.F.TERMOKIMIA', subject: 'KIM', title: 'Termokimia dan laju reaksi', subtitle: 'Entalpi, Hukum Hess, laju reaksi', phase: 'F', alias: 'termokimia',
  bekal: ['stoikiometri', 'kalor'],
  cores: [
    C('C1', 'Entalpi reaksi', [
      S('Eksoterm dan endoterm', ['**Eksoterm**: sistem melepas kalor, suhu lingkungan naik, **ΔH < 0**. **Endoterm**: sistem menyerap kalor, suhu lingkungan turun, **ΔH > 0**.'], [['eksoterm', 'ΔH negatif'], ['endoterm', 'ΔH positif']]),
      S('Kalorimeter', ['Kalor yang diserap larutan: **q = m · c · ΔT**. Untuk reaksi eksoterm: **ΔH = −q / n**.', 'Contoh: 100 g larutan naik 5°C (c = 4,2 J/g°C) ⇒ q = 2.100 J; untuk 0,05 mol ⇒ ΔH = −42 kJ/mol.'], [['q', 'm · c · ΔT'], ['ΔH', '−q / n']], 'Suhu naik berarti reaksi melepas kalor, jadi tanda ΔH negatif.'),
    ], [
      Q('Saat dua larutan dicampur, suhu campuran naik. Reaksi tersebut termasuk …', ['eksoterm, ΔH negatif', 'eksoterm, ΔH positif', 'endoterm, ΔH negatif', 'endoterm, ΔH positif'], 0, 'Suhu lingkungan naik karena sistem melepas kalor: eksoterm dengan ΔH < 0.', 1),
      Q('Reaksi 0,05 mol zat dalam kalorimeter menaikkan suhu 100 g larutan sebesar 5°C (c = 4,2 J/g°C). Perubahan entalpi reaksinya adalah …', ['−42 kJ/mol', '+42 kJ/mol', '−2,1 kJ/mol', '−105 kJ/mol'], 0, 'q = 100 × 4,2 × 5 = 2.100 J = 2,1 kJ. ΔH = −2,1 / 0,05 = −42 kJ/mol.', 3),
    ], { min: 5 }),
    C('HESS', 'Hukum Hess', [
      S('Jalan berbeda, ΔH sama', ['ΔH reaksi hanya bergantung pada keadaan awal dan akhir. Reaksi bisa dijumlahkan; **membalik reaksi membalik tanda ΔH**.', 'Contoh: C + O₂ → CO₂ (−394) dikurangi CO + ½O₂ → CO₂ (−283) memberi C + ½O₂ → CO, ΔH = −111 kJ.'], [['ΔH total', 'ΣΔH tahap']]),
      S('Dari entalpi pembentukan', ['**ΔH reaksi = ΣΔHf° produk − ΣΔHf° pereaksi** (unsur bebas = 0).', 'Contoh: CH₄ + 2O₂ → CO₂ + 2H₂O ⇒ (−394 + 2(−286)) − (−75) = −891 kJ.'], [['ΔH', 'ΣΔHf produk − ΣΔHf pereaksi']], 'Kalikan ΔHf dengan koefisiennya.'),
    ], [
      Q('Diketahui C + O₂ → CO₂ ΔH = −394 kJ dan CO + ½O₂ → CO₂ ΔH = −283 kJ. Perubahan entalpi untuk C + ½O₂ → CO adalah …', ['−111 kJ', '−677 kJ', '+111 kJ', '−283 kJ'], 0, 'Reaksi pertama ditambah kebalikan reaksi kedua: −394 + 283 = −111 kJ.'),
      Q('Diketahui ΔHf° CO₂ = −394 kJ/mol, H₂O = −286 kJ/mol, dan CH₄ = −75 kJ/mol. ΔH pembakaran CH₄ + 2O₂ → CO₂ + 2H₂O adalah …', ['−891 kJ', '−605 kJ', '−1.041 kJ', '+891 kJ'], 0, '(−394 + 2 × (−286)) − (−75) = −966 + 75 = −891 kJ.', 3),
    ], { min: 5 }),
    C('C2', 'Laju dan energi aktivasi', [
      S('Faktor yang memengaruhi laju', ['Laju bertambah bila **konsentrasi** naik, **luas permukaan** besar (serbuk), **suhu** naik, atau ada **katalis**.', 'Semuanya memperbanyak tumbukan efektif antarpartikel.'], [['faktor', 'konsentrasi, luas permukaan, suhu, katalis']]),
      S('Energi aktivasi', ['**Energi aktivasi (Ea)** adalah energi minimum agar tumbukan menghasilkan reaksi.', 'Katalis mempercepat reaksi dengan **menurunkan Ea**, tanpa ikut habis dan tanpa mengubah ΔH.'], [['katalis', 'menurunkan Ea']], 'Katalis tidak menggeser kesetimbangan dan tidak mengubah ΔH.'),
    ], [
      Q('Katalis mempercepat laju reaksi dengan cara …', ['menaikkan energi aktivasi', 'menurunkan energi aktivasi', 'mengubah nilai ΔH', 'menambah jumlah pereaksi'], 1, 'Katalis menyediakan jalur reaksi dengan energi aktivasi lebih rendah.', 1),
      Q('Serbuk CaCO₃ bereaksi lebih cepat dengan HCl dibandingkan bongkahan CaCO₃ yang massanya sama karena …', ['suhunya lebih tinggi', 'luas permukaan bidang sentuhnya lebih besar', 'konsentrasinya lebih besar', 'energi aktivasinya lebih tinggi'], 1, 'Serbuk memiliki luas permukaan lebih besar sehingga tumbukan dengan HCl lebih sering.', 1),
    ], { min: 4 }),
    C('LAJU', 'Hukum laju dari data', [
      S('Persamaan laju', ['**v = k [A]ᵐ [B]ⁿ**. Orde m dan n ditentukan dari **data percobaan**, bukan dari koefisien reaksi.'], [['v', 'k [A]ᵐ [B]ⁿ']]),
      S('Membaca data', ['Bandingkan dua percobaan yang hanya satu konsentrasinya berubah.', 'Jika [A] dua kali lipat dan laju dua kali ⇒ orde 1. Laju empat kali ⇒ orde 2. Laju tetap ⇒ orde 0.'], [['2ᵐ = rasio laju', 'orde m']], 'Pilih pasangan percobaan yang konsentrasi zat lainnya sama.'),
    ], [
      Q('Pada suatu reaksi, ketika konsentrasi A dinaikkan dua kali (konsentrasi lain tetap), laju reaksi menjadi empat kali. Orde reaksi terhadap A adalah …', ['0', '1', '2', '4'], 2, '2ᵐ = 4, jadi m = 2.', 1),
      Q('Data reaksi A + B → C: (1) [A] = 0,1, [B] = 0,1, v = 4; (2) [A] = 0,2, [B] = 0,1, v = 8; (3) [A] = 0,1, [B] = 0,2, v = 16. Persamaan laju reaksinya adalah …', ['v = k[A][B]', 'v = k[A]²[B]', 'v = k[A][B]²', 'v = k[A]²[B]²'], 2, 'Dari (1) ke (2): [A] × 2, v × 2 ⇒ orde A = 1. Dari (1) ke (3): [B] × 2, v × 4 ⇒ orde B = 2.', 3),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'HESS', 'S'], ['C1', 'LAJU', 'S'], ['C2', 'LAJU', 'S']],
};

const SETIMBANG: PilotTopic = {
  code: 'KIM.C26.F.SETIMBANG', subject: 'KIM', title: 'Kesetimbangan & asam-basa', subtitle: 'Le Chatelier, Kc, pH, penyangga', phase: 'F', alias: 'kesetimbangan',
  bekal: ['stoikiometri', 'logaritma'],
  cores: [
    C('C1', 'Kesetimbangan dinamis', [
      S('Reaksi bolak-balik', ['Pada kesetimbangan, **laju reaksi maju = laju reaksi balik**. Reaksi tetap berlangsung, tetapi konsentrasinya tidak berubah.'], [['setimbang', 'v maju = v balik']]),
      S('Asas Le Chatelier', ['Bila diganggu, kesetimbangan bergeser untuk mengurangi gangguan. **Tekanan naik** ⇒ ke arah jumlah mol gas lebih sedikit. **Suhu naik** ⇒ ke arah **endoterm**.', 'Contoh: N₂ + 3H₂ ⇌ 2NH₃ (ΔH = −92 kJ): tekanan naik ⇒ ke kanan; suhu naik ⇒ ke kiri.'], [['tekanan naik', 'ke mol gas sedikit'], ['suhu naik', 'ke arah endoterm']], 'Jika ΔH reaksi maju negatif, reaksi balik endoterm.'),
    ], [
      Q('Pada kesetimbangan N₂(g) + 3H₂(g) ⇌ 2NH₃(g), jika tekanan diperbesar, kesetimbangan bergeser ke …', ['kiri, NH₃ berkurang', 'kanan, NH₃ bertambah', 'tidak bergeser', 'kiri, N₂ berkurang'], 1, 'Kiri 4 mol gas, kanan 2 mol gas. Tekanan naik menggeser ke jumlah mol lebih sedikit, yaitu kanan.'),
      Q('Pada kesetimbangan N₂ + 3H₂ ⇌ 2NH₃ dengan ΔH = −92 kJ, jika suhu dinaikkan, kesetimbangan bergeser ke …', ['kanan', 'kiri', 'tidak bergeser', 'kanan lalu kiri'], 1, 'Reaksi maju eksoterm, sehingga reaksi balik endoterm. Suhu naik menggeser ke arah endoterm, yaitu kiri.'),
    ], { min: 5 }),
    C('KONSTANTA', 'Konstanta kesetimbangan', [
      S('Menulis Kc', ['**Kc = [produk]^koefisien / [pereaksi]^koefisien**. Zat **padat dan cair murni tidak** dimasukkan.', 'Contoh: 2SO₂(g) + O₂(g) ⇌ 2SO₃(g) ⇒ Kc = [SO₃]² / ([SO₂]² [O₂]).'], [['Kc', '[produk]ᵏᵒᵉᶠ / [pereaksi]ᵏᵒᵉᶠ']]),
      S('Menghitung Kc', ['Ubah mol menjadi konsentrasi (mol / volume), lalu masukkan.', 'Contoh: wadah 1 L berisi 0,1 mol H₂, 0,1 mol I₂, 0,8 mol HI ⇒ Kc = 0,8² / (0,1 × 0,1) = 64.'], [['H₂ + I₂ ⇌ 2HI', 'Kc = [HI]² / ([H₂][I₂])']], 'Konsentrasi pada keadaan setimbang, bukan konsentrasi awal.'),
    ], [
      Q('Rumus Kc untuk reaksi 2SO₂(g) + O₂(g) ⇌ 2SO₃(g) adalah …', ['[SO₃]² / ([SO₂]²[O₂])', '[SO₂]²[O₂] / [SO₃]²', '[SO₃] / ([SO₂][O₂])', '2[SO₃] / (2[SO₂] + [O₂])'], 0, 'Produk di pembilang, pereaksi di penyebut, masing-masing dipangkatkan koefisiennya.', 1),
      Q('Dalam wadah 1 liter, kesetimbangan H₂ + I₂ ⇌ 2HI mengandung 0,1 mol H₂, 0,1 mol I₂, dan 0,8 mol HI. Nilai Kc adalah …', ['8', '16', '64', '80'], 2, 'Kc = (0,8)² / (0,1 × 0,1) = 0,64 / 0,01 = 64.'),
    ], { min: 5 }),
    C('C2', 'Asam-basa dan pH', [
      S('pH asam kuat dan basa kuat', ['**pH = −log [H⁺]**. Asam kuat: [H⁺] = valensi × M. Basa kuat: [OH⁻] = valensi × M, **pOH = −log [OH⁻]**, lalu **pH = 14 − pOH**.', 'Contoh: HCl 0,01 M ⇒ pH 2. NaOH 0,001 M ⇒ pOH 3 ⇒ pH 11.'], [['pH', '−log [H⁺]'], ['pH + pOH', '14']]),
      S('Asam bervalensi dua', ['H₂SO₄ melepas 2 H⁺: [H⁺] = 2 × M.', 'Contoh: H₂SO₄ 0,005 M ⇒ [H⁺] = 0,01 M ⇒ pH 2.'], [['H₂SO₄', '[H⁺] = 2M']], 'pH < 7 asam, pH = 7 netral, pH > 7 basa (pada 25°C).'),
    ], [
      Q('pH larutan HCl 0,01 M adalah …', ['1', '2', '12', '0,01'], 1, '[H⁺] = 0,01 = 10⁻² M, jadi pH = 2.', 1),
      Q('pH larutan NaOH 0,001 M adalah …', ['3', '10', '11', '13'], 2, '[OH⁻] = 10⁻³ M, pOH = 3, pH = 14 − 3 = 11.'),
      Q('pH larutan H₂SO₄ 0,005 M adalah …', ['2', '2,3', '3', '5'], 0, '[H⁺] = 2 × 0,005 = 0,01 M, jadi pH = 2.', 3),
    ], { min: 5 }),
    C('HIDROLISIS', 'Hidrolisis dan penyangga', [
      S('Larutan penyangga', ['Penyangga mempertahankan pH saat ditambah sedikit asam, basa, atau air. Isinya **asam lemah + basa konjugasinya** (CH₃COOH + CH₃COONa) atau basa lemah + asam konjugasinya.', 'pH penyangga asam: **[H⁺] = Ka × (mol asam / mol garam)**.'], [['[H⁺]', 'Ka × n asam / n garam']]),
      S('Hidrolisis garam', ['Garam dari **asam kuat + basa lemah** (NH₄Cl) bersifat **asam**. Garam dari **asam lemah + basa kuat** (CH₃COONa) bersifat **basa**. Garam dari asam kuat + basa kuat (NaCl) netral.'], [['NH₄Cl', 'asam'], ['CH₃COONa', 'basa']], 'Sifat garam mengikuti induk yang kuat.'),
    ], [
      Q('Pasangan zat berikut yang dapat membentuk larutan penyangga adalah …', ['HCl dan NaCl', 'CH₃COOH dan CH₃COONa', 'NaOH dan NaCl', 'HNO₃ dan KNO₃'], 1, 'Penyangga terdiri dari asam lemah (CH₃COOH) dan basa konjugasinya (CH₃COO⁻ dari CH₃COONa).'),
      Q('Larutan berisi 0,1 mol CH₃COOH dan 0,1 mol CH₃COONa (Ka = 10⁻⁵). pH larutan tersebut adalah …', ['3', '5', '7', '9'], 1, '[H⁺] = 10⁻⁵ × 0,1/0,1 = 10⁻⁵, jadi pH = 5.'),
      Q('Larutan garam NH₄Cl dalam air bersifat …', ['asam', 'basa', 'netral', 'amfoter'], 0, 'NH₄Cl berasal dari basa lemah NH₃ dan asam kuat HCl, sehingga larutannya asam.', 1),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'KONSTANTA', 'S'], ['C1', 'C2', 'S'], ['C1', 'HIDROLISIS', 'S'], ['C2', 'HIDROLISIS', 'S']],
};

const KARBON: PilotTopic = {
  code: 'KIM.C26.F.KARBON', subject: 'KIM', title: 'Senyawa karbon & makromolekul', subtitle: 'Gugus fungsi, isomer, polimer, biomolekul', phase: 'F', alias: 'senyawa-karbon',
  bekal: ['ikatan kovalen'],
  cores: [
    C('C1', 'Struktur & gugus fungsi', [
      S('Gugus fungsi menentukan sifat', ['**–OH** alkohol, **–O–** eter, **–CHO** aldehida, **–CO–** keton, **–COOH** asam karboksilat, **–COO–** ester.', 'Contoh: CH₃–CH₂–OH adalah etanol (alkohol).'], [['–OH', 'alkohol'], ['–COOH', 'asam karboksilat']]),
      S('Penamaan alkana bercabang', ['Pilih rantai terpanjang, beri nomor dari ujung terdekat cabang, sebut cabang dulu lalu nama rantai induk.', 'Contoh: CH₃–CH(CH₃)–CH₃ = 2-metilpropana.'], [['CH₃–CH(CH₃)–CH₃', '2-metilpropana']], 'Alkana: CₙH₂ₙ₊₂, berakhiran -ana.'),
    ], [
      Q('Senyawa CH₃–CH₂–OH termasuk golongan …', ['alkana', 'alkohol', 'aldehida', 'eter'], 1, 'Gugus –OH yang terikat pada rantai karbon menandai alkohol (etanol).', 1),
      Q('Gugus fungsi asam karboksilat adalah …', ['–OH', '–CHO', '–COOH', '–COO–'], 2, 'Asam karboksilat memiliki gugus –COOH, misalnya asam asetat CH₃COOH.', 1),
      Q('Nama IUPAC senyawa CH₃–CH(CH₃)–CH₃ adalah …', ['butana', '2-metilpropana', '1-metilpropana', 'isopropana'], 1, 'Rantai terpanjang 3 karbon (propana) dengan cabang metil di karbon nomor 2.'),
    ], { min: 5 }),
    C('C2', 'Biomolekul', [
      S('Karbohidrat, protein, lemak', ['**Karbohidrat** tersusun atas monosakarida (glukosa). **Protein** tersusun atas **asam amino** yang dihubungkan ikatan peptida. **Lemak** adalah ester dari gliserol dan asam lemak.'], [['protein', 'polimer asam amino']]),
      S('Uji makanan', ['**Biuret** → ungu: protein. **Benedict/Fehling** → endapan merah bata: gula pereduksi (glukosa). **Iodin** → biru kehitaman: amilum.'], [['biuret ungu', 'protein'], ['iodin biru', 'amilum']], 'Hafalkan pasangan pereaksi–warna–zat; sering muncul dalam soal.'),
    ], [
      Q('Uji biuret yang menghasilkan warna ungu menunjukkan adanya …', ['amilum', 'glukosa', 'protein', 'lemak'], 2, 'Pereaksi biuret bereaksi dengan ikatan peptida pada protein menghasilkan warna ungu.', 1, 'KM'),
      Q('Monomer penyusun protein adalah …', ['glukosa', 'asam amino', 'asam lemak', 'nukleotida'], 1, 'Protein adalah polimer asam amino yang dihubungkan ikatan peptida.', 1, 'KM'),
    ], { min: 4 }),
    C('ISOMER', 'Isomer dan gugus fungsi', [
      S('Rumus sama, struktur beda', ['**Isomer** memiliki rumus molekul sama tetapi struktur berbeda. Isomer **rantai**: kerangka berbeda (butana dan 2-metilpropana). Isomer **posisi**: letak gugus berbeda.'], [['C₄H₁₀', '2 isomer']]),
      S('Isomer fungsi', ['Golongan berbeda dengan rumus umum sama: **alkohol ⇄ eter**, **aldehida ⇄ keton**, **asam karboksilat ⇄ ester**.', 'Contoh: propanol (C₃H₈O) berisomer fungsi dengan metoksietana.'], [['alkohol', 'eter'], ['aldehida', 'keton']], 'Hitung jumlah atom setiap struktur untuk memastikan rumusnya benar-benar sama.'),
    ], [
      Q('Isomer fungsi dari 1-propanol (C₃H₈O) adalah …', ['propanal', 'propanon', 'metoksietana', 'asam propanoat'], 2, 'Alkohol berisomer fungsi dengan eter. Metoksietana (CH₃–O–C₂H₅) juga C₃H₈O.'),
      Q('Jumlah isomer struktur dari butana (C₄H₁₀) adalah …', ['1', '2', '3', '4'], 1, 'n-butana dan 2-metilpropana.', 1),
    ], { min: 5 }),
    C('POLIMER', 'Polimerisasi & struktur bahan', [
      S('Polimerisasi adisi', ['Monomer dengan **ikatan rangkap** saling bergabung tanpa melepas zat lain.', 'Contoh: etena → **polietilena** (plastik kantong), vinil klorida → PVC.'], [['etena', 'polietilena'], ['vinil klorida', 'PVC']]),
      S('Polimerisasi kondensasi', ['Monomer bergabung sambil **melepas molekul kecil** seperti H₂O.', 'Contoh: nilon, poliester, protein (dari asam amino), amilum (dari glukosa).'], [['kondensasi', 'melepas H₂O']], 'Ada ikatan rangkap pada monomer ⇒ biasanya adisi.'),
    ], [
      Q('Polimer yang terbentuk dari monomer etena adalah …', ['PVC', 'polietilena', 'nilon', 'teflon'], 1, 'Etena (CH₂=CH₂) mengalami polimerisasi adisi menjadi polietilena.', 1),
      Q('Ciri polimerisasi kondensasi adalah …', ['monomer memiliki ikatan rangkap', 'terlepas molekul kecil seperti H₂O', 'tidak ada zat lain yang terbentuk', 'hanya terjadi pada plastik'], 1, 'Pada kondensasi, setiap ikatan baru melepas molekul kecil seperti air.'),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'C2', 'S'], ['C1', 'ISOMER', 'S'], ['C1', 'POLIMER', 'S']],
};

export const KIM_TOPICS: PilotTopic[] = [ATOM, STOIK, STRUKTUR, TERMOKIMIA, SETIMBANG, KARBON];
export const KIM_RELATIONS: PilotRelation[] = [
  { from: 'KIM.C26.E.ATOM', to: 'KIM.C26.E.STOIK', kind: 'REQUIRES', label: 'rumus kimia → stoikiometri' },
  { from: 'KIM.C26.E.ATOM', to: 'KIM.C26.F.STRUKTUR', kind: 'REQUIRES', label: 'partikel atom → konfigurasi elektron dan ikatan' },
  { from: 'KIM.C26.E.STOIK', to: 'KIM.C26.F.TERMOKIMIA', kind: 'REQUIRES', label: 'mol → entalpi per mol' },
  { from: 'KIM.C26.E.STOIK', to: 'KIM.C26.F.SETIMBANG', kind: 'REQUIRES', label: 'mol dan konsentrasi → kesetimbangan' },
  { from: 'KIM.C26.F.STRUKTUR', to: 'KIM.C26.F.KARBON', kind: 'REQUIRES', label: 'ikatan kovalen → senyawa karbon' },
  { from: 'FIS.C26.F.TERMAL', to: 'KIM.C26.F.TERMOKIMIA', kind: 'RELATED', label: 'kalor ↔ entalpi reaksi' },
  { from: 'MAT.EKS', to: 'KIM.C26.F.SETIMBANG', kind: 'RELATED', label: 'logaritma ↔ pH' },
];
