import type { PilotExisting, PilotQuestion, PilotSlide } from './types.js';
import { spread } from './spread.js';
// Materi dua slide dan soal untuk 14 inti Trigonometri (MAT.TRI) yang masih PLANNED. MAT.TRI.PRASYARAT tersembunyi, tidak diisi.
// Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi. Konteks soal tidak mengulang
// soal MAT.TRI yang sudah ada (menara 20 m, tangga 6 m, layang-layang), supaya tidak membuka pembahasannya.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
const T = (concept: string, title: string, slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): PilotExisting =>
  ({ topic: 'MAT.TRI', concept: `MAT.TRI.${concept}`, key: concept, title, slides, q: spread(`MAT.TRI.${concept}`, q), min });

export const TRI_EXISTING: PilotExisting[] = [
  // ---------- U1 Sudut & segitiga siku-siku ----------
  T('UKURAN_SUDUT', 'Ukuran Sudut', [
    S('Derajat dan jenis sudut', ['Satu putaran penuh = **360°**. Sudut **lancip** kurang dari 90°, **siku-siku** = 90°, **tumpul** di antara 90° dan 180°, **lurus** = 180°, dan **refleks** di antara 180° dan 360°.'], [['1 putaran', '360°'], ['siku-siku', '90°']]),
    S('Sudut berarah dan posisi baku', ['Dalam posisi baku, sudut diukur dari **sumbu x positif**. Putaran **berlawanan** arah jarum jam bernilai positif; searah jarum jam bernilai negatif.', 'Sudut yang berselisih kelipatan 360° punya sisi akhir yang sama (koterminal): 30°, 390°, dan −330° menunjuk ke arah yang sama.'], [['koterminal', 'θ + k · 360°']], 'Untuk sudut lebih dari 360°, kurangi 360° berulang kali sampai berada di antara 0° dan 360°.'),
  ], [
    Q('Sudut sebesar 135° termasuk sudut …', ['lancip', 'siku-siku', 'tumpul', 'refleks'], 2, 'Sudut tumpul berada di antara 90° dan 180°, dan 135° ada di rentang itu.', 1),
    Q('Sudut yang koterminal dengan 400° dan berada di antara 0° dan 360° adalah …', ['40°', '140°', '320°', '760°'], 0, '400° − 360° = 40°. Keduanya berselisih satu putaran penuh, jadi sisi akhirnya sama.'),
    Q('Dalam posisi baku, sisi akhir sudut −90° terletak pada …', ['sumbu y negatif', 'sumbu y positif', 'sumbu x negatif', 'kuadran III'], 0, 'Tanda negatif berarti diputar searah jarum jam. Seperempat putaran dari sumbu x positif ke arah itu berakhir di sumbu y negatif.'),
  ], 4),
  T('RADIAN', 'Radian', [
    S('Apa itu radian', ['Satu **radian** adalah sudut pusat yang busurnya sama panjang dengan jari-jari lingkaran.', 'Keliling lingkaran 2πr memuat 2π jari-jari, jadi satu putaran = **2π rad** = 360°, sehingga **π rad = 180°**.'], [['π rad', '180°'], ['1 rad', '≈ 57,3°']]),
    S('Konversi dan panjang busur', ['Derajat ke radian: kalikan **π/180°**. Radian ke derajat: kalikan **180°/π**. Contoh: 90° = π/2 rad.', 'Jika sudut pusat θ dinyatakan dalam radian, panjang busurnya **s = r · θ**.'], [['derajat → radian', '× π/180°'], ['panjang busur', 's = r · θ']], 'Rumus s = r · θ hanya berlaku jika θ dalam radian. Ubah dulu bila sudut diberikan dalam derajat.'),
  ], [
    Q('Sudut 60° jika dinyatakan dalam radian adalah …', ['π/6', 'π/4', 'π/3', 'π/2'], 2, '60° × π/180° = π/3.', 1),
    Q('Sudut 3π/4 rad jika dinyatakan dalam derajat adalah …', ['45°', '120°', '135°', '270°'], 2, '3π/4 × 180°/π = 3 × 45° = 135°.', 1),
    Q('Sebuah lingkaran berjari-jari 10 cm. Panjang busur di depan sudut pusat π/5 rad adalah …', ['2π cm', '5π cm', 'π/2 cm', '50π cm'], 0, 's = r · θ = 10 × π/5 = 2π cm.'),
  ], 4),
  // ---------- U3 Kuadran & relasi ----------
  T('KUADRAN_TANDA', 'Kuadran & Tanda', [
    S('Sudut di bidang koordinat', ['Ambil titik (x, y) pada sisi akhir sudut θ. Jaraknya ke pusat **r = √(x² + y²)**. Karena r adalah jarak, nilainya **selalu positif**.', 'Definisinya: **sin θ = y/r**, **cos θ = x/r**, **tan θ = y/x**. Tanda tiap rasio ditentukan oleh tanda x dan y.'], [['sin θ', 'y / r'], ['cos θ', 'x / r'], ['tan θ', 'y / x']]),
    S('Tanda di empat kuadran', ['Kuadran I (x +, y +): semua positif. Kuadran II (x −, y +): hanya **sin** positif. Kuadran III (x −, y −): hanya **tan** positif. Kuadran IV (x +, y −): hanya **cos** positif.'], [['kuadran II', 'sin +'], ['kuadran III', 'tan +'], ['kuadran IV', 'cos +']], 'Tentukan dulu kuadrannya, baru tandanya. Nilai mutlaknya tetap dihitung dari segitiga siku-siku seperti biasa.'),
  ], [
    Q('Jika sin θ > 0 dan cos θ < 0, sudut θ terletak di kuadran …', ['I', 'II', 'III', 'IV'], 1, 'sin positif berarti y positif, cos negatif berarti x negatif. Titik dengan x negatif dan y positif ada di kuadran II.', 1),
    Q('Titik (−3, −4) terletak pada sisi akhir sudut θ. Nilai cos θ adalah …', ['−3/5', '3/5', '−4/5', '4/3'], 0, 'r = √(9 + 16) = 5 dan selalu positif. cos θ = x/r = −3/5.'),
    Q('Diketahui sin x = −5/13 dan x berada di kuadran III. Nilai cos x adalah …', ['−12/13', '12/13', '−5/12', '5/12'], 0, 'Dari segitiga dengan sisi 5, 12, 13, nilai mutlak cos x adalah 12/13. Di kuadran III cos bernilai negatif, jadi cos x = −12/13.', 3),
  ]),
  T('SUDUT_BERELASI', 'Sudut Berelasi', [
    S('Kembali ke sudut lancip', ['Sudut di kuadran II, III, dan IV bisa ditulis memakai sudut lancip θ: **180° − θ**, **180° + θ**, atau **360° − θ**.', 'Nilainya sama dengan nilai di θ; yang berubah hanya tanda, sesuai kuadrannya.'], [['sin(180° − θ)', 'sin θ'], ['cos(180° + θ)', '−cos θ'], ['tan(360° − θ)', '−tan θ']]),
    S('Langkah dan kofungsi', ['Contoh: cos 210° = cos(180° + 30°). Sudut 210° ada di kuadran III, tempat cos negatif, jadi cos 210° = −cos 30° = −½√3.', 'Pasangan **90° − θ** menukar fungsi: sin(90° − θ) = cos θ dan cos(90° − θ) = sin θ.'], [['sin(90° − θ)', 'cos θ']], 'Urutannya: ubah ke 180° ± θ atau 360° − θ, tentukan tanda dari kuadran, lalu ambil nilai dari sudut θ.'),
  ], [
    Q('Nilai sin 150° adalah …', ['½', '−½', '½√3', '−½√3'], 0, 'sin 150° = sin(180° − 30°) = sin 30° = ½. Di kuadran II sin positif.', 1),
    Q('Nilai cos 240° adalah …', ['−½', '½', '−½√3', '½√3'], 0, '240° = 180° + 60° di kuadran III, tempat cos negatif. Jadi cos 240° = −cos 60° = −½.'),
    Q('Nilai tan 315° adalah …', ['−1', '1', '−√3', '√3'], 0, '315° = 360° − 45° di kuadran IV, tempat tan negatif. Jadi tan 315° = −tan 45° = −1.'),
  ]),
  T('IDENTITAS_DASAR', 'Identitas Dasar', [
    S('Dari Pythagoras ke identitas', ['Pada titik (x, y) berjarak r, berlaku x² + y² = r². Bagi kedua ruas dengan r²: (x/r)² + (y/r)² = 1.', 'Itulah **sin²θ + cos²θ = 1**, berlaku untuk setiap sudut θ. Selain itu, **tan θ = sin θ / cos θ**.'], [['sin²θ + cos²θ', '1'], ['tan θ', 'sin θ / cos θ']]),
    S('Turunan dan cara memakainya', ['Bagi sin²θ + cos²θ = 1 dengan cos²θ: **1 + tan²θ = sec²θ**. Bagi dengan sin²θ: **1 + cot²θ = csc²θ**.', 'Untuk menyederhanakan atau membuktikan identitas, ubah semuanya ke sin dan cos, lalu olah satu ruas sampai sama dengan ruas lainnya.'], [['1 + tan²θ', 'sec²θ'], ['1 + cot²θ', 'csc²θ']], 'Bentuk 1 − cos²θ dan 1 − sin²θ sering muncul. Ganti dengan sin²θ dan cos²θ.'),
  ], [
    Q('Bentuk sederhana dari (1 − cos²x) / sin x adalah …', ['sin x', 'cos x', 'tan x', '1'], 0, '1 − cos²x = sin²x, dan sin²x / sin x = sin x.'),
    Q('Jika sin x = 3/5 dan x sudut lancip, nilai tan x adalah …', ['3/4', '4/3', '4/5', '3/5'], 0, 'cos²x = 1 − 9/25 = 16/25, jadi cos x = 4/5 (positif untuk sudut lancip). tan x = (3/5) / (4/5) = 3/4.'),
    Q('Nilai dari sec²x − tan²x adalah …', ['1', '0', 'sec x', '−1'], 0, 'Dari 1 + tan²x = sec²x, selisih sec²x dan tan²x selalu 1.', 1),
  ]),
  // ---------- U4 Segitiga sembarang ----------
  T('ATURAN_SINUS', 'Aturan Sinus', [
    S('Sisi dan sinus sudut di depannya', ['Pada segitiga ABC, sisi a berada di depan sudut A, sisi b di depan sudut B, dan sisi c di depan sudut C.', 'Aturan sinus: **a / sin A = b / sin B = c / sin C**. Sisi terpanjang selalu berada di depan sudut terbesar.'], [['aturan sinus', 'a / sin A = b / sin B = c / sin C']]),
    S('Kapan dipakai', ['Pakai aturan sinus jika diketahui **dua sudut dan satu sisi**, atau **dua sisi dan sudut di depan salah satu sisi itu**.', 'Sudut ketiga didapat dari A + B + C = 180°. Pada kasus dua sisi dan sudut di depannya, bisa ada nol, satu, atau dua segitiga yang memenuhi.'], [['jumlah sudut', 'A + B + C = 180°']], 'Pastikan setiap pasangan yang dibandingkan adalah sisi dengan sudut di depannya, bukan sudut yang mengapitnya.'),
  ], [
    Q('Pada segitiga ABC, ∠A = 30°, ∠B = 45°, dan a = 6 cm. Panjang sisi b adalah …', ['6√2 cm', '3√2 cm', '12 cm', '6√3 cm'], 0, 'b = a · sin B / sin A = 6 · (½√2) / (½) = 6√2 cm.'),
    Q('Pada segitiga PQR, ∠P = 60°, ∠Q = 45°, dan sisi QR (di depan ∠P) = 12 cm. Panjang sisi PR (di depan ∠Q) adalah …', ['4√6 cm', '6√2 cm', '8√3 cm', '4√3 cm'], 0, 'PR = 12 · sin 45° / sin 60° = 12 · (½√2) / (½√3) = 12√2/√3 = 4√6 cm.', 3),
    Q('Aturan sinus paling tepat dipakai untuk mencari unsur segitiga jika yang diketahui …', ['dua sudut dan satu sisi', 'tiga sisi', 'dua sisi dan sudut yang diapitnya', 'tiga sudut saja'], 0, 'Dengan dua sudut, sudut ketiga ikut diketahui, sehingga setiap sisi bisa dipasangkan dengan sinus sudut di depannya. Tiga sisi atau dua sisi dengan sudut apit memerlukan aturan cosinus.', 1),
  ], 6),
  T('ATURAN_COSINUS', 'Aturan Cosinus', [
    S('Pythagoras untuk segitiga sembarang', ['**a² = b² + c² − 2bc · cos A**, dan bentuk serupa untuk b² dan c².', 'Jika A = 90°, cos A = 0 dan rumus ini kembali menjadi Pythagoras.'], [['aturan cosinus', 'a² = b² + c² − 2bc cos A']]),
    S('Mencari sisi atau sudut', ['Diketahui **dua sisi dan sudut apitnya**: hitung sisi ketiga. Diketahui **tiga sisi**: hitung sudut dengan **cos A = (b² + c² − a²) / (2bc)**.', 'Jika cos A negatif, sudut A tumpul.'], [['mencari sudut', 'cos A = (b² + c² − a²) / 2bc']], 'Saat mencari sudut terbesar, pilih sudut di depan sisi terpanjang.'),
  ], [
    Q('Pada segitiga ABC, b = 5 cm, c = 8 cm, dan ∠A = 60°. Panjang sisi a adalah …', ['7 cm', '√89 cm', '13 cm', '√129 cm'], 0, 'a² = 25 + 64 − 2 · 5 · 8 · ½ = 89 − 40 = 49, jadi a = 7 cm.'),
    Q('Sebuah segitiga memiliki sisi 7 cm, 8 cm, dan 13 cm. Besar sudut terbesarnya adalah …', ['120°', '60°', '150°', '90°'], 0, 'Sudut terbesar berada di depan sisi 13. cos C = (49 + 64 − 169) / (2 · 7 · 8) = −56/112 = −½, jadi C = 120°.', 3),
    Q('Pada segitiga ABC berlaku a² > b² + c². Sudut A adalah sudut …', ['tumpul', 'lancip', 'siku-siku', 'sebesar 60°'], 0, 'a² > b² + c² berarti 2bc · cos A < 0, sehingga cos A negatif dan A tumpul.'),
  ], 6),
  T('LUAS_SEGITIGA', 'Luas Segitiga', [
    S('Dua sisi dan sudut apit', ['Tinggi segitiga terhadap sisi a adalah b · sin C. Maka luasnya **L = ½ · a · b · sin C**.', 'Rumus ini berlaku untuk pasangan mana saja: dua sisi dan sudut yang diapit keduanya.'], [['luas', 'L = ½ ab sin C']]),
    S('Tiga sisi: rumus Heron', ['Jika ketiga sisi diketahui, hitung setengah keliling **s = ½(a + b + c)**.', 'Luasnya **L = √(s(s − a)(s − b)(s − c))**.'], [['setengah keliling', 's = ½(a + b + c)'], ['Heron', 'L = √(s(s − a)(s − b)(s − c))']], 'Rumus ½ · alas · tinggi tetap benar; sin C hanya cara menghitung tingginya.'),
  ], [
    Q('Segitiga ABC memiliki a = 6 cm, b = 8 cm, dan ∠C = 30°. Luasnya adalah …', ['12 cm²', '24 cm²', '12√3 cm²', '48 cm²'], 0, 'L = ½ · 6 · 8 · sin 30° = 24 · ½ = 12 cm².', 1),
    Q('Luas segitiga dengan sisi 13 cm, 14 cm, dan 15 cm adalah …', ['84 cm²', '42 cm²', '168 cm²', '72 cm²'], 0, 's = 21, jadi L = √(21 · 8 · 7 · 6) = √7056 = 84 cm².'),
    Q('Luas segitiga sama sisi dengan panjang sisi 4 cm adalah …', ['4√3 cm²', '8√3 cm²', '8 cm²', '16 cm²'], 0, 'Setiap sudutnya 60°. L = ½ · 4 · 4 · sin 60° = 8 · ½√3 = 4√3 cm².'),
  ]),
  // ---------- U5 Fungsi & grafik ----------
  T('LINGKARAN_SATUAN', 'Lingkaran Satuan', [
    S('Titik (cos θ, sin θ)', ['Lingkaran satuan berpusat di (0, 0) dengan jari-jari 1. Karena r = 1, titik pada sisi akhir sudut θ adalah **(cos θ, sin θ)**.', 'Akibatnya, nilai sin θ dan cos θ selalu di antara −1 dan 1.'], [['titik pada lingkaran satuan', '(cos θ, sin θ)'], ['batas nilai', '−1 ≤ sin θ, cos θ ≤ 1']]),
    S('Sudut pada sumbu', ['0° → (1, 0), 90° → (0, 1), 180° → (−1, 0), 270° → (0, −1).', 'Jadi sin 90° = 1, cos 180° = −1, dan sin 270° = −1. Karena tan θ = y/x, tan tidak terdefinisi di 90° dan 270°, saat x = 0.'], [['tan θ', 'y / x, tak terdefinisi saat x = 0']], 'Baca koordinat x sebagai cos dan koordinat y sebagai sin.'),
  ], [
    Q('Titik pada lingkaran satuan untuk sudut 180° adalah …', ['(−1, 0)', '(0, −1)', '(1, 0)', '(0, 1)'], 0, 'Setengah putaran dari (1, 0) berakhir di (−1, 0).', 1),
    Q('Nilai sin 270° adalah …', ['−1', '0', '1', 'tidak terdefinisi'], 0, 'Titik untuk 270° adalah (0, −1), dan sin adalah koordinat y-nya.', 1),
    Q('Titik P(−½, ½√3) pada lingkaran satuan merupakan sisi akhir sudut θ, dengan 0° ≤ θ < 360°. Besar θ adalah …', ['120°', '60°', '150°', '240°'], 0, 'cos θ = −½ dan sin θ = ½√3, jadi θ di kuadran II dengan sudut acuan 60°: θ = 180° − 60° = 120°.'),
  ], 4),
  T('GRAFIK_SIN_COS_TAN', 'Grafik sin, cos, tan', [
    S('Grafik sinus dan cosinus', ['**y = sin x** mulai dari 0 di 0°, naik ke 1 di 90°, kembali 0 di 180°, turun ke −1 di 270°, lalu 0 lagi di 360°.', '**y = cos x** berbentuk sama tetapi bergeser 90°: mulai dari 1 di 0°, 0 di 90°, dan −1 di 180°.'], [['sin x', 'maks 1 di 90°, min −1 di 270°'], ['cos x', 'maks 1 di 0°, min −1 di 180°']]),
    S('Grafik tangen', ['**y = tan x** tidak punya nilai maksimum atau minimum dan berulang setiap 180°.', 'Di 90° dan 270°, cos x = 0 sehingga tan x tidak terdefinisi. Grafiknya mendekati garis tegak (asimtot) di sana.'], [['tan x', 'asimtot di x = 90° + k · 180°']], 'Grafik sin dan cos adalah jejak koordinat y dan x dari titik yang berputar pada lingkaran satuan.'),
  ], [
    Q('Untuk 0° ≤ x ≤ 360°, grafik y = sin x mencapai nilai maksimum di x = …', ['90°', '0°', '180°', '270°'], 0, 'Nilai sin x terbesar adalah 1, dan itu terjadi di x = 90°.', 1),
    Q('Untuk 0° ≤ x ≤ 360°, grafik y = cos x memotong sumbu x di …', ['90° dan 270°', '0° dan 180°', '180° dan 360°', '45° dan 225°'], 0, 'Grafik memotong sumbu x saat cos x = 0, yaitu di x = 90° dan x = 270°.'),
    Q('Fungsi y = tan x tidak terdefinisi di x = …', ['90°', '0°', '180°', '45°'], 0, 'tan x = sin x / cos x, dan cos 90° = 0 sehingga pembaginya nol.', 1),
  ]),
  T('PERIODE_AMPLITUDO', 'Periode & Amplitudo', [
    S('Membaca y = a sin kx + c', ['**Amplitudo** = |a|, yaitu setengah jarak puncak ke lembah. **Periode** = 360° / |k|, yaitu panjang satu gelombang penuh.', 'Nilai maksimum = c + |a| dan nilai minimum = c − |a|. Aturan yang sama berlaku untuk y = a cos kx + c.'], [['amplitudo', '|a|'], ['periode sin, cos', '360° / |k|'], ['maks / min', 'c ± |a|']]),
    S('Tangen dan pergeseran', ['Untuk **y = a tan kx**, periodenya **180° / |k|**, dan tidak ada amplitudo karena grafiknya tidak terbatas.', 'Bentuk y = sin(x − α) menggeser grafik y = sin x sejauh α ke kanan; y = sin x + c menggesernya c satuan ke atas.'], [['periode tan', '180° / |k|']], 'k mengubah periode, a mengubah tinggi gelombang, c menggeser naik atau turun.'),
  ], [
    Q('Amplitudo dan periode fungsi y = 3 sin 2x adalah …', ['3 dan 180°', '2 dan 180°', '3 dan 720°', '6 dan 360°'], 0, 'Amplitudo = |3| = 3. Periode = 360° / 2 = 180°.', 1),
    Q('Nilai maksimum fungsi y = 2 cos x + 5 adalah …', ['7', '5', '3', '10'], 0, 'cos x paling besar 1, jadi y maksimum = 2 · 1 + 5 = 7.'),
    Q('Periode fungsi y = tan 3x adalah …', ['60°', '120°', '180°', '540°'], 0, 'Periode tan adalah 180° / |k| = 180° / 3 = 60°.'),
  ]),
  // ---------- U6 Terapkan ----------
  T('PERSAMAAN_SEDERHANA', 'Persamaan Sederhana', [
    S('Rumus umum', ['Jika **sin x = sin α**, maka x = α + k · 360° atau x = (180° − α) + k · 360°.', 'Jika **cos x = cos α**, maka x = ±α + k · 360°. Jika **tan x = tan α**, maka x = α + k · 180°.'], [['sin x = sin α', 'x = α atau 180° − α (+ k · 360°)'], ['cos x = cos α', 'x = ±α (+ k · 360°)'], ['tan x = tan α', 'x = α (+ k · 180°)']]),
    S('Langkah menyelesaikan', ['1) Ubah nilainya menjadi sudut acuan, misalnya sin x = ½ memberi sudut acuan 30°. 2) Tentukan kuadran yang sesuai dengan tandanya. 3) Tulis sudut di setiap kuadran itu. 4) Ambil hanya yang berada di interval soal.', 'Contoh: cos x = ½ untuk 0° ≤ x ≤ 360° memberi x = 60° atau x = 300°.'], [['cos x = ½', 'x = 60° atau 300°']], 'Satu nilai sinus atau cosinus biasanya punya dua jawaban dalam satu putaran. Jangan berhenti di jawaban pertama.'),
  ], [
    Q('Himpunan penyelesaian sin x = ½ untuk 0° ≤ x ≤ 360° adalah …', ['{30°, 150°}', '{30°, 330°}', '{60°, 120°}', '{30°, 210°}'], 0, 'Sudut acuannya 30°, dan sin positif di kuadran I dan II: x = 30° dan x = 180° − 30° = 150°.', 1),
    Q('Himpunan penyelesaian cos x = −½ untuk 0° ≤ x ≤ 360° adalah …', ['{120°, 240°}', '{60°, 300°}', '{120°, 300°}', '{150°, 210°}'], 0, 'Sudut acuannya 60°, dan cos negatif di kuadran II dan III: x = 180° − 60° = 120° dan x = 180° + 60° = 240°.'),
    Q('Himpunan penyelesaian tan x = 1 untuk 0° ≤ x ≤ 360° adalah …', ['{45°, 225°}', '{45°, 135°}', '{45°, 315°}', '{135°, 315°}'], 0, 'tan x = tan 45°, dan periodenya 180°: x = 45° dan x = 45° + 180° = 225°.'),
  ]),
  T('PERSAMAAN_DENGAN_IDENTITAS', 'Persamaan dengan Identitas', [
    S('Jadikan satu jenis fungsi', ['Jika persamaan memuat sin² dan cos sekaligus, ganti salah satunya memakai **sin²x + cos²x = 1** sehingga hanya ada satu jenis fungsi.', 'Hasilnya sering berbentuk kuadrat. Misalkan p = sin x atau p = cos x, lalu faktorkan.'], [['ganti sin²x', '1 − cos²x'], ['ganti cos²x', '1 − sin²x']]),
    S('Saring akarnya', ['Contoh: 2cos²x − cos x − 1 = 0 difaktorkan menjadi (2cos x + 1)(cos x − 1) = 0, jadi cos x = −½ atau cos x = 1.', 'Nilai sin dan cos hanya di antara −1 dan 1. Akar seperti cos x = 2 dibuang karena tidak mungkin.'], [['syarat', '−1 ≤ sin x, cos x ≤ 1']], 'Setelah mendapat nilai sin atau cos, selesaikan seperti persamaan trigonometri sederhana.'),
  ], [
    Q('Himpunan penyelesaian 2sin²x − sin x − 1 = 0 untuk 0° ≤ x ≤ 360° adalah …', ['{90°, 210°, 330°}', '{30°, 90°, 150°}', '{210°, 330°}', '{90°, 270°}'], 0, '(2 sin x + 1)(sin x − 1) = 0, jadi sin x = 1 atau sin x = −½. sin x = 1 memberi 90°; sin x = −½ memberi 210° dan 330°.', 3),
    Q('Dengan mengganti cos²x = 1 − sin²x, persamaan 2cos²x + 3 sin x − 3 = 0 menjadi …', ['2sin²x − 3 sin x + 1 = 0', '2sin²x + 3 sin x − 1 = 0', '2sin²x − 3 sin x − 5 = 0', 'sin²x − 3 sin x + 1 = 0'], 0, '2(1 − sin²x) + 3 sin x − 3 = −2sin²x + 3 sin x − 1 = 0. Kalikan −1: 2sin²x − 3 sin x + 1 = 0.'),
    Q('Himpunan penyelesaian cos²x − cos x − 2 = 0 untuk 0° ≤ x ≤ 360° adalah …', ['{180°}', '{0°, 180°}', '{60°, 180°}', 'tidak ada penyelesaian'], 0, '(cos x − 2)(cos x + 1) = 0. cos x = 2 tidak mungkin, jadi hanya cos x = −1, yaitu x = 180°.'),
  ], 6),
  T('SOAL_KONTEKSTUAL', 'Soal Kontekstual', [
    S('Dari cerita ke segitiga', ['1) Gambar sketsa dan tandai yang diketahui. 2) Tentukan segitiganya: siku-siku atau sembarang. 3) Pilih alat: sin, cos, tan untuk segitiga siku-siku; aturan sinus atau cosinus untuk segitiga sembarang. 4) Hitung, lalu periksa satuan dan kewajarannya.'], [['siku-siku', 'sin, cos, tan'], ['sembarang', 'aturan sinus / cosinus']]),
    S('Arah jurusan tiga angka', ['Dalam navigasi, arah ditulis sebagai **jurusan tiga angka**, diukur dari arah **utara searah jarum jam**: timur = 090°, selatan = 180°, barat = 270°.', 'Sudut antara dua lintasan dari titik yang sama adalah selisih jurusannya, yang lalu dipakai dalam aturan cosinus.'], [['timur', '090°'], ['selatan', '180°']], 'Jangan lupa tinggi mata pengamat atau tinggi alat ukur jika disebut dalam soal.'),
  ], [
    Q('Seorang siswa berdiri 12 m dari tiang bendera dan melihat puncaknya dengan sudut elevasi 45°. Tinggi matanya dari tanah 1,5 m. Tinggi tiang bendera adalah …', ['13,5 m', '12 m', '10,5 m', '12√2 m'], 0, 'Tinggi di atas mata = 12 · tan 45° = 12 m. Tambahkan tinggi mata: 12 + 1,5 = 13,5 m.'),
    Q('Sebuah kapal berlayar 8 km dengan jurusan 090°, lalu 6 km dengan jurusan 180°. Jarak kapal dari titik awal adalah …', ['10 km', '14 km', '2 km', '2√7 km'], 0, 'Jurusan 090° (timur) dan 180° (selatan) saling tegak lurus, jadi jaraknya √(8² + 6²) = 10 km.'),
    Q('Dua kapal berangkat dari pelabuhan yang sama. Kapal A berlayar 6 km dengan jurusan 030° dan kapal B 10 km dengan jurusan 090°. Jarak kedua kapal adalah …', ['2√19 km', '14 km', '4 km', '2√34 km'], 0, 'Sudut antara kedua lintasan 090° − 030° = 60°. d² = 36 + 100 − 2 · 6 · 10 · cos 60° = 76, jadi d = √76 = 2√19 km.', 3),
  ], 6),
];
