import type { PilotCore, PilotQuestion, PilotRelation, PilotSlide, PilotTopic } from './types.js';
// Topik Matematika yang sebelumnya PLANNED tanpa inti, plus dua topik fase F dari peta IntiVerse.
// Notasi matriks ditulis per baris: [a b; c d] berarti baris pertama a b, baris kedua c d.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2, src: PilotQuestion['src'] = 'UN'): PilotQuestion => ({ p, o, a, why, d, src });
const C = (id: string, title: string, slides: [PilotSlide, PilotSlide], q: PilotQuestion[], extra: Partial<PilotCore> = {}): PilotCore => ({ id, title, slides, q, ...extra });

const KUA: PilotTopic = {
  code: 'MAT.KUA', subject: 'MAT', title: 'Persamaan & Fungsi Kuadrat', subtitle: 'Akar, diskriminan, titik puncak, dan pemodelan', phase: 'E',
  bekal: ['operasi aljabar', 'persamaan linear'],
  cores: [
    C('KOEFISIEN', 'Bentuk & koefisien kuadrat', [
      S('Bentuk umum', ['Fungsi kuadrat: **f(x) = ax² + bx + c** dengan a ≠ 0. Urutkan dulu sukunya sebelum membaca a, b, c.', 'Contoh: f(x) = 3 − 2x + 5x² berarti a = 5, b = −2, c = 3.'], [['f(x)', 'ax² + bx + c'], ['syarat', 'a ≠ 0']]),
      S('Arti setiap koefisien', ['**a > 0**: parabola terbuka ke atas (punya minimum). **a < 0**: terbuka ke bawah (punya maksimum).', '**c** adalah titik potong dengan sumbu y, yaitu (0, c).'], [['a > 0', 'terbuka ke atas'], ['titik potong sumbu y', '(0, c)']], 'Tanda a langsung memberi tahu apakah soal mencari nilai maksimum atau minimum.'),
    ], [
      Q('Pada fungsi f(x) = 3 − 2x + 5x², nilai a, b, dan c berturut-turut adalah …', ['a = 3, b = −2, c = 5', 'a = 5, b = −2, c = 3', 'a = 5, b = 2, c = 3', 'a = −2, b = 5, c = 3'], 1, 'Urutkan: 5x² − 2x + 3, jadi a = 5, b = −2, c = 3.', 1),
      Q('Grafik f(x) = −x² + 4x + 5 terbuka ke … dan memotong sumbu y di titik …', ['atas, (0, 5)', 'bawah, (0, 5)', 'bawah, (5, 0)', 'atas, (0, −5)'], 1, 'a = −1 < 0 sehingga terbuka ke bawah; c = 5 sehingga memotong sumbu y di (0, 5).'),
    ], { min: 4 }),
    C('FAKTOR', 'Faktorisasi dan akar', [
      S('Memfaktorkan', ['x² + bx + c = (x + p)(x + q) dengan **p + q = b** dan **p · q = c**. Setiap faktor yang bernilai nol memberi satu akar.', 'Contoh: x² − 5x + 6 = (x − 2)(x − 3) ⇒ x = 2 atau x = 3.'], [['x² − 5x + 6', '(x − 2)(x − 3)']]),
      S('Jumlah dan hasil kali akar', ['Tanpa mencari akarnya: **x₁ + x₂ = −b/a** dan **x₁ · x₂ = c/a**.', 'Bentuk lain dihitung dari keduanya, misalnya x₁² + x₂² = (x₁ + x₂)² − 2x₁x₂.'], [['x₁ + x₂', '−b/a'], ['x₁ · x₂', 'c/a']], 'Persamaan kuadrat berakar p dan q: x² − (p + q)x + pq = 0.'),
    ], [
      Q('Akar-akar persamaan x² − 5x + 6 = 0 adalah …', ['2 dan 3', '−2 dan −3', '1 dan 6', '−1 dan 6'], 0, 'x² − 5x + 6 = (x − 2)(x − 3), jadi x = 2 atau x = 3.', 1),
      Q('Akar-akar persamaan 2x² − 6x + 1 = 0 adalah x₁ dan x₂. Nilai x₁² + x₂² adalah …', ['7', '8', '9', '10'], 1, 'x₁ + x₂ = 3 dan x₁x₂ = 1/2. x₁² + x₂² = 3² − 2 · 1/2 = 9 − 1 = 8.', 3),
      Q('Persamaan kuadrat yang akar-akarnya 3 dan −2 adalah …', ['x² − x − 6 = 0', 'x² + x − 6 = 0', 'x² − 5x + 6 = 0', 'x² + x + 6 = 0'], 0, 'x² − (3 + (−2))x + 3 · (−2) = x² − x − 6 = 0.'),
    ]),
    C('DISKRIMINAN', 'Rumus kuadrat & diskriminan', [
      S('Rumus ABC', ['Bila sulit difaktorkan: **x = (−b ± √D) / 2a** dengan **D = b² − 4ac**.', 'Contoh: 2x² + 3x − 2 = 0 ⇒ D = 9 + 16 = 25 ⇒ x = (−3 ± 5)/4, yaitu 1/2 atau −2.'], [['x₁,₂', '(−b ± √D) / 2a'], ['D', 'b² − 4ac']]),
      S('Membaca jenis akar dari D', ['**D > 0**: dua akar real berbeda. **D = 0**: akar kembar. **D < 0**: tidak punya akar real (parabola tidak memotong sumbu x).'], [['D = 0', 'akar kembar'], ['D < 0', 'tidak ada akar real']], 'Soal "akar kembar" atau "menyinggung sumbu x" selalu berarti D = 0.'),
    ], [
      Q('Akar-akar persamaan 2x² + 3x − 2 = 0 adalah …', ['1/2 dan −2', '−1/2 dan 2', '1 dan −2', '2 dan −1'], 0, 'D = 3² − 4 · 2 · (−2) = 25. x = (−3 ± 5)/4 memberi 1/2 dan −2.'),
      Q('Persamaan x² + (m − 1)x + 4 = 0 mempunyai akar kembar. Nilai m yang memenuhi adalah …', ['m = 5 atau m = −3', 'm = −5 atau m = 3', 'm = 4', 'm = 1'], 0, 'Akar kembar: D = (m − 1)² − 16 = 0 ⇒ m − 1 = ±4 ⇒ m = 5 atau m = −3.', 3),
    ]),
    C('PUNCAK', 'Melengkapkan kuadrat & puncak', [
      S('Bentuk puncak', ['Fungsi kuadrat bisa ditulis **f(x) = a(x − h)² + k** dengan puncak **(h, k)**.', 'Melengkapkan kuadrat: x² − 6x + 5 = (x − 3)² − 9 + 5 = (x − 3)² − 4, puncaknya (3, −4).'], [['f(x)', 'a(x − h)² + k'], ['puncak', '(h, k)']]),
      S('Rumus cepat puncak', ['**xₚ = −b/2a**, lalu yₚ = f(xₚ). Nilai yₚ adalah nilai minimum (a > 0) atau maksimum (a < 0).', 'Contoh: f(x) = −2x² + 8x + 1 ⇒ xₚ = 2 ⇒ f(2) = 9 (maksimum).'], [['xₚ', '−b / 2a'], ['yₚ', '−D / 4a']], 'Hitung xₚ dulu, lalu substitusikan; lebih jarang salah daripada menghafal −D/4a.'),
    ], [
      Q('Titik puncak grafik y = x² − 6x + 5 adalah …', ['(3, −4)', '(−3, −4)', '(3, 4)', '(6, 5)'], 0, 'xₚ = −(−6)/2 = 3, yₚ = 9 − 18 + 5 = −4. Puncaknya (3, −4).', 1),
      Q('Nilai maksimum fungsi f(x) = −2x² + 8x + 1 adalah …', ['7', '9', '17', '1'], 1, 'xₚ = −8/(2 · (−2)) = 2, f(2) = −8 + 16 + 1 = 9.'),
    ]),
    C('MODEL', 'Pemodelan kuadrat', [
      S('Masalah maksimum dan minimum', ['Banyak masalah nyata berbentuk kuadrat: tinggi benda yang dilempar, luas dengan keliling tetap, keuntungan dari harga jual.', 'Langkah: tulis besaran yang dicari sebagai fungsi satu variabel, lalu cari puncaknya.'], [['tinggi', 'h(t) = v₀t − 5t²']]),
      S('Contoh luas maksimum', ['Keliling persegi panjang 40 cm ⇒ p + l = 20 ⇒ L = p(20 − p) = −p² + 20p.', 'Puncak di p = 10, jadi L maksimum = 100 cm² (persegi).'], [['L(p)', '−p² + 20p'], ['Lmaks', '100 cm²']], 'Ganti satu variabel dengan variabel lain memakai syarat yang diketahui.'),
    ], [
      Q('Sebuah bola dilempar ke atas dengan ketinggian h(t) = 20t − 5t² meter setelah t detik. Tinggi maksimum bola adalah …', ['10 m', '20 m', '40 m', '15 m'], 1, 'tₚ = −20/(2 · (−5)) = 2 detik, h(2) = 40 − 20 = 20 m.'),
      Q('Keliling sebuah persegi panjang 40 cm. Luas maksimum persegi panjang itu adalah …', ['96 cm²', '100 cm²', '400 cm²', '80 cm²'], 1, 'L = p(20 − p) maksimum saat p = 10, sehingga L = 10 × 10 = 100 cm².', 2, 'SNBT'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['KOEFISIEN', 'FAKTOR', 'S'], ['KOEFISIEN', 'DISKRIMINAN', 'S'], ['KOEFISIEN', 'PUNCAK', 'S'], ['PUNCAK', 'MODEL', 'S']],
};

const SPL: PilotTopic = {
  code: 'MAT.SPL', subject: 'MAT', title: 'Sistem Persamaan & Pertidaksamaan', subtitle: 'Garis batas, daerah penyelesaian, program linear', phase: 'E',
  bekal: ['persamaan linear dua variabel', 'koordinat Kartesius'],
  cores: [
    C('GARIS', 'Persamaan garis batas', [
      S('Garis dari dua titik potong', ['Garis yang memotong sumbu x di (a, 0) dan sumbu y di (0, b) mempunyai persamaan **bx + ay = ab**.', 'Contoh: melalui (4, 0) dan (0, 3) ⇒ 3x + 4y = 12.'], [['melalui (a, 0) dan (0, b)', 'bx + ay = ab']]),
      S('Dari persamaan ke gambar', ['Untuk menggambar 2x + 5y = 10, cari titik potongnya: x = 0 ⇒ y = 2, y = 0 ⇒ x = 5. Hubungkan kedua titik.'], [['2x + 5y = 10', '(5, 0) dan (0, 2)']], 'Angka di depan x berpasangan dengan titik potong sumbu y, dan sebaliknya.'),
    ], [
      Q('Persamaan garis yang melalui titik (4, 0) dan (0, 3) adalah …', ['3x + 4y = 12', '4x + 3y = 12', '3x − 4y = 12', 'x + y = 7'], 0, 'Dengan a = 4 dan b = 3: bx + ay = ab ⇒ 3x + 4y = 12.', 1),
      Q('Persamaan garis yang melalui titik (0, 2) dan (5, 0) adalah …', ['5x + 2y = 10', '2x + 5y = 10', '2x − 5y = 10', 'x + y = 7'], 1, 'a = 5 dan b = 2: 2x + 5y = 10. Cek: (5, 0) ⇒ 10 ✓, (0, 2) ⇒ 10 ✓.'),
    ], { min: 4 }),
    C('IRISAN', 'Irisan kendala', [
      S('Daerah penyelesaian', ['Setiap pertidaksamaan membagi bidang menjadi dua. **Daerah penyelesaian sistem** adalah irisan semua daerah yang memenuhi.', 'Titik pojok daerah itu adalah titik potong garis-garis batas.'], [['titik pojok', 'perpotongan garis batas']]),
      S('Mencari titik potong', ['Selesaikan dua persamaan garis dengan eliminasi atau substitusi.', 'Contoh: x + y = 6 dan x − y = 2 ⇒ 2x = 8 ⇒ x = 4, y = 2.'], [['x + y = 6, x − y = 2', '(4, 2)']], 'Sebuah titik ada di daerah penyelesaian jika memenuhi semua pertidaksamaan sekaligus.'),
    ], [
      Q('Titik manakah yang memenuhi sistem x + y ≤ 6, x − y ≥ 0, x ≥ 0, y ≥ 0?', ['(4, 1)', '(1, 4)', '(5, 3)', '(0, 7)'], 0, '(4, 1): 4 + 1 = 5 ≤ 6 dan 4 − 1 = 3 ≥ 0. Titik lain melanggar salah satu kendala.'),
      Q('Titik potong garis x + y = 6 dan x − y = 2 adalah …', ['(4, 2)', '(2, 4)', '(3, 3)', '(6, 0)'], 0, 'Jumlahkan kedua persamaan: 2x = 8 ⇒ x = 4, lalu y = 2.', 1),
    ], { min: 4 }),
    C('BATAS', 'Batas terbuka & tertutup', [
      S('Garis penuh atau putus-putus', ['Tanda **≤ atau ≥**: titik pada garis termasuk penyelesaian, digambar **garis penuh**. Tanda **< atau >**: tidak termasuk, digambar **garis putus-putus**.'], [['≤, ≥', 'garis penuh'], ['<, >', 'garis putus-putus']]),
      S('Uji titik', ['Pilih titik yang tidak terletak pada garis, biasanya O(0, 0). Jika memenuhi, daerahnya memuat O; jika tidak, daerahnya di seberang.', 'Contoh: 3x + 2y ≥ 12 ⇒ 0 ≥ 12 salah, jadi daerahnya tidak memuat O.'], [['uji O(0, 0)', 'benar ⇒ daerah memuat O']], 'Jika garis melewati O, uji dengan titik lain seperti (1, 0).'),
    ], [
      Q('Daerah penyelesaian 2x + y < 8 dibatasi oleh garis …', ['penuh, titik pada garis termasuk', 'putus-putus, titik pada garis tidak termasuk', 'penuh, titik pada garis tidak termasuk', 'putus-putus, titik pada garis termasuk'], 1, 'Tanda < tidak memasukkan titik pada garis, sehingga garisnya digambar putus-putus.', 1),
      Q('Daerah penyelesaian 3x + 2y ≥ 12 adalah daerah …', ['yang memuat titik O(0, 0)', 'yang tidak memuat titik O(0, 0)', 'pada garisnya saja', 'seluruh bidang'], 1, 'Uji O: 3 · 0 + 2 · 0 = 0 ≥ 12 salah, jadi daerahnya tidak memuat O.'),
    ], { min: 4 }),
    C('MODEL', 'Variabel & model kendala', [
      S('Dari cerita ke model', ['Tentukan variabel (x dan y), tulis setiap batasan sebagai pertidaksamaan, dan tulis **fungsi objektif** yang dimaksimumkan atau diminimumkan.', 'Contoh: tiket dewasa Rp10.000 dan anak Rp5.000, uang paling banyak Rp200.000 ⇒ 10.000x + 5.000y ≤ 200.000 ⇒ 2x + y ≤ 40.'], [['kendala', '2x + y ≤ 40'], ['objektif', 'f(x, y) = px + qy']]),
      S('Uji titik pojok', ['Nilai optimum fungsi objektif selalu terjadi di **titik pojok** daerah penyelesaian. Hitung f di setiap titik pojok, lalu bandingkan.'], [['optimum', 'di titik pojok']], 'Sederhanakan kendala dengan membagi angka yang sama supaya titik potong mudah dicari.'),
    ], [
      Q('Pedagang menjual paling banyak 40 roti sehari: roti A paling banyak 30 dan roti B paling banyak 25. Laba roti A Rp2.000 dan roti B Rp3.000 per buah. Laba maksimum per hari adalah …', ['Rp90.000', 'Rp105.000', 'Rp120.000', 'Rp75.000'], 1, 'Titik pojok: (30, 0), (30, 10), (15, 25), (0, 25). Laba di (15, 25) = 30.000 + 75.000 = Rp105.000, terbesar.', 3),
      Q('Harga tiket dewasa Rp10.000 dan anak Rp5.000. Uang yang terkumpul tidak lebih dari Rp200.000. Jika x dewasa dan y anak, model yang tepat adalah …', ['2x + y ≤ 40', 'x + 2y ≤ 40', '2x + y ≥ 40', 'x + y ≤ 40'], 0, '10.000x + 5.000y ≤ 200.000, dibagi 5.000 menjadi 2x + y ≤ 40.', 2, 'SNBT'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['GARIS', 'IRISAN', 'S'], ['GARIS', 'BATAS', 'S'], ['IRISAN', 'MODEL', 'S']],
};

const STP: PilotTopic = {
  code: 'MAT.STP', subject: 'MAT', title: 'Statistika & Peluang', subtitle: 'Kuartil, box plot, histogram, diagram pencar', phase: 'E',
  bekal: ['rata-rata, median, modus', 'membaca tabel dan diagram'],
  cores: [
    C('KUARTIL', 'Kuartil dan IQR', [
      S('Membagi data menjadi empat', ['Urutkan data. **Q₂** adalah median. **Q₁** median bagian bawah, **Q₃** median bagian atas.', 'Contoh: 3, 5, 6, 7, 8, 9, 10, 12 ⇒ Q₂ = 7,5; Q₁ = 5,5; Q₃ = 9,5.'], [['Q₂', 'median']]),
      S('Jangkauan antarkuartil', ['**IQR = Q₃ − Q₁** mengukur sebaran 50% data di tengah. Tidak terpengaruh nilai ekstrem.', 'Dari contoh tadi: IQR = 9,5 − 5,5 = 4.'], [['IQR', 'Q₃ − Q₁']], 'Selalu urutkan data dulu; kesalahan paling sering adalah menghitung dari data acak.'),
    ], [
      Q('Jangkauan antarkuartil dari data 3, 5, 6, 7, 8, 9, 10, 12 adalah …', ['3', '4', '5', '9'], 1, 'Q₁ = (5 + 6)/2 = 5,5 dan Q₃ = (9 + 10)/2 = 9,5. IQR = 4.'),
      Q('Median dari data 4, 7, 2, 9, 5 adalah …', ['5', '7', '5,4', '4'], 0, 'Urutkan: 2, 4, 5, 7, 9. Nilai tengahnya 5.', 1),
    ], { min: 4 }),
    C('BOXPLOT', 'Membaca box plot', [
      S('Lima angka ringkasan', ['Box plot menampilkan **minimum, Q₁, median, Q₃, maksimum**. Kotak = Q₁ sampai Q₃, garis di dalam kotak = median.'], [['kotak', 'Q₁ sampai Q₃']]),
      S('Pencilan', ['Nilai disebut **pencilan** jika kurang dari Q₁ − 1,5·IQR atau lebih dari Q₃ + 1,5·IQR.', 'Contoh: Q₁ = 20, Q₃ = 30 ⇒ IQR = 10 ⇒ batas atas 45.'], [['batas atas', 'Q₃ + 1,5 · IQR'], ['batas bawah', 'Q₁ − 1,5 · IQR']], 'Panjang kotak = IQR, bukan jangkauan seluruh data.'),
    ], [
      Q('Sebuah box plot memiliki minimum 10, Q₁ = 20, median 25, Q₃ = 30, dan maksimum 50. Jangkauan antarkuartilnya adalah …', ['10', '40', '25', '5'], 0, 'IQR = Q₃ − Q₁ = 30 − 20 = 10.', 1),
      Q('Dari box plot yang sama (Q₁ = 20, Q₃ = 30), sebuah data termasuk pencilan atas jika nilainya lebih dari …', ['40', '45', '50', '35'], 1, 'Batas atas = Q₃ + 1,5 × IQR = 30 + 15 = 45.'),
    ], { min: 4 }),
    C('HISTOGRAM', 'Histogram & dot plot', [
      S('Rata-rata dari tabel frekuensi', ['Rata-rata = **Σ(f · x) / Σf**. Kalikan setiap nilai dengan frekuensinya, jumlahkan, lalu bagi banyak data.', 'Contoh: nilai 6 (3 siswa), 7 (5 siswa), 8 (2 siswa) ⇒ (18 + 35 + 16)/10 = 6,9.'], [['x̄', 'Σ(f · x) / Σf']]),
      S('Bentuk sebaran', ['Histogram **simetris**: rata-rata ≈ median. **Menceng ke kanan** (ekor panjang di kanan): rata-rata > median. Menceng ke kiri: rata-rata < median.'], [['menceng kanan', 'rata-rata > median']], 'Ekor menarik rata-rata ke arahnya; median lebih tahan.'),
    ], [
      Q('Nilai ulangan: 6 diperoleh 3 siswa, 7 diperoleh 5 siswa, dan 8 diperoleh 2 siswa. Rata-rata nilainya adalah …', ['6,9', '7', '7,1', '6,5'], 0, '(6 × 3 + 7 × 5 + 8 × 2)/10 = 69/10 = 6,9.', 1),
      Q('Histogram pendapatan warga menceng ke kanan (ekor panjang di sebelah kanan). Pernyataan yang paling tepat adalah …', ['rata-rata lebih kecil dari median', 'rata-rata lebih besar dari median', 'rata-rata sama dengan median', 'modus lebih besar dari rata-rata'], 1, 'Beberapa nilai sangat besar di ekor kanan menarik rata-rata ke atas, sehingga rata-rata > median.', 2, 'SNBT'),
    ], { min: 4 }),
    C('PENCAR', 'Diagram pencar', [
      S('Membaca hubungan', ['Diagram pencar memplot pasangan data (x, y). Titik naik dari kiri bawah ke kanan atas: **korelasi positif**. Turun: **korelasi negatif**. Tersebar acak: tidak ada korelasi.'], [['naik', 'korelasi positif'], ['turun', 'korelasi negatif']]),
      S('Korelasi bukan sebab-akibat', ['Dua besaran bisa naik bersama karena dipengaruhi faktor ketiga.', 'Contoh: penjualan es krim dan kasus tenggelam sama-sama naik di musim panas; penyebabnya cuaca, bukan es krim.'], [['korelasi', '≠ sebab-akibat']], 'Cari faktor ketiga sebelum menyimpulkan sebab-akibat.'),
    ], [
      Q('Diagram pencar jam belajar dan nilai ujian menunjukkan titik-titik naik dari kiri bawah ke kanan atas. Hubungan keduanya adalah …', ['korelasi negatif', 'korelasi positif', 'tidak ada korelasi', 'sebab-akibat pasti'], 1, 'Pola naik berarti nilai cenderung lebih tinggi saat jam belajar lebih banyak: korelasi positif.', 1),
      Q('Data menunjukkan penjualan es krim dan kasus tenggelam naik bersamaan. Penjelasan yang paling masuk akal adalah …', ['es krim menyebabkan tenggelam', 'tenggelam menyebabkan orang membeli es krim', 'keduanya dipengaruhi cuaca panas', 'data pasti salah'], 2, 'Korelasi tidak sama dengan sebab-akibat. Cuaca panas membuat orang membeli es krim dan berenang.', 2, 'SNBT'),
    ], { min: 4 }),
    C('KRITIS', 'Mengevaluasi laporan data', [
      S('Pertanyaan kritis', ['Siapa sampelnya? Apakah mewakili populasi? Apakah grafik memotong sumbu sehingga perbedaan tampak besar? Ukuran pemusatan apa yang dipakai?'], [['sampel bias', 'tidak mewakili populasi']]),
      S('Rata-rata atau median?', ['Bila ada pencilan, **median** lebih mewakili. Contoh gaji 4, 4, 5, 5, 32 juta: rata-rata 10 juta, padahal 4 dari 5 orang bergaji ≤ 5 juta. Median 5 juta lebih jujur.'], [['ada pencilan', 'pakai median']], 'Laporan yang hanya menyebut "rata-rata" patut dicek sebarannya.'),
    ], [
      Q('Sebuah survei kepuasan restoran hanya dilakukan pada pelanggan yang datang kembali. Kelemahan utama survei ini adalah …', ['jumlah responden terlalu banyak', 'sampelnya bias karena hanya pelanggan yang puas cenderung kembali', 'pertanyaannya terlalu sedikit', 'tidak memakai diagram'], 1, 'Pelanggan yang tidak puas jarang kembali, sehingga sampel tidak mewakili semua pelanggan.', 2, 'SNBT'),
      Q('Gaji lima karyawan (juta rupiah): 4, 4, 5, 5, 32. Ukuran pemusatan yang paling mewakili gaji karyawan adalah …', ['rata-rata, 10 juta', 'median, 5 juta', 'modus, 4 dan 5 juta', 'jangkauan, 28 juta'], 1, 'Gaji 32 juta adalah pencilan yang menarik rata-rata ke 10 juta. Median 5 juta lebih mewakili.', 2, 'SNBT'),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['KUARTIL', 'BOXPLOT', 'S'], ['HISTOGRAM', 'KRITIS', 'S'], ['PENCAR', 'KRITIS', 'S']],
};

const BNG: PilotTopic = {
  code: 'MAT.BNG', subject: 'MAT', title: 'Bunga Majemuk & Anuitas', subtitle: 'Matematika keuangan', phase: 'F',
  bekal: ['persen', 'barisan geometri', 'eksponen'],
  cores: [
    C('TUNGGAL', 'Bunga tunggal', [
      S('Bunga dari modal awal saja', ['Bunga tunggal dihitung dari **modal awal** setiap periode: **B = M · i · n**. Nilai akhir **Mₙ = M(1 + i·n)**.', 'Contoh: Rp2.000.000, 6% per tahun, 3 tahun ⇒ bunga Rp360.000, nilai akhir Rp2.360.000.'], [['B', 'M · i · n'], ['Mₙ', 'M(1 + i · n)']]),
      S('Samakan satuan waktu', ['Jika bunga per bulan dan waktu dalam bulan, langsung kalikan. Jika bunga per tahun dan waktu dalam bulan, ubah dulu: 8 bulan = 8/12 tahun.'], [['1% per bulan × 8 bulan', '8%']], 'Bunga tunggal bertambah sama besar setiap periode, seperti barisan aritmetika.'),
    ], [
      Q('Tabungan Rp2.000.000 mendapat bunga tunggal 6% per tahun. Besar tabungan setelah 3 tahun adalah …', ['Rp2.120.000', 'Rp2.360.000', 'Rp2.382.032', 'Rp2.600.000'], 1, 'Bunga = 2.000.000 × 0,06 × 3 = 360.000, jadi tabungan Rp2.360.000.', 1),
      Q('Pinjaman Rp5.000.000 dikenai bunga tunggal 1% per bulan. Total bunga selama 8 bulan adalah …', ['Rp40.000', 'Rp400.000', 'Rp500.000', 'Rp4.000.000'], 1, 'B = 5.000.000 × 0,01 × 8 = 400.000.', 1),
    ], { min: 4 }),
    C('MAJEMUK', 'Bunga majemuk', [
      S('Bunga berbunga', ['Pada bunga majemuk, bunga periode sebelumnya ikut berbunga: **Mₙ = M(1 + i)ⁿ**.', 'Contoh: Rp10.000.000, 10% per tahun, 2 tahun ⇒ 10.000.000 × 1,21 = Rp12.100.000.'], [['Mₙ', 'M(1 + i)ⁿ']]),
      S('Majemuk vs tunggal', ['Untuk modal, bunga, dan waktu yang sama (lebih dari satu periode), bunga majemuk selalu **lebih besar** karena bunga ikut berbunga.', 'Dari contoh tadi, bunga tunggal hanya memberi Rp12.000.000.'], [['tunggal', 'Mₙ = M(1 + in)'], ['majemuk', 'Mₙ = M(1 + i)ⁿ']], 'Bunga majemuk = barisan geometri dengan rasio (1 + i).'),
    ], [
      Q('Modal Rp10.000.000 dibungakan dengan bunga majemuk 10% per tahun. Besar modal setelah 2 tahun adalah …', ['Rp12.000.000', 'Rp12.100.000', 'Rp12.210.000', 'Rp11.000.000'], 1, '10.000.000 × (1,1)² = 10.000.000 × 1,21 = Rp12.100.000.'),
      Q('Dua tabungan bermodal sama, satu dengan bunga tunggal 10% dan satu dengan bunga majemuk 10% per tahun. Setelah 2 tahun, pernyataan yang benar adalah …', ['keduanya sama besar', 'bunga majemuk lebih besar', 'bunga tunggal lebih besar', 'tidak bisa dibandingkan'], 1, 'Pada tahun kedua, bunga majemuk juga menghitung bunga dari bunga tahun pertama, jadi hasilnya lebih besar.', 1, 'KM'),
    ], { min: 5 }),
    C('NILAI_KINI', 'Nilai kini & mendatang', [
      S('Nilai mendatang', ['**Nilai mendatang** (future value) adalah nilai uang di masa depan: **FV = PV(1 + i)ⁿ**.', 'Contoh: Rp4.000.000, 5% per tahun, 2 tahun ⇒ 4.000.000 × 1,1025 = Rp4.410.000.'], [['FV', 'PV(1 + i)ⁿ']]),
      S('Nilai kini', ['**Nilai kini** (present value) menjawab: berapa yang perlu ditabung sekarang? **PV = FV / (1 + i)ⁿ**.', 'Contoh: ingin Rp12.100.000 dalam 2 tahun dengan bunga 10% ⇒ PV = 12.100.000 / 1,21 = Rp10.000.000.'], [['PV', 'FV / (1 + i)ⁿ']], 'Nilai kini selalu lebih kecil dari nilai mendatang bila bunganya positif.'),
    ], [
      Q('Agar 2 tahun lagi memiliki Rp12.100.000 dengan bunga majemuk 10% per tahun, uang yang harus ditabung sekarang adalah …', ['Rp10.000.000', 'Rp10.100.000', 'Rp9.900.000', 'Rp11.000.000'], 0, 'PV = 12.100.000 / 1,1² = 12.100.000 / 1,21 = Rp10.000.000.'),
      Q('Nilai mendatang uang Rp4.000.000 dengan bunga majemuk 5% per tahun selama 2 tahun adalah …', ['Rp4.400.000', 'Rp4.410.000', 'Rp4.200.000', 'Rp4.420.000'], 1, '4.000.000 × 1,05² = 4.000.000 × 1,1025 = Rp4.410.000.'),
    ], { min: 5 }),
    C('ANUITAS', 'Pembayaran anuitas', [
      S('Angsuran tetap setiap periode', ['**Anuitas** adalah pembayaran tetap tiap periode yang terdiri dari **bunga + angsuran** (pelunasan pokok): A = bₙ + aₙ.', 'Bunga periode ke-n dihitung dari sisa pinjaman saat itu.'], [['A', 'bunga + angsuran']]),
      S('Contoh periode pertama', ['Pinjaman Rp10.000.000, bunga 2% per bulan, anuitas Rp1.000.000.', 'Bunga bulan pertama = 2% × 10.000.000 = Rp200.000, angsuran pertama = 1.000.000 − 200.000 = Rp800.000.'], [['a₁', 'A − i · M']], 'Bunga makin kecil setiap bulan, angsuran makin besar; jumlahnya tetap A.'),
    ], [
      Q('Besar anuitas sebuah pinjaman Rp500.000 per bulan. Bunga pada bulan pertama Rp200.000. Besar angsuran pertama adalah …', ['Rp200.000', 'Rp300.000', 'Rp500.000', 'Rp700.000'], 1, 'Angsuran = anuitas − bunga = 500.000 − 200.000 = Rp300.000.', 1),
      Q('Pinjaman Rp10.000.000 dilunasi dengan anuitas Rp1.000.000 per bulan dan bunga 2% per bulan. Besar angsuran pertama adalah …', ['Rp200.000', 'Rp800.000', 'Rp1.000.000', 'Rp1.200.000'], 1, 'Bunga pertama = 2% × 10.000.000 = 200.000; angsuran = 1.000.000 − 200.000 = Rp800.000.'),
    ], { min: 5 }),
    C('SALDO', 'Saldo pinjaman & parameter', [
      S('Sisa pinjaman', ['Setelah pembayaran ke-n, **sisa pinjaman = sisa sebelumnya − angsuran ke-n**.', 'Contoh: 10.000.000 − 800.000 = Rp9.200.000 setelah bulan pertama.'], [['sisa', 'Mₙ₋₁ − aₙ']]),
      S('Angsuran naik geometris', ['Pada anuitas, angsuran membentuk barisan geometri: **aₙ = a₁(1 + i)ⁿ⁻¹**.', 'Contoh: a₁ = Rp800.000, i = 2% ⇒ a₂ = 816.000.'], [['aₙ', 'a₁(1 + i)ⁿ⁻¹']], 'Bunga bulan kedua dihitung dari sisa pinjaman, bukan dari pinjaman awal.'),
    ], [
      Q('Pinjaman Rp10.000.000 dengan bunga 2% per bulan dilunasi dengan anuitas Rp1.000.000. Sisa pinjaman setelah pembayaran pertama adalah …', ['Rp9.000.000', 'Rp9.200.000', 'Rp9.800.000', 'Rp9.180.000'], 1, 'Angsuran pertama 800.000 (karena bunga 200.000), jadi sisa = 10.000.000 − 800.000 = Rp9.200.000.'),
      Q('Angsuran pertama sebuah anuitas Rp800.000 dengan bunga 2% per bulan. Besar angsuran kedua adalah …', ['Rp800.000', 'Rp816.000', 'Rp832.000', 'Rp784.000'], 1, 'a₂ = a₁ × (1 + i) = 800.000 × 1,02 = Rp816.000.', 3),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['TUNGGAL', 'MAJEMUK', 'S'], ['MAJEMUK', 'NILAI_KINI', 'S'], ['MAJEMUK', 'ANUITAS', 'S'], ['ANUITAS', 'SALDO', 'S']],
};

const INV: PilotTopic = {
  code: 'MAT.INV', subject: 'MAT', title: 'Fungsi Invers & Komposisi', subtitle: 'Domain, komposisi, invers, transformasi', phase: 'F',
  bekal: ['fungsi linear dan kuadrat', 'operasi aljabar'],
  cores: [
    C('DOMAIN', 'Domain, kodomain & range', [
      S('Domain alami', ['**Domain** adalah nilai x yang boleh dimasukkan. Dua larangan utama: bilangan di dalam akar kuadrat tidak boleh negatif, penyebut tidak boleh nol.', 'Contoh: f(x) = √(2x − 6) ⇒ 2x − 6 ≥ 0 ⇒ x ≥ 3.'], [['√g(x)', 'g(x) ≥ 0'], ['1/g(x)', 'g(x) ≠ 0']]),
      S('Range', ['**Range** adalah himpunan hasil f(x). Kodomain adalah himpunan tujuan yang disediakan; range bagian dari kodomain.', 'Contoh: f(x) = x² + 1 untuk x real ⇒ x² ≥ 0 ⇒ range y ≥ 1.'], [['x² + 1', 'range y ≥ 1']], 'Untuk range, pikirkan nilai terkecil dan terbesar yang bisa dicapai.'),
    ], [
      Q('Domain fungsi f(x) = √(2x − 6) adalah …', ['x ≥ 3', 'x > 3', 'x ≥ −3', 'x ≤ 3'], 0, '2x − 6 ≥ 0 ⇒ x ≥ 3. Nilai x = 3 boleh karena √0 = 0.', 1),
      Q('Range fungsi f(x) = x² + 1 untuk x bilangan real adalah …', ['y ≥ 0', 'y ≥ 1', 'y ≤ 1', 'semua bilangan real'], 1, 'x² paling kecil 0, jadi f(x) paling kecil 1: range y ≥ 1.'),
    ], { min: 4 }),
    C('KOMPOSISI', 'Komposisi fungsi', [
      S('Fungsi di dalam fungsi', ['**(f ∘ g)(x) = f(g(x))**: kerjakan g dulu, hasilnya dimasukkan ke f.', 'Contoh: f(x) = 2x + 1, g(x) = x² − 3 ⇒ (f ∘ g)(x) = 2(x² − 3) + 1 = 2x² − 5.'], [['(f ∘ g)(x)', 'f(g(x))']]),
      S('Urutan menentukan hasil', ['Umumnya **f ∘ g ≠ g ∘ f**. Untuk nilai tertentu, hitung dari dalam: (g ∘ f)(1) = g(f(1)) = g(3) = 6.'], [['(g ∘ f)(1)', 'g(f(1))']], 'Baca dari kanan ke kiri: fungsi paling kanan dikerjakan pertama.'),
    ], [
      Q('Diketahui f(x) = 2x + 1 dan g(x) = x² − 3. Fungsi (f ∘ g)(x) adalah …', ['2x² − 5', '2x² − 2', '4x² + 4x − 2', '2x² + 1'], 0, 'f(g(x)) = 2(x² − 3) + 1 = 2x² − 5.'),
      Q('Dengan f(x) = 2x + 1 dan g(x) = x² − 3, nilai (g ∘ f)(1) adalah …', ['6', '−1', '3', '9'], 0, 'f(1) = 3, lalu g(3) = 9 − 3 = 6.', 1),
    ], { min: 5 }),
    C('SATU_SATU', 'Fungsi satu-satu', [
      S('Satu hasil, satu asal', ['Fungsi **satu-satu** (injektif): setiap nilai y berasal dari paling banyak satu nilai x.', '**Uji garis horizontal**: jika setiap garis mendatar memotong grafik paling banyak sekali, fungsinya satu-satu.'], [['injektif', 'x₁ ≠ x₂ ⇒ f(x₁) ≠ f(x₂)']]),
      S('Membatasi domain', ['f(x) = x² tidak satu-satu karena f(2) = f(−2) = 4. Dengan domain **x ≥ 0**, f menjadi satu-satu.', 'Hanya fungsi satu-satu (pada domainnya) yang mempunyai invers berupa fungsi.'], [['x² pada x ≥ 0', 'satu-satu']], 'Fungsi linear dengan gradien tidak nol selalu satu-satu.'),
    ], [
      Q('Fungsi berikut yang merupakan fungsi satu-satu pada himpunan bilangan real adalah …', ['f(x) = x²', 'f(x) = |x|', 'f(x) = 2x + 3', 'f(x) = cos x'], 2, 'Fungsi linear 2x + 3 selalu naik, sehingga setiap y berasal dari tepat satu x. Fungsi lain memberi nilai sama untuk x berbeda.', 1),
      Q('Fungsi f(x) = x² dengan domain x ≥ 0 …', ['satu-satu, karena setiap y berasal dari satu x', 'bukan satu-satu, karena f(2) = f(−2)', 'bukan fungsi', 'satu-satu hanya untuk x bulat'], 0, 'Dengan domain x ≥ 0, nilai negatif tidak termasuk, sehingga setiap y ≥ 0 berasal dari satu x saja.'),
    ], { min: 4 }),
    C('INVERS', 'Menentukan & memeriksa invers', [
      S('Tukar peran x dan y', ['Tulis y = f(x), nyatakan x dalam y, lalu ganti y dengan x.', 'Contoh: y = 3x − 6 ⇒ x = (y + 6)/3 ⇒ f⁻¹(x) = (x + 6)/3.'], [['f⁻¹', 'balik operasi f']]),
      S('Fungsi pecahan dan pemeriksaan', ['Untuk f(x) = (ax + b)/(cx + d), inversnya **f⁻¹(x) = (−dx + b)/(cx − a)**.', 'Periksa: (f ∘ f⁻¹)(x) = x. Nilai f⁻¹(k) adalah x yang membuat f(x) = k.'], [['(ax + b)/(cx + d)', 'invers (−dx + b)/(cx − a)']], 'Untuk mencari f⁻¹(6), cukup selesaikan f(x) = 6.'),
    ], [
      Q('Invers dari f(x) = 3x − 6 adalah …', ['(x + 6)/3', '(x − 6)/3', '3x + 6', '(x + 3)/6'], 0, 'y = 3x − 6 ⇒ x = (y + 6)/3, jadi f⁻¹(x) = (x + 6)/3.', 1),
      Q('Diketahui f(x) = (2x + 1)/(x − 3), x ≠ 3. Invers fungsi f adalah f⁻¹(x) = …', ['(3x + 1)/(x − 2)', '(3x − 1)/(x + 2)', '(x + 3)/(2x − 1)', '(2x − 1)/(x + 3)'], 0, 'y(x − 3) = 2x + 1 ⇒ x(y − 2) = 3y + 1 ⇒ x = (3y + 1)/(y − 2).', 3),
      Q('Jika f(x) = 2x − 4, nilai f⁻¹(6) adalah …', ['8', '5', '1', '10'], 1, 'f⁻¹(6) adalah x yang memenuhi 2x − 4 = 6, yaitu x = 5.'),
    ], { min: 5 }),
    C('TRANSFORMASI', 'Transformasi fungsi', [
      S('Menggeser grafik', ['**y = f(x − h) + k** menggeser grafik f sejauh h ke kanan dan k ke atas.', 'Contoh: y = x² digeser 3 ke kanan dan 2 ke atas ⇒ y = (x − 3)² + 2.'], [['geser kanan h, atas k', 'y = f(x − h) + k']]),
      S('Mencerminkan dan meregangkan', ['**y = −f(x)**: cermin terhadap sumbu x. **y = f(−x)**: cermin terhadap sumbu y. **y = a · f(x)**: regang vertikal dengan faktor a.'], [['cermin sumbu x', 'y = −f(x)'], ['cermin sumbu y', 'y = f(−x)']], 'Geser ke kanan berarti x dikurangi, bukan ditambah.'),
    ], [
      Q('Grafik y = x² digeser 3 satuan ke kanan dan 2 satuan ke atas. Persamaan grafik hasilnya adalah …', ['y = (x − 3)² + 2', 'y = (x + 3)² + 2', 'y = (x − 2)² + 3', 'y = (x + 3)² − 2'], 0, 'Geser kanan 3: ganti x dengan x − 3. Geser atas 2: tambah 2.'),
      Q('Hasil pencerminan grafik y = f(x) terhadap sumbu x adalah …', ['y = f(−x)', 'y = −f(x)', 'y = f(x) − 1', 'y = −f(−x)'], 1, 'Cermin terhadap sumbu x membalik tanda setiap nilai y: y = −f(x).', 1),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['DOMAIN', 'KOMPOSISI', 'S'], ['DOMAIN', 'SATU_SATU', 'S'], ['SATU_SATU', 'INVERS', 'S'], ['DOMAIN', 'TRANSFORMASI', 'S']],
};

const LINGKARAN: PilotTopic = {
  code: 'MAT.CP25.F.LINGKARAN', subject: 'MAT', title: 'Hubungan Unsur Lingkaran', subtitle: 'Sudut pusat, sudut keliling, garis singgung', phase: 'F', alias: 'lingkaran',
  bekal: ['keliling dan luas lingkaran', 'Teorema Pythagoras'],
  cores: [
    C('UNSUR', 'Unsur & sudut lingkaran', [
      S('Nama-nama bagian', ['**Jari-jari** (r) dari pusat ke lingkaran, **diameter** = 2r, **tali busur** menghubungkan dua titik pada lingkaran, **busur** adalah bagian keliling, **juring** daerah antara dua jari-jari dan busur, **tembereng** daerah antara tali busur dan busur.'], [['diameter', '2r']]),
      S('Busur dan juring', ['Panjang busur dan luas juring sebanding dengan sudut pusatnya.', 'Contoh: sudut 90°, r = 14 cm, π = 22/7 ⇒ busur = 90/360 × 2 × 22/7 × 14 = 22 cm.'], [['panjang busur', '(α/360°) × 2πr'], ['luas juring', '(α/360°) × πr²']], 'Sederhanakan α/360 dulu (90/360 = 1/4) supaya hitungan ringan.'),
    ], [
      Q('Ruas garis yang menghubungkan dua titik pada lingkaran tetapi tidak melalui pusat disebut …', ['jari-jari', 'diameter', 'tali busur', 'apotema'], 2, 'Tali busur menghubungkan dua titik pada lingkaran. Jika melalui pusat, tali busur itu disebut diameter.', 1, 'KM'),
      Q('Panjang busur dengan sudut pusat 90° pada lingkaran berjari-jari 14 cm (π = 22/7) adalah …', ['11 cm', '22 cm', '44 cm', '88 cm'], 1, '90/360 × 2 × 22/7 × 14 = 1/4 × 88 = 22 cm.'),
    ], { min: 4 }),
    C('HUBUNGAN', 'Hubungan sudut dan busur', [
      S('Sudut pusat dan sudut keliling', ['Sudut keliling yang menghadap busur yang sama besarnya **setengah sudut pusat**.', 'Sudut keliling yang menghadap **diameter** selalu **90°**. Sudut-sudut keliling yang menghadap busur yang sama besarnya sama.'], [['sudut keliling', '½ × sudut pusat'], ['menghadap diameter', '90°']]),
      S('Segiempat tali busur', ['Segiempat yang keempat titik sudutnya pada lingkaran: **sudut yang berhadapan berjumlah 180°**.', 'Contoh: ∠A = 75° ⇒ ∠C = 105°.'], [['∠A + ∠C', '180°']], 'Tandai busur yang dihadap sudut; dua sudut yang menghadap busur sama saling terhubung.'),
    ], [
      Q('Besar sudut pusat AOB adalah 100°. Besar sudut keliling ACB yang menghadap busur AB adalah …', ['50°', '100°', '200°', '80°'], 0, 'Sudut keliling = ½ × sudut pusat = ½ × 100° = 50°.', 1),
      Q('ABCD adalah segiempat tali busur dengan ∠A = 75°. Besar ∠C adalah …', ['75°', '95°', '105°', '115°'], 2, 'Sudut berhadapan pada segiempat tali busur berjumlah 180°: ∠C = 180° − 75° = 105°.'),
    ], { min: 5 }),
    C('MASALAH', 'Masalah geometri lingkaran', [
      S('Garis singgung', ['Garis singgung **tegak lurus** jari-jari di titik singgungnya. Dari titik P di luar lingkaran: **panjang garis singgung = √(d² − r²)**, d = jarak P ke pusat.', 'Contoh: d = 13 cm, r = 5 cm ⇒ √(169 − 25) = 12 cm.'], [['garis singgung', '√(d² − r²)']]),
      S('Segitiga di dalam setengah lingkaran', ['Jika AB diameter dan C pada lingkaran, maka ∠ACB = 90°, sehingga Pythagoras berlaku: AB² = AC² + BC².', 'Contoh: AB = 10, AC = 6 ⇒ BC = 8.'], [['AB diameter', '∠ACB = 90°']], 'Sudut siku-siku tersembunyi di lingkaran sering menjadi kunci soal.'),
    ], [
      Q('Titik P berjarak 13 cm dari pusat lingkaran yang jari-jarinya 5 cm. Panjang garis singgung dari P ke lingkaran adalah …', ['8 cm', '12 cm', '18 cm', '√194 cm'], 1, 'Jari-jari tegak lurus garis singgung: √(13² − 5²) = √144 = 12 cm.'),
      Q('AB adalah diameter lingkaran dengan panjang 10 cm dan C terletak pada lingkaran. Jika AC = 6 cm, panjang BC adalah …', ['4 cm', '8 cm', '√136 cm', '16 cm'], 1, '∠ACB = 90° karena menghadap diameter, jadi BC = √(10² − 6²) = 8 cm.'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['UNSUR', 'HUBUNGAN', 'S'], ['HUBUNGAN', 'MASALAH', 'S']],
};

const PELUANG: PilotTopic = {
  code: 'MAT.CP25.F.PELUANG', subject: 'MAT', title: 'Peluang Majemuk & Bersyarat', subtitle: 'Kaidah pencacahan, kejadian majemuk, peluang bersyarat', phase: 'F', alias: 'peluang',
  bekal: ['peluang sederhana', 'pecahan'],
  cores: [
    C('CACAH', 'Permutasi dan kombinasi', [
      S('Urutan penting atau tidak?', ['**Permutasi** dipakai bila urutan penting (ketua, sekretaris, bendahara): **P(n, r) = n!/(n − r)!**.', '**Kombinasi** dipakai bila urutan tidak penting (memilih tim): **C(n, r) = n!/(r!(n − r)!)**.'], [['P(n, r)', 'n! / (n − r)!'], ['C(n, r)', 'n! / (r!(n − r)!)']]),
      S('Aturan perkalian', ['Jika langkah pertama punya m cara dan langkah kedua n cara, totalnya **m × n** cara.', 'Contoh: bilangan ganjil 3 angka berbeda dari 1–5: angka satuan 3 pilihan (1, 3, 5), lalu 4 dan 3 pilihan ⇒ 36.'], [['m langkah', 'kalikan banyak cara']], 'Isi dulu posisi yang punya syarat (misalnya angka satuan ganjil).'),
    ], [
      Q('Dari 5 siswa akan dipilih ketua, sekretaris, dan bendahara. Banyak susunan yang mungkin adalah …', ['10', '15', '60', '125'], 2, 'Urutan (jabatan) penting: P(5, 3) = 5 × 4 × 3 = 60.', 1),
      Q('Dari 8 siswa akan dipilih 3 siswa untuk mengikuti lomba (tanpa jabatan). Banyak cara memilih adalah …', ['24', '56', '336', '512'], 1, 'Urutan tidak penting: C(8, 3) = 8 × 7 × 6 / 6 = 56.'),
      Q('Dari angka 1, 2, 3, 4, 5 akan dibuat bilangan ganjil tiga angka dengan angka berbeda. Banyak bilangan yang dapat dibuat adalah …', ['24', '36', '48', '60'], 1, 'Satuan: 3 pilihan (1, 3, 5). Puluhan: 4 pilihan. Ratusan: 3 pilihan. Total 3 × 4 × 3 = 36.', 3),
    ], { min: 5 }),
    C('MAJEMUK', 'Kejadian majemuk & harapan', [
      S('Gabungan kejadian', ['**P(A ∪ B) = P(A) + P(B) − P(A ∩ B)**. Untuk kejadian **saling lepas** (tidak bisa terjadi bersamaan), P(A ∩ B) = 0.', 'Kejadian **saling bebas**: P(A ∩ B) = P(A) × P(B).'], [['P(A ∪ B)', 'P(A) + P(B) − P(A ∩ B)'], ['saling bebas', 'P(A ∩ B) = P(A)P(B)']]),
      S('Frekuensi harapan', ['Jika percobaan dilakukan n kali, kejadian A diharapkan muncul **Fₕ = n × P(A)** kali.', 'Contoh: dadu dilempar 120 kali, mata prima (2, 3, 5) peluangnya 1/2 ⇒ harapan 60 kali.'], [['Fₕ', 'n × P(A)']], 'Untuk dua dadu, buat tabel 6 × 6 supaya tidak ada pasangan yang terlewat.'),
    ], [
      Q('Dua dadu dilempar bersamaan. Peluang muncul jumlah mata 7 atau 11 adalah …', ['1/6', '2/9', '1/18', '7/36'], 1, 'Jumlah 7: 6 pasangan, jumlah 11: 2 pasangan. Saling lepas: (6 + 2)/36 = 8/36 = 2/9.'),
      Q('Sebuah dadu dilempar 120 kali. Frekuensi harapan muncul mata dadu bilangan prima adalah …', ['20 kali', '40 kali', '60 kali', '80 kali'], 2, 'Mata prima: 2, 3, 5, peluangnya 3/6 = 1/2. Fₕ = 120 × 1/2 = 60.', 1),
    ], { min: 5 }),
    C('BERSYARAT', 'Peluang bersyarat', [
      S('Peluang jika sudah diketahui sesuatu', ['**P(A | B) = P(A ∩ B) / P(B)**: peluang A jika B sudah pasti terjadi. Ruang sampelnya menyusut menjadi B.', 'Contoh: 15 siswa suka fisika, 10 di antaranya juga suka matematika ⇒ P(suka matematika | suka fisika) = 10/15 = 2/3.'], [['P(A | B)', 'P(A ∩ B) / P(B)']]),
      S('Tanpa pengembalian', ['Pada pengambilan **tanpa pengembalian**, peluang kedua bergantung pada hasil pertama.', 'Contoh: 5 merah dan 3 putih, ambil 2 berturut-turut ⇒ P(merah, merah) = 5/8 × 4/7 = 5/14.'], [['P(M₁ ∩ M₂)', '5/8 × 4/7']], 'Setelah satu bola diambil, isi kantong berkurang satu.'),
    ], [
      Q('Sebuah kantong berisi 5 bola merah dan 3 bola putih. Diambil 2 bola satu per satu tanpa pengembalian. Peluang terambil keduanya merah adalah …', ['5/14', '25/64', '5/8', '15/56'], 0, '5/8 × 4/7 = 20/56 = 5/14.'),
      Q('Dari 40 siswa, 25 suka matematika, 15 suka fisika, dan 10 suka keduanya. Seorang siswa yang suka fisika dipilih secara acak. Peluang ia juga suka matematika adalah …', ['1/4', '2/5', '2/3', '3/8'], 2, 'Ruang sampelnya 15 siswa yang suka fisika, 10 di antaranya suka matematika: 10/15 = 2/3.', 3, 'SNBT'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['CACAH', 'MAJEMUK', 'S'], ['MAJEMUK', 'BERSYARAT', 'H']],
};

const KAL: PilotTopic = {
  code: 'MAT.KAL', subject: 'MAT', title: 'Kalkulus Dasar', subtitle: 'Turunan, optimasi, dan integral', phase: 'F+',
  bekal: ['fungsi aljabar', 'gradien garis'],
  cores: [
    C('RATA_RATA', 'Laju perubahan rata-rata', [
      S('Gradien garis potong', ['Laju perubahan rata-rata f dari x = a sampai x = b adalah **(f(b) − f(a)) / (b − a)**, yaitu gradien garis yang menghubungkan dua titik grafik.', 'Contoh: f(x) = x² dari 1 ke 3 ⇒ (9 − 1)/2 = 4.'], [['laju rata-rata', '(f(b) − f(a)) / (b − a)']]),
      S('Kecepatan rata-rata', ['Jika s(t) adalah posisi, kecepatan rata-rata = perubahan posisi / selang waktu.', 'Contoh: s(t) = t² + 2t, dari t = 0 ke t = 2 ⇒ (8 − 0)/2 = 4 m/s.'], [['v rata-rata', 'Δs / Δt']], 'Hitung nilai fungsi di kedua ujung dulu, baru bagi.'),
    ], [
      Q('Laju perubahan rata-rata f(x) = x² dari x = 1 sampai x = 3 adalah …', ['2', '4', '8', '9'], 1, '(f(3) − f(1)) / (3 − 1) = (9 − 1)/2 = 4.', 1),
      Q('Posisi benda s(t) = t² + 2t meter. Kecepatan rata-ratanya dari t = 0 sampai t = 2 detik adalah …', ['2 m/s', '4 m/s', '6 m/s', '8 m/s'], 1, 's(2) = 8 dan s(0) = 0, jadi (8 − 0)/2 = 4 m/s.'),
    ], { min: 4 }),
    C('TURUNAN', 'Turunan sbg laju sesaat', [
      S('Dari rata-rata ke sesaat', ['Perkecil selangnya sampai h → 0: **f′(x) = lim (h→0) [f(x + h) − f(x)] / h**. Ini laju perubahan **sesaat**, yaitu gradien garis singgung.'], [['f′(x)', 'lim (h→0) [f(x + h) − f(x)] / h']]),
      S('Contoh limit', ['Untuk f(x) = x² di x = 2: [(2 + h)² − 4]/h = (4h + h²)/h = 4 + h → 4.', 'Kecepatan sesaat adalah turunan posisi: v(t) = s′(t).'], [['v(t)', 's′(t)']], 'Sederhanakan pembilang dulu sampai h bisa dicoret.'),
    ], [
      Q('Nilai lim (h→0) [(2 + h)² − 4] / h adalah …', ['0', '2', '4', 'tidak ada'], 2, '(4 + 4h + h² − 4)/h = 4 + h, yang menuju 4 saat h → 0.'),
      Q('Posisi benda s(t) = 5t² meter. Kecepatan benda pada t = 3 detik adalah …', ['15 m/s', '30 m/s', '45 m/s', '10 m/s'], 1, 'v(t) = s′(t) = 10t, jadi v(3) = 30 m/s.'),
    ], { min: 5 }),
    C('ATURAN', 'Aturan turunan fungsi', [
      S('Aturan pangkat', ['**(xⁿ)′ = n · xⁿ⁻¹**. Turunan konstanta = 0. Konstanta pengali ikut: (k · xⁿ)′ = k · n · xⁿ⁻¹. Turunan jumlah = jumlah turunan.', 'Contoh: (3x⁴ − 2x² + 5x − 7)′ = 12x³ − 4x + 5.'], [['(xⁿ)′', 'n · xⁿ⁻¹'], ['(k)′', '0']]),
      S('Jabarkan dulu', ['Bentuk seperti (2x − 1)² bisa dijabarkan menjadi 4x² − 4x + 1, lalu diturunkan: 8x − 4.', 'Nilai f′(2) = 16 − 4 = 12.'], [['((2x − 1)²)′', '8x − 4']], 'Turunan suku bx adalah b; konstanta hilang.'),
    ], [
      Q('Turunan pertama f(x) = 3x⁴ − 2x² + 5x − 7 adalah …', ['12x³ − 4x + 5', '12x³ − 4x − 7', '3x³ − 2x + 5', '12x⁴ − 4x² + 5x'], 0, 'Turunkan per suku: 12x³ − 4x + 5. Konstanta −7 hilang.', 1),
      Q('Jika f(x) = (2x − 1)², nilai f′(2) adalah …', ['6', '9', '12', '16'], 2, 'f(x) = 4x² − 4x + 1, f′(x) = 8x − 4, jadi f′(2) = 12.'),
    ], { min: 5 }),
    C('OPTIMASI', 'Garis singgung & optimasi', [
      S('Persamaan garis singgung', ['Gradien garis singgung di x = a adalah **m = f′(a)**. Persamaannya **y − f(a) = m(x − a)**.', 'Contoh: y = x² − 3x di (2, −2): m = 2·2 − 3 = 1 ⇒ y = x − 4.'], [['m', 'f′(a)'], ['garis singgung', 'y − f(a) = m(x − a)']]),
      S('Titik stasioner', ['Nilai maksimum atau minimum terjadi saat **f′(x) = 0**.', 'Contoh: f(x) = −x² + 6x − 5 ⇒ f′(x) = −2x + 6 = 0 ⇒ x = 3 ⇒ f(3) = 4 (maksimum).'], [['stasioner', 'f′(x) = 0']], 'Cari x dari f′(x) = 0, lalu nilai optimumnya f(x), bukan x.'),
    ], [
      Q('Persamaan garis singgung kurva y = x² − 3x di titik (2, −2) adalah …', ['y = x − 4', 'y = x + 4', 'y = −x', 'y = 2x − 6'], 0, 'y′ = 2x − 3, di x = 2 gradiennya 1. y + 2 = 1(x − 2) ⇒ y = x − 4.'),
      Q('Nilai maksimum fungsi f(x) = −x² + 6x − 5 adalah …', ['3', '4', '5', '9'], 1, 'f′(x) = −2x + 6 = 0 ⇒ x = 3, f(3) = −9 + 18 − 5 = 4.'),
    ], { min: 6 }),
    C('ANTITURUNAN', 'Antiturunan & konstanta', [
      S('Membalik turunan', ['Antiturunan (integral tak tentu): **∫xⁿ dx = xⁿ⁺¹/(n + 1) + C**, n ≠ −1.', 'Contoh: ∫(6x² − 4x + 3) dx = 2x³ − 2x² + 3x + C.'], [['∫xⁿ dx', 'xⁿ⁺¹/(n + 1) + C']]),
      S('Mencari konstanta C', ['C ditentukan dari satu nilai yang diketahui.', 'Contoh: F′(x) = 2x + 1 dan F(1) = 5 ⇒ F(x) = x² + x + C ⇒ 2 + C = 5 ⇒ C = 3.'], [['F(x)', 'x² + x + 3']], 'Cek jawaban dengan menurunkannya kembali.'),
    ], [
      Q('Hasil dari ∫(6x² − 4x + 3) dx adalah …', ['2x³ − 2x² + 3x + C', '12x − 4 + C', '6x³ − 4x² + 3x + C', '3x³ − 2x² + 3 + C'], 0, '∫6x² dx = 2x³, ∫4x dx = 2x², ∫3 dx = 3x. Jadi 2x³ − 2x² + 3x + C.', 1),
      Q('Diketahui F′(x) = 2x + 1 dan F(1) = 5. Fungsi F(x) adalah …', ['x² + x + 3', 'x² + x + 5', 'x² + x', '2x² + x + 2'], 0, 'F(x) = x² + x + C, F(1) = 2 + C = 5 ⇒ C = 3.'),
    ], { min: 5 }),
    C('INTEGRAL', 'Integral tentu dan luas', [
      S('Integral tentu', ['**∫ₐᵇ f(x) dx = F(b) − F(a)**, dengan F antiturunan f. Konstanta C saling menghapus.', 'Contoh: ∫₁³ 2x dx = [x²]₁³ = 9 − 1 = 8.'], [['∫ₐᵇ f(x) dx', 'F(b) − F(a)']]),
      S('Luas di bawah kurva', ['Jika f(x) ≥ 0 pada [a, b], integral tentu sama dengan **luas** daerah di antara kurva dan sumbu x.', 'Contoh: luas di bawah y = x² dari 0 sampai 3 = [x³/3]₀³ = 9.'], [['luas', '∫ₐᵇ f(x) dx (f ≥ 0)']], 'Bila kurva di bawah sumbu x, ambil nilai mutlaknya untuk luas.'),
    ], [
      Q('Nilai ∫₁³ 2x dx adalah …', ['4', '6', '8', '9'], 2, '[x²] dari 1 sampai 3 = 9 − 1 = 8.', 1),
      Q('Luas daerah yang dibatasi kurva y = x², sumbu x, garis x = 0, dan x = 3 adalah …', ['3 satuan luas', '6 satuan luas', '9 satuan luas', '27 satuan luas'], 2, '∫₀³ x² dx = [x³/3]₀³ = 27/3 = 9.'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['RATA_RATA', 'TURUNAN', 'S'], ['TURUNAN', 'ATURAN', 'S'], ['ATURAN', 'OPTIMASI', 'S'], ['ATURAN', 'ANTITURUNAN', 'S'], ['ANTITURUNAN', 'INTEGRAL', 'S']],
};

const MTX: PilotTopic = {
  code: 'MAT.MTX', subject: 'MAT', title: 'Matriks', subtitle: 'Operasi, determinan, invers, transformasi', phase: 'F',
  bekal: ['sistem persamaan linear', 'koordinat Kartesius'],
  cores: [
    C('ORDO', 'Elemen, ordo & kesamaan', [
      S('Baris kali kolom', ['Matriks adalah susunan bilangan dalam baris dan kolom. **Ordo m × n**: m baris, n kolom. Di sini matriks ditulis per baris: [1 2 3; 4 5 6] punya 2 baris dan 3 kolom.'], [['ordo', 'baris × kolom']]),
      S('Kesamaan matriks', ['Dua matriks sama jika ordonya sama dan **setiap elemen seletak sama**.', 'Contoh: [x + 1  4; 2  y] = [3  4; 2  5] ⇒ x = 2, y = 5.'], [['A = B', 'aᵢⱼ = bᵢⱼ']], 'Baris disebut dulu, baru kolom.'),
    ], [
      Q('Matriks [1 2 3; 4 5 6] berordo …', ['3 × 2', '2 × 3', '6 × 1', '2 × 2'], 1, 'Ada 2 baris dan 3 kolom, jadi ordonya 2 × 3.', 1),
      Q('Diketahui [x + 1  4; 2  y] = [3  4; 2  5]. Nilai x + y adalah …', ['5', '6', '7', '8'], 2, 'x + 1 = 3 ⇒ x = 2 dan y = 5, jadi x + y = 7.'),
    ], { min: 4 }),
    C('TRANSPOSE', 'Jenis matriks & transpose', [
      S('Transpose', ['**Aᵀ** dibuat dengan menukar baris menjadi kolom. Contoh: A = [1 2; 3 4] ⇒ Aᵀ = [1 3; 2 4].'], [['(Aᵀ)ᵢⱼ', 'aⱼᵢ']]),
      S('Jenis-jenis matriks', ['**Persegi**: banyak baris = banyak kolom. **Identitas** I: diagonal utama 1, lainnya 0, misalnya [1 0; 0 1]. **Nol**: semua elemen 0.'], [['I (2 × 2)', '[1 0; 0 1]']], 'A · I = I · A = A, seperti mengalikan bilangan dengan 1.'),
    ], [
      Q('Transpose dari A = [1 2; 3 4] adalah …', ['[1 3; 2 4]', '[4 3; 2 1]', '[2 1; 4 3]', '[1 2; 3 4]'], 0, 'Baris pertama (1, 2) menjadi kolom pertama, baris kedua (3, 4) menjadi kolom kedua.', 1),
      Q('Matriks identitas berordo 2 × 2 adalah …', ['[1 1; 1 1]', '[0 1; 1 0]', '[1 0; 0 1]', '[0 0; 0 0]'], 2, 'Matriks identitas memiliki 1 pada diagonal utama dan 0 di tempat lain.', 1),
    ], { min: 4 }),
    C('OPERASI', 'Penjumlahan & skalar', [
      S('Jumlah elemen seletak', ['Dua matriks berordo sama dijumlah dengan menjumlahkan **elemen yang seletak**.', 'Contoh: [2 −1; 0 3] + [1 4; 5 −2] = [3 3; 5 1].'], [['(A + B)ᵢⱼ', 'aᵢⱼ + bᵢⱼ']]),
      S('Perkalian dengan skalar', ['**kA** mengalikan setiap elemen dengan k. Contoh: 3 · [1 −2; 0 4] = [3 −6; 0 12].'], [['(kA)ᵢⱼ', 'k · aᵢⱼ']], 'Matriks dengan ordo berbeda tidak dapat dijumlahkan.'),
    ], [
      Q('Hasil dari [2 −1; 0 3] + [1 4; 5 −2] adalah …', ['[3 3; 5 1]', '[3 −5; 5 1]', '[1 −5; −5 5]', '[3 3; 5 5]'], 0, 'Jumlahkan elemen seletak: [2+1  −1+4; 0+5  3−2] = [3 3; 5 1].', 1),
      Q('Hasil dari 3 · [1 −2; 0 4] adalah …', ['[3 −6; 0 12]', '[3 −2; 0 4]', '[4 1; 3 7]', '[3 6; 0 12]'], 0, 'Setiap elemen dikali 3: [3 −6; 0 12].', 1),
    ], { min: 4 }),
    C('KALI', 'Perkalian matriks', [
      S('Baris kali kolom', ['Elemen baris i kolom j dari AB = **baris i dari A dikali kolom j dari B** (kalikan pasangan lalu jumlahkan).', 'Contoh: [1 2; 3 4] · [2; 1] = [1·2 + 2·1; 3·2 + 4·1] = [4; 10].'], [['(AB)ᵢⱼ', 'baris i · kolom j']]),
      S('Syarat dan ordo hasil', ['AB terdefinisi jika **kolom A = baris B**. Ordo (m × n)(n × p) menghasilkan **m × p**.', 'Umumnya **AB ≠ BA**.'], [['(m × n)(n × p)', 'm × p']], 'Tulis ordo kedua matriks berdampingan: angka tengah harus sama.'),
    ], [
      Q('Hasil dari [1 2; 3 4] · [2; 1] adalah …', ['[4; 10]', '[2; 6]', '[5; 7]', '[4 10]'], 0, 'Baris 1: 1·2 + 2·1 = 4. Baris 2: 3·2 + 4·1 = 10.', 1),
      Q('Hasil dari [1 2; 0 1] · [3 0; 1 2] adalah …', ['[5 4; 1 2]', '[3 0; 0 2]', '[3 6; 1 4]', '[5 2; 1 2]'], 0, 'Baris 1: (1·3 + 2·1, 1·0 + 2·2) = (5, 4). Baris 2: (0·3 + 1·1, 0·0 + 1·2) = (1, 2).'),
      Q('Matriks A berordo 2 × 3 dan B berordo 3 × 4. Ordo matriks AB adalah …', ['3 × 3', '2 × 4', '4 × 2', 'tidak terdefinisi'], 1, '(2 × 3)(3 × 4): angka tengah sama, hasilnya 2 × 4.', 1),
    ], { min: 5 }),
    C('DETERMINAN', 'Determinan matriks 2×2', [
      S('ad − bc', ['Untuk A = [a b; c d]: **det A = ad − bc** (diagonal utama dikurangi diagonal samping).', 'Contoh: det [5 3; 2 4] = 20 − 6 = 14.'], [['det [a b; c d]', 'ad − bc']]),
      S('Matriks singular', ['Matriks dengan **determinan 0** disebut singular dan **tidak punya invers**.', 'Contoh: [x 4; 3 6] singular ⇒ 6x − 12 = 0 ⇒ x = 2.'], [['singular', 'det A = 0']], 'Determinan juga menyatakan faktor perubahan luas pada transformasi.'),
    ], [
      Q('Determinan matriks [5 3; 2 4] adalah …', ['14', '26', '2', '−14'], 0, 'det = 5 · 4 − 3 · 2 = 20 − 6 = 14.', 1),
      Q('Matriks [x 4; 3 6] merupakan matriks singular. Nilai x adalah …', ['2', '3', '4', '8'], 0, 'Singular berarti det = 0: 6x − 12 = 0, jadi x = 2.'),
    ], { min: 4 }),
    C('INVERS', 'Invers matriks 2×2', [
      S('Rumus invers', ['**A⁻¹ = 1/(ad − bc) · [d −b; −c a]**: tukar elemen diagonal utama, ubah tanda diagonal samping, bagi dengan determinan.', 'Contoh: A = [4 3; 1 1], det = 1 ⇒ A⁻¹ = [1 −3; −1 4].'], [['A⁻¹', '1/(ad − bc) · [d −b; −c a]']]),
      S('Menyelesaikan AX = B', ['Kalikan kedua ruas dari kiri dengan A⁻¹: **X = A⁻¹B**.', 'Contoh: A = [2 1; 1 1], B = [5; 3] ⇒ A⁻¹ = [1 −1; −1 2] ⇒ X = [2; 1].'], [['AX = B', 'X = A⁻¹B'], ['XA = B', 'X = BA⁻¹']], 'Cek: A · A⁻¹ harus menghasilkan matriks identitas.'),
    ], [
      Q('Invers matriks [4 3; 1 1] adalah …', ['[1 −3; −1 4]', '[1 3; 1 4]', '[−1 3; 1 −4]', '[4 −3; −1 1]'], 0, 'det = 4 − 3 = 1. Tukar 4 dan 1, ubah tanda 3 dan 1: [1 −3; −1 4].'),
      Q('Diketahui A = [2 1; 1 1] dan B = [5; 3]. Matriks X yang memenuhi AX = B adalah …', ['[2; 1]', '[1; 2]', '[3; −1]', '[8; 1]'], 0, 'A⁻¹ = [1 −1; −1 2], X = A⁻¹B = [5 − 3; −5 + 6] = [2; 1]. Cek: 2·2 + 1 = 5 dan 2 + 1 = 3.', 3),
    ], { min: 5 }),
    C('TRANSFORMASI', 'Matriks transformasi geometri', [
      S('Transformasi sebagai perkalian', ['Bayangan titik (x, y) oleh matriks M adalah **M · [x; y]**.', 'Pencerminan terhadap sumbu x: [1 0; 0 −1]. Terhadap sumbu y: [−1 0; 0 1]. Dilatasi faktor k: [k 0; 0 k].'], [['cermin sumbu x', '[1 0; 0 −1]'], ['dilatasi k', '[k 0; 0 k]']]),
      S('Rotasi', ['Rotasi 90° berlawanan arah jarum jam terhadap O: **[0 −1; 1 0]**, sehingga (x, y) → (−y, x).', 'Contoh: (2, 5) → (−5, 2).'], [['rotasi 90°', '(x, y) → (−y, x)']], 'Uji matriks dengan titik (1, 0) untuk memastikan arahnya benar.'),
    ], [
      Q('Bayangan titik (3, 2) oleh pencerminan terhadap sumbu x adalah …', ['(3, −2)', '(−3, 2)', '(2, 3)', '(−3, −2)'], 0, 'Cermin sumbu x: x tetap, y berubah tanda. Bayangannya (3, −2).', 1),
      Q('Bayangan titik (2, 5) oleh rotasi 90° berlawanan arah jarum jam dengan pusat O adalah …', ['(5, −2)', '(−5, 2)', '(−2, −5)', '(5, 2)'], 1, 'Rotasi 90°: (x, y) → (−y, x), jadi (2, 5) → (−5, 2).'),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['ORDO', 'TRANSPOSE', 'S'], ['ORDO', 'OPERASI', 'S'], ['OPERASI', 'KALI', 'S'], ['ORDO', 'DETERMINAN', 'S'], ['DETERMINAN', 'INVERS', 'S'], ['KALI', 'TRANSFORMASI', 'S']],
};

export const MAT_TOPICS: PilotTopic[] = [KUA, SPL, STP, BNG, INV, LINGKARAN, PELUANG, KAL, MTX];
export const MAT_RELATIONS: PilotRelation[] = [
  { from: 'MAT.EKS', to: 'MAT.BNG', kind: 'REQUIRES', label: 'eksponen → bunga majemuk' },
  { from: 'MAT.INV', to: 'MAT.KAL', kind: 'REQUIRES', label: 'komposisi fungsi → kalkulus' },
  { from: 'MAT.STP', to: 'MAT.CP25.F.PELUANG', kind: 'REQUIRES', label: 'data dan peluang → peluang bersyarat' },
  { from: 'MAT.KUA', to: 'MAT.KAL', kind: 'RELATED', label: 'titik puncak ↔ turunan sama dengan nol' },
];
