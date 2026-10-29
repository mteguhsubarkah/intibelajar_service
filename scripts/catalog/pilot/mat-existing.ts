import type { PilotExisting, PilotQuestion, PilotSlide } from './types.js';
// Materi dua slide dan soal untuk inti Matematika yang sudah ada di katalog (Eksponen, Barisan, Vektor).

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2, src: PilotQuestion['src'] = 'UN'): PilotQuestion => ({ p, o, a, why, d, src });
const at = (topic: string) => (concept: string, key: string, title: string, slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): PilotExisting =>
  ({ topic, concept: `${topic}.${concept}`, key, title, slides, q, min });
const E = at('MAT.EKS'), B = at('MAT.BAR'), V = at('MAT.VEK');

const EKS: PilotExisting[] = [
  E('DEFINISI_EKSPONEN', 'DEFINISI_EKSPONEN', 'Definisi Eksponen', [
    S('Pangkat = perkalian berulang', ['**aⁿ** berarti a dikalikan dengan dirinya sendiri sebanyak **n faktor**. a disebut basis, n disebut pangkat.', 'Contoh: 2⁵ = 2 × 2 × 2 × 2 × 2 = 32. Bukan 2 × 5.'], [['aⁿ', 'a × a × … × a (n faktor)'], ['2⁵', '32']]),
    S('Pangkat nol dan negatif', ['Untuk a ≠ 0, **a⁰ = 1**. Pangkat negatif berarti kebalikan: **a⁻ⁿ = 1/aⁿ**.', 'Contoh: 2⁻³ = 1/2³ = 1/8.'], [['a⁰', '1'], ['a⁻ⁿ', '1/aⁿ']], 'Perhatikan tanda kurung: (−2)⁴ = 16, tetapi −2⁴ = −16.'),
  ], [
    Q('Nilai dari 3⁴ adalah …', ['12', '27', '64', '81'], 3, '3⁴ = 3 × 3 × 3 × 3 = 81. Pangkat bukan perkalian basis dengan pangkatnya.', 1),
    Q('Nilai dari 2⁻³ + 5⁰ adalah …', ['−7', '1/8', '9/8', '6'], 2, '2⁻³ = 1/8 dan 5⁰ = 1, jadi jumlahnya 1/8 + 1 = 9/8.'),
    Q('Nilai dari (−2)⁴ − 2⁴ adalah …', ['0', '32', '−32', '16'], 0, '(−2)⁴ = 16 karena tanda negatif ikut dipangkatkan, dan 2⁴ = 16. Selisihnya 0.'),
  ]),
  E('SIFAT_SIFAT_EKSPONEN', 'SIFAT_EKSPONEN', 'Sifat-sifat Eksponen', [
    S('Tiga sifat utama', ['Kalikan basis sama: **jumlahkan** pangkat. Bagi basis sama: **kurangkan** pangkat. Pangkat dari pangkat: **kalikan** pangkat.'], [['aᵐ · aⁿ', 'aᵐ⁺ⁿ'], ['aᵐ : aⁿ', 'aᵐ⁻ⁿ'], ['(aᵐ)ⁿ', 'aᵐⁿ']]),
    S('Pangkat dari perkalian dan pembagian', ['Pangkat dibagikan ke setiap faktor: **(ab)ⁿ = aⁿbⁿ** dan **(a/b)ⁿ = aⁿ/bⁿ**.', 'Contoh: (2³ · 2⁵) / 2⁴ = 2⁸ / 2⁴ = 2⁴ = 16.'], [['(ab)ⁿ', 'aⁿbⁿ'], ['(a/b)ⁿ', 'aⁿ/bⁿ']], 'Ubah dulu semua basis ke basis yang sama (4 = 2², 8 = 2³), baru pakai sifatnya.'),
  ], [
    Q('Bentuk sederhana dari (a³b⁻²)² / (a⁴b⁻³) adalah …', ['a²/b', 'a²b', 'a¹⁰/b⁷', 'ab'], 0, '(a³b⁻²)² = a⁶b⁻⁴. Dibagi a⁴b⁻³ menjadi a⁶⁻⁴ b⁻⁴⁺³ = a²b⁻¹ = a²/b.'),
    Q('Nilai dari (2⁵ × 4²) / 8³ adalah …', ['1/2', '1', '2', '4'], 1, 'Ubah ke basis 2: 2⁵ × 2⁴ / 2⁹ = 2⁹ / 2⁹ = 1.'),
    Q('Bentuk sederhana dari (3x²y)³ adalah …', ['9x⁵y³', '27x⁶y³', '27x⁵y³', '3x⁶y³'], 1, 'Setiap faktor dipangkatkan 3: 3³ = 27, (x²)³ = x⁶, y³. Hasilnya 27x⁶y³.', 1),
  ]),
  E('BENTUK_AKAR', 'BENTUK_AKAR', 'Bentuk Akar', [
    S('Menyederhanakan akar', ['Pakai **√(ab) = √a · √b**: cari faktor kuadrat sempurna. √12 = √4 · √3 = 2√3.', 'Akar hanya bisa dijumlah bila **sejenis**: 2√3 + 5√3 = 7√3, tetapi √2 + √3 tidak bisa digabung.'], [['√(ab)', '√a · √b'], ['√12', '2√3']]),
    S('Merasionalkan penyebut', ['Penyebut berbentuk √b: kalikan dengan √b/√b. Penyebut berbentuk √a − √b: kalikan dengan **sekawannya** √a + √b.', 'Contoh: 6/(√5 − √2) = 6(√5 + √2)/(5 − 2) = 2√5 + 2√2.'], [['a/√b', 'a√b / b'], ['(√a − √b)(√a + √b)', 'a − b']]),
  ], [
    Q('Hasil dari √75 − √27 + √12 adalah …', ['4√3', '2√3', '6√3', '√60'], 0, '√75 = 5√3, √27 = 3√3, √12 = 2√3. Jadi 5√3 − 3√3 + 2√3 = 4√3.'),
    Q('Bentuk rasional dari 6/(√5 − √2) adalah …', ['2√5 + 2√2', '2√5 − 2√2', '6√5 + 6√2', '(√5 + √2)/2'], 0, 'Kalikan sekawan: 6(√5 + √2)/(5 − 2) = 2(√5 + √2) = 2√5 + 2√2.'),
    Q('Hasil dari √8 × √18 adalah …', ['12', '6√2', '26', '24'], 0, '√8 × √18 = √144 = 12.', 1),
  ]),
  E('EKSPONEN_RASIONAL', 'EKSPONEN_RASIONAL', 'Eksponen Rasional', [
    S('Akar sebagai pangkat pecahan', ['Akar pangkat n sama dengan pangkat 1/n: **a^(1/n) = ⁿ√a**. Pangkat m/n berarti akar n lalu pangkat m.'], [['a^(m/n)', 'ⁿ√(aᵐ) = (ⁿ√a)ᵐ'], ['∛(x²)', 'x^(2/3)']]),
    S('Menghitung tanpa kalkulator', ['Hitung akarnya dulu supaya angkanya kecil: 8^(2/3) = (∛8)² = 2² = 4.', 'Pangkat negatif tetap berarti kebalikan: 16^(−3/4) = 1/(⁴√16)³ = 1/8.'], [['8^(2/3)', '4'], ['16^(−3/4)', '1/8']], 'Akar dulu, pangkat kemudian. Lebih ringan daripada memangkatkan bilangan besar.'),
  ], [
    Q('Nilai dari 27^(2/3) adalah …', ['6', '9', '18', '81'], 1, '27^(2/3) = (∛27)² = 3² = 9.', 1),
    Q('Nilai dari 16^(3/4) × 4^(−1/2) adalah …', ['2', '4', '8', '16'], 1, '16^(3/4) = (⁴√16)³ = 8 dan 4^(−1/2) = 1/2. Hasilnya 8 × 1/2 = 4.'),
    Q('Bentuk pangkat dari ∛(x²) adalah …', ['x^(3/2)', 'x^(2/3)', 'x^(−2/3)', 'x⁶'], 1, 'Akar pangkat 3 menjadi penyebut, pangkat 2 menjadi pembilang: x^(2/3).', 1),
  ]),
  E('FUNGSI_EKSPONEN', 'FUNGSI_EKSPONEN', 'Fungsi Eksponen', [
    S('Bentuk f(x) = a · bˣ', ['Variabelnya ada di **pangkat**. a adalah nilai awal (f(0) = a), b adalah faktor pengali tiap kali x naik 1.', 'Syarat: b > 0 dan b ≠ 1.'], [['f(x)', 'a · bˣ'], ['f(0)', 'a']]),
    S('Tumbuh atau meluruh', ['Bila **b > 1**, nilainya tumbuh (contoh 2ˣ). Bila **0 < b < 1**, nilainya meluruh (contoh (0,8)ˣ).', 'Contoh: f(x) = 3 · 2ˣ, maka f(3) = 3 · 8 = 24.'], [['b > 1', 'pertumbuhan'], ['0 < b < 1', 'peluruhan']]),
  ], [
    Q('Jika f(x) = 2^(x+1), nilai f(3) adalah …', ['8', '16', '32', '7'], 1, 'f(3) = 2^(3+1) = 2⁴ = 16.', 1),
    Q('Fungsi manakah yang menggambarkan peluruhan?', ['f(x) = 5 · (1,2)ˣ', 'f(x) = 5 · (0,8)ˣ', 'f(x) = 0,8 · 5ˣ', 'f(x) = 2ˣ + 5'], 1, 'Peluruhan terjadi bila basis pangkatnya di antara 0 dan 1. Hanya 5 · (0,8)ˣ yang basisnya 0,8.'),
    Q('Fungsi f(x) = a · bˣ (b > 0) memenuhi f(0) = 4 dan f(2) = 36. Nilai b adalah …', ['3', '9', '4', '6'], 0, 'f(0) = a = 4. f(2) = 4b² = 36, jadi b² = 9 dan b = 3.', 2, 'SNBT'),
  ]),
  E('GRAFIK_FUNGSI_EKSPONEN', 'GRAFIK_EKSPONEN', 'Grafik Fungsi Eksponen', [
    S('Ciri grafik y = aˣ', ['Grafik y = aˣ selalu melewati **(0, 1)** karena a⁰ = 1, selalu di atas sumbu x, dan punya **asimtot datar y = 0**.', 'a > 1: naik dari kiri ke kanan. 0 < a < 1: turun.'], [['titik potong sumbu y', '(0, 1)'], ['asimtot', 'y = 0']]),
    S('Menggeser grafik', ['**y = aˣ + k** menggeser grafik ke atas sejauh k, sehingga asimtotnya y = k. **y = a^(x − h)** menggeser ke kanan sejauh h.'], [['y = aˣ + k', 'asimtot y = k'], ['y = a^(x − h)', 'geser kanan h']], 'Untuk mencari asimtot, lihat konstanta yang ditambahkan di luar pangkat.'),
  ], [
    Q('Grafik y = 2ˣ memotong sumbu y di titik …', ['(0, 0)', '(0, 1)', '(1, 0)', '(0, 2)'], 1, 'Saat x = 0, y = 2⁰ = 1. Jadi titik potongnya (0, 1).', 1),
    Q('Asimtot datar grafik y = 3ˣ − 4 adalah …', ['y = 0', 'y = −4', 'y = 4', 'x = −4'], 1, '3ˣ mendekati 0 untuk x sangat kecil, jadi y mendekati −4. Asimtotnya y = −4.'),
    Q('Pernyataan yang benar tentang grafik y = (1/2)ˣ adalah …', ['naik dari kiri ke kanan', 'turun dari kiri ke kanan', 'berupa garis lurus', 'memotong sumbu x di (1, 0)'], 1, 'Basis 1/2 berada di antara 0 dan 1, jadi grafiknya turun. Grafik eksponen tidak pernah memotong sumbu x.'),
  ]),
  E('DEFINISI_LOGARITMA', 'DEFINISI_LOGARITMA', 'Definisi Logaritma', [
    S('Logaritma = mencari pangkat', ['**ᵃlog b = c** artinya **aᶜ = b**. Logaritma menjawab: "a dipangkatkan berapa supaya hasilnya b?"', 'Syarat: a > 0, a ≠ 1, dan b > 0.'], [['ᵃlog b = c', 'aᶜ = b'], ['²log 8', '3']]),
    S('Nilai-nilai khusus', ['ᵃlog 1 = 0, ᵃlog a = 1, dan ᵃlog aⁿ = n. Tulisan **log** tanpa basis berarti basis 10.', 'Contoh: log 1000 = 3 karena 10³ = 1000, dan log 0,01 = −2.'], [['ᵃlog aⁿ', 'n'], ['log 1000', '3']]),
  ], [
    Q('Nilai dari ²log 32 adalah …', ['4', '5', '6', '16'], 1, '2⁵ = 32, jadi ²log 32 = 5.', 1),
    Q('Jika ³log x = 4, maka nilai x adalah …', ['12', '64', '81', '7'], 2, '³log x = 4 berarti x = 3⁴ = 81.', 1),
    Q('Nilai dari log 0,001 adalah …', ['−3', '3', '−2', '1/3'], 0, '0,001 = 10⁻³, jadi log 0,001 = −3.'),
  ]),
  E('SIFAT_SIFAT_LOGARITMA', 'SIFAT_LOGARITMA', 'Sifat-sifat Logaritma', [
    S('Kali jadi tambah, bagi jadi kurang', ['Logaritma mengubah perkalian menjadi penjumlahan dan pangkat menjadi pengali.'], [['log (bc)', 'log b + log c'], ['log (b/c)', 'log b − log c'], ['log bⁿ', 'n · log b']]),
    S('Mengganti basis', ['**ᵃlog b = log b / log a**. Rantai basis saling menghapus: **ᵃlog b · ᵇlog c = ᵃlog c**.', 'Contoh: ²log 9 · ³log 16 = 2 · ²log 3 · 4 · ³log 2 = 8.'], [['ᵃlog b', 'log b / log a'], ['ᵃlog b · ᵇlog c', 'ᵃlog c']], 'Gabungkan semua suku menjadi satu logaritma dulu, baru hitung.'),
  ], [
    Q('Nilai dari ²log 8 + ²log 12 − ²log 6 adalah …', ['2', '3', '4', '5'], 2, 'Gabungkan: ²log (8 × 12 / 6) = ²log 16 = 4.'),
    Q('Jika log 2 = p dan log 3 = q, maka log 12 = …', ['2p + q', 'p + 2q', '2pq', 'p² + q'], 0, '12 = 2² × 3, jadi log 12 = 2 log 2 + log 3 = 2p + q.'),
    Q('Nilai dari ²log 9 · ³log 16 adalah …', ['6', '8', '12', '36'], 1, '²log 9 = 2 · ²log 3 dan ³log 16 = 4 · ³log 2. Hasil kalinya 8 · (²log 3 · ³log 2) = 8 · 1 = 8.', 3),
  ]),
  E('PERSAMAAN_EKSPONEN', 'PERSAMAAN_EKSPONEN', 'Persamaan Eksponen', [
    S('Samakan basisnya', ['Jika **a^f(x) = a^g(x)**, maka **f(x) = g(x)**. Kuncinya menulis kedua ruas dengan basis yang sama.', 'Contoh: 4^(x+1) = 8ˣ ⇒ 2^(2x+2) = 2^(3x) ⇒ 2x + 2 = 3x ⇒ x = 2.'], [['a^f(x) = a^g(x)', 'f(x) = g(x)']]),
    S('Bentuk kuadrat', ['Bila muncul 2^(2x) dan 2ˣ sekaligus, misalkan **p = 2ˣ** sehingga 2^(2x) = p². Selesaikan persamaan kuadratnya, lalu kembalikan ke x.'], [['2^(2x)', '(2ˣ)² = p²']], 'Ingat p = 2ˣ selalu positif; buang nilai p yang negatif.'),
  ], [
    Q('Nilai x yang memenuhi 3^(2x − 1) = 27 adalah …', ['1', '2', '3', '4'], 1, '27 = 3³, jadi 2x − 1 = 3 dan x = 2.', 1),
    Q('Penyelesaian dari 4^(x + 1) = 8^(x − 1) adalah …', ['x = 1', 'x = 3', 'x = 5', 'x = −5'], 2, '2^(2x + 2) = 2^(3x − 3), jadi 2x + 2 = 3x − 3 dan x = 5.'),
    Q('Jumlah semua nilai x yang memenuhi 2^(2x) − 6 · 2ˣ + 8 = 0 adalah …', ['2', '3', '6', '8'], 1, 'Misalkan p = 2ˣ: p² − 6p + 8 = 0, p = 2 atau p = 4, sehingga x = 1 atau x = 2. Jumlahnya 3.', 3, 'SNBT'),
  ]),
  E('PERSAMAAN_LOGARITMA', 'PERSAMAAN_LOGARITMA', 'Persamaan Logaritma', [
    S('Samakan bentuknya', ['Jika **ᵃlog f(x) = ᵃlog g(x)**, maka **f(x) = g(x)**. Bila ruas kanan berupa angka, ubah ke bentuk pangkat.', 'Contoh: ²log (x + 3) = 3 ⇒ x + 3 = 2³ ⇒ x = 5.'], [['ᵃlog f(x) = c', 'f(x) = aᶜ']]),
    S('Wajib cek syarat numerus', ['Numerus harus **positif**. Setelah dapat calon jawaban, masukkan kembali ke setiap logaritma.', 'Contoh: log (x + 2) + log (x − 1) = 1 memberi x = 3 atau x = −4. Nilai −4 membuat x − 1 negatif, jadi dibuang.'], [['syarat', 'f(x) > 0, g(x) > 0']], 'Jawaban yang tidak memenuhi syarat numerus adalah jebakan paling umum.'),
  ], [
    Q('Nilai x yang memenuhi ²log (x − 1) = 3 adalah …', ['7', '8', '9', '10'], 2, 'x − 1 = 2³ = 8, jadi x = 9. Syarat x − 1 > 0 terpenuhi.', 1),
    Q('Himpunan penyelesaian log (x + 2) + log (x − 1) = 1 adalah …', ['{3}', '{−4}', '{−4, 3}', '{4}'], 0, '(x + 2)(x − 1) = 10 ⇒ x² + x − 12 = 0 ⇒ x = 3 atau x = −4. x = −4 membuat numerus negatif, jadi hanya {3}.', 3),
    Q('Nilai x yang memenuhi ³log (2x + 1) = ³log (x + 5) adalah …', ['2', '4', '6', '−4'], 1, '2x + 1 = x + 5, jadi x = 4. Kedua numerus bernilai 9, positif.'),
  ]),
  E('PENERAPAN', 'PENERAPAN', 'Penerapan Eksponen dan Logaritma', [
    S('Tumbuh dan meluruh', ['Pertumbuhan dengan persentase tetap: **N(t) = N₀(1 + r)ᵗ**. Peluruhan dengan waktu paruh T: **N(t) = N₀ (1/2)^(t/T)**.'], [['N(t)', 'N₀(1 + r)ᵗ'], ['waktu paruh', 'N₀ (1/2)^(t/T)']]),
    S('Logaritma di sekitar kita', ['Keasaman: **pH = −log [H⁺]**. Skala Richter: naik 1 angka berarti amplitudo gempa **10 kali** lebih besar.', 'Contoh: [H⁺] = 10⁻³ M memberi pH = 3.'], [['pH', '−log [H⁺]']], 'Hitung berapa kali periode terjadi (t/T) sebelum memangkatkan.'),
  ], [
    Q('Sebuah bakteri membelah menjadi dua setiap 20 menit. Jika awalnya ada 500 bakteri, banyak bakteri setelah 1 jam adalah …', ['1.500', '3.000', '4.000', '8.000'], 2, '1 jam = 3 kali pembelahan, jadi 500 × 2³ = 4.000.'),
    Q('Larutan dengan konsentrasi [H⁺] = 10⁻⁴ M memiliki pH …', ['−4', '4', '10', '0,0001'], 1, 'pH = −log 10⁻⁴ = −(−4) = 4.', 1),
    Q('Zat radioaktif memiliki waktu paruh 5 hari. Jika massa awalnya 80 gram, massa yang tersisa setelah 15 hari adalah …', ['10 gram', '20 gram', '26,7 gram', '40 gram'], 0, '15 hari = 3 waktu paruh, jadi 80 × (1/2)³ = 10 gram.'),
  ]),
  E('SOAL_KONTEKSTUAL', 'SOAL_KONTEKSTUAL', 'Soal Kontekstual Eksponen', [
    S('Dari cerita ke model', ['Cari tiga hal: **nilai awal**, **faktor pengali per periode** (naik r% berarti × (1 + r), turun r% berarti × (1 − r)), dan **banyak periode**.', 'Contoh: 100.000 penduduk tumbuh 2% per tahun ⇒ P(t) = 100.000 · (1,02)ᵗ.'], [['naik r%', '× (1 + r)'], ['turun r%', '× (1 − r)']]),
    S('Mencari waktu', ['Jika yang ditanya lamanya waktu, samakan basis atau pakai logaritma.', 'Contoh: populasi menjadi 3 kali tiap 4 tahun; menjadi 9 = 3² kali berarti 2 periode, yaitu 8 tahun.'], [['3^(t/4) = 9', 't = 8']], 'Tulis modelnya dulu sebelum menghitung; jawaban sering cukup dibaca dari model.'),
  ], [
    Q('Penduduk sebuah kota 100.000 jiwa dan bertambah 2% setiap tahun. Model jumlah penduduk setelah t tahun adalah …', ['100.000 · (1,02)ᵗ', '100.000 · (0,02)ᵗ', '100.000 + 2t', '100.000 · (1,2)ᵗ'], 0, 'Naik 2% berarti dikali 1,02 setiap tahun, sehingga P(t) = 100.000 · (1,02)ᵗ.', 1, 'SNBT'),
    Q('Harga sebuah mobil Rp200 juta dan nilainya turun 10% setiap tahun. Nilai mobil setelah 2 tahun adalah …', ['Rp160 juta', 'Rp162 juta', 'Rp180 juta', 'Rp164 juta'], 1, 'Turun 10% berarti dikali 0,9 tiap tahun: 200 × 0,9² = 200 × 0,81 = 162 juta.'),
    Q('Suatu populasi menjadi 3 kali lipat setiap 4 tahun. Waktu yang dibutuhkan agar populasi menjadi 9 kali lipat adalah …', ['6 tahun', '8 tahun', '12 tahun', '36 tahun'], 1, '9 = 3², artinya dua periode tiga kali lipat, yaitu 2 × 4 = 8 tahun.', 2, 'SNBT'),
  ], 6),
];

const BAR: PilotExisting[] = [
  B('POLA_BILANGAN', 'POLA_BILANGAN', 'Pola Bilangan', [
    S('Mencari aturan', ['Pola bilangan punya **aturan tetap** antarsuku. Lihat selisihnya: 2, 5, 8, 11 (selalu +3). Bila selisihnya berubah, lihat selisih tingkat dua.', 'Contoh: 3, 7, 13, 21 memiliki selisih 4, 6, 8, naik 2 setiap langkah.'], [['selisih tetap', 'pola aritmetika']]),
    S('Pola bangun', ['Pola persegi: **n²** (1, 4, 9, 16). Pola segitiga: **n(n + 1)/2** (1, 3, 6, 10). Pola persegi panjang: **n(n + 1)** (2, 6, 12, 20).'], [['segitiga', 'n(n + 1)/2'], ['persegi', 'n²']], 'Uji rumus pada n = 1 dan n = 2 sebelum dipakai untuk n besar.'),
  ], [
    Q('Suku berikutnya dari barisan 3, 7, 13, 21, 31, … adalah …', ['41', '43', '45', '39'], 1, 'Selisihnya 4, 6, 8, 10, jadi selisih berikutnya 12: 31 + 12 = 43.'),
    Q('Banyak noktah pada pola ke-10 dari pola bilangan segitiga 1, 3, 6, 10, … adalah …', ['45', '55', '66', '100'], 1, 'Pola segitiga: n(n + 1)/2 = 10 × 11 / 2 = 55.', 1),
  ]),
  B('BARISAN_ARITMETIKA', 'BARISAN_ARITMETIKA', 'Barisan Aritmetika', [
    S('Beda yang tetap', ['Barisan aritmetika bertambah dengan **beda b** yang sama. Suku ke-n: **Uₙ = a + (n − 1)b**.', 'Contoh: 5, 9, 13, … memiliki a = 5 dan b = 4, sehingga U₁₅ = 5 + 14 × 4 = 61.'], [['Uₙ', 'a + (n − 1)b'], ['b', 'Uₙ − Uₙ₋₁']]),
    S('Dari dua suku yang diketahui', ['Kurangkan dua suku untuk mendapat b. Contoh: U₃ = 11 dan U₇ = 23 ⇒ 4b = 12 ⇒ b = 3, lalu a = 11 − 2 × 3 = 5.'], [['U₇ − U₃', '4b']], 'Selisih indeks (7 − 3 = 4) adalah banyaknya b di antara dua suku.'),
  ], [
    Q('Suku ke-3 suatu barisan aritmetika adalah 11 dan suku ke-7 adalah 23. Suku ke-20 barisan itu adalah …', ['59', '62', '65', '68'], 1, '4b = 23 − 11 = 12, jadi b = 3 dan a = 5. U₂₀ = 5 + 19 × 3 = 62.'),
    Q('Suku ke-15 dari barisan 5, 9, 13, … adalah …', ['57', '61', '65', '60'], 1, 'a = 5, b = 4, U₁₅ = 5 + 14 × 4 = 61.', 1),
  ]),
  B('BARISAN_GEOMETRI', 'BARISAN_GEOMETRI', 'Barisan Geometri', [
    S('Rasio yang tetap', ['Barisan geometri dikalikan **rasio r** yang sama. Suku ke-n: **Uₙ = a · rⁿ⁻¹**.', 'Contoh: 3, 6, 12, … memiliki r = 2, sehingga U₈ = 3 × 2⁷ = 384.'], [['Uₙ', 'a · rⁿ⁻¹'], ['r', 'Uₙ / Uₙ₋₁']]),
    S('Dari dua suku yang diketahui', ['Bagi dua suku untuk mendapat r. Contoh: U₂ = 6 dan U₅ = 162 ⇒ r³ = 27 ⇒ r = 3, lalu a = 6/3 = 2.'], [['U₅ / U₂', 'r³']], 'Pada barisan geometri, suku dibagi, bukan dikurangi.'),
  ], [
    Q('Suku ke-8 dari barisan 3, 6, 12, … adalah …', ['192', '384', '768', '256'], 1, 'a = 3, r = 2, U₈ = 3 × 2⁷ = 3 × 128 = 384.', 1),
    Q('Suku ke-2 suatu barisan geometri adalah 6 dan suku ke-5 adalah 162. Suku ke-4 barisan itu adalah …', ['18', '54', '81', '108'], 1, 'r³ = 162/6 = 27, jadi r = 3 dan a = 2. U₄ = 2 × 3³ = 54.'),
  ]),
  B('SUKU_TENGAH_SISIPAN', 'SUKU_TENGAH', 'Suku Tengah & Sisipan', [
    S('Suku tengah', ['Untuk banyak suku ganjil, suku tengah aritmetika adalah **rata-rata suku pertama dan terakhir**: Uₜ = (a + Uₙ)/2. Pada geometri: Uₜ = √(a · Uₙ).'], [['aritmetika', 'Uₜ = (a + Uₙ)/2'], ['geometri', 'Uₜ = √(a · Uₙ)']]),
    S('Menyisipkan bilangan', ['Menyisipkan k bilangan di antara x dan y membuat **k + 1 langkah**. Aritmetika: b′ = (y − x)/(k + 1). Geometri: r′ = (y/x)^(1/(k + 1)).', 'Contoh: 3 bilangan di antara 2 dan 162 membentuk geometri: r⁴ = 81 ⇒ r = 3.'], [['b′', '(y − x)/(k + 1)']], 'Hitung langkahnya, bukan banyak bilangan sisipan.'),
  ], [
    Q('Barisan aritmetika 3, …, 63 memiliki banyak suku ganjil. Suku tengahnya adalah …', ['30', '33', '36', '31'], 1, 'Uₜ = (3 + 63)/2 = 33.', 1),
    Q('Di antara 2 dan 162 disisipkan 3 bilangan sehingga terbentuk barisan geometri. Rasio barisan baru itu adalah …', ['3', '4', '9', '27'], 0, 'Ada 4 langkah: r⁴ = 162/2 = 81, jadi r = 3.'),
  ]),
  B('DERET_ARITMETIKA', 'DERET_ARITMETIKA', 'Deret Aritmetika', [
    S('Jumlah n suku', ['Jumlahkan pasangan ujung: **Sₙ = n/2 (a + Uₙ) = n/2 (2a + (n − 1)b)**.', 'Contoh terkenal: 1 + 2 + … + 100 = 100/2 × 101 = 5.050.'], [['Sₙ', 'n/2 (2a + (n − 1)b)']]),
    S('Dari Sₙ ke Uₙ', ['Jika rumus Sₙ diketahui, suku ke-n adalah **Uₙ = Sₙ − Sₙ₋₁**.', 'Contoh: Sₙ = n² + 3n ⇒ U₁₀ = S₁₀ − S₉ = 130 − 108 = 22.'], [['Uₙ', 'Sₙ − Sₙ₋₁']], 'Jangan langsung memasukkan n ke rumus Sₙ bila yang ditanya suku, bukan jumlah.'),
  ], [
    Q('Jumlah 20 suku pertama deret 4 + 7 + 10 + … adalah …', ['610', '650', '670', '700'], 1, 'a = 4, b = 3, S₂₀ = 10 × (8 + 19 × 3) = 10 × 65 = 650.'),
    Q('Jumlah n suku pertama suatu deret aritmetika adalah Sₙ = n² + 3n. Suku ke-10 deret itu adalah …', ['20', '22', '24', '130'], 1, 'U₁₀ = S₁₀ − S₉ = (100 + 30) − (81 + 27) = 130 − 108 = 22.'),
  ]),
  B('DERET_GEOMETRI', 'DERET_GEOMETRI', 'Deret Geometri', [
    S('Jumlah n suku geometri', ['**Sₙ = a(rⁿ − 1)/(r − 1)** untuk r > 1, atau **Sₙ = a(1 − rⁿ)/(1 − r)** untuk r < 1.', 'Contoh: 1 + 2 + 4 + … + 2⁹ = (2¹⁰ − 1)/(2 − 1) = 1.023.'], [['Sₙ (r > 1)', 'a(rⁿ − 1)/(r − 1)'], ['Sₙ (r < 1)', 'a(1 − rⁿ)/(1 − r)']]),
    S('Pilih bentuk yang nyaman', ['Kedua bentuk memberi hasil sama; pilih yang penyebutnya positif agar tidak keliru tanda.', 'Contoh: 64 + 32 + 16 + 8 + 4 = 64(1 − (1/2)⁵)/(1/2) = 124.'], [['64 + 32 + … (5 suku)', '124']], 'Untuk sedikit suku, menjumlah langsung juga sah dan cepat.'),
  ], [
    Q('Jumlah 6 suku pertama deret 2 + 6 + 18 + … adalah …', ['364', '728', '1.456', '486'], 1, 'a = 2, r = 3: S₆ = 2(3⁶ − 1)/(3 − 1) = 3⁶ − 1 = 728.'),
    Q('Deret geometri memiliki suku pertama 64 dan rasio 1/2. Jumlah 5 suku pertamanya adalah …', ['120', '124', '126', '128'], 1, '64 + 32 + 16 + 8 + 4 = 124.', 1),
  ]),
  B('DERET_GEOMETRI_TAK_HINGGA', 'DERET_TAK_HINGGA', 'Deret Geometri Tak Hingga', [
    S('Jumlah yang tidak pernah habis tapi terbatas', ['Bila **−1 < r < 1**, suku-sukunya makin kecil dan jumlahnya menuju **S∞ = a/(1 − r)**.', 'Contoh: 12 + 6 + 3 + … = 12/(1 − 1/2) = 24.'], [['S∞', 'a/(1 − r)'], ['syarat', '−1 < r < 1']]),
    S('Bola memantul', ['Bola jatuh dari h dan memantul r kali tinggi sebelumnya. Lintasan turun: h/(1 − r). Lintasan naik: hr/(1 − r). Total = turun + naik.', 'Contoh: h = 10 m, r = 3/4: turun 40 m, naik 30 m, total 70 m.'], [['lintasan total', 'h(1 + r)/(1 − r)']], 'Lintasan naik dimulai dari pantulan pertama, jadi suku pertamanya hr, bukan h.'),
  ], [
    Q('Jumlah deret tak hingga 12 + 6 + 3 + … adalah …', ['21', '24', '36', 'tak terhingga'], 1, 'a = 12, r = 1/2: S∞ = 12/(1 − 1/2) = 24.', 1),
    Q('Sebuah bola dijatuhkan dari ketinggian 10 m dan memantul 3/4 kali tinggi sebelumnya, terus-menerus sampai berhenti. Panjang seluruh lintasan bola adalah …', ['40 m', '60 m', '70 m', '80 m'], 2, 'Turun: 10/(1 − 3/4) = 40 m. Naik: 7,5/(1 − 3/4) = 30 m. Total 70 m.', 3),
  ]),
  B('PENERAPAN', 'PENERAPAN', 'Penerapan Barisan dan Deret', [
    S('Aritmetika atau geometri?', ['Bertambah **jumlah tetap** (Rp50.000 per bulan, 15 unit per bulan) ⇒ aritmetika. Bertambah **persentase tetap** (10% per tahun) ⇒ geometri.'], [['+ tetap', 'aritmetika'], ['× tetap', 'geometri']]),
    S('Total atau satu waktu?', ['"Produksi bulan ke-12" menanyakan **suku** Uₙ. "Total produksi selama setahun" menanyakan **jumlah** Sₙ.', 'Contoh: 120 unit bulan pertama, naik 15 per bulan: S₁₂ = 6 × (240 + 165) = 2.430.'], [['S₁₂', '6(2a + 11b)']], 'Garis bawahi kata "selama" (jumlah) dan "pada" (suku).'),
  ], [
    Q('Produksi pabrik pada bulan pertama 120 unit dan bertambah 15 unit setiap bulan. Total produksi selama satu tahun adalah …', ['2.280 unit', '2.430 unit', '2.580 unit', '1.620 unit'], 1, 'S₁₂ = 12/2 × (2 × 120 + 11 × 15) = 6 × 405 = 2.430 unit.'),
    Q('Tinggi tanaman 50 cm dan bertambah 10% dari tinggi sebelumnya setiap minggu. Tinggi tanaman setelah 2 minggu adalah …', ['60 cm', '60,5 cm', '61 cm', '55 cm'], 1, 'Pertumbuhan persentase: 50 × 1,1² = 50 × 1,21 = 60,5 cm.'),
  ]),
  B('SOAL_KONTEKSTUAL', 'SOAL_KONTEKSTUAL', 'Soal Kontekstual Barisan dan Deret', [
    S('Empat langkah', ['1) Kenali jenisnya (tetap ditambah atau dikali). 2) Tentukan a dan b atau r. 3) Tentukan yang ditanya: suku atau jumlah. 4) Hitung dan cek satuannya.'], [['suku', 'Uₙ'], ['jumlah', 'Sₙ']]),
    S('Contoh tali dipotong', ['Tali dipotong 5 bagian membentuk barisan geometri, terpendek 4 cm dan terpanjang 64 cm: r⁴ = 16 ⇒ r = 2. Panjang tali = 4 + 8 + 16 + 32 + 64 = 124 cm.'], [['r⁴', '64/4 = 16']], 'Panjang seluruh tali adalah jumlah, bukan suku terakhir.'),
  ], [
    Q('Gaji seorang karyawan pada tahun pertama Rp36 juta dan naik Rp2 juta setiap tahun. Total gaji yang diterimanya selama 10 tahun adalah …', ['Rp360 juta', 'Rp400 juta', 'Rp450 juta', 'Rp540 juta'], 2, 'S₁₀ = 10/2 × (2 × 36 + 9 × 2) = 5 × 90 = 450 juta.'),
    Q('Seutas tali dipotong menjadi 5 bagian yang panjangnya membentuk barisan geometri. Potongan terpendek 4 cm dan terpanjang 64 cm. Panjang tali semula adalah …', ['120 cm', '124 cm', '128 cm', '132 cm'], 1, 'r⁴ = 64/4 = 16, r = 2: 4 + 8 + 16 + 32 + 64 = 124 cm.'),
  ], 6),
];

const VEK: PilotExisting[] = [
  V('KONSEP_DASAR_VEKTOR', 'KONSEP_DASAR', 'Konsep Dasar Vektor', [
    S('Skalar dan vektor', ['**Skalar** hanya punya besar (massa, suhu, waktu). **Vektor** punya besar dan **arah** (perpindahan, kecepatan, gaya).', 'Vektor digambar sebagai anak panah: panjangnya menyatakan besar, ujungnya menyatakan arah.'], [['vektor', 'besar + arah']]),
    S('Kapan dua vektor sama?', ['Dua vektor **sama** bila besar dan arahnya sama, walaupun letaknya berbeda. Vektor yang besarnya sama tapi arahnya berlawanan disebut **vektor negatif**.'], [['−a', 'besar sama, arah berlawanan']], 'Menggeser anak panah tanpa memutarnya tidak mengubah vektornya.'),
  ], [
    Q('Manakah yang termasuk besaran vektor?', ['massa', 'suhu', 'perpindahan', 'waktu'], 2, 'Perpindahan memiliki besar dan arah. Massa, suhu, dan waktu hanya memiliki besar.', 1, 'KM'),
    Q('Dua vektor dikatakan sama jika …', ['letak titik pangkalnya sama', 'besar dan arahnya sama', 'besarnya sama saja', 'arahnya berlawanan'], 1, 'Vektor ditentukan oleh besar dan arah; letaknya tidak berpengaruh.', 1, 'KM'),
  ], 4),
  V('NOTASI_VEKTOR', 'NOTASI', 'Notasi Vektor', [
    S('Vektor dari titik A ke B', ['Vektor **AB = B − A**: kurangkan koordinat ujung dengan pangkal. Contoh: A(1, 2), B(4, 6) ⇒ AB = (3, 4).'], [['AB', 'B − A']]),
    S('Tiga cara menulis', ['Bentuk kolom/baris (3, 4), bentuk basis **3i + 4j**, atau huruf tebal **a**. Semuanya menyatakan vektor yang sama.'], [['(x, y)', 'xi + yj']], 'Ujung dikurangi pangkal, bukan sebaliknya: BA = A − B = −AB.'),
  ], [
    Q('Diketahui A(1, 2) dan B(4, 6). Vektor AB adalah …', ['(3, 4)', '(5, 8)', '(−3, −4)', '(4, 3)'], 0, 'AB = B − A = (4 − 1, 6 − 2) = (3, 4).', 1),
    Q('Vektor 2i − 5j jika ditulis dalam bentuk komponen adalah …', ['(2, 5)', '(−2, 5)', '(2, −5)', '(−5, 2)'], 2, 'Koefisien i adalah komponen x dan koefisien j adalah komponen y: (2, −5).', 1),
  ], 4),
  V('VEKTOR_DI_KOORDINAT', 'KOORDINAT', 'Vektor di Koordinat', [
    S('Vektor posisi', ['Vektor posisi titik A adalah **a = OA**, dari titik asal O ke A. Komponennya sama dengan koordinat A.', 'Di ruang tiga dimensi: A(x, y, z) ⇒ a = xi + yj + zk.'], [['a = OA', '(x, y, z)']]),
    S('Vektor antara dua titik di ruang', ['Sama seperti di bidang: **PQ = q − p**. Contoh: P(2, −1, 3), Q(5, 3, 1) ⇒ PQ = (3, 4, −2).'], [['PQ', 'q − p']], 'Kurangkan komponen yang sejenis: x dengan x, y dengan y, z dengan z.'),
  ], [
    Q('Diketahui P(2, −1, 3) dan Q(5, 3, 1). Vektor PQ adalah …', ['(3, 4, −2)', '(7, 2, 4)', '(3, 2, −2)', '(−3, −4, 2)'], 0, 'PQ = Q − P = (5 − 2, 3 − (−1), 1 − 3) = (3, 4, −2).'),
    Q('Vektor posisi titik A(−3, 4) adalah …', ['−3i + 4j', '3i − 4j', '4i − 3j', '−3i − 4j'], 0, 'Vektor posisi memiliki komponen yang sama dengan koordinat titiknya: −3i + 4j.', 1),
  ], 4),
  V('PANJANG_VEKTOR', 'PANJANG', 'Panjang Vektor', [
    S('Pythagoras untuk vektor', ['Panjang (besar) vektor a = (x, y) adalah **|a| = √(x² + y²)**. Di ruang: **|a| = √(x² + y² + z²)**.', 'Contoh: |(3, −4)| = √(9 + 16) = 5.'], [['|a|', '√(x² + y² + z²)']]),
    S('Jarak dua titik', ['Jarak A ke B sama dengan panjang vektor AB. Contoh: A(1, 2), B(7, 10) ⇒ AB = (6, 8) ⇒ |AB| = 10.'], [['|AB|', '√((x₂ − x₁)² + (y₂ − y₁)²)']], 'Komponen negatif tetap dikuadratkan menjadi positif.'),
  ], [
    Q('Panjang vektor a = (3, −4) adalah …', ['1', '5', '7', '25'], 1, '|a| = √(3² + (−4)²) = √25 = 5.', 1),
    Q('Panjang vektor 2i − j + 2k adalah …', ['3', '√5', '5', '9'], 0, '√(4 + 1 + 4) = √9 = 3.'),
    Q('Jarak titik A(1, 2) ke B(7, 10) adalah …', ['8', '10', '14', '100'], 1, 'AB = (6, 8), |AB| = √(36 + 64) = 10.'),
  ], 4),
  V('KESAMAAN_VEKTOR', 'KESAMAAN', 'Kesamaan Vektor', [
    S('Komponen demi komponen', ['Dua vektor sama bila **setiap komponen yang bersesuaian sama**. (a₁, a₂) = (b₁, b₂) ⇔ a₁ = b₁ dan a₂ = b₂.'], [['a = b', 'a₁ = b₁, a₂ = b₂']]),
    S('Mencari variabel', ['Contoh: (2x − 1, 6) = (5, 3y) ⇒ 2x − 1 = 5 dan 6 = 3y ⇒ x = 3, y = 2.'], [['2x − 1 = 5', 'x = 3']], 'Setiap komponen memberi satu persamaan.'),
  ], [
    Q('Jika (2x − 1, 6) = (5, 3y), nilai x + y adalah …', ['4', '5', '6', '7'], 1, '2x − 1 = 5 ⇒ x = 3; 3y = 6 ⇒ y = 2. Jadi x + y = 5.'),
    Q('Diketahui a = (p, 4) dan b = (3, q + 1). Jika a = b, nilai p · q adalah …', ['9', '12', '6', '15'], 0, 'p = 3 dan q + 1 = 4 ⇒ q = 3. Jadi p · q = 9.'),
  ], 4),
  V('VEKTOR_SATUAN', 'SATUAN', 'Vektor Satuan', [
    S('Panjangnya satu', ['Vektor satuan searah a: **â = a / |a|**. Panjangnya selalu 1.', 'Contoh: a = (3, 4), |a| = 5 ⇒ â = (3/5, 4/5).'], [['â', 'a / |a|']]),
    S('i, j, k', ['**i, j, k** adalah vektor satuan pada sumbu x, y, z. Setiap vektor bisa ditulis sebagai kombinasi ketiganya.', 'Contoh: a = i + 2j + 2k, |a| = 3 ⇒ â = (1/3)(i + 2j + 2k).'], [['|i| = |j| = |k|', '1']], 'Bagi setiap komponen dengan panjang vektor.'),
  ], [
    Q('Vektor satuan yang searah dengan a = (3, 4) adalah …', ['(3/5, 4/5)', '(3/7, 4/7)', '(1, 1)', '(4/5, 3/5)'], 0, '|a| = 5, jadi â = (3/5, 4/5).', 1),
    Q('Vektor satuan dari a = i + 2j + 2k adalah …', ['(1/3)(i + 2j + 2k)', '(1/5)(i + 2j + 2k)', '(1/9)(i + 2j + 2k)', 'i + j + k'], 0, '|a| = √(1 + 4 + 4) = 3, jadi â = a/3.'),
  ], 4),
  V('PENJUMLAHAN_VEKTOR', 'PENJUMLAHAN', 'Penjumlahan Vektor', [
    S('Ujung bertemu pangkal', ['**Aturan segitiga**: letakkan pangkal b di ujung a; a + b adalah panah dari pangkal a ke ujung b. **Aturan jajargenjang** memberi hasil yang sama.'], [['a + b', '(a₁ + b₁, a₂ + b₂)']]),
    S('Secara komponen', ['Jumlahkan komponen yang sejenis. Contoh: (2, −3) + (−1, 5) = (1, 2).', '(i + 2j − k) + (3i − j + 4k) = 4i + j + 3k.'], [['(2, −3) + (−1, 5)', '(1, 2)']], 'Hati-hati dengan tanda negatif saat menjumlah.'),
  ], [
    Q('Diketahui a = (2, −3) dan b = (−1, 5). Hasil a + b adalah …', ['(1, 2)', '(3, −8)', '(1, −8)', '(−2, −15)'], 0, '(2 + (−1), −3 + 5) = (1, 2).', 1),
    Q('Hasil dari (i + 2j − k) + (3i − j + 4k) adalah …', ['4i + j + 3k', '4i + 3j + 3k', '2i + j + 5k', '4i − j + 3k'], 0, 'Jumlahkan per komponen: (1 + 3)i + (2 − 1)j + (−1 + 4)k = 4i + j + 3k.', 1),
  ], 4),
  V('PENGURANGAN_VEKTOR', 'PENGURANGAN', 'Pengurangan Vektor', [
    S('Menambah lawannya', ['**a − b = a + (−b)**: balik arah b, lalu jumlahkan. Secara komponen, kurangkan komponen yang sejenis.'], [['a − b', '(a₁ − b₁, a₂ − b₂)']]),
    S('Hubungan dengan dua titik', ['AB = OB − OA = b − a. Jadi pengurangan vektor posisi memberi vektor antara dua titik.', 'Contoh: A(2, 3), B(6, 1) ⇒ BA = a − b = (−4, 2).'], [['AB', 'b − a']], 'Urutan penting: a − b tidak sama dengan b − a.'),
  ], [
    Q('Diketahui a = (5, 2) dan b = (1, −3). Hasil a − b adalah …', ['(4, 5)', '(4, −1)', '(6, −1)', '(−4, −5)'], 0, '(5 − 1, 2 − (−3)) = (4, 5).', 1),
    Q('Diketahui A(2, 3) dan B(6, 1). Vektor BA adalah …', ['(4, −2)', '(−4, 2)', '(8, 4)', '(−4, −2)'], 1, 'BA = A − B = (2 − 6, 3 − 1) = (−4, 2).'),
  ], 4),
  V('SIFAT_OPERASI_VEKTOR', 'SIFAT_OPERASI', 'Sifat Operasi Vektor', [
    S('Seperti bilangan biasa', ['**Komutatif**: a + b = b + a. **Asosiatif**: (a + b) + c = a + (b + c).'], [['komutatif', 'a + b = b + a'], ['asosiatif', '(a + b) + c = a + (b + c)']]),
    S('Identitas dan invers', ['**Vektor nol** 0 adalah identitas: a + 0 = a. **Invers** a adalah −a: a + (−a) = 0.'], [['a + (−a)', '0']], 'Sifat ini membuat kita bebas mengatur urutan saat menjumlah banyak vektor.'),
  ], [
    Q('Sifat a + b = b + a disebut sifat …', ['asosiatif', 'komutatif', 'distributif', 'identitas'], 1, 'Menukar urutan penjumlahan tanpa mengubah hasil disebut sifat komutatif.', 1, 'KM'),
    Q('Hasil dari a + (−a) adalah …', ['2a', 'a', 'vektor nol', '−2a'], 2, 'Sebuah vektor dijumlahkan dengan inversnya menghasilkan vektor nol.', 1, 'KM'),
  ], 4),
  V('PERKALIAN_SKALAR', 'PERKALIAN_SKALAR', 'Perkalian Skalar dengan Vektor', [
    S('Memperpanjang dan membalik', ['**k · a** mengalikan setiap komponen dengan k. Bila k > 0 arahnya tetap; bila k < 0 arahnya **berlawanan**.', 'Contoh: 3(2, −1) = (6, −3).'], [['k · (x, y)', '(kx, ky)']]),
    S('Kombinasi linear', ['Gabungkan perkalian skalar dan penjumlahan. Contoh: a = (1, 2), b = (3, −1) ⇒ 2a − 3b = (2, 4) − (9, −3) = (−7, 7).'], [['2a − 3b', '(−7, 7)']], 'Kalikan dulu, baru jumlahkan atau kurangkan.'),
  ], [
    Q('Hasil dari 3 · (2, −1) adalah …', ['(6, −3)', '(5, 2)', '(6, 3)', '(2, −3)'], 0, 'Setiap komponen dikali 3: (6, −3).', 1),
    Q('Diketahui a = (1, 2) dan b = (3, −1). Hasil 2a − 3b adalah …', ['(−7, 7)', '(7, −7)', '(−7, 1)', '(11, 1)'], 0, '2a = (2, 4), 3b = (9, −3). 2a − 3b = (2 − 9, 4 + 3) = (−7, 7).'),
  ], 4),
  V('SIFAT_PERKALIAN_SKALAR', 'SIFAT_SKALAR', 'Sifat Perkalian Skalar', [
    S('Distributif', ['k(a + b) = ka + kb dan (k + m)a = ka + ma. Jadi bentuk vektor bisa disederhanakan seperti aljabar.'], [['k(a + b)', 'ka + kb']]),
    S('Panjang ikut berlipat', ['**|ka| = |k| · |a|**. Contoh: |a| = 4 ⇒ |−3a| = 3 × 4 = 12. Tanda negatif hanya membalik arah.'], [['|ka|', '|k| · |a|']], 'Panjang tidak pernah negatif.'),
  ], [
    Q('Jika |a| = 4, maka |−3a| adalah …', ['−12', '12', '7', '1'], 1, '|−3a| = |−3| × |a| = 3 × 4 = 12.', 1),
    Q('Bentuk sederhana dari 2(a + b) − (a − 2b) adalah …', ['a + 4b', 'a', '3a + 4b', 'a + 2b'], 0, '2a + 2b − a + 2b = a + 4b.'),
  ], 4),
  V('RESULTAN_VEKTOR', 'RESULTAN', 'Resultan Vektor', [
    S('Resultan dua gaya', ['Resultan adalah jumlah vektor. Untuk dua vektor yang membentuk sudut θ: **|R| = √(F₁² + F₂² + 2F₁F₂ cos θ)**.'], [['|R|', '√(F₁² + F₂² + 2F₁F₂ cos θ)']]),
    S('Kasus khusus', ['θ = 90°: |R| = √(F₁² + F₂²). θ = 0°: |R| = F₁ + F₂. θ = 180°: |R| = |F₁ − F₂|.', 'Contoh: 6 N dan 8 N saling tegak lurus ⇒ |R| = 10 N.'], [['θ = 90°', '√(F₁² + F₂²)']], 'cos 90° = 0, jadi suku tengahnya hilang.'),
  ], [
    Q('Dua gaya 6 N dan 8 N bekerja saling tegak lurus pada satu titik. Besar resultannya adalah …', ['2 N', '10 N', '14 N', '48 N'], 1, '|R| = √(36 + 64) = √100 = 10 N.', 1),
    Q('Dua gaya masing-masing 5 N membentuk sudut 60°. Besar resultannya adalah …', ['5 N', '5√3 N', '10 N', '5√2 N'], 1, '|R| = √(25 + 25 + 2 · 25 · ½) = √75 = 5√3 N.'),
  ], 5),
  V('PERKALIAN_TITIK', 'PERKALIAN_TITIK', 'Perkalian Titik (Dot)', [
    S('Hasilnya skalar', ['**a · b = a₁b₁ + a₂b₂ (+ a₃b₃)**. Hasil perkalian titik adalah bilangan, bukan vektor.', 'Contoh: (2, 3) · (4, −1) = 8 − 3 = 5.'], [['a · b', 'a₁b₁ + a₂b₂ + a₃b₃'], ['a · b', '|a||b| cos θ']]),
    S('Tegak lurus', ['Karena a · b = |a||b| cos θ dan cos 90° = 0, dua vektor **tegak lurus jika a · b = 0**.', 'Contoh: (2, p) · (3, −6) = 6 − 6p = 0 ⇒ p = 1.'], [['a ⊥ b', 'a · b = 0']], 'Gunakan rumus komponen bila komponen diketahui, rumus cos θ bila panjang dan sudut diketahui.'),
  ], [
    Q('Hasil perkalian titik (2, 3) · (4, −1) adalah …', ['5', '11', '(8, −3)', '−5'], 0, '2 × 4 + 3 × (−1) = 8 − 3 = 5.', 1),
    Q('Diketahui |a| = 4, |b| = 3, dan sudut antara a dan b adalah 60°. Nilai a · b adalah …', ['6', '6√3', '12', '3'], 0, 'a · b = 4 × 3 × cos 60° = 12 × ½ = 6.'),
    Q('Vektor a = (2, p) tegak lurus dengan b = (3, −6). Nilai p adalah …', ['−1', '1', '2', '3'], 1, 'Tegak lurus berarti a · b = 0: 6 − 6p = 0, jadi p = 1.'),
  ], 5),
  V('SUDUT_ANTAR_VEKTOR', 'SUDUT_ANTAR', 'Sudut Antar Vektor', [
    S('Rumus kosinus sudut', ['**cos θ = (a · b) / (|a||b|)**. Hitung perkalian titik, hitung kedua panjang, lalu cari sudut dari nilai cos.'], [['cos θ', '(a · b) / (|a||b|)']]),
    S('Membaca nilai cos', ['cos θ = 1 ⇒ 0° (searah). cos θ = 0 ⇒ 90°. cos θ = −1 ⇒ 180° (berlawanan). cos θ = ½√2 ⇒ 45°.', 'Contoh: a = (1, 0), b = (1, 1) ⇒ cos θ = 1/√2 ⇒ θ = 45°.'], [['cos θ = 1/√2', 'θ = 45°']], 'Bila a · b = 0, langsung simpulkan 90° tanpa menghitung panjang.'),
  ], [
    Q('Besar sudut antara a = (1, 0) dan b = (1, 1) adalah …', ['30°', '45°', '60°', '90°'], 1, 'a · b = 1, |a| = 1, |b| = √2, cos θ = 1/√2, jadi θ = 45°.'),
    Q('Besar sudut antara a = (1, 2, 2) dan b = (2, −2, 1) adalah …', ['0°', '45°', '60°', '90°'], 3, 'a · b = 2 − 4 + 2 = 0, jadi kedua vektor tegak lurus: θ = 90°.'),
  ], 5),
  V('PENERAPAN_VEKTOR', 'PENERAPAN', 'Penerapan Vektor', [
    S('Usaha sebagai perkalian titik', ['Usaha oleh gaya F yang memindahkan benda sejauh s: **W = F · s**. Hanya komponen gaya yang searah perpindahan yang melakukan usaha.'], [['W', 'F · s = |F||s| cos θ']]),
    S('Kecepatan relatif', ['Kecepatan perahu di sungai = kecepatan perahu + kecepatan arus (jumlah vektor).', 'Contoh: 4 m/s ke timur dan arus 3 m/s ke utara ⇒ 5 m/s.'], [['v total', 'v perahu + v arus']], 'Gambar sketsa panahnya dulu; sering membentuk segitiga siku-siku.'),
  ], [
    Q('Gaya F = (3, 4) N memindahkan benda dengan perpindahan s = (5, 0) m. Usaha yang dilakukan gaya adalah …', ['15 J', '20 J', '25 J', '35 J'], 0, 'W = F · s = 3 × 5 + 4 × 0 = 15 J.'),
    Q('Perahu melaju 4 m/s ke timur di sungai yang arusnya 3 m/s ke utara. Besar kecepatan resultan perahu adalah …', ['1 m/s', '5 m/s', '7 m/s', '12 m/s'], 1, 'Kedua kecepatan tegak lurus: √(16 + 9) = 5 m/s.', 1),
  ], 5),
  V('SOAL_KONTEKSTUAL', 'SOAL_KONTEKSTUAL', 'Soal Kontekstual Vektor', [
    S('Cerita jadi panah', ['Ubah setiap gerakan atau gaya menjadi vektor komponen: timur = +x, utara = +y. Lalu jumlahkan.', 'Contoh: 6 km ke timur lalu 8 km ke utara ⇒ (6, 8), jaraknya 10 km.'], [['timur', '+x'], ['utara', '+y']]),
    S('Besar resultan', ['Setelah menjumlah komponen, hitung panjangnya. Contoh: F₁ = (4, 3) N, F₂ = (2, 5) N ⇒ R = (6, 8) ⇒ |R| = 10 N.'], [['|R|', '√(Rx² + Ry²)']], 'Jarak (besar) berbeda dengan perpindahan (vektor); baca yang ditanya.'),
  ], [
    Q('Seseorang berjalan 6 km ke timur, lalu 8 km ke utara. Jarak orang itu dari titik awal adalah …', ['2 km', '10 km', '14 km', '48 km'], 1, 'Perpindahannya (6, 8), panjangnya √(36 + 64) = 10 km.', 1),
    Q('Dua orang menarik sebuah peti dengan gaya F₁ = (4, 3) N dan F₂ = (2, 5) N. Besar gaya resultannya adalah …', ['8 N', '10 N', '12 N', '14 N'], 1, 'R = (4 + 2, 3 + 5) = (6, 8), |R| = 10 N.'),
  ], 6),
];

export const MAT_EXISTING: PilotExisting[] = [...EKS, ...BAR, ...VEK];
