import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Matematika SMP (Fase D) untuk inti PLANNED dari audit kesenjangan materi (prioritas 1).
// Kunci = "KODE_TOPIK:ID_INTI" di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): Content => ({ slides, q, min });

export const SMP_MAT: Record<string, Content> = {
  // ---------- Bilangan dan operasi ----------
  // Inti /coba (14 November 2026): soal suhu freezer memakai a − (−b), yang belum diajarkan inti Bilangan rasional & estimasi.
  'MAT.C26.D.BILANGAN:BULAT': K([
    S('Bilangan bulat di garis bilangan', ['Bilangan bulat terdiri dari bilangan negatif, nol, dan bilangan positif: …, −3, −2, −1, 0, 1, 2, 3, …', 'Di garis bilangan, makin ke kanan makin besar. Suhu −5 °C lebih dingin daripada 2 °C karena letaknya lebih ke kiri.'], [['urutan', '… < −2 < −1 < 0 < 1 < 2 < …']]),
    S('Menjumlah dan mengurangi', ['Mengurangi bilangan negatif sama dengan menambah lawannya: a − (−b) = a + b. Menambah bilangan negatif sama dengan mengurangi: a + (−b) = a − b.', 'Selisih dua suhu = suhu tertinggi dikurangi suhu terendah. Dari −3 °C ke 4 °C, suhu naik 4 − (−3) = 7 °C.'], [['kurang negatif', 'a − (−b) = a + b'], ['tambah negatif', 'a + (−b) = a − b']], 'Bayangkan termometer: hitung langkah dari angka bawah ke angka atas.'),
  ], [
    Q('Hasil dari 8 − (−3) adalah …', ['11', '5', '−24', '24'], 0, '8 − (−3) = 8 + 3 = 11.', 1),
    Q('Suhu pagi di puncak gunung −4 °C dan siang harinya 9 °C. Kenaikan suhunya adalah …', ['13 °C', '5 °C', '36 °C', '−36 °C'], 0, '9 − (−4) = 9 + 4 = 13 °C.'),
    Q('Urutan bilangan −7, 2, 0, −1 dari yang terkecil adalah …', ['−7, −1, 0, 2', '−1, −7, 0, 2', '0, −1, 2, −7', '2, 0, −1, −7'], 0, 'Di garis bilangan, −7 paling kiri, lalu −1, 0, dan 2.', 1),
  ], 4),
  'MAT.C26.D.BILANGAN:C1': K([
    S('Bilangan rasional', ['Bilangan **rasional** dapat ditulis a/b dengan a dan b bulat, b ≠ 0. Contoh: 3, −2, 0,5 = 1/2, 0,333… = 1/3.', 'Bilangan seperti √2 dan π **tidak rasional**: desimalnya tidak berakhir dan tidak berulang.', 'Untuk membandingkan, ubah ke bentuk yang sama. −3/4 = −0,75 lebih kecil dari −0,7 karena letaknya lebih jauh di kiri garis bilangan.'], [['bilangan rasional', 'a/b, dengan b ≠ 0']]),
    S('Estimasi', ['Estimasi berarti membulatkan dulu supaya hitungan cepat dan hasil akhir bisa dicek.', 'Contoh: 49,8 × 3,1 ≈ 50 × 3 = 150. Hasil tepatnya 154,38, dekat dengan estimasi, jadi masuk akal.'], [['estimasi', 'bulatkan, lalu hitung']], 'Bandingkan jawaban akhirmu dengan estimasi; kalau jauh berbeda, cek lagi hitungannya.'),
  ], [
    Q('Bilangan berikut yang **bukan** bilangan rasional adalah …', ['0,25', '−7', '√2', '2/3'], 2, '√2 tidak dapat ditulis sebagai pecahan a/b; desimalnya tidak berakhir dan tidak berulang. Bilangan lain dapat ditulis a/b.', 1),
    Q('Urutan bilangan −0,7; −3/4; 1/2; 0,45 dari yang terkecil adalah …', ['−3/4; −0,7; 0,45; 1/2', '−0,7; −3/4; 0,45; 1/2', '−3/4; −0,7; 1/2; 0,45', '0,45; 1/2; −0,7; −3/4'], 0, '−3/4 = −0,75 lebih kecil dari −0,7, dan 0,45 lebih kecil dari 1/2 = 0,5.'),
    Q('Ani membeli 3 buku seharga Rp19.800 per buku. Estimasi total harga yang paling masuk akal adalah …', ['sekitar Rp40.000', 'sekitar Rp60.000', 'sekitar Rp80.000', 'sekitar Rp6.000'], 1, 'Rp19.800 dibulatkan menjadi Rp20.000; 3 × Rp20.000 = Rp60.000.', 1),
  ], 4),
  'MAT.C26.D.BILANGAN:C2': K([
    S('Bilangan berpangkat', ['aⁿ artinya a dikalikan sebanyak n kali: 2⁴ = 2 × 2 × 2 × 2 = 16.', 'Sifat penting: aᵐ × aⁿ = aᵐ⁺ⁿ, aᵐ : aⁿ = aᵐ⁻ⁿ, (aᵐ)ⁿ = aᵐⁿ, dan a⁰ = 1 untuk a ≠ 0.'], [['perkalian, basis sama', 'aᵐ × aⁿ = aᵐ⁺ⁿ'], ['pembagian, basis sama', 'aᵐ : aⁿ = aᵐ⁻ⁿ']]),
    S('Bentuk akar', ['√a adalah bilangan tak negatif yang kuadratnya a: √49 = 7 karena 7² = 49. Akar pangkat tiga: ∛8 = 2 karena 2³ = 8.', 'Menyederhanakan akar: √50 = √(25 × 2) = 5√2.'], [['√(a × b)', '√a × √b']], 'Cari faktor kuadrat terbesar (4, 9, 16, 25, 36, …) untuk menyederhanakan akar.'),
  ], [
    Q('Hasil 2³ × 2⁴ adalah …', ['2⁷', '2¹²', '4⁷', '4¹²'], 0, 'Basisnya sama, jadi pangkatnya dijumlahkan: 3 + 4 = 7.', 1),
    Q('Bentuk sederhana dari √72 adalah …', ['6√2', '3√8', '2√18', '8√3'], 0, '72 = 36 × 2 dan √36 = 6, jadi √72 = 6√2. Bentuk 3√8 dan 2√18 bernilai sama tetapi belum paling sederhana.'),
    Q('Nilai dari (5²)³ : 5⁴ adalah …', ['5', '25', '125', '625'], 1, '(5²)³ = 5⁶, lalu 5⁶ : 5⁴ = 5² = 25.'),
  ]),
  'MAT.C26.D.BILANGAN:PECAHAN': K([
    S('Menjumlah dan mengurangi pecahan', ['Samakan dulu penyebutnya dengan KPK, lalu jumlahkan atau kurangkan pembilangnya.', 'Contoh: 2/3 + 1/4 = 8/12 + 3/12 = 11/12.'], [['a/b + c/d', '(ad + bc)/bd']]),
    S('Mengali dan membagi pecahan', ['**Kali**: pembilang × pembilang, penyebut × penyebut.', '**Bagi**: kalikan dengan kebalikan pembagi. 3/4 : 1/2 = 3/4 × 2/1 = 6/4 = 1½.'], [['a/b : c/d', 'a/b × d/c']], 'Ubah pecahan campuran menjadi pecahan biasa sebelum mengali atau membagi.'),
  ], [
    Q('Hasil 2/3 + 3/4 adalah …', ['5/7', '17/12', '5/12', '6/7'], 1, 'KPK 3 dan 4 adalah 12: 8/12 + 9/12 = 17/12. Pembilang dan penyebut tidak boleh dijumlahkan langsung.', 1),
    Q('Hasil 1½ : 3/4 adalah …', ['2', '9/8', '1/2', '3/8'], 0, '1½ = 3/2, lalu 3/2 × 4/3 = 12/6 = 2.'),
    Q('Sebuah resep membutuhkan 3/4 cangkir gula untuk 1 loyang kue. Untuk 2½ loyang dibutuhkan … cangkir gula.', ['1 7/8', '2 1/4', '3 1/4', '1 1/2'], 0, '3/4 × 5/2 = 15/8 = 1 7/8 cangkir.'),
  ]),
  'MAT.C26.D.BILANGAN:ILMIAH': K([
    S('Bentuk a × 10ⁿ', ['Notasi ilmiah menulis bilangan sangat besar atau sangat kecil sebagai a × 10ⁿ, dengan 1 ≤ a < 10 dan n bilangan bulat.', 'Contoh: 3.000.000 = 3 × 10⁶ dan 0,00045 = 4,5 × 10⁻⁴.'], [['notasi ilmiah', 'a × 10ⁿ, 1 ≤ a < 10']]),
    S('Menghitung dengan notasi ilmiah', ['Kalikan bagian a-nya, lalu jumlahkan pangkat 10-nya: (2 × 10³) × (4 × 10⁵) = 8 × 10⁸.', 'Jika hasil a ≥ 10, geser koma: 12 × 10⁴ = 1,2 × 10⁵. Contoh nyata: jarak Bumi–Matahari ≈ 1,5 × 10⁸ km.'], [['(a × 10ᵐ)(b × 10ⁿ)', '(a × b) × 10ᵐ⁺ⁿ']], 'Koma digeser ke kiri → pangkat bertambah; digeser ke kanan → pangkat berkurang.'),
  ], [
    Q('Notasi ilmiah dari 0,00072 adalah …', ['7,2 × 10⁻⁴', '72 × 10⁻⁵', '7,2 × 10⁴', '0,72 × 10⁻³'], 0, 'Koma digeser 4 tempat ke kanan menjadi 7,2, jadi pangkatnya −4. Bentuk 72 × 10⁻⁵ dan 0,72 × 10⁻³ tidak memenuhi 1 ≤ a < 10.', 1),
    Q('Hasil (3 × 10⁴) × (5 × 10²) dalam notasi ilmiah adalah …', ['1,5 × 10⁵', '1,5 × 10⁷', '1,5 × 10⁶', '8 × 10⁸'], 1, '3 × 5 = 15 dan 10⁴ × 10² = 10⁶, jadi 15 × 10⁶ = 1,5 × 10⁷.'),
    Q('Massa satu sel kira-kira 2 × 10⁻⁹ gram. Massa 5 × 10³ sel adalah …', ['1 × 10⁻⁵ g', '10 × 10⁻¹² g', '1 × 10⁻⁶ g', '7 × 10⁻⁶ g'], 0, '2 × 5 = 10 dan 10⁻⁹ × 10³ = 10⁻⁶, jadi 10 × 10⁻⁶ = 1 × 10⁻⁵ gram.'),
  ]),
  // ---------- Rasio, skala, dan laju ----------
  'MAT.C26.D.RASIO:C1': K([
    S('Naik bersama', ['Dua besaran **senilai** jika yang satu bertambah, yang lain ikut bertambah dengan perbandingan tetap.', 'Contoh: 2 kg beras Rp26.000, maka 5 kg beras Rp65.000.'], [['senilai', 'a₁/b₁ = a₂/b₂']]),
    S('Cara menghitung', ['Cara 1: cari harga satuan (Rp26.000 : 2 = Rp13.000 per kg), lalu kalikan 5.', 'Cara 2: pakai perbandingan 2/5 = 26.000/x, sehingga x = 65.000.'], [['nilai satuan', 'total : banyak']], 'Tanyakan dulu: kalau yang satu naik, apakah yang lain juga naik? Jika ya, perbandingannya senilai.'),
  ], [
    Q('Harga 4 pensil Rp10.000. Harga 10 pensil yang sama adalah …', ['Rp20.000', 'Rp25.000', 'Rp40.000', 'Rp4.000'], 1, 'Harga satu pensil Rp2.500, jadi 10 pensil Rp25.000.', 1),
    Q('Sebuah mobil menghabiskan 6 liter bensin untuk menempuh 72 km. Untuk menempuh 120 km dibutuhkan … liter.', ['8', '9', '10', '12'], 2, '72 km : 6 L = 12 km per liter, lalu 120 : 12 = 10 liter.'),
    Q('Pasangan besaran berikut yang merupakan perbandingan senilai adalah …', ['banyak pekerja dan lama pekerjaan selesai', 'kecepatan dan waktu tempuh untuk jarak yang sama', 'banyak barang dan total harga', 'banyak siswa dan jatah kue per siswa dari kue yang sama'], 2, 'Makin banyak barang, makin besar total harganya dengan perbandingan tetap. Pasangan lain berbalik nilai.', 1),
  ], 4),
  // Inti /coba (14 November 2026): soal peta ke sekolah menghasilkan waktu dalam jam desimal yang perlu diubah ke menit.
  'MAT.C26.D.RASIO:WAKTU': K([
    S('Tangga satuan waktu', ['1 jam = 60 menit dan 1 menit = 60 detik, jadi 1 jam = 3.600 detik.', 'Dari satuan besar ke satuan kecil dikali (jam ke menit: × 60). Dari satuan kecil ke satuan besar dibagi (menit ke jam: : 60).'], [['1 jam', '60 menit = 3.600 detik'], ['jam ke menit', '× 60']]),
    S('Waktu dalam bentuk desimal', ['Hasil hitungan waktu sering berbentuk desimal atau pecahan jam: 0,1 jam = 0,1 × 60 = 6 menit; ¼ jam = 15 menit; 1,5 jam = 1 jam 30 menit.', 'Saat menghitung laju, pakai satuan waktu yang sama dengan satuan kecepatannya: kecepatan dalam km/jam berarti waktunya dalam jam.'], [['0,1 jam', '6 menit'], ['1,5 jam', '1 jam 30 menit']], '1,5 jam bukan 1 jam 50 menit, karena 0,5 jam = 30 menit.'),
  ], [
    Q('2,5 jam sama dengan …', ['150 menit', '250 menit', '125 menit', '90 menit'], 0, '2,5 × 60 = 150 menit.', 1),
    Q('Sebuah perjalanan memakan waktu 0,2 jam. Dalam menit, waktunya …', ['12 menit', '20 menit', '120 menit', '32 menit'], 0, '0,2 × 60 = 12 menit.'),
    Q('Rani berlari selama 45 menit. Dalam jam, waktunya …', ['0,75 jam', '0,45 jam', '1,5 jam', '4,5 jam'], 0, '45 : 60 = 0,75 jam.'),
  ], 4),
  'MAT.C26.D.RASIO:C2': K([
    S('Skala', ['Skala = jarak pada peta : jarak sebenarnya, dengan satuan yang sama.', 'Skala 1 : 200.000 berarti 1 cm pada peta mewakili 200.000 cm = 2 km.'], [['jarak sebenarnya', 'jarak peta × penyebut skala']]),
    S('Laju', ['Laju membandingkan dua besaran yang satuannya berbeda, misalnya kecepatan (km/jam), debit (liter/menit), atau harga per kg.', 'Motor menempuh 90 km dalam 2 jam, jadi lajunya 45 km/jam.'], [['kecepatan', 'jarak : waktu']], 'Samakan satuan dulu: km ↔ cm (1 km = 100.000 cm), menit ↔ jam.'),
  ], [
    Q('Jarak dua kota pada peta 4 cm dengan skala 1 : 500.000. Jarak sebenarnya adalah …', ['2 km', '20 km', '200 km', '2.000 km'], 1, '4 × 500.000 = 2.000.000 cm = 20 km.', 1),
    Q('Sebuah keran mengisi 120 liter air dalam 8 menit. Debit air keran adalah …', ['15 liter/menit', '12 liter/menit', '960 liter/menit', '16 liter/menit'], 0, 'Debit = volume : waktu = 120 : 8 = 15 liter per menit.', 1),
    Q('Jarak sebenarnya 15 km digambar 5 cm pada sebuah denah. Skala denah tersebut adalah …', ['1 : 3.000', '1 : 30.000', '1 : 300.000', '1 : 3.000.000'], 2, '15 km = 1.500.000 cm; 1.500.000 : 5 = 300.000, jadi skalanya 1 : 300.000.'),
  ]),
  'MAT.C26.D.RASIO:BERBALIK': K([
    S('Satu naik, satu turun', ['Dua besaran **berbalik nilai** jika yang satu bertambah, yang lain berkurang, dan hasil kalinya tetap.', 'Contoh: 6 pekerja selesai dalam 10 hari (6 × 10 = 60 hari-kerja). Dengan 12 pekerja, selesai dalam 60 : 12 = 5 hari.'], [['berbalik nilai', 'a₁ × b₁ = a₂ × b₂']]),
    S('Membedakan dari senilai', ['Cek hasil kalinya. Kecepatan × waktu = jarak tetap; banyak orang × jatah per orang = jumlah barang tetap.', 'Kalau hasil baginya yang tetap, berarti senilai.'], [['senilai', 'hasil bagi tetap'], ['berbalik nilai', 'hasil kali tetap']], 'Senilai: bagi tetap. Berbalik nilai: kali tetap.'),
  ], [
    Q('Suatu pekerjaan selesai oleh 8 orang dalam 15 hari. Jika dikerjakan 12 orang, pekerjaan selesai dalam … hari.', ['10', '12', '18', '22,5'], 0, '8 × 15 = 120 hari-kerja; 120 : 12 = 10 hari.', 1),
    Q('Persediaan makanan cukup untuk 40 ekor ayam selama 9 hari. Jika ayam bertambah 20 ekor, makanan itu cukup untuk … hari.', ['6', '13,5', '4,5', '12'], 0, '40 × 9 = 360; ayam menjadi 60 ekor, jadi 360 : 60 = 6 hari.'),
    Q('Mobil dengan kecepatan 60 km/jam membutuhkan 3 jam untuk suatu perjalanan. Jika kecepatannya 90 km/jam, waktunya …', ['2 jam', '4,5 jam', '1,5 jam', '2,5 jam'], 0, 'Jarak tetap 60 × 3 = 180 km; 180 : 90 = 2 jam.'),
  ]),
  // ---------- Pola, bentuk aljabar & persamaan ----------
  'MAT.C26.D.ALJABAR:C1': K([
    S('Pola dan bentuk aljabar', ['Pola 3, 7, 11, 15, … selalu bertambah 4, sehingga suku ke-n = 4n − 1.', 'Dalam 4n − 1: **n** adalah variabel, **4** koefisien, dan **−1** konstanta.'], [['suku ke-n pola bertambah 4', '4n − 1']]),
    S('Bentuk yang ekuivalen', ['Dua bentuk aljabar **ekuivalen** jika nilainya selalu sama untuk setiap nilai variabel.', 'Contoh: 3(x + 2) = 3x + 6 (sifat distributif) dan 2x + 5x = 7x (menggabung suku sejenis).'], [['distributif', 'a(b + c) = ab + ac']], 'Uji dengan satu angka, misalnya x = 1. Jika hasilnya berbeda, pasti tidak ekuivalen.'),
  ], [
    Q('Rumus suku ke-n dari pola 5, 8, 11, 14, … adalah …', ['3n + 2', '5n', 'n + 3', '3n + 5'], 0, 'Bedanya 3, jadi bentuknya 3n + c. Untuk n = 1 hasilnya harus 5, sehingga c = 2.', 1),
    Q('Bentuk yang ekuivalen dengan 4(2x − 3) adalah …', ['8x − 3', '8x − 12', '6x − 7', '8x + 12'], 1, '4 × 2x = 8x dan 4 × (−3) = −12.', 1),
    Q('Bentuk sederhana dari 5a + 3b − 2a + b adalah …', ['3a + 4b', '7a + 4b', '3a + 2b', '7ab'], 0, 'Gabungkan suku sejenis: 5a − 2a = 3a dan 3b + b = 4b.'),
  ], 4),
  'MAT.C26.D.ALJABAR:C2': K([
    S('Persamaan dan pertidaksamaan', ['**Persamaan** memakai tanda =, penyelesaiannya satu nilai: x + 4 = 9, jadi x = 5.', '**Pertidaksamaan** memakai <, >, ≤, atau ≥, penyelesaiannya sekumpulan nilai: x + 4 > 9, jadi x > 5.'], [['persamaan', 'x + 4 = 9 → x = 5'], ['pertidaksamaan', 'x + 4 > 9 → x > 5']]),
    S('Hati-hati dengan tanda', ['Menambah atau mengurangi kedua ruas tidak mengubah tanda pertidaksamaan.', 'Tetapi saat kedua ruas **dikali atau dibagi bilangan negatif**, tandanya dibalik: −2x < 6 menjadi x > −3.'], [['bagi dengan negatif', 'balik tanda pertidaksamaan']], 'Cek jawabanmu dengan satu angka dari himpunan penyelesaian.'),
  ], [
    Q('Penyelesaian dari 3x − 5 < 10 adalah …', ['x < 5', 'x > 5', 'x < 15', 'x < 3'], 0, '3x < 15, lalu bagi 3: x < 5.', 1),
    Q('Penyelesaian dari −4x ≥ 12 adalah …', ['x ≥ −3', 'x ≤ −3', 'x ≥ 3', 'x ≤ 3'], 1, 'Kedua ruas dibagi −4, jadi tanda dibalik: x ≤ −3.'),
    Q('Tiket masuk taman bermain Rp15.000 dan setiap naik wahana Rp10.000. Uang Rina Rp65.000. Paling banyak Rina dapat naik wahana … kali.', ['4', '5', '6', '6,5'], 1, '15.000 + 10.000n ≤ 65.000, sehingga 10.000n ≤ 50.000 dan n ≤ 5.'),
  ]),
  'MAT.C26.D.ALJABAR:LINEAR': K([
    S('Menyelesaikan PLSV', ['Lakukan operasi yang sama pada kedua ruas sampai variabel tinggal sendiri.', 'Contoh: 2x + 7 = 19 → 2x = 12 → x = 6.'], [['PLSV', 'ax + b = c → x = (c − b)/a']]),
    S('Dari cerita ke persamaan', ['Umur ayah 3 kali umur anak, dan jumlah umur mereka 48 tahun.', 'Misalkan umur anak x: x + 3x = 48 → 4x = 48 → x = 12. Anak berumur 12 tahun, ayah 36 tahun.'], [['umur anak', 'x'], ['umur ayah', '3x']], 'Tulis dulu arti x sebelum menyusun persamaan.'),
  ], [
    Q('Nilai x yang memenuhi 5x − 8 = 2x + 7 adalah …', ['5', '3', '15', '−5'], 0, '5x − 2x = 7 + 8, jadi 3x = 15 dan x = 5.', 1),
    Q('Nilai x yang memenuhi (x + 4)/3 = 5 adalah …', ['11', '19', '1', '15'], 0, 'Kalikan kedua ruas dengan 3: x + 4 = 15, jadi x = 11.'),
    Q('Keliling sebuah persegi panjang 46 cm. Panjangnya 5 cm lebih dari lebarnya. Lebar persegi panjang itu adalah …', ['9 cm', '14 cm', '18 cm', '10,5 cm'], 0, '2(l + 5 + l) = 46 → 4l + 10 = 46 → l = 9 cm.'),
  ]),
  // ---------- Relasi, fungsi linear, dan SPLDV ----------
  'MAT.C26.D.FUNGSI:C1': K([
    S('Relasi dan fungsi', ['**Fungsi** memasangkan setiap anggota domain dengan **tepat satu** anggota kodomain.', 'Untuk f(x) = 2x + 1, nilai f(3) = 2 × 3 + 1 = 7. Himpunan semua hasilnya disebut range.'], [['fungsi linear', 'f(x) = mx + c']]),
    S('Grafik garis lurus', ['Grafik f(x) = mx + c berupa garis lurus: **m** gradien (kemiringan) dan **c** titik potong sumbu y.', 'Gradien dari dua titik: m = (y₂ − y₁)/(x₂ − x₁).'], [['gradien', '(y₂ − y₁)/(x₂ − x₁)']], 'm positif → garis naik ke kanan; m negatif → garis turun ke kanan.'),
  ], [
    Q('Jika f(x) = 3x − 4, nilai f(5) adalah …', ['11', '19', '1', '−11'], 0, 'f(5) = 3 × 5 − 4 = 11.', 1),
    Q('Gradien garis yang melalui titik (1, 2) dan (4, 11) adalah …', ['3', '1/3', '9', '2'], 0, 'm = (11 − 2)/(4 − 1) = 9/3 = 3.'),
    Q('Relasi berikut yang merupakan fungsi adalah …', ['{(1, a), (1, b), (2, c)}', '{(1, a), (2, a), (3, b)}', '{(2, a), (2, b), (3, c)}', '{(3, a), (3, b), (4, a)}'], 1, 'Setiap anggota domain (1, 2, 3) punya tepat satu pasangan. Pada pilihan lain ada anggota domain yang punya dua pasangan.'),
  ], 4),
  'MAT.C26.D.FUNGSI:C2': K([
    S('Dua persamaan, dua variabel', ['SPLDV terdiri dari dua persamaan linear dengan dua variabel, misalnya x + y = 10 dan x − y = 2.', 'Penyelesaiannya pasangan (x, y) yang memenuhi **kedua** persamaan sekaligus: (6, 4).'], [['SPLDV', 'a₁x + b₁y = c₁ dan a₂x + b₂y = c₂']]),
    S('Makna grafiknya', ['Setiap persamaan linear adalah sebuah garis. **Titik potong** kedua garis adalah penyelesaiannya.', 'Garis sejajar → tidak ada penyelesaian. Garis berimpit → penyelesaiannya tak hingga banyak.'], [['penyelesaian', 'titik potong dua garis']], 'Selalu cek jawaban dengan memasukkannya ke kedua persamaan.'),
  ], [
    Q('Pasangan (x, y) yang memenuhi x + y = 7 dan x − y = 1 adalah …', ['(4, 3)', '(3, 4)', '(5, 2)', '(6, 1)'], 0, '4 + 3 = 7 dan 4 − 3 = 1. Pasangan (3, 4) hanya memenuhi persamaan pertama.', 1),
    Q('Harga 2 buku dan 1 pena Rp13.000, sedangkan 1 buku dan 2 pena Rp11.000. Jika b = harga buku dan p = harga pena, model matematikanya adalah …', ['2b + p = 13.000 dan b + 2p = 11.000', '2b + 2p = 13.000 dan b + p = 11.000', 'b + 2p = 13.000 dan 2b + p = 11.000', '2b + p = 11.000 dan b + 2p = 13.000'], 0, '2 buku + 1 pena = 13.000 dan 1 buku + 2 pena = 11.000.'),
    Q('Sistem persamaan 2x + y = 5 dan 4x + 2y = 7 memiliki …', ['tepat satu penyelesaian', 'tak hingga banyak penyelesaian', 'tidak ada penyelesaian', 'dua penyelesaian'], 2, 'Persamaan kedua dibagi 2 menjadi 2x + y = 3,5, sedangkan persamaan pertama 2x + y = 5. Kedua garis sejajar, jadi tidak berpotongan.', 3),
  ]),
  'MAT.C26.D.FUNGSI:ELIMINASI': K([
    S('Metode eliminasi', ['Samakan koefisien salah satu variabel, lalu jumlahkan atau kurangkan kedua persamaan.', 'x + y = 10 dan x − y = 2. Jumlahkan: 2x = 12, jadi x = 6, lalu y = 10 − 6 = 4.'], [['eliminasi', 'samakan koefisien, lalu jumlah/kurang']]),
    S('Metode substitusi', ['Ubah satu persamaan menjadi y = …, lalu masukkan ke persamaan lain.', 'y = 10 − x, maka x − (10 − x) = 2 → 2x = 12 → x = 6.'], [['substitusi', 'y = …, masukkan ke persamaan lain']], 'Gabungan keduanya (eliminasi dulu, lalu substitusi) biasanya paling cepat.'),
  ], [
    Q('Penyelesaian dari 2x + y = 11 dan x − y = 1 adalah …', ['x = 4, y = 3', 'x = 3, y = 5', 'x = 5, y = 1', 'x = 4, y = 4'], 0, 'Jumlahkan kedua persamaan: 3x = 12, jadi x = 4 dan y = 11 − 8 = 3.', 1),
    Q('Harga 2 buku dan 1 pena Rp13.000, sedangkan 1 buku dan 2 pena Rp11.000. Harga 1 buku adalah …', ['Rp5.000', 'Rp3.000', 'Rp4.000', 'Rp6.000'], 0, 'Kalikan persamaan kedua dengan 2: 2b + 4p = 22.000. Kurangi dengan 2b + p = 13.000: 3p = 9.000, p = 3.000, lalu b = (13.000 − 3.000) : 2 = 5.000.'),
    Q('Jumlah dua bilangan 30 dan selisihnya 8. Hasil kali kedua bilangan itu adalah …', ['209', '220', '176', '240'], 0, 'x + y = 30 dan x − y = 8, jadi x = 19 dan y = 11. Hasil kalinya 19 × 11 = 209.'),
  ]),
  // ---------- Sudut, kesebangunan & Pythagoras ----------
  'MAT.C26.D.GEOMETRI:C1': K([
    S('Hubungan antarsudut', ['Sudut **berpelurus** jumlahnya 180°; sudut **berpenyiku** jumlahnya 90°.', 'Dua garis sejajar dipotong garis lain: sudut sehadap sama besar, sudut dalam berseberangan sama besar.'], [['berpelurus', 'a + b = 180°'], ['berpenyiku', 'a + b = 90°']]),
    S('Bangun yang sebangun', ['Dua bangun **sebangun** jika sudut-sudut yang bersesuaian sama besar dan sisi-sisi yang bersesuaian sebanding.', 'Foto 4 cm × 6 cm yang diperbesar menjadi 8 cm × 12 cm sebangun dengan faktor skala 2.'], [['sebangun', 'a/a′ = b/b′ = c/c′']], 'Pasangkan sisi yang berhadapan dengan sudut yang sama besar.'),
  ], [
    Q('Pelurus sudut 65° adalah …', ['25°', '115°', '125°', '295°'], 1, 'Sudut berpelurus berjumlah 180°: 180° − 65° = 115°. Jawaban 25° adalah penyikunya.', 1),
    Q('Segitiga ABC sebangun dengan segitiga PQR, dengan AB bersesuaian dengan PQ. AB = 6 cm, PQ = 9 cm, dan BC = 8 cm. Panjang QR adalah …', ['10 cm', '11 cm', '12 cm', '5⅓ cm'], 2, 'Faktor skala 9 : 6 = 1,5, jadi QR = 8 × 1,5 = 12 cm.'),
    Q('Sebuah tiang setinggi 2 m memiliki bayangan 1,5 m. Pada saat yang sama, bayangan sebuah pohon 6 m. Tinggi pohon itu adalah …', ['4,5 m', '8 m', '7,5 m', '9 m'], 1, 'Tiang dan pohon membentuk segitiga sebangun: 2/1,5 = t/6, jadi t = 8 m.'),
  ], 4),
  'MAT.C26.D.GEOMETRI:C2': K([
    S('a² + b² = c²', ['Pada segitiga siku-siku, kuadrat sisi miring sama dengan jumlah kuadrat dua sisi lainnya.', 'Sisi miring (c) adalah sisi terpanjang, di depan sudut siku-siku.'], [['Teorema Pythagoras', 'a² + b² = c²']]),
    S('Tripel dan penerapan', ['Tripel Pythagoras yang sering dipakai: (3, 4, 5), (5, 12, 13), (8, 15, 17), dan kelipatannya.', 'Tangga 5 m bersandar dengan kaki 3 m dari dinding, maka tingginya √(25 − 9) = √16 = 4 m.'], [['sisi tegak', '√(c² − a²)']], 'Pastikan dulu mana sisi miringnya sebelum memasukkan angka ke rumus.'),
  ], [
    Q('Sebuah segitiga siku-siku memiliki sisi tegak 6 cm dan 8 cm. Panjang sisi miringnya adalah …', ['10 cm', '14 cm', '12 cm', '√28 cm'], 0, '√(6² + 8²) = √(36 + 64) = √100 = 10 cm.', 1),
    Q('Tiga bilangan berikut yang dapat menjadi panjang sisi segitiga siku-siku adalah …', ['4, 5, 6', '6, 8, 12', '9, 12, 15', '5, 11, 12'], 2, '9² + 12² = 81 + 144 = 225 = 15². Pilihan lain tidak memenuhi a² + b² = c².'),
    Q('Tangga sepanjang 13 m bersandar pada dinding. Kaki tangga berjarak 5 m dari dinding. Tinggi ujung tangga dari lantai adalah …', ['8 m', '12 m', '18 m', '√194 m'], 1, 'Tangga adalah sisi miring: √(13² − 5²) = √(169 − 25) = √144 = 12 m.'),
  ]),
  'MAT.C26.D.GEOMETRI:KONGRUEN': K([
    S('Kongruen dan sebangun', ['**Kongruen**: bentuk dan ukurannya sama persis; sisi-sisi yang bersesuaian sama panjang.', '**Sebangun**: bentuknya sama, ukurannya boleh berbeda. Setiap bangun yang kongruen pasti sebangun, tetapi tidak sebaliknya.'], [['kongruen', 'sebangun dengan faktor skala 1']]),
    S('Syarat segitiga kongruen', ['Cukup salah satu syarat: **s-s-s** (tiga sisi), **s-sd-s** (dua sisi dan sudut yang diapitnya), atau **sd-s-sd** (dua sudut dan sisi di antaranya).'], [['syarat kongruen', 's-s-s, s-sd-s, sd-s-sd']], 'Tiga sudut yang sama saja hanya menjamin sebangun, belum kongruen.'),
  ], [
    Q('Pernyataan berikut yang benar adalah …', ['setiap dua bangun yang sebangun pasti kongruen', 'setiap dua bangun yang kongruen pasti sebangun', 'dua persegi panjang selalu sebangun', 'dua segitiga dengan sudut-sudut sama pasti kongruen'], 1, 'Kongruen berarti bentuk dan ukuran sama, jadi pasti sebangun. Sebaliknya belum tentu.'),
    Q('Dua segitiga memiliki tiga pasang sudut yang sama besar. Kedua segitiga itu pasti …', ['kongruen', 'sebangun', 'sama luas', 'sama keliling'], 1, 'Sudut-sudut yang sama menjamin bentuknya sama (sebangun), tetapi ukurannya bisa berbeda.'),
    Q('Pada segitiga ABC dan DEF diketahui AB = DE dan ∠B = ∠E. Agar kedua segitiga kongruen dengan syarat s-sd-s, harus diketahui juga …', ['BC = EF', 'AC = DF', '∠A = ∠D', '∠C = ∠F'], 0, 'Syarat s-sd-s memerlukan sudut yang diapit dua sisi. ∠B diapit oleh AB dan BC, jadi perlu BC = EF.', 3),
  ]),
  // ---------- Lingkaran, bangun ruang & transformasi ----------
  'MAT.C26.D.PENGUKURAN:C1': K([
    S('Rumus volume dan luas', ['Volume kubus s³, balok p × l × t, prisma = luas alas × tinggi, tabung πr²t. Luas lingkaran πr².'], [['volume prisma dan tabung', 'luas alas × tinggi'], ['volume balok', 'p × l × t']]),
    S('Pengaruh skala', ['Jika semua ukuran panjang dikali k, luasnya menjadi k² kali dan volumenya k³ kali.', 'Kubus bersisi 2 cm bervolume 8 cm³; kubus bersisi 4 cm bervolume 64 cm³, yaitu 8 kali lebih besar.'], [['dikali k', 'luas × k², volume × k³']], 'Ingat konversi: 1 liter = 1 dm³ = 1.000 cm³.'),
  ], [
    Q('Volume balok berukuran 10 cm × 6 cm × 5 cm adalah …', ['300 cm³', '210 cm³', '30 cm³', '600 cm³'], 0, '10 × 6 × 5 = 300 cm³.', 1),
    Q('Sebuah tabung berjari-jari 7 cm dan tinggi 10 cm. Dengan π = 22/7, volumenya adalah …', ['1.540 cm³', '440 cm³', '220 cm³', '3.080 cm³'], 0, 'V = 22/7 × 7² × 10 = 22 × 7 × 10 = 1.540 cm³.'),
    Q('Semua rusuk sebuah balok diperbesar menjadi 3 kali semula. Volumenya menjadi … kali semula.', ['3', '6', '9', '27'], 3, 'Volume berubah sebesar k³ = 3³ = 27 kali.'),
  ]),
  'MAT.C26.D.PENGUKURAN:C2': K([
    S('Translasi dan refleksi', ['**Translasi** (a, b): (x, y) → (x + a, y + b).', '**Refleksi** terhadap sumbu x: (x, y) → (x, −y). Terhadap sumbu y: (x, y) → (−x, y).'], [['translasi', '(x, y) → (x + a, y + b)']]),
    S('Rotasi dan dilatasi', ['**Rotasi** 90° berlawanan arah jarum jam dengan pusat O: (x, y) → (−y, x). Rotasi 180°: (x, y) → (−x, −y).', '**Dilatasi** dengan faktor k dan pusat O: (x, y) → (kx, ky).'], [['dilatasi', '(x, y) → (kx, ky)']], 'Uji dengan titik (1, 0): rotasi 90° berlawanan arah jarum jam membawanya ke (0, 1).'),
  ], [
    Q('Titik A(3, −2) ditranslasikan oleh (−4, 5). Bayangan titik A adalah …', ['(−1, 3)', '(7, −7)', '(−1, −7)', '(7, 3)'], 0, '3 + (−4) = −1 dan −2 + 5 = 3.', 1),
    Q('Bayangan titik P(2, 5) oleh refleksi terhadap sumbu y adalah …', ['(2, −5)', '(−2, 5)', '(−2, −5)', '(5, 2)'], 1, 'Refleksi terhadap sumbu y hanya mengubah tanda koordinat x.'),
    Q('Bayangan titik Q(4, 1) oleh rotasi 90° berlawanan arah jarum jam dengan pusat O(0, 0) adalah …', ['(−1, 4)', '(1, −4)', '(−4, −1)', '(4, −1)'], 0, '(x, y) → (−y, x), jadi (4, 1) → (−1, 4).'),
  ]),
  'MAT.C26.D.PENGUKURAN:JARING': K([
    S('Jaring-jaring', ['Jaring-jaring adalah bangun datar yang didapat dengan membuka (menggunting) permukaan bangun ruang.', 'Jaring-jaring kubus terdiri dari 6 persegi yang kongruen. Tidak semua susunan 6 persegi bisa dilipat menjadi kubus.'], [['kubus', '6 sisi persegi']]),
    S('Luas permukaan', ['Luas permukaan = jumlah luas semua sisinya.', 'Kubus 6s², balok 2(pl + pt + lt), tabung 2πr² + 2πrt.'], [['luas permukaan balok', '2(pl + pt + lt)']], 'Bayangkan jaring-jaringnya supaya tidak ada sisi yang terlewat atau terhitung dua kali.'),
  ], [
    Q('Luas permukaan kubus dengan panjang rusuk 5 cm adalah …', ['125 cm²', '150 cm²', '100 cm²', '25 cm²'], 1, '6 × 5² = 6 × 25 = 150 cm². Jawaban 125 adalah volumenya (cm³).', 1),
    Q('Luas permukaan balok berukuran 8 cm × 5 cm × 3 cm adalah …', ['120 cm²', '158 cm²', '79 cm²', '240 cm²'], 1, '2(8 × 5 + 8 × 3 + 5 × 3) = 2(40 + 24 + 15) = 158 cm².'),
    Q('Sebuah kotak berbentuk kubus tanpa tutup dengan rusuk 20 cm akan dicat bagian luarnya. Luas yang dicat adalah …', ['2.400 cm²', '2.000 cm²', '8.000 cm²', '1.600 cm²'], 1, 'Tanpa tutup, sisinya tinggal 5: 5 × 20² = 2.000 cm².'),
  ]),
  'MAT.C26.D.PENGUKURAN:JURING': K([
    S('Sebanding dengan sudut pusat', ['Panjang busur dan luas juring sebanding dengan besar sudut pusatnya dibandingkan satu putaran penuh (360°).'], [['panjang busur', '(α/360°) × 2πr'], ['luas juring', '(α/360°) × πr²']]),
    S('Contoh', ['Lingkaran berjari-jari 14 cm dengan sudut pusat 90° (seperempat lingkaran):', 'panjang busur = 1/4 × 2 × 22/7 × 14 = 22 cm, luas juring = 1/4 × 22/7 × 14² = 154 cm².'], [['90°', 'seperempat lingkaran']], 'Sudut 90° = 1/4 lingkaran, 60° = 1/6, 120° = 1/3, 180° = 1/2.'),
  ], [
    Q('Panjang busur dengan sudut pusat 60° pada lingkaran berjari-jari 21 cm (π = 22/7) adalah …', ['22 cm', '11 cm', '66 cm', '231 cm'], 0, '60°/360° = 1/6; keliling = 2 × 22/7 × 21 = 132 cm; 132 : 6 = 22 cm.'),
    Q('Luas juring dengan sudut pusat 90° pada lingkaran berjari-jari 14 cm (π = 22/7) adalah …', ['154 cm²', '616 cm²', '44 cm²', '308 cm²'], 0, 'Luas lingkaran 22/7 × 196 = 616 cm²; seperempatnya 154 cm².'),
    Q('Sebuah pizza berdiameter 28 cm dipotong menjadi 8 potong sama besar. Luas satu potong pizza (π = 22/7) adalah …', ['77 cm²', '154 cm²', '308 cm²', '38,5 cm²'], 0, 'Jari-jarinya 14 cm, luas pizza 616 cm², jadi satu potong 616 : 8 = 77 cm².'),
  ]),
  // ---------- Data dan peluang sederhana ----------
  'MAT.C26.D.DATA:C1': K([
    S('Mean, median, modus', ['**Mean** = jumlah semua data : banyak data. **Median** = nilai tengah setelah data diurutkan. **Modus** = nilai yang paling sering muncul.'], [['mean', 'jumlah data / banyak data']]),
    S('Mana yang paling mewakili?', ['Jika ada nilai ekstrem (pencilan), median biasanya lebih mewakili daripada mean.', 'Gaji 3, 3, 4, 4, dan 30 juta: mean 8,8 juta terlalu tinggi untuk sebagian besar orang, median 4 juta lebih mewakili.'], [['ada pencilan', 'pakai median']], 'Urutkan data dulu sebelum mencari median.'),
  ], [
    Q('Mean dari data 6, 8, 7, 9, 10 adalah …', ['7', '8', '9', '40'], 1, 'Jumlahnya 40 dan banyak datanya 5, jadi mean = 40 : 5 = 8.', 1),
    Q('Median dari data 5, 9, 3, 7, 8, 4 adalah …', ['6', '7', '5,5', '6,5'], 0, 'Urutkan: 3, 4, 5, 7, 8, 9. Dua nilai tengahnya 5 dan 7, jadi median = (5 + 7) : 2 = 6.'),
    Q('Nilai rata-rata 9 siswa adalah 70. Seorang siswa yang ikut ujian susulan mendapat nilai 80. Nilai rata-rata 10 siswa itu menjadi …', ['71', '75', '72', '70,5'], 0, 'Jumlah nilai 9 siswa = 630; ditambah 80 menjadi 710; 710 : 10 = 71.'),
  ], 4),
  'MAT.C26.D.DATA:C2': K([
    S('Peluang teoretis', ['Jika setiap hasil sama mungkin terjadi, peluang kejadian A = banyak hasil yang diharapkan : banyak semua hasil yang mungkin.', 'Pada sebuah dadu, P(bilangan genap) = 3/6 = 1/2.'], [['peluang', 'n(A) / n(S)']]),
    S('Frekuensi relatif', ['Frekuensi relatif = banyak kejadian muncul : banyak percobaan.', 'Makin banyak percobaan dilakukan, frekuensi relatif makin mendekati peluang teoretisnya.'], [['frekuensi relatif', 'banyak kejadian / banyak percobaan']], 'Peluang selalu bernilai dari 0 (mustahil) sampai 1 (pasti).'),
  ], [
    Q('Peluang muncul mata dadu lebih dari 4 pada pelemparan sebuah dadu adalah …', ['1/3', '1/2', '2/3', '1/6'], 0, 'Mata dadu lebih dari 4 adalah 5 dan 6, jadi peluangnya 2/6 = 1/3.', 1),
    Q('Sebuah koin dilempar 50 kali dan sisi angka muncul 28 kali. Frekuensi relatif munculnya sisi angka adalah …', ['0,28', '0,56', '0,5', '0,44'], 1, '28 : 50 = 0,56. Nilai 0,5 adalah peluang teoretisnya.'),
    Q('Sebuah kantong berisi 4 kelereng merah dan 6 kelereng biru. Satu kelereng diambil secara acak. Peluang terambil kelereng merah adalah …', ['2/5', '3/5', '4/6', '1/4'], 0, 'Semua kelereng ada 10, yang merah 4, jadi peluangnya 4/10 = 2/5.'),
  ]),
  'MAT.C26.D.DATA:SAMPEL': K([
    S('Populasi dan sampel', ['**Populasi** adalah seluruh objek yang ingin diketahui; **sampel** adalah sebagian yang benar-benar diambil datanya.', 'Sampel **representatif** mewakili ciri populasi, misalnya dipilih acak dari semua kelas, bukan hanya dari satu kelas.'], [['sampel representatif', 'semua anggota berpeluang sama terpilih']]),
    S('Waspada bias', ['Sampel **bias** jika cara memilihnya condong ke kelompok tertentu.', 'Menanyakan olahraga favorit hanya kepada anggota klub basket akan membuat basket tampak paling populer di sekolah.'], [['memperkirakan populasi', 'proporsi sampel × ukuran populasi']], 'Tanyakan: apakah setiap anggota populasi punya kesempatan yang sama untuk terpilih?'),
  ], [
    Q('Kepala sekolah ingin mengetahui makanan kantin favorit seluruh siswa. Sampel yang paling representatif adalah …', ['10 siswa dari kelas 7A', '30 siswa yang dipilih acak dari setiap kelas', 'semua anggota OSIS', 'siswa yang berada di kantin pukul 07.00'], 1, 'Memilih acak dari setiap kelas memberi kesempatan yang sama bagi semua siswa untuk terpilih.'),
    Q('Survei tentang jam tidur siswa hanya dilakukan pada siswa yang mengikuti kegiatan malam. Hasil survei itu kemungkinan …', ['mewakili semua siswa', 'bias, cenderung menunjukkan jam tidur lebih sedikit', 'pasti sama dengan hasil populasi', 'tidak dapat dihitung'], 1, 'Siswa yang ikut kegiatan malam cenderung tidur lebih larut, jadi sampelnya condong ke satu kelompok.'),
    Q('Dari 200 siswa diambil sampel acak 40 siswa; 10 di antaranya suka membaca komik. Perkiraan banyak siswa di sekolah yang suka membaca komik adalah …', ['10', '40', '50', '25'], 2, 'Proporsi pada sampel 10/40 = 1/4, jadi perkiraannya 1/4 × 200 = 50 siswa.'),
  ]),
};
