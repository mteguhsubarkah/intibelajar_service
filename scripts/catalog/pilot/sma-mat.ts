import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Matematika SMA untuk inti PLANNED dari audit kesenjangan materi: Fase E/F (prioritas 2) dan
// Matematika Tingkat Lanjut F+ (distribusi, irisan kerucut).
// Kunci = "KODE_TOPIK:ID_INTI" di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): Content => ({ slides, q, min });

export const SMA_MAT: Record<string, Content> = {
  // ---------- Sistem persamaan linear tiga variabel ----------
  'MAT.C26.E.SPLTV:C1': K([
    S('Tiga besaran, tiga persamaan', ['SPLTV terdiri dari tiga persamaan linear dengan tiga variabel, misalnya x, y, dan z. Bentuk umumnya **ax + by + cz = d**.', 'Untuk memodelkan masalah, tentukan dulu apa yang dilambangkan x, y, dan z (lengkap dengan satuannya), lalu ubah setiap informasi menjadi satu persamaan.'], [['bentuk umum', 'ax + by + cz = d']]),
    S('Contoh pemodelan', ['Harga 2 buku, 1 pensil, dan 1 penghapus Rp13.000; 1 buku, 2 pensil, dan 1 penghapus Rp11.000; 1 buku, 1 pensil, dan 2 penghapus Rp10.000.', 'Misalkan x = harga buku, y = harga pensil, z = harga penghapus: 2x + y + z = 13.000, x + 2y + z = 11.000, x + y + 2z = 10.000.'], [['x, y, z', 'harga buku, pensil, penghapus']], 'Satu kalimat informasi biasanya menjadi satu persamaan. Tiga variabel butuh tiga persamaan yang tidak saling bergantung.'),
  ], [
    Q('Ani membeli 2 kg apel, 1 kg jeruk, dan 1 kg mangga seharga Rp95.000. Jika x, y, dan z berturut-turut harga per kg apel, jeruk, dan mangga, persamaan yang tepat adalah …', ['2x + y + z = 95.000', 'x + 2y + z = 95.000', '2x + 2y + z = 95.000', 'x + y + z = 95.000'], 0, 'Setiap banyak kilogram dikalikan harga per kilogramnya: 2x + 1y + 1z = 95.000.', 1),
    Q('Jumlah tiga bilangan adalah 30. Bilangan pertama dua kali bilangan kedua, dan bilangan ketiga 6 lebih dari bilangan kedua. Jika ketiga bilangan itu x, y, dan z, sistem persamaan yang tepat adalah …', ['x + y + z = 30, x = 2y, z = y + 6', 'x + y + z = 30, y = 2x, z = y + 6', 'x + y + z = 30, x = 2y, y = z + 6', 'x + y + z = 30, x = y + 2, z = 6y'], 0, '"Bilangan pertama dua kali bilangan kedua" berarti x = 2y, dan "ketiga 6 lebih dari kedua" berarti z = y + 6.'),
    Q('Agar nilai tiga variabel dapat ditentukan tunggal, SPLTV umumnya memerlukan …', ['tiga persamaan yang tidak saling bergantung', 'dua persamaan saja', 'satu persamaan dengan tiga variabel', 'tiga persamaan yang sama'], 0, 'Tiga nilai yang belum diketahui hanya bisa ditentukan jika ada tiga informasi berbeda, bukan kelipatan satu sama lain.', 1),
  ], 4),
  'MAT.C26.E.SPLTV:C2': K([
    S('Dari tiga variabel ke dua', ['Pilih satu variabel, misalnya z. Eliminasi z dari persamaan (1) dan (2), lalu dari (1) dan (3). Hasilnya dua persamaan yang hanya memuat x dan y (SPLDV).'], [['langkah 1', 'eliminasi satu variabel dua kali']]),
    S('Selesaikan, lalu substitusi balik', ['Selesaikan SPLDV untuk x dan y, lalu substitusikan ke salah satu persamaan awal untuk mendapat z.', 'Contoh: x + y + z = 6, x − y + z = 2, 2x + y − z = 1. Kurangkan dua persamaan pertama: 2y = 4, jadi y = 2. Lalu x + z = 4 dan 2x − z = −1, sehingga 3x = 3, x = 1, dan z = 3.'], [['contoh', '(x, y, z) = (1, 2, 3)']], 'Pilih variabel yang koefisiennya paling mudah disamakan, misalnya yang sudah 1 atau −1.'),
  ], [
    Q('Penyelesaian sistem x + y + z = 9, x − y = 1, dan y − z = 1 adalah …', ['(4, 3, 2)', '(3, 4, 2)', '(2, 3, 4)', '(5, 3, 1)'], 0, 'Dari x = y + 1 dan z = y − 1, persamaan pertama menjadi 3y = 9, jadi y = 3, x = 4, dan z = 2.'),
    Q('Dari sistem 2x + y − z = 3 dan x − y + z = 0, menjumlahkan kedua persamaan menghasilkan …', ['3x = 3', '3x + 2z = 3', 'x + 2y = 3', '3x − 2y = 3'], 0, 'y dan −y saling menghilang, begitu juga −z dan z, sehingga tersisa 3x = 3.', 1),
    Q('Harga satu tiket dewasa, satu tiket remaja, dan satu tiket anak seluruhnya Rp60.000. Tiket dewasa Rp10.000 lebih mahal daripada tiket remaja, dan tiket remaja Rp10.000 lebih mahal daripada tiket anak. Harga tiket anak adalah …', ['Rp10.000', 'Rp20.000', 'Rp30.000', 'Rp15.000'], 0, 'Tulis semuanya dalam harga tiket anak a: a + (a + 10.000) + (a + 20.000) = 60.000, jadi 3a = 30.000 dan a = Rp10.000.'),
  ]),
  'MAT.C26.E.SPLTV:SOLUSI': K([
    S('Memeriksa solusi', ['Solusi SPLTV adalah tripel terurut (x, y, z) yang memenuhi **ketiga** persamaan sekaligus.', 'Selalu substitusikan kembali ke ketiga persamaan awal. Satu persamaan yang tidak terpenuhi berarti ada salah hitung.'], [['himpunan solusi', '{(x, y, z)}']]),
    S('Banyaknya solusi dan maknanya', ['SPLTV bisa punya satu solusi, tak hingga banyak solusi (ada persamaan yang merupakan gabungan persamaan lain), atau tidak punya solusi (persamaannya saling bertentangan).', 'Dalam konteks, periksa kewajarannya: harga, banyak barang, atau umur tidak boleh negatif, dan banyak barang harus bilangan bulat.'], [['tidak ada solusi', 'muncul pernyataan salah, mis. 0 = 5']], 'Jawaban akhir ditulis dalam bahasa soal, misalnya "harga satu buku Rp4.500", bukan hanya x = 4.500.'),
  ], [
    Q('Tripel yang merupakan solusi sistem x + y + z = 6, x + 2y − z = 2, dan 2x − y + z = 3 adalah …', ['(1, 2, 3)', '(2, 1, 3)', '(3, 2, 1)', '(1, 3, 2)'], 0, 'Substitusikan setiap pilihan ke ketiga persamaan. Hanya (1, 2, 3) yang menghasilkan 6, 2, dan 3.'),
    Q('Saat menyelesaikan sebuah SPLTV, diperoleh 0x + 0y + 0z = 4. Artinya sistem tersebut …', ['tidak memiliki solusi', 'memiliki tepat satu solusi', 'memiliki tak hingga banyak solusi', 'memiliki solusi (0, 0, 0)'], 0, 'Tidak ada nilai x, y, dan z yang membuat 0 = 4, jadi persamaannya saling bertentangan.'),
    Q('Model SPLTV untuk banyak tiga jenis kue menghasilkan x = 12, y = −3, dan z = 8. Kesimpulan yang tepat adalah …', ['ada kesalahan model atau hitungan, karena banyak kue tidak mungkin negatif', 'banyak kue jenis kedua adalah 3', 'solusinya pasti benar karena memenuhi persamaan', 'y cukup dibulatkan menjadi 0'], 0, 'Dalam konteks banyak barang, nilai negatif tidak masuk akal. Model dan hitungannya perlu diperiksa lagi.'),
  ]),
  // ---------- Statistika dua variabel ----------
  'MAT.C26.F.REGRESI:C1': K([
    S('Arah dan kekuatan hubungan', ['Koefisien korelasi **r** mengukur hubungan **linear** dua variabel, nilainya −1 ≤ r ≤ 1.', 'r positif: kedua variabel cenderung naik bersama. r negatif: satu naik, yang lain turun. Makin dekat |r| ke 1, titik-titik makin rapat ke sebuah garis.'], [['rentang', '−1 ≤ r ≤ 1'], ['r ≈ 0', 'tidak ada hubungan linear']]),
    S('Membaca diagram pencar', ['Titik yang naik ke kanan dan rapat → r mendekati 1. Titik yang turun ke kanan dan rapat → r mendekati −1. Titik tersebar tanpa pola → r mendekati 0.', 'r ≈ 0 tidak berarti tidak ada hubungan sama sekali; hubungannya bisa saja melengkung, bukan garis lurus.'], [['kuat', '|r| mendekati 1']], 'Tanda r menunjukkan arah, besar |r| menunjukkan kekuatan. r = −0,9 lebih kuat daripada r = 0,5.'),
  ], [
    Q('Nilai koefisien korelasi yang menunjukkan hubungan linear paling kuat adalah …', ['−0,92', '0,75', '0,10', '−0,40'], 0, 'Kekuatan dilihat dari |r|, dan |−0,92| = 0,92 paling dekat ke 1.', 1),
    Q('Data lama belajar dan banyak kesalahan ujian menunjukkan: makin lama belajar, makin sedikit kesalahan, dengan pola hampir lurus. Nilai r yang paling mungkin adalah …', ['−0,85', '0,85', '0', '1,3'], 0, 'Satu variabel naik ketika yang lain turun, jadi r negatif; pola yang hampir lurus berarti |r| besar. Nilai 1,3 tidak mungkin.'),
    Q('Diagram pencar membentuk lengkungan seperti huruf U dan r ≈ 0. Kesimpulan yang tepat adalah …', ['tidak ada hubungan linear, tetapi bisa ada hubungan tak linear', 'kedua variabel pasti tidak berhubungan', 'korelasinya sangat kuat', 'r salah hitung karena seharusnya negatif'], 0, 'r hanya mengukur hubungan garis lurus, sedangkan pola U menunjukkan hubungan yang melengkung.'),
  ], 4),
  'MAT.C26.F.REGRESI:C2': K([
    S('Garis kecocokan terbaik', ['Garis regresi **ŷ = a + bx** adalah garis yang paling dekat dengan titik-titik data (metode kuadrat terkecil).', 'b adalah gradien: perubahan rata-rata y untuk setiap kenaikan x sebesar 1 satuan. a adalah nilai ŷ saat x = 0.'], [['garis regresi', 'ŷ = a + bx'], ['gradien b', 'perubahan ŷ per satuan x']]),
    S('Garis melewati titik rata-rata', ['Garis regresi selalu melewati titik (x̄, ȳ). Jadi jika b diketahui, a = ȳ − b · x̄.', 'Contoh: x̄ = 4, ȳ = 20, dan b = 3, maka a = 20 − 12 = 8 dan ŷ = 8 + 3x.'], [['titik rata-rata', '(x̄, ȳ)'], ['a', 'ȳ − b · x̄']], 'Makna gradien ditulis dengan satuannya, misalnya "setiap tambahan 1 jam belajar, nilai naik rata-rata 3 poin".'),
  ], [
    Q('Garis regresi nilai ujian (y) terhadap lama belajar dalam jam (x) adalah ŷ = 45 + 6x. Makna angka 6 adalah …', ['setiap tambahan 1 jam belajar, nilai naik rata-rata 6 poin', 'nilai siswa yang tidak belajar adalah 6', 'rata-rata lama belajar 6 jam', 'koefisien korelasinya 0,6'], 0, '6 adalah gradien, yaitu perubahan rata-rata ŷ untuk setiap kenaikan x sebesar 1 jam.', 1),
    Q('Sebuah data memiliki x̄ = 5, ȳ = 32, dan gradien regresi b = 4. Persamaan garis regresinya adalah …', ['ŷ = 12 + 4x', 'ŷ = 32 + 4x', 'ŷ = 4 + 12x', 'ŷ = 28 + 4x'], 0, 'a = ȳ − b · x̄ = 32 − 4 · 5 = 12, jadi ŷ = 12 + 4x.'),
    Q('Garis regresi ŷ = 80 − 2,5x memodelkan sisa baterai (%) terhadap lama pemakaian (jam). Pernyataan yang benar adalah …', ['setiap jam pemakaian, sisa baterai turun rata-rata 2,5%', 'setiap jam, baterai bertambah 2,5%', 'baterai habis tepat setelah 80 jam', 'baterai mula-mula 2,5%'], 0, 'Gradien −2,5 berarti ŷ turun 2,5 untuk setiap kenaikan x sebesar 1 jam.'),
  ]),
  'MAT.C26.F.REGRESI:PREDIKSI': K([
    S('Memprediksi dengan garis regresi', ['Substitusikan nilai x ke garis regresi untuk mendapat prediksi ŷ.', '**Interpolasi**: x di dalam rentang data, prediksinya lebih dapat dipercaya. **Ekstrapolasi**: x di luar rentang data, polanya belum tentu berlanjut.'], [['interpolasi', 'x di dalam rentang data'], ['ekstrapolasi', 'x di luar rentang data']]),
    S('Sisaan', ['**Sisaan** (residu) = y sebenarnya − ŷ prediksi. Sisaan positif berarti data berada di atas garis.', 'Sisaan yang kecil dan tersebar acak menandakan garis cocok dengan data.'], [['sisaan', 'e = y − ŷ']], 'Hati-hati memprediksi jauh di luar data: tinggi badan anak tidak terus naik 6 cm per tahun sampai dewasa.'),
  ], [
    Q('Dengan garis regresi ŷ = 12 + 4x, prediksi y untuk x = 7 adalah …', ['40', '28', '16', '52'], 0, 'ŷ = 12 + 4 · 7 = 12 + 28 = 40.', 1),
    Q('Garis ŷ = 20 + 3x dibuat dari data dengan x antara 2 dan 10. Prediksi yang paling tidak dapat dipercaya adalah untuk x = …', ['50', '5', '8', '3'], 0, 'x = 50 jauh di luar rentang data 2–10 (ekstrapolasi), sehingga polanya belum tentu berlaku.'),
    Q('Untuk x = 6, garis regresi memprediksi ŷ = 50, sedangkan data sebenarnya y = 46. Sisaannya adalah …', ['−4', '4', '96', '50'], 0, 'Sisaan = y − ŷ = 46 − 50 = −4, jadi data berada di bawah garis.'),
  ]),
  'MAT.C26.F.REGRESI:KAUSAL': K([
    S('Berhubungan belum tentu menyebabkan', ['Korelasi yang kuat hanya menunjukkan dua variabel bergerak bersama. Itu **bukan bukti** bahwa yang satu menyebabkan yang lain.', 'Bisa ada **variabel ketiga** (variabel perancu) yang memengaruhi keduanya.'], [['variabel perancu', 'memengaruhi kedua variabel']]),
    S('Contoh dan cara menguji', ['Penjualan es krim dan kasus tenggelam sama-sama naik di musim panas. Penyebabnya cuaca panas, bukan es krim.', 'Untuk menguji sebab-akibat diperlukan eksperimen terkontrol: kelompok dibagi acak, hanya satu perlakuan yang diubah, dan kondisi lain dijaga sama.'], [['bukti sebab-akibat', 'eksperimen terkontrol']], 'Selalu tanyakan: adakah faktor lain yang bisa menjelaskan kedua data ini?'),
  ], [
    Q('Di sebuah kota, banyak mobil pemadam yang dikirim berkorelasi positif dengan besar kerugian kebakaran. Penjelasan yang paling tepat adalah …', ['kebakaran yang lebih besar membuat lebih banyak pemadam dikirim dan kerugian lebih besar', 'mobil pemadam menyebabkan kerugian', 'kerugian besar membuat api mengecil', 'korelasinya pasti salah hitung'], 0, 'Besarnya kebakaran adalah variabel ketiga yang memengaruhi banyak pemadam sekaligus besar kerugian.'),
    Q('Data menunjukkan siswa yang sarapan memiliki nilai rata-rata lebih tinggi. Kesimpulan yang paling tepat adalah …', ['ada hubungan, tetapi belum terbukti sarapan menyebabkan nilai tinggi', 'sarapan pasti menyebabkan nilai tinggi', 'nilai tinggi menyebabkan siswa sarapan', 'tidak ada hubungan sama sekali'], 0, 'Data pengamatan hanya menunjukkan hubungan. Faktor lain, misalnya kebiasaan tidur atau dukungan keluarga, bisa ikut berperan.'),
    Q('Cara paling tepat untuk menguji apakah pupuk baru menyebabkan tanaman lebih tinggi adalah …', ['membagi tanaman secara acak ke dua kelompok, hanya satu yang diberi pupuk, dan kondisi lain disamakan', 'mengamati kebun yang sudah memakai pupuk itu', 'menghitung korelasi tinggi tanaman dengan harga pupuk', 'bertanya kepada penjual pupuk'], 0, 'Eksperimen terkontrol dengan pembagian acak memisahkan pengaruh pupuk dari faktor lain.'),
  ]),
  // ---------- Distribusi binomial dan normal (Matematika Tingkat Lanjut, F+) ----------
  'MAT.C26.FPLUS.DISTRIBUSI:C1': K([
    S('Percobaan binomial', ['Percobaan binomial diulang n kali, setiap percobaan hanya punya dua hasil (sukses atau gagal), peluang sukses p tetap, dan antarpercobaan saling bebas.', 'Variabel acak X = banyak sukses dalam n percobaan, nilainya 0, 1, 2, …, n.'], [['syarat', 'n tetap, dua hasil, p tetap, saling bebas']]),
    S('Peluang binomial', ['**P(X = k) = C(n, k) · pᵏ · (1 − p)ⁿ⁻ᵏ**, dengan C(n, k) = n! / (k!(n − k)!).', 'Contoh: koin dilempar 4 kali, peluang tepat 2 gambar = C(4, 2) · (½)² · (½)² = 6/16 = 3/8.'], [['P(X = k)', 'C(n, k) pᵏ (1 − p)ⁿ⁻ᵏ']], 'C(n, k) menghitung banyak urutan; pᵏ(1 − p)ⁿ⁻ᵏ adalah peluang satu urutan tertentu.'),
  ], [
    Q('Sebuah dadu dilempar 3 kali. Peluang muncul mata 6 tepat satu kali adalah …', ['25/72', '1/6', '25/216', '1/216'], 0, 'P = C(3, 1) · (1/6) · (5/6)² = 3 · 25/216 = 75/216 = 25/72.'),
    Q('Percobaan berikut yang BUKAN percobaan binomial adalah …', ['mengambil 3 kartu satu per satu tanpa pengembalian dan menghitung kartu As', 'melempar koin 10 kali dan menghitung sisi gambar', 'menebak 5 soal pilihan ganda dan menghitung yang benar', 'menembak sasaran 8 kali dengan peluang kena tetap 0,7'], 0, 'Tanpa pengembalian, peluang mendapat As berubah setelah setiap pengambilan, jadi p tidak tetap dan percobaannya tidak saling bebas.'),
    Q('Peluang seorang pemain mencetak gol dari tendangan penalti adalah 0,8. Jika ia menendang 3 penalti, peluang ketiganya gol adalah …', ['0,512', '0,8', '0,24', '0,096'], 0, 'P(X = 3) = C(3, 3) · 0,8³ · 0,2⁰ = 0,512.', 1),
  ], 6),
  'MAT.C26.FPLUS.DISTRIBUSI:PARAMETER': K([
    S('Nilai harapan dan varians', ['Nilai harapan (rataan) variabel acak diskrit: **E(X) = Σ x · P(X = x)**.', 'Varians: **Var(X) = E(X²) − μ²**, dan simpangan baku σ = √Var(X).'], [['nilai harapan', 'E(X) = Σ x · P(x)'], ['varians', 'E(X²) − μ²']]),
    S('Untuk distribusi binomial', ['Jika X berdistribusi binomial dengan n percobaan dan peluang sukses p: **E(X) = np**, **Var(X) = np(1 − p)**, dan σ = √(np(1 − p)).', 'Contoh: koin dilempar 100 kali, banyak sisi gambar memiliki rataan 50 dan simpangan baku √25 = 5.'], [['binomial', 'μ = np, σ² = np(1 − p)']], 'Nilai harapan adalah rata-rata jangka panjang dan tidak harus berupa hasil yang mungkin muncul, misalnya 3,5 pada dadu.'),
  ], [
    Q('Variabel acak X memiliki P(X = 0) = 0,2, P(X = 1) = 0,5, dan P(X = 2) = 0,3. Nilai E(X) adalah …', ['1,1', '1', '0,5', '1,3'], 0, 'E(X) = 0 · 0,2 + 1 · 0,5 + 2 · 0,3 = 1,1.'),
    Q('Sebanyak 50 soal pilihan ganda dengan 5 opsi dijawab dengan menebak. Rataan banyak jawaban benar adalah …', ['10', '25', '5', '12,5'], 0, 'Peluang benar setiap soal 1/5, jadi E(X) = np = 50 × 1/5 = 10.', 1),
    Q('X berdistribusi binomial dengan n = 100 dan p = 0,2. Simpangan baku X adalah …', ['4', '16', '20', '2'], 0, 'σ = √(np(1 − p)) = √(100 × 0,2 × 0,8) = √16 = 4.'),
  ], 6),
  'MAT.C26.FPLUS.DISTRIBUSI:C2': K([
    S('Kurva normal', ['Distribusi normal berbentuk lonceng dan simetris terhadap rataan μ. Lebar kurvanya ditentukan simpangan baku σ.', 'Aturan empiris: sekitar **68%** data berada dalam μ ± σ, **95%** dalam μ ± 2σ, dan **99,7%** dalam μ ± 3σ.'], [['68–95–99,7', 'μ ± σ, μ ± 2σ, μ ± 3σ']]),
    S('Nilai baku z', ['Ubah nilai x ke nilai baku: **z = (x − μ) / σ**. Nilai z menyatakan berapa simpangan baku x berada di atas atau di bawah rataan.', 'Peluang dibaca dari tabel distribusi normal baku, misalnya P(Z < 1) ≈ 0,8413. Luas seluruh daerah di bawah kurva = 1.'], [['nilai baku', 'z = (x − μ) / σ'], ['luas total', '1']], 'Karena simetris, P(Z > a) = P(Z < −a) dan P(Z < 0) = 0,5.'),
  ], [
    Q('Nilai ujian berdistribusi normal dengan μ = 70 dan σ = 8. Nilai baku untuk x = 86 adalah …', ['2', '16', '1,6', '0,5'], 0, 'z = (86 − 70) / 8 = 16 / 8 = 2.', 1),
    Q('Tinggi siswa berdistribusi normal dengan μ = 160 cm dan σ = 5 cm. Menurut aturan empiris, persentase siswa dengan tinggi antara 150 cm dan 170 cm sekitar …', ['95%', '68%', '99,7%', '50%'], 0, '150 dan 170 adalah μ − 2σ dan μ + 2σ, jadi sekitar 95% data berada di antaranya.'),
    Q('Jika P(Z < 1,5) = 0,9332, maka P(Z > 1,5) adalah …', ['0,0668', '0,9332', '0,4332', '0,5'], 0, 'Luas total di bawah kurva 1, jadi P(Z > 1,5) = 1 − 0,9332 = 0,0668.'),
  ], 6),
  // ---------- Irisan kerucut (Matematika Tingkat Lanjut, F+) ----------
  'MAT.C26.FPLUS.KERUCUT:C1': K([
    S('Fokus dan direktriks', ['Parabola adalah himpunan titik yang jaraknya ke **fokus** sama dengan jaraknya ke **direktriks** (sebuah garis).', 'Puncak di (0, 0) dan terbuka ke kanan: **y² = 4px**, fokus (p, 0), direktriks x = −p. Terbuka ke atas: **x² = 4py**, fokus (0, p), direktriks y = −p.'], [['y² = 4px', 'fokus (p, 0), direktriks x = −p'], ['x² = 4py', 'fokus (0, p), direktriks y = −p']]),
    S('Membaca persamaan', ['Tanda p menentukan arah: p > 0 terbuka ke kanan atau ke atas, p < 0 ke kiri atau ke bawah.', 'Puncak di (a, b): (y − b)² = 4p(x − a) atau (x − a)² = 4p(y − b). Contoh: y² = 12x berarti 4p = 12, p = 3, dan fokusnya (3, 0).'], [['puncak (a, b)', '(y − b)² = 4p(x − a)']], 'Cari 4p dulu dari koefisiennya, baru tentukan p, fokus, dan direktriks.'),
  ], [
    Q('Fokus parabola y² = 8x adalah …', ['(2, 0)', '(8, 0)', '(0, 2)', '(4, 0)'], 0, '4p = 8, jadi p = 2 dan fokusnya (2, 0).', 1),
    Q('Persamaan direktriks parabola x² = −16y adalah …', ['y = 4', 'y = −4', 'x = 4', 'y = 16'], 0, '4p = −16, jadi p = −4. Parabola terbuka ke bawah dengan fokus (0, −4), dan direktriksnya y = −p = 4.'),
    Q('Parabola dengan puncak (0, 0) dan fokus (−3, 0) memiliki persamaan …', ['y² = −12x', 'y² = 12x', 'x² = −12y', 'y² = −3x'], 0, 'Fokus di sumbu x negatif berarti bentuknya y² = 4px dengan p = −3, jadi y² = −12x.'),
  ], 6),
  'MAT.C26.FPLUS.KERUCUT:C2': K([
    S('Dua fokus', ['Elips adalah himpunan titik yang **jumlah jaraknya ke dua fokus tetap**, yaitu 2a.', 'Elips berpusat di (0, 0) dengan sumbu mayor mendatar: **x²/a² + y²/b² = 1**, dengan a > b. Fokusnya (±c, 0) dengan **c² = a² − b²**.'], [['elips', 'x²/a² + y²/b² = 1'], ['fokus', 'c² = a² − b²']]),
    S('Unsur-unsur elips', ['Panjang sumbu mayor 2a, sumbu minor 2b, dan puncaknya (±a, 0). Jika penyebut di bawah y² yang lebih besar, sumbu mayornya tegak.', 'Eksentrisitas **e = c/a**, dengan 0 < e < 1: makin dekat ke 0, elips makin mendekati lingkaran.'], [['eksentrisitas', 'e = c / a']], 'Pada elips, a² adalah penyebut terbesar. Jangan tertukar dengan hiperbola, yang memakai c² = a² + b².'),
  ], [
    Q('Fokus elips x²/25 + y²/9 = 1 adalah …', ['(±4, 0)', '(±5, 0)', '(±3, 0)', '(±√34, 0)'], 0, 'a² = 25 dan b² = 9, jadi c² = 25 − 9 = 16 dan c = 4. Fokusnya (±4, 0).'),
    Q('Panjang sumbu mayor elips x²/16 + y²/36 = 1 adalah …', ['12', '8', '6', '36'], 0, 'Penyebut terbesar 36 ada di bawah y², jadi sumbu mayor tegak dengan a = 6 dan panjangnya 2a = 12.'),
    Q('Eksentrisitas elips x²/25 + y²/16 = 1 adalah …', ['3/5', '4/5', '5/3', '1'], 0, 'c² = 25 − 16 = 9, jadi c = 3 dan e = c/a = 3/5.'),
  ], 6),
  'MAT.C26.FPLUS.KERUCUT:HIPERBOLA': K([
    S('Selisih jarak tetap', ['Hiperbola adalah himpunan titik yang **selisih jaraknya ke dua fokus tetap**, yaitu 2a.', 'Hiperbola berpusat di (0, 0) yang terbuka ke kiri dan kanan: **x²/a² − y²/b² = 1**, dengan fokus (±c, 0) dan **c² = a² + b²**.'], [['hiperbola', 'x²/a² − y²/b² = 1'], ['fokus', 'c² = a² + b²']]),
    S('Asimtot dan arah', ['Asimtot hiperbola x²/a² − y²/b² = 1 adalah **y = ±(b/a)x**. Cabang-cabangnya makin mendekati garis ini tetapi tidak pernah memotongnya.', 'Jika suku y² yang bertanda positif (y²/a² − x²/b² = 1), hiperbola terbuka ke atas dan bawah, dan asimtotnya y = ±(a/b)x.'], [['asimtot', 'y = ±(b/a)x']], 'Arah hiperbola ditentukan suku yang bertanda positif, bukan penyebut yang lebih besar.'),
  ], [
    Q('Fokus hiperbola x²/16 − y²/9 = 1 adalah …', ['(±5, 0)', '(±√7, 0)', '(±4, 0)', '(0, ±5)'], 0, 'c² = a² + b² = 16 + 9 = 25, jadi c = 5. Suku x² positif, sehingga fokusnya (±5, 0).'),
    Q('Persamaan asimtot hiperbola x²/9 − y²/4 = 1 adalah …', ['y = ±(2/3)x', 'y = ±(3/2)x', 'y = ±(4/9)x', 'y = ±(9/4)x'], 0, 'a = 3 dan b = 2, jadi asimtotnya y = ±(b/a)x = ±(2/3)x.'),
    Q('Hiperbola y²/25 − x²/144 = 1 terbuka ke arah …', ['atas dan bawah', 'kiri dan kanan', 'kanan saja', 'atas saja'], 0, 'Suku y² bertanda positif, sehingga cabang-cabangnya terbuka ke atas dan ke bawah.', 1),
  ], 6),
};
