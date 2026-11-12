import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Matematika kelas 11–12 (Matematika Tingkat Lanjut, Fase F+) dari pemeriksaan per kelas 12 November 2026:
// bab yang ada di buku siswa Matematika Tingkat Lanjut XI–XII tetapi belum ada di katalog. Kunci = "KODE_TOPIK:ID_INTI"
// di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): Content => ({ slides, q, min });

export const SMA_MAT_LANJUT: Record<string, Content> = {
  // ---------- Bilangan kompleks (kelas 11) ----------
  'MAT.C26.FPLUS.KOMPLEKS:C1': K([
    S('Satuan imajiner i', ['Persamaan x² + 1 = 0 tidak punya penyelesaian bilangan real. Untuk itu didefinisikan **satuan imajiner i** dengan i² = −1.', '**Bilangan kompleks** ditulis z = a + bi, dengan a **bagian real** (Re z) dan b **bagian imajiner** (Im z); a dan b bilangan real.'], [['satuan imajiner', 'i² = −1'], ['bentuk kompleks', 'z = a + bi']]),
    S('Bidang kompleks dan pangkat i', ['Bilangan z = a + bi digambar sebagai titik (a, b) pada **bidang kompleks**: sumbu mendatar real, sumbu tegak imajiner.', 'Pangkat i berulang tiap empat: i¹ = i, i² = −1, i³ = −i, i⁴ = 1. Jadi iⁿ cukup dilihat dari sisa pembagian n oleh 4.'], [['siklus', 'i⁴ = 1']], '√(−9) = 3i karena (3i)² = 9i² = −9.'),
  ], [
    Q('Bagian real dan bagian imajiner dari z = 4 − 7i berturut-turut adalah …', ['4 dan −7', '4 dan 7', '−7 dan 4', '4 dan −7i'], 0, 'Bentuk a + bi dengan a = 4 dan b = −7; bagian imajiner adalah bilangan real b, bukan bi.', 1),
    Q('Nilai i²⁰²⁶ adalah …', ['−1', '1', 'i', '−i'], 0, '2026 = 4 · 506 + 2, sehingga i²⁰²⁶ = i² = −1.'),
    Q('Titik pada bidang kompleks yang mewakili z = −2 + 3i adalah …', ['(−2, 3)', '(3, −2)', '(2, 3)', '(−2, −3)'], 0, 'Bagian real −2 menjadi koordinat mendatar dan bagian imajiner 3 menjadi koordinat tegak.', 1),
  ]),
  'MAT.C26.FPLUS.KOMPLEKS:C2': K([
    S('Jumlah, selisih, dan kali', ['Jumlahkan atau kurangkan bagian real dengan real, imajiner dengan imajiner: (a + bi) + (c + di) = (a + c) + (b + d)i.', 'Perkalian memakai sifat distributif lalu ganti i² dengan −1: (a + bi)(c + di) = (ac − bd) + (ad + bc)i.'], [['penjumlahan', '(a + c) + (b + d)i'], ['perkalian', '(ac − bd) + (ad + bc)i']]),
    S('Pembagian', ['Untuk membagi, kalikan pembilang dan penyebut dengan **sekawan** penyebut agar penyebut menjadi bilangan real.', 'Contoh: (1 + i)/(1 − i) = (1 + i)²/((1 − i)(1 + i)) = 2i/2 = i.'], [['pembagian', '(a + bi)/(c + di) × (c − di)/(c − di)']], 'Dua bilangan kompleks sama jika bagian real dan imajinernya masing-masing sama.'),
  ], [
    Q('(3 + 2i) + (1 − 5i) = …', ['4 − 3i', '4 + 7i', '2 + 7i', '4 − 7i'], 0, 'Real: 3 + 1 = 4; imajiner: 2 + (−5) = −3.', 1),
    Q('(2 + 3i)(1 − i) = …', ['5 + i', '−1 + i', '5 − i', '2 − 3i'], 0, '2 − 2i + 3i − 3i² = 2 + i + 3 = 5 + i, karena −3i² = 3.'),
    Q('Hasil 5/(2 + i) adalah …', ['2 − i', '2 + i', '5/2 − 5i', '10 − 5i'], 0, 'Kalikan dengan sekawan 2 − i: 5(2 − i)/(4 + 1) = 2 − i.'),
  ]),
  'MAT.C26.FPLUS.KOMPLEKS:KONJUGAT': K([
    S('Sekawan dan modulus', ['**Sekawan** (konjugat) dari z = a + bi adalah z̄ = a − bi: cerminan z terhadap sumbu real.', '**Modulus** |z| = √(a² + b²) adalah jarak titik z ke titik asal. Selalu berlaku z · z̄ = |z|².'], [['sekawan', 'z̄ = a − bi'], ['modulus', '|z| = √(a² + b²)']]),
    S('Argumen', ['**Argumen** arg z adalah sudut θ dari sumbu real positif ke garis yang menghubungkan titik asal dan z, dengan tan θ = b/a.', 'Tentukan kuadrannya dari tanda a dan b. Misalnya z = −1 + i di kuadran II, jadi arg z = 135°, bukan −45°.'], [['argumen', 'tan θ = b/a']], 'Periksa kuadran dulu sebelum mengambil nilai arctan.'),
  ], [
    Q('Modulus dari z = 6 − 8i adalah …', ['10', '14', '2', '√28'], 0, '√(6² + (−8)²) = √100 = 10.', 1),
    Q('Jika z = 3 + 4i, nilai z · z̄ adalah …', ['25', '7', '9 − 16i', '5'], 0, 'z · z̄ = |z|² = 3² + 4² = 25; hasilnya selalu bilangan real.'),
    Q('Argumen dari z = −√3 + i adalah …', ['150°', '30°', '−30°', '120°'], 0, 'Titik (−√3, 1) di kuadran II dengan sudut acuan 30°, jadi arg z = 180° − 30° = 150°.', 3),
  ]),
  'MAT.C26.FPLUS.KOMPLEKS:POLAR': K([
    S('Dari kartesius ke polar', ['Dengan r = |z| dan θ = arg z, bilangan kompleks dapat ditulis **z = r(cos θ + i sin θ)**, sering disingkat r cis θ.', 'Contoh: z = 1 + i memiliki r = √2 dan θ = 45°, jadi z = √2 cis 45°.'], [['bentuk polar', 'z = r(cos θ + i sin θ)']]),
    S('Kali dan pangkat dalam bentuk polar', ['Saat mengalikan, modulus **dikalikan** dan argumen **dijumlahkan**: r₁ cis θ₁ · r₂ cis θ₂ = r₁r₂ cis(θ₁ + θ₂).', 'Akibatnya, menurut Teorema De Moivre: (r cis θ)ⁿ = rⁿ cis(nθ).'], [['De Moivre', '(r cis θ)ⁿ = rⁿ cis nθ']], 'Perkalian dengan i sama dengan memutar titik 90° berlawanan arah jarum jam.'),
  ], [
    Q('Bentuk polar dari z = 2i adalah …', ['2 cis 90°', '2 cis 0°', '2 cis 180°', '4 cis 90°'], 0, 'Titik (0, 2) berjarak 2 dari titik asal dan terletak di sumbu imajiner positif, jadi θ = 90°.', 1),
    Q('Hasil 3 cis 40° × 2 cis 50° adalah …', ['6i', '6', '5 cis 90°', '6 cis 2000°'], 0, 'Modulus 3 × 2 = 6 dan argumen 40° + 50° = 90°, sehingga hasilnya 6 cis 90° = 6i.'),
    Q('Nilai (1 + i)⁴ adalah …', ['−4', '4', '4i', '−4i'], 0, '1 + i = √2 cis 45°, sehingga pangkat empatnya (√2)⁴ cis 180° = 4 · (−1) = −4.', 3),
  ]),
  // ---------- Polinomial (kelas 11) ----------
  'MAT.C26.FPLUS.POLINOMIAL:C1': K([
    S('Apa itu polinomial', ['**Polinomial** berderajat n: P(x) = aₙxⁿ + aₙ₋₁xⁿ⁻¹ + … + a₁x + a₀, dengan aₙ ≠ 0 dan pangkat x bilangan cacah.', '**Derajat** adalah pangkat tertinggi; aₙ disebut koefisien utama dan a₀ suku tetap. Bentuk 3/x atau √x bukan suku polinomial.'], [['derajat n', 'aₙxⁿ + … + a₀']]),
    S('Nilai dan operasi', ['**Nilai** polinomial dicari dengan substitusi, misalnya P(x) = x³ − 2x + 5 memberi P(2) = 8 − 4 + 5 = 9.', 'Jumlah dan selisih: gabungkan suku sejenis. Hasil kali dua polinomial berderajat m dan n berderajat m + n.'], [['derajat hasil kali', 'm + n']], 'Jumlah semua koefisien P(x) sama dengan P(1).'),
  ], [
    Q('Derajat polinomial P(x) = 4x² − x⁵ + 7 adalah …', ['5', '2', '4', '7'], 0, 'Pangkat tertinggi x adalah 5 (dari suku −x⁵); urutan penulisan suku tidak berpengaruh.', 1),
    Q('Jika P(x) = 2x³ − x² + 3x − 4, nilai P(−1) adalah …', ['−10', '−2', '2', '−8'], 0, '2(−1)³ − (−1)² + 3(−1) − 4 = −2 − 1 − 3 − 4 = −10.'),
    Q('Derajat hasil kali (x³ + 2)(x² − x + 1) adalah …', ['5', '6', '3', '2'], 0, 'Derajat hasil kali adalah jumlah derajat kedua faktor: 3 + 2 = 5.', 1),
  ]),
  'MAT.C26.FPLUS.POLINOMIAL:C2': K([
    S('Hasil bagi dan sisa', ['Membagi P(x) dengan pembagi Q(x) menghasilkan **hasil bagi** H(x) dan **sisa** S(x): P(x) = Q(x) · H(x) + S(x).', 'Derajat sisa selalu lebih kecil daripada derajat pembagi. Jika pembaginya linear (x − k), sisanya berupa konstanta.'], [['pembagian', 'P(x) = Q(x) · H(x) + S(x)']]),
    S('Cara Horner', ['Untuk pembagi x − k, tulis koefisien P(x) berurutan (isi 0 untuk suku yang hilang), lalu turunkan koefisien pertama.', 'Kalikan dengan k, jumlahkan ke koefisien berikutnya, ulangi. Bilangan terakhir adalah sisa; bilangan sebelumnya adalah koefisien hasil bagi.'], [['skema Horner', 'kalikan k, jumlahkan']], 'Lupa menulis 0 untuk suku yang hilang adalah kesalahan paling sering.'),
  ], [
    Q('Sisa pembagian x³ − 4x + 2 oleh x − 2 adalah …', ['2', '0', '−2', '10'], 0, 'Horner dengan k = 2 pada koefisien 1, 0, −4, 2 menghasilkan baris 1, 2, 0, 2; bilangan terakhir 2 adalah sisa.'),
    Q('Hasil bagi x³ − 4x + 2 oleh x − 2 adalah …', ['x² + 2x', 'x² − 2x', 'x² + 2x − 4', 'x² + 2'], 0, 'Baris Horner 1, 2, 0 adalah koefisien hasil bagi berderajat dua: x² + 2x + 0.'),
    Q('Polinomial berderajat 4 dibagi x² − 1. Derajat tertinggi yang mungkin untuk sisanya adalah …', ['1', '2', '3', '0'], 0, 'Sisa harus berderajat lebih kecil dari pembagi yang berderajat 2, jadi paling tinggi berderajat 1.'),
  ]),
  'MAT.C26.FPLUS.POLINOMIAL:SISA': K([
    S('Teorema sisa', ['Jika P(x) dibagi (x − k), sisanya **P(k)**. Jika dibagi (ax − b), sisanya P(b/a).', 'Contoh: sisa x⁴ + 3x − 1 dibagi x + 1 adalah P(−1) = 1 − 3 − 1 = −3, tanpa melakukan pembagian.'], [['teorema sisa', 'S = P(k)']]),
    S('Teorema faktor', ['(x − k) adalah **faktor** P(x) jika dan hanya jika P(k) = 0. Nilai k seperti itu disebut akar.', 'Untuk mencari faktor, uji nilai k dari faktor-faktor suku tetap a₀ (dibagi faktor koefisien utama).'], [['teorema faktor', 'P(k) = 0 ⇔ (x − k) faktor']], 'Setelah satu faktor ditemukan, bagi dengan Horner untuk mendapat polinomial yang derajatnya lebih rendah.'),
  ], [
    Q('Sisa pembagian P(x) = x³ + 2x² − 5 oleh (x + 2) adalah …', ['−5', '3', '−21', '5'], 0, 'Menurut teorema sisa, sisanya P(−2) = −8 + 8 − 5 = −5.'),
    Q('Jika (x − 1) adalah faktor dari x³ + ax − 4, nilai a adalah …', ['3', '−3', '4', '5'], 0, 'Faktor (x − 1) berarti P(1) = 0: 1 + a − 4 = 0, sehingga a = 3.'),
    Q('Faktor-faktor dari x³ − 6x² + 11x − 6 adalah …', ['(x − 1)(x − 2)(x − 3)', '(x + 1)(x + 2)(x + 3)', '(x − 1)(x + 2)(x − 3)', '(x − 1)²(x − 6)'], 0, 'P(1) = 1 − 6 + 11 − 6 = 0; pembagian dengan (x − 1) memberi x² − 5x + 6 = (x − 2)(x − 3).', 3),
  ]),
  'MAT.C26.FPLUS.POLINOMIAL:AKAR': K([
    S('Akar polinomial', ['Polinomial berderajat n memiliki paling banyak n akar real. Akar-akar dapat dicari lewat teorema faktor lalu Horner berulang.', 'Grafik y = P(x) memotong sumbu x tepat di akar-akar realnya.'], [['jumlah akar maksimum', 'n akar']]),
    S('Rumus Vieta derajat tiga', ['Untuk ax³ + bx² + cx + d = 0 dengan akar x₁, x₂, x₃ berlaku x₁ + x₂ + x₃ = −b/a.', 'Juga x₁x₂ + x₁x₃ + x₂x₃ = c/a dan x₁x₂x₃ = −d/a. Rumus ini dipakai tanpa harus menghitung akarnya satu per satu.'], [['jumlah akar', '−b/a'], ['hasil kali akar', '−d/a']], 'Tandanya berganti: −b/a, +c/a, −d/a.'),
  ], [
    Q('Jumlah akar-akar persamaan 2x³ − 6x² + x + 8 = 0 adalah …', ['3', '−3', '4', '−4'], 0, 'x₁ + x₂ + x₃ = −b/a = −(−6)/2 = 3.'),
    Q('Hasil kali akar-akar x³ − 4x² + x + 6 = 0 adalah …', ['−6', '6', '1', '4'], 0, 'x₁x₂x₃ = −d/a = −6/1 = −6. Akarnya memang −1, 2, dan 3.'),
    Q('Salah satu akar x³ − 7x + 6 = 0 adalah 1. Dua akar lainnya adalah …', ['2 dan −3', '−2 dan 3', '3 dan −1', '6 dan 1'], 0, 'Bagi dengan (x − 1): hasil baginya x² + x − 6 = (x + 3)(x − 2), jadi akar lainnya 2 dan −3.', 3),
  ]),
  // ---------- Transformasi geometri (kelas 11) ----------
  'MAT.C26.FPLUS.TRANSFORMASI:C1': K([
    S('Translasi', ['**Translasi** (pergeseran) oleh T = (a, b) memindahkan setiap titik (x, y) ke (x + a, y + b). Bentuk dan ukuran bangun tidak berubah.', 'Dalam bentuk vektor kolom: bayangan = titik + vektor translasi.'], [['translasi', '(x, y) → (x + a, y + b)']]),
    S('Refleksi', ['**Refleksi** (pencerminan) membalik bangun terhadap garis cermin. Terhadap sumbu x: (x, y) → (x, −y); terhadap sumbu y: (x, y) → (−x, y).', 'Terhadap garis y = x: (x, y) → (y, x); terhadap garis y = −x: (x, y) → (−y, −x).'], [['cermin y = x', '(x, y) → (y, x)'], ['matriks cermin sumbu x', '[[1, 0], [0, −1]]']], 'Jarak titik ke cermin sama dengan jarak bayangannya ke cermin.'),
  ], [
    Q('Bayangan titik (3, −1) oleh translasi (−5, 4) adalah …', ['(−2, 3)', '(8, −5)', '(−2, −5)', '(8, 3)'], 0, 'Tambahkan komponennya: 3 + (−5) = −2 dan −1 + 4 = 3.', 1),
    Q('Bayangan titik (2, 5) jika dicerminkan terhadap garis y = x adalah …', ['(5, 2)', '(−2, 5)', '(2, −5)', '(−5, −2)'], 0, 'Pencerminan terhadap y = x menukar absis dan ordinat.', 1),
    Q('Titik A(4, −3) dicerminkan terhadap sumbu y, lalu digeser oleh (1, 2). Bayangan akhirnya adalah …', ['(−3, −1)', '(5, −1)', '(−3, −5)', '(−5, −1)'], 0, 'Cermin sumbu y memberi (−4, −3); translasi (1, 2) memberi (−3, −1).'),
  ]),
  'MAT.C26.FPLUS.TRANSFORMASI:C2': K([
    S('Rotasi terhadap titik asal', ['**Rotasi** sebesar θ berlawanan arah jarum jam terhadap O(0, 0) memetakan (x, y) ke (x cos θ − y sin θ, x sin θ + y cos θ).', 'Kasus khusus: rotasi 90° memetakan (x, y) → (−y, x); rotasi 180° memetakan (x, y) → (−x, −y).'], [['matriks rotasi', '[[cos θ, −sin θ], [sin θ, cos θ]]'], ['rotasi 90°', '(x, y) → (−y, x)']]),
    S('Arah dan pusat lain', ['Sudut positif berarti berlawanan arah jarum jam; rotasi searah jarum jam memakai sudut negatif, misalnya −90°: (x, y) → (y, −x).', 'Untuk pusat P(a, b): geser dulu sehingga P ke titik asal, putar, lalu geser kembali.'], [['rotasi −90°', '(x, y) → (y, −x)']], 'Rotasi tidak mengubah jarak titik ke pusat rotasi.'),
  ], [
    Q('Bayangan titik (3, 1) oleh rotasi 90° berlawanan arah jarum jam terhadap O adalah …', ['(−1, 3)', '(1, −3)', '(−3, −1)', '(3, −1)'], 0, 'Rotasi 90° memetakan (x, y) ke (−y, x), jadi (3, 1) menjadi (−1, 3).'),
    Q('Bayangan titik (−2, 5) oleh rotasi 180° terhadap O adalah …', ['(2, −5)', '(−5, −2)', '(5, −2)', '(−2, −5)'], 0, 'Rotasi 180° membalik tanda kedua koordinat, sehingga diperoleh (2, −5).', 1),
    Q('Titik (4, 0) diputar 60° berlawanan arah jarum jam terhadap O. Bayangannya adalah …', ['(2, 2√3)', '(2√3, 2)', '(−2, 2√3)', '(4, 2√3)'], 0, 'x′ = 4 cos 60° = 2 dan y′ = 4 sin 60° = 2√3.', 3),
  ]),
  'MAT.C26.FPLUS.TRANSFORMASI:DILATASI': K([
    S('Dilatasi berpusat O', ['**Dilatasi** dengan pusat O dan faktor skala k memetakan (x, y) ke (kx, ky). Bentuk bayangan sebangun dengan aslinya, ukurannya berubah.', '|k| > 1 memperbesar, |k| < 1 memperkecil, dan k negatif membuat bayangan berada di sisi berlawanan dari pusat.'], [['dilatasi [O, k]', '(x, y) → (kx, ky)']]),
    S('Luas dan pusat lain', ['Panjang sisi dikali |k|, sedangkan **luas dikali k²**. Segitiga seluas 6 satuan yang didilatasi dengan k = 3 menjadi seluas 54 satuan.', 'Untuk pusat P(a, b): (x, y) → (a + k(x − a), b + k(y − b)).'], [['luas bayangan', 'k² × luas awal'], ['pusat P(a, b)', '(a + k(x − a), b + k(y − b))']], 'Dilatasi dengan k = −1 sama dengan rotasi 180° terhadap pusatnya.'),
  ], [
    Q('Bayangan titik (−3, 2) oleh dilatasi [O, 4] adalah …', ['(−12, 8)', '(1, 6)', '(−12, 2)', '(12, −8)'], 0, 'Kalikan kedua koordinat dengan faktor skala 4.', 1),
    Q('Persegi seluas 5 cm² didilatasi dengan faktor skala −2. Luas bayangannya adalah …', ['20 cm²', '10 cm²', '−20 cm²', '25 cm²'], 0, 'Luas dikali k² = (−2)² = 4, sehingga 5 × 4 = 20 cm².'),
    Q('Bayangan titik (5, 3) oleh dilatasi berpusat (1, 1) dengan faktor skala 2 adalah …', ['(9, 5)', '(10, 6)', '(11, 7)', '(6, 4)'], 0, 'Jarak dari pusat (4, 2) dikalikan 2 menjadi (8, 4), lalu ditambah pusat (1, 1): (9, 5).', 3),
  ]),
  'MAT.C26.FPLUS.TRANSFORMASI:KOMPOSISI': K([
    S('Matriks transformasi', ['Transformasi linear di bidang dapat ditulis sebagai perkalian matriks: (x′, y′) = M · (x, y).', 'Contoh: refleksi sumbu x M = [[1, 0], [0, −1]], rotasi 90° M = [[0, −1], [1, 0]], dilatasi [O, k] M = [[k, 0], [0, k]].'], [['bayangan', '(x′, y′) = M · (x, y)']]),
    S('Urutan komposisi', ['Transformasi M₁ dilanjutkan M₂ setara dengan satu matriks **M₂ · M₁**: matriks yang dikerjakan pertama ditulis paling kanan.', 'Determinan matriks komposisi memberi faktor perubahan luas: luas bayangan = |det M| × luas awal.'], [['komposisi', 'M = M₂ · M₁'], ['luas', '|det M| × luas awal']], 'Perkalian matriks tidak komutatif, jadi urutan transformasi penting.'),
  ], [
    Q('Matriks yang mewakili refleksi terhadap sumbu x dilanjutkan rotasi 90° terhadap O adalah …', ['[[0, 1], [1, 0]]', '[[0, −1], [−1, 0]]', '[[1, 0], [0, −1]]', '[[0, −1], [1, 0]]'], 0, 'Matriks rotasi dikalikan dari kiri: [[0, −1], [1, 0]] · [[1, 0], [0, −1]] = [[0, 1], [1, 0]], yaitu pencerminan terhadap y = x.', 3),
    Q('Titik (2, 1) ditransformasi oleh matriks [[2, 1], [0, 3]]. Bayangannya adalah …', ['(5, 3)', '(4, 3)', '(5, 6)', '(2, 3)'], 0, 'x′ = 2 · 2 + 1 · 1 = 5 dan y′ = 0 · 2 + 3 · 1 = 3.'),
    Q('Segitiga seluas 4 satuan luas ditransformasi oleh matriks [[3, 1], [2, 2]]. Luas bayangannya adalah …', ['16 satuan luas', '32 satuan luas', '12 satuan luas', '8 satuan luas'], 0, 'det M = 3 · 2 − 1 · 2 = 4, sehingga luas bayangan 4 × 4 = 16 satuan luas.'),
  ]),
  // ---------- Fungsi dan pemodelan (kelas 11) ----------
  'MAT.C26.FPLUS.FUNGSI:C1': K([
    S('Fungsi rasional', ['**Fungsi rasional** adalah hasil bagi dua polinomial, f(x) = P(x)/Q(x), dengan Q(x) ≠ 0. Contoh: f(x) = (2x + 1)/(x − 3).', 'Daerah asal tidak memuat nilai x yang membuat penyebut nol.'], [['fungsi rasional', 'f(x) = P(x)/Q(x)']]),
    S('Asimtot', ['**Asimtot tegak** x = a muncul jika penyebut nol di a tetapi pembilang tidak. **Asimtot datar**: jika derajat pembilang sama dengan derajat penyebut, y = perbandingan koefisien utama.', 'Jika derajat pembilang lebih kecil, asimtot datarnya y = 0. Contoh f(x) = (2x + 1)/(x − 3): asimtot x = 3 dan y = 2.'], [['asimtot datar (derajat sama)', 'y = aₙ/bₙ']], 'Grafik tidak pernah menyentuh asimtot tegak, tetapi boleh memotong asimtot datar.'),
  ], [
    Q('Asimtot tegak grafik f(x) = (x + 4)/(x + 2) adalah …', ['x = −2', 'x = 2', 'x = −4', 'y = 1'], 0, 'Penyebut nol saat x = −2, sedangkan pembilangnya bernilai 2 (tidak nol).', 1),
    Q('Asimtot datar grafik f(x) = (6x − 1)/(2x + 5) adalah …', ['y = 3', 'y = 6', 'y = −1/5', 'x = −5/2'], 0, 'Derajat pembilang dan penyebut sama-sama 1, jadi y = 6/2 = 3.'),
    Q('Daerah asal f(x) = 3/(x² − 9) adalah …', ['semua bilangan real kecuali 3 dan −3', 'semua bilangan real kecuali 9', 'semua bilangan real kecuali 3', 'x > 3'], 0, 'x² − 9 = 0 saat x = 3 atau x = −3, sehingga kedua nilai itu dikeluarkan.'),
  ]),
  'MAT.C26.FPLUS.FUNGSI:C2': K([
    S('Bentuk umum model periodik', ['Fenomena berulang seperti pasang surut, suhu harian, dan putaran roda dimodelkan dengan y = A sin(B(x − C)) + D.', '**Amplitudo** |A| = setengah selisih nilai maksimum dan minimum; **garis tengah** y = D = rata-rata maksimum dan minimum; **periode** = 2π/B (atau 360°/B).'], [['model', 'y = A sin(B(x − C)) + D'], ['periode', '2π / B']]),
    S('Membaca data', ['Contoh: tinggi air laut berkisar 1 m sampai 5 m dan berulang tiap 12 jam. Maka A = 2, D = 3, dan B = 2π/12 = π/6.', 'C menggeser grafik mendatar sehingga puncak atau titik awalnya tepat pada waktu yang diketahui.'], [['amplitudo', '(maks − min)/2'], ['garis tengah', '(maks + min)/2']], 'Satuan periode mengikuti satuan x: jam, menit, atau hari.'),
  ], [
    Q('Suhu sebuah ruangan berubah periodik antara 18°C dan 30°C. Amplitudo modelnya adalah …', ['6°C', '12°C', '24°C', '30°C'], 0, 'Amplitudo = (30 − 18)/2 = 6°C.', 1),
    Q('Periode fungsi y = 4 sin(3x) + 1 (x dalam radian) adalah …', ['2π/3', '3', '6π', 'π/3'], 0, 'Periode = 2π/B dengan B = 3, jadi 2π/3.'),
    Q('Bianglala berdiameter 40 m dengan titik terendah 2 m di atas tanah berputar sekali tiap 10 menit. Garis tengah (D) model tinggi penumpang adalah …', ['22 m', '20 m', '40 m', '42 m'], 0, 'Tinggi berkisar 2 m sampai 42 m, sehingga D = (2 + 42)/2 = 22 m.', 3),
  ]),
  'MAT.C26.FPLUS.FUNGSI:MODEL': K([
    S('Ciri tiap model', ['**Linear**: selisih nilai y tetap untuk langkah x yang sama. **Kuadrat**: selisih keduanya tetap. **Eksponensial**: rasio nilai y berurutan tetap.', '**Trigonometri**: nilai naik-turun berulang dengan periode tertentu. **Rasional**: mendekati suatu nilai tetapi tidak pernah mencapainya.'], [['linear', 'selisih tetap'], ['eksponensial', 'rasio tetap']]),
    S('Menguji model', ['Hitung selisih atau rasio dari tabel, pilih model, lalu tentukan parameternya dari dua atau tiga titik.', 'Periksa model dengan titik lain dan pertimbangkan batas wajarnya. Jumlah bakteri, misalnya, tidak bisa tumbuh eksponensial selamanya.'], undefined, 'Model yang cocok dengan data belum tentu cocok untuk meramal jauh di luar rentang data.'),
  ], [
    Q('Data y untuk x = 0, 1, 2, 3 adalah 5, 10, 20, 40. Model yang paling sesuai adalah …', ['eksponensial', 'linear', 'kuadrat', 'trigonometri'], 0, 'Rasio berurutannya tetap 2 (10/5 = 20/10 = 40/20), ciri pertumbuhan eksponensial.', 1),
    Q('Data y untuk x = 0, 1, 2, 3, 4 adalah 1, 4, 9, 16, 25. Selisih kedua data ini …', ['tetap 2, sehingga modelnya kuadrat', 'tetap 3, sehingga modelnya linear', 'tidak tetap, sehingga modelnya eksponensial', 'tetap 1, sehingga modelnya trigonometri'], 0, 'Selisih pertama 3, 5, 7, 9 dan selisih keduanya selalu 2, jadi datanya mengikuti fungsi kuadrat y = (x + 1)².'),
    Q('Jumlah pengunjung taman selalu tinggi di akhir pekan dan rendah di tengah pekan, berulang tiap minggu. Model yang tepat adalah fungsi …', ['trigonometri dengan periode 7 hari', 'linear naik', 'eksponensial dengan rasio 7', 'rasional dengan asimtot x = 7'], 0, 'Pola naik-turun yang berulang setiap minggu adalah ciri model periodik dengan periode 7 hari.'),
  ]),
  // ---------- Persamaan lingkaran (kelas 12, geometri analitik) ----------
  'MAT.C26.FPLUS.LINGKARAN:C1': K([
    S('Pusat dan jari-jari', ['Lingkaran adalah himpunan titik yang berjarak sama (jari-jari r) dari pusat. Dengan rumus jarak, lingkaran berpusat (a, b) memenuhi **(x − a)² + (y − b)² = r²**.', 'Jika pusatnya di titik asal, persamaannya menjadi x² + y² = r².'], [['pusat (a, b)', '(x − a)² + (y − b)² = r²'], ['pusat O', 'x² + y² = r²']]),
    S('Menyusun persamaan', ['Jika diketahui pusat dan satu titik pada lingkaran, jari-jarinya adalah jarak pusat ke titik itu.', 'Contoh: pusat (2, −1) melalui (5, 3) memberi r = √(3² + 4²) = 5, jadi (x − 2)² + (y + 1)² = 25.'], [['jari-jari', 'r = jarak pusat ke titik']], 'Tanda di dalam kurung berlawanan dengan koordinat pusat.'),
  ], [
    Q('Persamaan lingkaran berpusat (−3, 4) dan berjari-jari 6 adalah …', ['(x + 3)² + (y − 4)² = 36', '(x − 3)² + (y + 4)² = 36', '(x + 3)² + (y − 4)² = 6', '(x − 3)² + (y − 4)² = 36'], 0, 'Substitusi a = −3, b = 4, dan r² = 36 ke (x − a)² + (y − b)² = r².', 1),
    Q('Lingkaran berpusat di O melalui titik (6, −8). Persamaannya adalah …', ['x² + y² = 100', 'x² + y² = 10', 'x² + y² = 14', 'x² + y² = 28'], 0, 'r² = 6² + (−8)² = 100.', 1),
    Q('Lingkaran memiliki diameter AB dengan A(1, 2) dan B(7, 10). Persamaannya adalah …', ['(x − 4)² + (y − 6)² = 25', '(x − 4)² + (y − 6)² = 100', '(x − 3)² + (y − 4)² = 25', '(x − 8)² + (y − 12)² = 25'], 0, 'Pusat adalah titik tengah AB, yaitu (4, 6), dan jari-jarinya setengah panjang AB = 10/2 = 5.', 3),
  ]),
  'MAT.C26.FPLUS.LINGKARAN:C2': K([
    S('Bentuk umum', ['Jika dijabarkan, persamaan lingkaran menjadi **x² + y² + Ax + By + C = 0**.', 'Pusatnya (−A/2, −B/2) dan jari-jarinya r = √(A²/4 + B²/4 − C). Lingkaran nyata hanya ada bila nilai di bawah akar positif.'], [['pusat', '(−A/2, −B/2)'], ['jari-jari', '√(A²/4 + B²/4 − C)']]),
    S('Melengkapkan kuadrat', ['Cara lain: kelompokkan x dan y, lalu lengkapkan kuadrat. x² + y² − 6x + 4y − 3 = 0 menjadi (x − 3)² + (y + 2)² = 16.', 'Dari bentuk itu langsung terbaca pusat (3, −2) dan r = 4.'], [['contoh', '(x − 3)² + (y + 2)² = 16']], 'Koefisien x² dan y² harus 1; jika belum, bagi dulu seluruh persamaan.'),
  ], [
    Q('Pusat lingkaran x² + y² + 8x − 2y − 8 = 0 adalah …', ['(−4, 1)', '(4, −1)', '(8, −2)', '(−8, 2)'], 0, 'Pusat (−A/2, −B/2) = (−8/2, 2/2) = (−4, 1).'),
    Q('Jari-jari lingkaran x² + y² − 4x + 6y − 12 = 0 adalah …', ['5', '√12', '25', '1'], 0, 'r = √(16/4 + 36/4 + 12) = √(4 + 9 + 12) = 5.'),
    Q('Persamaan 2x² + 2y² − 8x + 12y + 8 = 0 menyatakan lingkaran dengan jari-jari …', ['3', '√26', '9', '√13'], 0, 'Bagi dengan 2 dulu: x² + y² − 4x + 6y + 4 = 0, sehingga r = √(4 + 9 − 4) = 3.', 3),
  ]),
  'MAT.C26.FPLUS.LINGKARAN:KEDUDUKAN': K([
    S('Kedudukan titik', ['Substitusi titik (p, q) ke ruas kiri (x − a)² + (y − b)², lalu bandingkan hasilnya dengan r².', 'Lebih kecil dari r²: titik **di dalam**; sama dengan r²: **pada** lingkaran; lebih besar: **di luar**.'], [['di dalam', '(p − a)² + (q − b)² < r²']]),
    S('Kedudukan garis', ['Substitusi persamaan garis ke persamaan lingkaran sehingga terbentuk persamaan kuadrat satu variabel, lalu hitung diskriminannya D.', 'D > 0: garis **memotong** di dua titik; D = 0: garis **menyinggung**; D < 0: garis **tidak memotong**.'], [['menyinggung', 'D = 0']], 'Cara lain: bandingkan jarak pusat ke garis dengan jari-jari.'),
  ], [
    Q('Kedudukan titik (5, 1) terhadap lingkaran x² + y² = 25 adalah …', ['di luar lingkaran', 'pada lingkaran', 'di dalam lingkaran', 'di pusat lingkaran'], 0, '5² + 1² = 26, lebih besar dari r² = 25.', 1),
    Q('Kedudukan garis y = x + 1 terhadap lingkaran x² + y² = 1 adalah …', ['memotong di dua titik', 'menyinggung', 'tidak memotong', 'melalui pusat'], 0, 'Substitusi memberi 2x² + 2x = 0 dengan D = 4 > 0, jadi ada dua titik potong, yaitu (0, 1) dan (−1, 0).'),
    Q('Jarak pusat lingkaran (x − 2)² + (y − 3)² = 9 ke garis 3x + 4y + 2 = 0 adalah 4. Kedudukan garis itu adalah …', ['tidak memotong lingkaran', 'menyinggung lingkaran', 'memotong di dua titik', 'melalui pusat lingkaran'], 0, 'Jarak pusat ke garis (4) lebih besar dari jari-jari (3), sehingga garis berada di luar lingkaran.'),
  ]),
  'MAT.C26.FPLUS.LINGKARAN:SINGGUNG': K([
    S('Singgung di titik pada lingkaran', ['Garis singgung di titik (x₁, y₁) pada x² + y² = r² adalah **x₁x + y₁y = r²**.', 'Untuk (x − a)² + (y − b)² = r²: (x₁ − a)(x − a) + (y₁ − b)(y − b) = r². Garis singgung selalu tegak lurus jari-jari di titik singgungnya.'], [['pusat O', 'x₁x + y₁y = r²']]),
    S('Singgung dengan gradien m', ['Garis singgung bergradien m pada x² + y² = r² adalah **y = mx ± r√(1 + m²)**.', 'Untuk pusat (a, b): y − b = m(x − a) ± r√(1 + m²). Selalu ada dua garis singgung yang sejajar.'], [['gradien m, pusat O', 'y = mx ± r√(1 + m²)']], 'Periksa dulu bahwa titik yang diketahui memang terletak pada lingkaran.'),
  ], [
    Q('Persamaan garis singgung lingkaran x² + y² = 25 di titik (3, 4) adalah …', ['3x + 4y = 25', '4x + 3y = 25', '3x − 4y = 25', '3x + 4y = 5'], 0, 'Gunakan x₁x + y₁y = r² dengan (x₁, y₁) = (3, 4) dan r² = 25.', 1),
    Q('Garis singgung lingkaran x² + y² = 9 yang bergradien 0 adalah …', ['y = 3 dan y = −3', 'x = 3 dan x = −3', 'y = 9 dan y = −9', 'y = x ± 3'], 0, 'Dengan m = 0, y = 0 · x ± 3√1, sehingga y = 3 atau y = −3.'),
    Q('Persamaan garis singgung lingkaran (x − 1)² + (y + 2)² = 10 di titik (2, 1) adalah …', ['x + 3y = 5', 'x + 3y = 10', '3x + y = 7', 'x − 3y = −1'], 0, '(2 − 1)(x − 1) + (1 + 2)(y + 2) = 10 menjadi x − 1 + 3y + 6 = 10, yaitu x + 3y = 5.', 3),
  ]),
  // ---------- Limit fungsi (kelas 12) ----------
  'MAT.C26.FPLUS.LIMIT:C1': K([
    S('Mendekati, bukan sama dengan', ['lim x→a f(x) = L berarti nilai f(x) makin dekat ke L ketika x makin dekat ke a, dari kiri maupun dari kanan.', 'Nilai f(a) sendiri tidak harus ada. Yang dilihat adalah perilaku fungsi di sekitar a.'], [['notasi', 'lim x→a f(x) = L']]),
    S('Limit kiri dan kanan', ['Limit ada jika **limit kiri** (x → a⁻) sama dengan **limit kanan** (x → a⁺).', 'Contoh fungsi tangga: mendekati x = 2 dari kiri bernilai 1 dan dari kanan bernilai 3, sehingga limitnya di x = 2 tidak ada.'], [['syarat ada', 'lim x→a⁻ = lim x→a⁺']], 'Tabel nilai x seperti 1,9; 1,99; 1,999 membantu menebak limit.'),
  ], [
    Q('Tabel f(x) untuk x = 2,9; 2,99; 2,999 adalah 5,8; 5,98; 5,998 dan untuk x = 3,1; 3,01; 3,001 adalah 6,2; 6,02; 6,002. Nilai lim x→3 f(x) adalah …', ['6', '5,998', '3', 'tidak ada'], 0, 'Dari kiri dan dari kanan, nilai f(x) sama-sama mendekati 6.', 1),
    Q('Fungsi f(x) = x + 1 untuk x < 1 dan f(x) = 2x untuk x ≥ 1. Nilai lim x→1 f(x) adalah …', ['2', '1', '3', 'tidak ada'], 0, 'Limit kiri 1 + 1 = 2 dan limit kanan 2 · 1 = 2 sama, sehingga limitnya 2.'),
    Q('Fungsi g(x) = 3 untuk x < 0 dan g(x) = −3 untuk x ≥ 0. Pernyataan yang benar adalah …', ['lim x→0 g(x) tidak ada', 'lim x→0 g(x) = 0', 'lim x→0 g(x) = 3', 'lim x→0 g(x) = −3'], 0, 'Limit kiri 3 berbeda dengan limit kanan −3, jadi limit di x = 0 tidak ada.'),
  ]),
  'MAT.C26.FPLUS.LIMIT:C2': K([
    S('Substitusi langsung', ['Untuk fungsi polinomial, limit di x = a cukup dihitung f(a). Contoh: lim x→2 (x² + 3x) = 4 + 6 = 10.', 'Jika substitusi menghasilkan bentuk tak tentu 0/0, ubah dulu bentuk fungsinya.'], [['polinomial', 'lim x→a f(x) = f(a)']]),
    S('Faktorisasi dan perkalian sekawan', ['**Faktorisasi**: (x² − 9)/(x − 3) = (x − 3)(x + 3)/(x − 3) = x + 3, sehingga limitnya di x = 3 adalah 6.', '**Sekawan**: untuk bentuk akar, kalikan dengan sekawannya. (√x − 2)/(x − 4) = 1/(√x + 2), sehingga limit di x = 4 adalah 1/4.'], [['contoh', 'lim x→3 (x² − 9)/(x − 3) = 6']], 'Bentuk 0/0 tidak berarti limitnya 0 atau tidak ada.'),
  ], [
    Q('Nilai lim x→−1 (2x³ − x + 4) adalah …', ['3', '5', '1', '−3'], 0, 'Substitusi langsung: 2(−1)³ − (−1) + 4 = −2 + 1 + 4 = 3.', 1),
    Q('Nilai lim x→2 (x² − 5x + 6)/(x − 2) adalah …', ['−1', '0', '1', 'tidak ada'], 0, 'Pembilang = (x − 2)(x − 3), sehingga bentuknya menjadi x − 3 dan limitnya 2 − 3 = −1.'),
    Q('Nilai lim x→9 (x − 9)/(√x − 3) adalah …', ['6', '0', '3', '1/6'], 0, 'x − 9 = (√x − 3)(√x + 3), sehingga limitnya √9 + 3 = 6.', 3),
  ]),
  'MAT.C26.FPLUS.LIMIT:TAKHINGGA': K([
    S('Fungsi rasional di tak hingga', ['Untuk x → ∞, bagi pembilang dan penyebut dengan pangkat tertinggi penyebut, karena 1/xⁿ → 0.', 'Hasilnya: derajat pembilang < penyebut → 0; derajat sama → perbandingan koefisien utama; derajat pembilang > penyebut → ∞ atau −∞.'], [['derajat sama', 'a/b (koefisien utama)']]),
    S('Selisih akar', ['Bentuk √(ax² + bx + c) − √(ax² + qx + r) untuk x → ∞ bernilai **(b − q)/(2√a)**.', 'Rumus ini berasal dari perkalian sekawan dan hanya berlaku jika koefisien x² di kedua akar sama.'], [['selisih akar', '(b − q) / (2√a)']], 'Limit di tak hingga menggambarkan asimtot datar grafik.'),
  ], [
    Q('Nilai lim x→∞ (4x² − x)/(2x² + 7) adalah …', ['2', '4', '0', 'tak hingga'], 0, 'Derajat pembilang dan penyebut sama, jadi limitnya 4/2 = 2.', 1),
    Q('Nilai lim x→∞ (3x + 1)/(x² − 5) adalah …', ['0', '3', 'tak hingga', '−1/5'], 0, 'Derajat pembilang (1) lebih kecil daripada derajat penyebut (2), sehingga limitnya 0.'),
    Q('Nilai lim x→∞ (√(x² + 6x) − √(x² − 2x)) adalah …', ['4', '2', '8', '0'], 0, 'Dengan rumus (b − q)/(2√a): (6 − (−2))/(2 · 1) = 4.', 3),
  ]),
  'MAT.C26.FPLUS.LIMIT:TRIGONOMETRI': K([
    S('Limit dasar', ['Untuk x dalam radian berlaku **lim x→0 sin x / x = 1** dan lim x→0 tan x / x = 1.', 'Akibatnya lim x→0 sin(ax)/(bx) = a/b dan lim x→0 tan(ax)/sin(bx) = a/b.'], [['limit dasar', 'lim x→0 sin x / x = 1'], ['bentuk umum', 'lim x→0 sin(ax)/(bx) = a/b']]),
    S('Mengubah bentuk', ['Ubah fungsi dengan identitas agar muncul bentuk dasar. Contoh: 1 − cos 2x = 2 sin² x.', 'Sehingga lim x→0 (1 − cos 2x)/x² = lim 2 sin² x / x² = 2.'], [['identitas', '1 − cos 2x = 2 sin² x']], 'Rumus limit trigonometri ini hanya berlaku jika x dalam radian.'),
  ], [
    Q('Nilai lim x→0 sin 5x / (2x) adalah …', ['5/2', '2/5', '5', '1'], 0, 'Bentuk sin(ax)/(bx) dengan a = 5 dan b = 2 menghasilkan 5/2.', 1),
    Q('Nilai lim x→0 tan 6x / sin 3x adalah …', ['2', '1/2', '18', '3'], 0, 'tan(ax)/sin(bx) → a/b = 6/3 = 2.'),
    Q('Nilai lim x→0 (1 − cos 4x)/x² adalah …', ['8', '4', '16', '2'], 0, '1 − cos 4x = 2 sin² 2x, sehingga limitnya 2 · 2² = 8.', 3),
  ]),
  // ---------- Turunan lanjut (kelas 12) ----------
  'MAT.C26.FPLUS.TURUNAN:C1': K([
    S('Fungsi di dalam fungsi', ['Untuk y = f(g(x)), turunannya **y′ = f′(g(x)) · g′(x)**: turunkan fungsi luar dengan bagian dalam tetap, lalu kalikan turunan bagian dalam.', 'Contoh: y = (3x + 1)⁴ memberi y′ = 4(3x + 1)³ · 3 = 12(3x + 1)³.'], [['aturan rantai', 'y′ = f′(g(x)) · g′(x)']]),
    S('Bentuk akar dan pangkat', ['Tulis akar sebagai pangkat pecahan. y = √(x² + 5) = (x² + 5)^(1/2), sehingga y′ = ½(x² + 5)^(−1/2) · 2x = x/√(x² + 5).', 'Untuk y = [u(x)]ⁿ berlaku y′ = n[u(x)]ⁿ⁻¹ · u′(x).'], [['pangkat fungsi', '(uⁿ)′ = n uⁿ⁻¹ u′']], 'Kesalahan yang sering terjadi adalah lupa mengalikan dengan turunan bagian dalam.'),
  ], [
    Q('Turunan y = (2x − 5)³ adalah …', ['6(2x − 5)²', '3(2x − 5)²', '6(2x − 5)³', '2(2x − 5)²'], 0, '3(2x − 5)² dikalikan turunan bagian dalam 2, menjadi 6(2x − 5)².'),
    Q('Turunan y = √(4x + 1) adalah …', ['2/√(4x + 1)', '1/(2√(4x + 1))', '4√(4x + 1)', '1/√(4x + 1)'], 0, '½(4x + 1)^(−1/2) · 4 = 2/√(4x + 1).'),
    Q('Jika f(x) = (x² + 1)⁵, nilai f′(1) adalah …', ['160', '80', '32', '10'], 0, 'f′(x) = 10x(x² + 1)⁴, sehingga f′(1) = 10 · 1 · 2⁴ = 160.', 3),
  ]),
  'MAT.C26.FPLUS.TURUNAN:C2': K([
    S('Turunan dasar', ['Dengan x dalam radian: (sin x)′ = cos x, (cos x)′ = −sin x, dan (tan x)′ = sec² x.', 'Dengan aturan rantai: (sin ax)′ = a cos ax dan (cos ax)′ = −a sin ax.'], [['sinus', '(sin x)′ = cos x'], ['kosinus', '(cos x)′ = −sin x']]),
    S('Menggabungkan aturan', ['Gabungkan dengan aturan perkalian atau rantai. Contoh: y = sin² x = (sin x)² memberi y′ = 2 sin x cos x = sin 2x.', 'Contoh lain: y = x sin x memberi y′ = sin x + x cos x.'], [['contoh', '(sin² x)′ = sin 2x']], 'Tanda negatif muncul pada turunan kosinus, bukan pada turunan sinus.'),
  ], [
    Q('Turunan y = 3 sin x − 2 cos x adalah …', ['3 cos x + 2 sin x', '3 cos x − 2 sin x', '−3 cos x + 2 sin x', '3 sin x + 2 cos x'], 0, '(sin x)′ = cos x dan (cos x)′ = −sin x, jadi 3 cos x − 2(−sin x) = 3 cos x + 2 sin x.'),
    Q('Turunan y = cos(4x) adalah …', ['−4 sin 4x', '4 sin 4x', '−sin 4x', '−4 cos 4x'], 0, 'Turunan luar −sin 4x dikalikan turunan bagian dalam 4.', 1),
    Q('Jika f(x) = x² cos x, nilai f′(π) adalah …', ['−2π', '2π', '−π²', '0'], 0, 'f′(x) = 2x cos x − x² sin x; di x = π: 2π(−1) − π² · 0 = −2π.', 3),
  ]),
  'MAT.C26.FPLUS.TURUNAN:STASIONER': K([
    S('Naik, turun, stasioner', ['Fungsi **naik** jika f′(x) > 0 dan **turun** jika f′(x) < 0. Titik dengan f′(x) = 0 disebut **titik stasioner**.', 'Jenisnya dilihat dari tanda f′ di sekitar titik: + ke − berarti maksimum; − ke + berarti minimum; tanda tetap berarti titik belok.'], [['stasioner', 'f′(x) = 0']]),
    S('Uji turunan kedua', ['Jika f′(a) = 0 dan f″(a) < 0, maka f(a) adalah nilai **maksimum** lokal. Jika f″(a) > 0, nilai **minimum** lokal.', 'Contoh: f(x) = x³ − 3x memiliki f′ = 3x² − 3 = 0 di x = ±1; f″(1) = 6 > 0 (minimum) dan f″(−1) = −6 < 0 (maksimum).'], [['maksimum', 'f″(a) < 0'], ['minimum', 'f″(a) > 0']], 'Untuk nilai ekstrem pada interval tertutup, bandingkan juga nilai di ujung-ujung interval.'),
  ], [
    Q('Fungsi f(x) = x² − 6x + 1 naik pada interval …', ['x > 3', 'x < 3', 'x > −3', 'x < 6'], 0, 'f′(x) = 2x − 6 > 0 saat x > 3.', 1),
    Q('Titik stasioner f(x) = x³ − 12x terjadi di …', ['x = 2 dan x = −2', 'x = 0 dan x = 12', 'x = 4 dan x = −4', 'x = 2 saja'], 0, 'f′(x) = 3x² − 12 = 0 memberi x² = 4, jadi x = ±2.'),
    Q('Nilai maksimum lokal f(x) = −x³ + 3x² + 2 adalah …', ['6', '2', '0', '10'], 0, 'Titik stasioner x = 0 dan x = 2; f″(2) = −6 < 0, sehingga maksimumnya f(2) = −8 + 12 + 2 = 6.', 3),
  ]),
  // ---------- Integral lanjut (kelas 12) ----------
  'MAT.C26.FPLUS.INTEGRAL:C1': K([
    S('Ide substitusi', ['Jika integran memuat suatu fungsi dan turunannya, misalkan **u = g(x)** sehingga du = g′(x) dx.', 'Contoh: ∫2x(x² + 1)³ dx. Misalkan u = x² + 1 dan du = 2x dx, sehingga integralnya ∫u³ du = u⁴/4 + C = (x² + 1)⁴/4 + C.'], [['substitusi', 'u = g(x), du = g′(x) dx']]),
    S('Menyesuaikan konstanta', ['Jika turunannya hanya berbeda konstanta, sesuaikan. Pada ∫x√(x² + 3) dx dengan u = x² + 3: du = 2x dx, jadi x dx = ½ du.', 'Hasilnya ½ ∫u^(1/2) du = ⅓(x² + 3)^(3/2) + C. Selalu kembalikan ke variabel x di akhir.'], [['contoh', '∫x√(x² + 3) dx = ⅓(x² + 3)^(3/2) + C']], 'Periksa hasil integral dengan menurunkannya kembali.'),
  ], [
    Q('Hasil ∫3x²(x³ − 2)⁴ dx adalah …', ['(x³ − 2)⁵/5 + C', '(x³ − 2)⁵ + C', '3(x³ − 2)⁵/5 + C', '(x³ − 2)⁴/4 + C'], 0, 'Dengan u = x³ − 2 dan du = 3x² dx, integralnya ∫u⁴ du = u⁵/5 + C.'),
    Q('Hasil ∫cos(5x) dx adalah …', ['(1/5) sin 5x + C', '5 sin 5x + C', '−(1/5) sin 5x + C', 'sin 5x + C'], 0, 'Misalkan u = 5x sehingga du = 5 dx; integralnya (1/5) sin 5x + C.', 1),
    Q('Hasil ∫x/(x² + 4)² dx adalah …', ['−1/(2(x² + 4)) + C', '1/(2(x² + 4)) + C', '−1/(x² + 4) + C', '−2/(x² + 4)³ + C'], 0, 'Dengan u = x² + 4, x dx = ½ du, sehingga ½ ∫u⁻² du = −1/(2u) + C.', 3),
  ]),
  'MAT.C26.FPLUS.INTEGRAL:C2': K([
    S('Kurva atas dikurangi kurva bawah', ['Luas daerah antara y = f(x) dan y = g(x) pada [a, b] dengan f(x) ≥ g(x) adalah **L = ∫ₐᵇ (f(x) − g(x)) dx**.', 'Batas a dan b sering merupakan absis titik potong kedua kurva, yaitu penyelesaian f(x) = g(x).'], [['luas', 'L = ∫ₐᵇ (f − g) dx']]),
    S('Contoh', ['Daerah antara y = x dan y = x²: titik potong x² = x memberi x = 0 dan x = 1. Pada [0, 1] garis y = x berada di atas parabola.', 'L = ∫₀¹ (x − x²) dx = ½ − ⅓ = 1/6 satuan luas.'], [['contoh', '∫₀¹ (x − x²) dx = 1/6']], 'Gambar sketsa dulu untuk menentukan kurva mana yang di atas.'),
  ], [
    Q('Luas daerah yang dibatasi y = x² dan sumbu x pada 0 ≤ x ≤ 3 adalah …', ['9 satuan luas', '27 satuan luas', '3 satuan luas', '6 satuan luas'], 0, '∫₀³ x² dx = [x³/3]₀³ = 27/3 = 9.', 1),
    Q('Luas daerah yang dibatasi y = 4 − x² dan sumbu x adalah …', ['32/3 satuan luas', '16/3 satuan luas', '8 satuan luas', '16 satuan luas'], 0, 'Kurva memotong sumbu x di x = ±2; ∫₋₂² (4 − x²) dx = 16 − 16/3 = 32/3.'),
    Q('Luas daerah antara y = x² dan y = 2x adalah …', ['4/3 satuan luas', '8/3 satuan luas', '4 satuan luas', '2/3 satuan luas'], 0, 'Titik potong x = 0 dan x = 2, dengan garis y = 2x di atas: ∫₀² (2x − x²) dx = 4 − 8/3 = 4/3.', 3),
  ]),
  'MAT.C26.FPLUS.INTEGRAL:VOLUME': K([
    S('Metode cakram', ['Daerah di bawah y = f(x) pada [a, b] yang diputar 360° mengelilingi sumbu x membentuk benda putar. Irisan tegaknya berupa cakram berjari-jari f(x).', 'Volumenya **V = π ∫ₐᵇ [f(x)]² dx**.'], [['cakram (sumbu x)', 'V = π ∫ₐᵇ f(x)² dx']]),
    S('Metode cincin', ['Jika daerah dibatasi dua kurva f(x) ≥ g(x) ≥ 0, irisannya berupa cincin, sehingga **V = π ∫ₐᵇ ([f(x)]² − [g(x)]²) dx**.', 'Untuk perputaran mengelilingi sumbu y, gunakan rumus yang sama dengan x sebagai fungsi y.'], [['cincin', 'V = π ∫ (f² − g²) dx']], 'Kuadratkan setiap fungsi terlebih dahulu, baru kurangkan; (f − g)² tidak sama dengan f² − g².'),
  ], [
    Q('Daerah di bawah y = x pada 0 ≤ x ≤ 3 diputar mengelilingi sumbu x. Volume benda putarnya adalah …', ['9π', '3π', '27π', '9π/2'], 0, 'V = π ∫₀³ x² dx = π · 27/3 = 9π, sama dengan volume kerucut berjari-jari 3 dan tinggi 3.'),
    Q('Daerah di bawah y = √x pada 0 ≤ x ≤ 4 diputar mengelilingi sumbu x. Volumenya adalah …', ['8π', '16π', '4π', '2π'], 0, 'V = π ∫₀⁴ (√x)² dx = π ∫₀⁴ x dx = π · 16/2 = 8π.'),
    Q('Daerah antara y = 2 dan y = 1 pada 0 ≤ x ≤ 5 diputar mengelilingi sumbu x. Volumenya adalah …', ['15π', '5π', '25π', '45π'], 0, 'Metode cincin: π ∫₀⁵ (2² − 1²) dx = π · 3 · 5 = 15π.', 3),
  ]),
};
