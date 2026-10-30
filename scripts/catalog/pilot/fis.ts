import type { PilotCore, PilotQuestion, PilotRelation, PilotSlide, PilotTopic } from './types.js';
// Fisika fase E dan F, mengikuti topik dan inti peta IntiVerse. g = 10 m/s² kecuali disebut lain.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2, src: PilotQuestion['src'] = 'UN'): PilotQuestion => ({ p, o, a, why, d, src });
const C = (id: string, title: string, slides: [PilotSlide, PilotSlide], q: PilotQuestion[], extra: Partial<PilotCore> = {}): PilotCore => ({ id, title, slides, q, ...extra });

const UKUR: PilotTopic = {
  code: 'FIS.C26.E.UKUR', subject: 'FIS', title: 'Pengukuran ilmiah & analisis data', subtitle: 'Alat ukur, grafik, dan angka penting', phase: 'E', alias: 'pengukuran',
  bekal: ['besaran dan satuan SI', 'membaca skala'],
  cores: [
    C('C1', 'Ketidakpastian pengukuran', [
      S('Membaca alat ukur', ['**Jangka sorong** (ketelitian 0,01 cm): hasil = skala utama + (garis nonius yang berimpit × 0,01 cm).', '**Mikrometer sekrup** (ketelitian 0,01 mm): hasil = skala utama + (skala putar × 0,01 mm).'], [['jangka sorong', 'SU + nonius × 0,01 cm'], ['mikrometer', 'SU + putar × 0,01 mm']]),
      S('Menulis hasil ukur', ['Hasil pengukuran selalu ditulis dengan ketidakpastiannya: **x = x₀ ± Δx**. Untuk pengukuran tunggal, Δx biasanya setengah skala terkecil.', 'Ketidakpastian relatif **Δx/x₀ × 100%** menunjukkan seberapa teliti hasilnya.'], [['hasil', 'x₀ ± Δx'], ['relatif', 'Δx / x₀ × 100%']], 'Alat dengan skala terkecil lebih kecil memberi hasil yang lebih teliti.'),
    ], [
      Q('Pada pengukuran dengan jangka sorong, skala utama menunjukkan 2,3 cm dan garis nonius ke-6 berimpit dengan skala utama. Hasil pengukurannya adalah …', ['2,36 cm', '2,30 cm', '2,96 cm', '2,306 cm'], 0, '2,3 cm + 6 × 0,01 cm = 2,36 cm.', 1),
      Q('Mikrometer sekrup menunjukkan skala utama 4,5 mm dan skala putar pada angka 28. Hasil pengukurannya adalah …', ['4,78 mm', '4,528 mm', '7,30 mm', '4,28 mm'], 0, '4,5 mm + 28 × 0,01 mm = 4,5 + 0,28 = 4,78 mm.'),
    ], { min: 4 }),
    C('C2', 'Grafik dan model', [
      S('Gradien punya arti', ['Pada grafik posisi–waktu (s–t), **gradien = kecepatan**. Garis lurus berarti kecepatan tetap.', 'Contoh: garis dari (0 s, 0 m) ke (4 s, 20 m) ⇒ v = 20/4 = 5 m/s.'], [['v', 'Δs / Δt (gradien s–t)']]),
      S('Luas juga punya arti', ['Pada grafik kecepatan–waktu (v–t), **gradien = percepatan** dan **luas di bawah grafik = perpindahan**.', 'Contoh: v naik dari 0 ke 10 m/s dalam 5 s ⇒ luas segitiga = ½ × 5 × 10 = 25 m.'], [['a', 'gradien v–t'], ['s', 'luas di bawah v–t']], 'Selalu baca label sumbu dan satuannya sebelum menghitung.'),
    ], [
      Q('Grafik posisi terhadap waktu sebuah benda berupa garis lurus dari (0 s, 0 m) ke (4 s, 20 m). Kecepatan benda adalah …', ['4 m/s', '5 m/s', '20 m/s', '80 m/s'], 1, 'Gradien grafik s–t = 20 m / 4 s = 5 m/s.', 1),
      Q('Kecepatan benda naik beraturan dari 0 menjadi 10 m/s dalam 5 s. Perpindahan benda selama 5 s itu adalah …', ['2 m', '10 m', '25 m', '50 m'], 2, 'Perpindahan = luas segitiga di bawah grafik v–t = ½ × 5 × 10 = 25 m.'),
    ], { min: 4 }),
    C('SIGNIFIKAN', 'Angka penting & pelaporan', [
      S('Menghitung angka penting', ['Semua angka bukan nol penting. Nol **di antara** angka bukan nol penting. Nol **di depan** tidak penting. Nol **di belakang koma** penting.', 'Contoh: 0,005020 memiliki 4 angka penting (5, 0, 2, 0).'], [['0,005020', '4 angka penting']]),
      S('Aturan berhitung', ['**Perkalian/pembagian**: hasil mengikuti angka penting **paling sedikit**. **Penjumlahan/pengurangan**: hasil mengikuti angka desimal paling sedikit.', 'Contoh: 12,5 cm × 4,2 cm = 52,5 → dibulatkan menjadi 53 cm² (2 angka penting).'], [['kali/bagi', 'AP paling sedikit'], ['tambah/kurang', 'desimal paling sedikit']], 'Hasil hitung tidak boleh tampak lebih teliti daripada alat ukurnya.'),
    ], [
      Q('Banyak angka penting pada hasil pengukuran 0,005020 kg adalah …', ['3', '4', '6', '7'], 1, 'Nol di depan tidak penting; 5, 0, 2, dan 0 di belakang penting. Jadi 4 angka penting.'),
      Q('Panjang dan lebar pelat diukur 12,5 cm dan 4,2 cm. Luas pelat menurut aturan angka penting adalah …', ['52,5 cm²', '52,50 cm²', '53 cm²', '52 cm²'], 2, '12,5 × 4,2 = 52,5. Angka penting paling sedikit adalah 2 (dari 4,2), jadi dibulatkan menjadi 53 cm².', 3),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'SIGNIFIKAN', 'S']],
};

const GERAK2D: PilotTopic = {
  code: 'FIS.C26.E.GERAK2D', subject: 'FIS', title: 'Gerak dua dimensi', subtitle: 'Gerak lurus, perpaduan gerak, dan gerak parabola', phase: 'E', alias: 'gerak-parabola',
  bekal: ['gerak lurus', 'sinus dan kosinus'],
  cores: [
    C('GLBB', 'Gerak lurus (GLB dan GLBB)', [
      S('Kecepatan tetap atau percepatan tetap', ['**GLB**: kecepatan tetap, jarak **s = v · t**. **GLBB**: percepatan tetap, kecepatan berubah beraturan.', 'Tiga rumus GLBB cukup untuk hampir semua soal: pilih yang memuat besaran yang diketahui dan yang ditanya.'], [['GLB', 's = v · t'], ['v', 'v₀ + a · t'], ['s', 'v₀ · t + ½ · a · t²'], ['v²', 'v₀² + 2 · a · s']]),
      S('Gerak bertahap', ['Bila gerak berganti jenis (dipercepat lalu konstan), hitung **tiap tahap terpisah**: kecepatan akhir tahap pertama menjadi kecepatan tahap berikutnya.', 'Contoh: dari diam a = 2 m/s² selama 5 s ⇒ v = 10 m/s, s₁ = 25 m. Lalu konstan 4 s ⇒ s₂ = 40 m. Jarak total 65 m.'], [['s total', 's₁ + s₂']], 'Dari diam berarti v₀ = 0; berhenti berarti v akhir = 0.'),
    ], [
      Q('Sebuah mobil bergerak dari keadaan diam dengan percepatan tetap 3 m/s² selama 4 s. Jarak yang ditempuh mobil adalah …', ['12 m', '24 m', '36 m', '48 m'], 1, 's = ½ × 3 × 4² = 24 m.', 1),
      Q('Benda yang bergerak 20 m/s direm beraturan hingga berhenti dalam 4 s. Jarak pengereman adalah …', ['20 m', '40 m', '60 m', '80 m'], 1, 'Perlambatan 20/4 = 5 m/s². s = 20 × 4 − ½ × 5 × 16 = 40 m (sama dengan rata-rata kecepatan 10 m/s × 4 s).'),
      Q('Sebuah motor bergerak dari diam dengan percepatan 2 m/s² selama 5 s, lalu bergerak dengan kecepatan tetap selama 6 s. Jarak total yang ditempuh motor adalah …', ['60 m', '75 m', '85 m', '110 m'], 2, 'Tahap 1: v = 10 m/s, s₁ = ½ × 2 × 25 = 25 m. Tahap 2: s₂ = 10 × 6 = 60 m. Total 85 m.', 3),
    ], { min: 5 }),
    C('C1', 'Komponen gerak', [
      S('Dua gerak yang berjalan sendiri-sendiri', ['Gerak dua dimensi dapat diuraikan menjadi gerak pada sumbu x dan sumbu y yang **tidak saling memengaruhi**.', 'Contoh: perahu menyeberangi sungai. Waktu menyeberang hanya ditentukan kecepatan yang tegak lurus arus.'], [['t menyeberang', 'lebar sungai / v tegak lurus arus']]),
      S('Hanyut oleh arus', ['Selama waktu itu, arus menghanyutkan perahu sejauh **v arus × t**.', 'Contoh: lebar 60 m, perahu 3 m/s, arus 4 m/s ⇒ t = 20 s, hanyut 80 m, kecepatan resultan 5 m/s.'], [['hanyut', 'v arus × t']], 'Hitung waktu dari arah yang lebarnya diketahui, lalu pakai waktu itu untuk arah lain.'),
    ], [
      Q('Sebuah perahu menyeberangi sungai selebar 60 m dengan kecepatan 3 m/s tegak lurus arus. Kecepatan arus 4 m/s. Waktu yang diperlukan untuk menyeberang adalah …', ['12 s', '15 s', '20 s', '30 s'], 2, 'Waktu menyeberang hanya bergantung kecepatan tegak lurus arus: 60 / 3 = 20 s.'),
      Q('Pada keadaan yang sama (lebar 60 m, perahu 3 m/s, arus 4 m/s), perahu hanyut searah arus sejauh …', ['45 m', '60 m', '80 m', '100 m'], 2, 'Waktu menyeberang 20 s, jadi hanyut 4 × 20 = 80 m.'),
    ], { min: 4 }),
    C('VEKTOR', 'Proyeksi vektor gerak', [
      S('Mengurai kecepatan', ['Kecepatan v yang membentuk sudut θ terhadap horizontal diuraikan menjadi **vₓ = v cos θ** dan **vᵧ = v sin θ**.', 'Contoh: v = 20 m/s, θ = 30° ⇒ vₓ = 10√3 m/s, vᵧ = 10 m/s.'], [['vₓ', 'v cos θ'], ['vᵧ', 'v sin θ']]),
      S('Menggabungkan kembali', ['Besar kecepatan dari komponennya: **v = √(vₓ² + vᵧ²)**, arahnya tan θ = vᵧ/vₓ.', 'Contoh: vₓ = 6 m/s, vᵧ = 8 m/s ⇒ v = 10 m/s.'], [['v', '√(vₓ² + vᵧ²)']], 'Komponen yang bersebelahan dengan sudut memakai cos, yang berseberangan memakai sin.'),
    ], [
      Q('Sebuah benda bergerak dengan kecepatan 20 m/s membentuk sudut 30° terhadap horizontal. Komponen kecepatan horizontalnya adalah …', ['10 m/s', '10√3 m/s', '20 m/s', '10√2 m/s'], 1, 'vₓ = 20 cos 30° = 20 × ½√3 = 10√3 m/s.', 1),
      Q('Komponen kecepatan sebuah benda adalah vₓ = 6 m/s dan vᵧ = 8 m/s. Besar kecepatan benda adalah …', ['7 m/s', '10 m/s', '14 m/s', '48 m/s'], 1, 'v = √(6² + 8²) = √100 = 10 m/s.', 1),
    ], { min: 4 }),
    C('C2', 'Gerak peluru ideal', [
      S('Dua gerak dalam satu lintasan', ['Tanpa hambatan udara, gerak peluru = **GLB pada sumbu x** (vₓ tetap) + **GLBB pada sumbu y** (percepatan −g).', 'Di titik tertinggi, **vᵧ = 0** dan kecepatannya hanya vₓ.'], [['tₘₐₖₛ', 'v₀ sin θ / g'], ['H', 'v₀² sin² θ / 2g']]),
      S('Jangkauan', ['Jarak mendatar terjauh: **R = v₀² sin 2θ / g**. Jangkauan terbesar dicapai pada **θ = 45°**.', 'Contoh: v₀ = 40 m/s, θ = 30° ⇒ H = 20 m, R = 80√3 m.'], [['R', 'v₀² sin 2θ / g']], 'Sudut θ dan 90° − θ memberi jangkauan yang sama.'),
    ], [
      Q('Sebuah peluru ditembakkan dengan kecepatan awal 40 m/s dan sudut elevasi 30° (g = 10 m/s²). Tinggi maksimum peluru adalah …', ['10 m', '20 m', '40 m', '80 m'], 1, 'v₀ sin 30° = 20 m/s. H = 20² / (2 × 10) = 20 m.'),
      Q('Peluru yang sama (v₀ = 40 m/s, θ = 30°, g = 10 m/s²) mencapai jarak mendatar terjauh …', ['80 m', '80√3 m', '160 m', '40√3 m'], 1, 'R = 40² × sin 60° / 10 = 160 × ½√3 = 80√3 m.', 3),
      Q('Tanpa hambatan udara, sudut elevasi yang menghasilkan jangkauan mendatar paling jauh adalah …', ['30°', '45°', '60°', '90°'], 1, 'R sebanding dengan sin 2θ, yang bernilai maksimum 1 saat 2θ = 90°, yaitu θ = 45°.', 1),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['GLBB', 'C1', 'S'], ['C1', 'VEKTOR', 'S'], ['C1', 'C2', 'S']],
};

const ENERGI: PilotTopic = {
  code: 'FIS.C26.E.ENERGI', subject: 'FIS', title: 'Energi alternatif & perubahan iklim', subtitle: 'Daya, efisiensi, dan pilihan energi', phase: 'E', alias: 'energi-alternatif',
  bekal: ['usaha dan energi', 'energi listrik'],
  cores: [
    C('C1', 'Daya dan efisiensi', [
      S('Daya = usaha per waktu', ['**P = W / t**, satuannya watt (J/s). Mengangkat beban: W = m · g · h.', 'Contoh: 50 kg diangkat 10 m dalam 20 s ⇒ P = 50 × 10 × 10 / 20 = 250 W.'], [['P', 'W / t'], ['W angkat', 'm · g · h']]),
      S('Efisiensi', ['Tidak ada mesin yang mengubah seluruh energi menjadi energi berguna. **η = energi keluaran berguna / energi masukan × 100%**.', 'Contoh: lampu 60 W memancarkan 9 W cahaya ⇒ η = 15%; sisanya menjadi panas.'], [['η', 'P keluaran / P masukan × 100%']], 'Efisiensi selalu kurang dari 100%.'),
    ], [
      Q('Sebuah motor listrik mengangkat beban 50 kg setinggi 10 m dalam waktu 20 s (g = 10 m/s²). Daya motor adalah …', ['25 W', '100 W', '250 W', '5.000 W'], 2, 'W = mgh = 50 × 10 × 10 = 5.000 J. P = 5.000 / 20 = 250 W.'),
      Q('Sebuah lampu menerima daya listrik 60 W dan memancarkan cahaya 9 W. Efisiensi lampu adalah …', ['9%', '15%', '51%', '85%'], 1, 'η = 9 / 60 × 100% = 15%.', 1),
    ], { min: 4 }),
    C('C2', 'Evaluasi pilihan energi', [
      S('Terbarukan dan tidak terbarukan', ['Energi **terbarukan**: matahari, angin, air, panas bumi, biomassa. **Tidak terbarukan**: batu bara, minyak bumi, gas alam (bahan bakar fosil).', 'Pembakaran bahan bakar fosil melepaskan CO₂ yang memperkuat efek rumah kaca.'], [['fosil', 'menghasilkan CO₂']]),
      S('Pilih sesuai kondisi', ['Setiap sumber punya syarat: PLTS butuh sinar matahari, PLTB butuh angin stabil, **PLTMH (mikrohidro)** butuh aliran sungai yang deras sepanjang tahun.', 'Pertimbangkan ketersediaan, biaya, dan dampak lingkungan.'], [['sungai deras', 'PLTMH']], 'Jawaban terbaik bergantung pada sumber daya yang benar-benar ada di lokasi.'),
    ], [
      Q('Sumber energi berikut yang termasuk energi terbarukan adalah …', ['batu bara', 'minyak bumi', 'gas alam', 'panas bumi'], 3, 'Panas bumi terus dihasilkan dari dalam bumi. Batu bara, minyak, dan gas adalah bahan bakar fosil.', 1, 'KM'),
      Q('Sebuah desa terpencil di pegunungan memiliki sungai berarus deras sepanjang tahun dan belum terjangkau jaringan listrik. Pembangkit yang paling tepat adalah …', ['PLTU batu bara', 'PLTMH (mikrohidro)', 'PLTD solar', 'PLTN'], 1, 'Aliran sungai yang deras dan tetap cocok untuk mikrohidro: terbarukan, murah dioperasikan, dan sesuai skala desa.', 2, 'SNBT'),
    ], { min: 4 }),
    C('NERACA', 'Neraca kebutuhan energi', [
      S('Energi listrik di rumah', ['Energi = daya × waktu: **W = P · t**. Dalam tagihan listrik dipakai satuan **kWh** (1 kWh = 1.000 W × 1 jam).', 'Contoh: 4 lampu 10 W menyala 10 jam = 400 Wh = 0,4 kWh.'], [['W', 'P · t'], ['1 kWh', '1.000 W × 1 jam']]),
      S('Menghitung biaya', ['Biaya = energi (kWh) × tarif per kWh.', 'Contoh: setrika 400 W, 30 menit sehari, 30 hari ⇒ 0,4 × 0,5 × 30 = 6 kWh. Dengan tarif Rp1.500/kWh ⇒ Rp9.000.'], [['biaya', 'kWh × tarif']], 'Ubah watt ke kilowatt dan menit ke jam sebelum mengalikan.'),
    ], [
      Q('Sebuah rumah memakai 4 lampu 10 W selama 10 jam sehari dan sebuah TV 100 W selama 5 jam sehari. Energi listrik yang dipakai per hari adalah …', ['0,5 kWh', '0,9 kWh', '1,4 kWh', '9 kWh'], 1, 'Lampu: 4 × 10 × 10 = 400 Wh. TV: 100 × 5 = 500 Wh. Total 900 Wh = 0,9 kWh.'),
      Q('Setrika 400 W dipakai 30 menit setiap hari selama 30 hari. Jika tarif listrik Rp1.500 per kWh, biaya pemakaian setrika adalah …', ['Rp6.000', 'Rp9.000', 'Rp18.000', 'Rp90.000'], 1, '0,4 kW × 0,5 jam × 30 hari = 6 kWh. Biaya = 6 × 1.500 = Rp9.000.'),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'NERACA', 'S']],
};

const MEKANIKA: PilotTopic = {
  code: 'FIS.C26.F.MEKANIKA', subject: 'FIS', title: 'Dinamika, momentum & keseimbangan', subtitle: 'Hukum Newton, impuls, torsi, rotasi', phase: 'F', alias: 'dinamika',
  bekal: ['gerak lurus', 'vektor gaya'],
  cores: [
    C('C1', 'Hukum Newton & momentum', [
      S('ΣF = m · a', ['Hukum II Newton: percepatan sebanding dengan gaya total dan berbanding terbalik dengan massa: **ΣF = m · a**.', 'Contoh: 20 N pada benda 4 kg di lantai licin ⇒ a = 5 m/s².'], [['ΣF', 'm · a']]),
      S('Sistem benda terhubung', ['Untuk benda yang dihubungkan tali, hitung dulu percepatan **seluruh sistem**: a = F / (m₁ + m₂). Lalu tinjau satu benda untuk mencari tegangan tali.', 'Contoh: 2 kg dan 3 kg ditarik 20 N ⇒ a = 4 m/s² ⇒ tegangan tali yang menarik balok 2 kg = 2 × 4 = 8 N.'], [['a sistem', 'F / Σm'], ['T', 'm₁ · a']], 'Pilih benda yang gayanya paling sedikit untuk mencari tegangan tali.'),
    ], [
      Q('Gaya 20 N bekerja pada benda bermassa 4 kg di atas lantai licin. Percepatan benda adalah …', ['0,2 m/s²', '5 m/s²', '16 m/s²', '80 m/s²'], 1, 'a = F / m = 20 / 4 = 5 m/s².', 1),
      Q('Balok A (2 kg) dan balok B (3 kg) dihubungkan tali di lantai licin. Balok B ditarik dengan gaya 20 N sehingga keduanya bergerak bersama. Tegangan tali penghubung adalah …', ['4 N', '8 N', '12 N', '20 N'], 1, 'a = 20 / (2 + 3) = 4 m/s². Tali menarik balok A: T = 2 × 4 = 8 N.'),
    ], { min: 5 }),
    C('C2', 'Torsi dan keseimbangan', [
      S('Torsi = gaya × lengan', ['Torsi (momen gaya) membuat benda berputar: **τ = F · r · sin θ**. Jika gaya tegak lurus lengan, τ = F · r.', 'Contoh: 10 N tegak lurus kunci inggris 0,2 m ⇒ τ = 2 N·m.'], [['τ', 'F · r · sin θ']]),
      S('Syarat seimbang', ['Benda seimbang bila **ΣF = 0** dan **Στ = 0** terhadap titik mana pun.', 'Jungkat-jungkit: m₁ · r₁ = m₂ · r₂. Contoh: 30 kg pada 2 m seimbang dengan 40 kg pada 1,5 m.'], [['seimbang', 'ΣF = 0 dan Στ = 0']], 'Pilih poros di titik yang gayanya tidak diketahui agar torsinya nol.'),
    ], [
      Q('Gaya 10 N dikerjakan tegak lurus pada ujung kunci inggris yang berjarak 0,2 m dari poros. Torsi yang dihasilkan adalah …', ['0,02 N·m', '2 N·m', '10,2 N·m', '50 N·m'], 1, 'τ = F × r = 10 × 0,2 = 2 N·m.', 1),
      Q('Seorang anak bermassa 30 kg duduk 2 m dari poros jungkat-jungkit. Agar seimbang, anak bermassa 40 kg harus duduk pada jarak … dari poros di sisi lain.', ['1 m', '1,5 m', '2 m', '2,67 m'], 1, 'Στ = 0: 30 × 2 = 40 × x, jadi x = 1,5 m.'),
    ], { min: 5 }),
    C('IMPULS', 'Impuls dan momentum', [
      S('Impuls mengubah momentum', ['Momentum **p = m · v** (vektor). Impuls **I = F · Δt = Δp = m(v₂ − v₁)**.', 'Perhatikan arah: bola yang berbalik arah mengalami perubahan kecepatan yang besar.'], [['p', 'm · v'], ['I', 'F · Δt = m(v₂ − v₁)']]),
      S('Kekekalan momentum', ['Saat tumbukan tanpa gaya luar: **m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′**. Jika menyatu: (m₁ + m₂)v′.', 'Contoh: 2 kg bergerak 6 m/s menumbuk 4 kg diam lalu menyatu ⇒ v′ = 12/6 = 2 m/s.'], [['tumbukan', 'Σp sebelum = Σp sesudah']], 'Tetapkan arah positif dulu; kecepatan berlawanan arah diberi tanda negatif.'),
    ], [
      Q('Bola bermassa 0,5 kg bergerak 10 m/s, lalu dipukul sehingga berbalik arah dengan kecepatan 20 m/s. Besar impuls yang diberikan pemukul adalah …', ['5 N·s', '10 N·s', '15 N·s', '30 N·s'], 2, 'Arah awal positif: I = 0,5 × (−20 − 10) = −15 N·s. Besarnya 15 N·s.'),
      Q('Balok 2 kg yang bergerak 6 m/s menumbuk balok 4 kg yang diam. Setelah tumbukan keduanya menyatu. Kecepatan kedua balok setelah tumbukan adalah …', ['1 m/s', '2 m/s', '3 m/s', '4 m/s'], 1, 'Kekekalan momentum: 2 × 6 = (2 + 4)v′, jadi v′ = 2 m/s.'),
    ], { min: 5 }),
    C('ROTASI', 'Dinamika rotasi', [
      S('Hukum Newton untuk rotasi', ['**τ = I · α**: torsi menghasilkan percepatan sudut. I adalah momen inersia, makin besar makin sulit diputar.', 'Silinder pejal: I = ½mR². Contoh: m = 4 kg, R = 0,5 m ⇒ I = 0,5 kg·m²; τ = 2 N·m ⇒ α = 4 rad/s².'], [['τ', 'I · α'], ['silinder pejal', 'I = ½mR²']]),
      S('Kekekalan momentum sudut', ['Tanpa torsi luar: **I₁ω₁ = I₂ω₂**.', 'Penari yang merapatkan lengan memperkecil I sehingga berputar lebih cepat.'], [['L', 'I · ω tetap']], 'I mengecil setengah ⇒ ω menjadi dua kali.'),
    ], [
      Q('Seorang penari berputar dengan kecepatan sudut 2 putaran/s. Ia merapatkan lengan sehingga momen inersianya menjadi setengah semula. Kecepatan sudutnya menjadi …', ['1 putaran/s', '2 putaran/s', '4 putaran/s', '8 putaran/s'], 2, 'I₁ω₁ = I₂ω₂: I × 2 = ½I × ω₂, jadi ω₂ = 4 putaran/s.'),
      Q('Silinder pejal bermassa 4 kg dan berjari-jari 0,5 m (I = ½mR²) diberi torsi 2 N·m. Percepatan sudutnya adalah …', ['1 rad/s²', '2 rad/s²', '4 rad/s²', '8 rad/s²'], 2, 'I = ½ × 4 × 0,25 = 0,5 kg·m². α = τ / I = 2 / 0,5 = 4 rad/s².', 3),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'IMPULS', 'S'], ['C1', 'ROTASI', 'S']],
};

const FLUIDA: PilotTopic = {
  code: 'FIS.C26.F.FLUIDA', subject: 'FIS', title: 'Fluida statis dan dinamis', subtitle: 'Tekanan, Archimedes, Pascal, Bernoulli', phase: 'F', alias: 'fluida',
  bekal: ['massa jenis', 'gaya dan tekanan'],
  cores: [
    C('C1', 'Tekanan dan gaya apung', [
      S('Tekanan hidrostatis', ['Tekanan zat cair bertambah dengan kedalaman: **Pₕ = ρ · g · h**.', 'Contoh: kedalaman 5 m di air (ρ = 1.000 kg/m³) ⇒ Pₕ = 50.000 Pa.'], [['Pₕ', 'ρ · g · h']]),
      S('Hukum Archimedes', ['Benda yang tercelup mendapat gaya ke atas sebesar berat zat cair yang dipindahkan: **Fₐ = ρ_f · g · V_tercelup**.', 'Benda terapung: berat = Fₐ, sehingga ρ_benda · V = ρ_f · V_tercelup.'], [['Fₐ', 'ρ_f · g · V_tercelup'], ['terapung', 'ρ_b / ρ_f = V_tercelup / V']], 'Yang dipakai adalah volume yang tercelup, bukan volume seluruh benda.'),
    ], [
      Q('Tekanan hidrostatis pada kedalaman 5 m di bawah permukaan air (ρ = 1.000 kg/m³, g = 10 m/s²) adalah …', ['500 Pa', '5.000 Pa', '50.000 Pa', '500.000 Pa'], 2, 'Pₕ = 1.000 × 10 × 5 = 50.000 Pa.', 1),
      Q('Sebuah balok bervolume 0,002 m³ tercelup seluruhnya di dalam air (ρ = 1.000 kg/m³). Gaya apung yang dialami balok adalah …', ['2 N', '20 N', '200 N', '2.000 N'], 1, 'Fₐ = 1.000 × 10 × 0,002 = 20 N.'),
      Q('Sebuah benda terapung di air dengan 3/4 bagian volumenya tercelup. Massa jenis benda adalah …', ['250 kg/m³', '750 kg/m³', '1.000 kg/m³', '1.333 kg/m³'], 1, 'Terapung: ρ_benda = (V_tercelup / V) × ρ_air = 3/4 × 1.000 = 750 kg/m³.', 3),
    ], { min: 5 }),
    C('PASCAL', 'Hukum Pascal', [
      S('Tekanan diteruskan ke segala arah', ['Tekanan pada zat cair tertutup diteruskan sama besar ke segala arah. Pada dua pengisap: **F₁/A₁ = F₂/A₂**.'], [['F₁ / A₁', 'F₂ / A₂']]),
      S('Gaya kecil, beban besar', ['Dongkrak hidrolik: A₁ = 10 cm², A₂ = 500 cm², F₁ = 200 N ⇒ F₂ = 200 × 50 = 10.000 N.', 'Penerapan lain: rem hidrolik, kursi dokter gigi, mesin press.'], [['F₂', 'F₁ × A₂ / A₁']], 'Satuan luas tidak perlu diubah selama keduanya sama.'),
    ], [
      Q('Dongkrak hidrolik memiliki pengisap kecil 10 cm² dan pengisap besar 500 cm². Gaya 200 N pada pengisap kecil dapat mengangkat beban sebesar …', ['4 N', '1.000 N', '10.000 N', '100.000 N'], 2, 'F₂ = F₁ × A₂ / A₁ = 200 × 500 / 10 = 10.000 N.'),
      Q('Prinsip kerja rem hidrolik pada kendaraan berdasarkan hukum …', ['Archimedes', 'Pascal', 'Bernoulli', 'Boyle'], 1, 'Tekanan dari pedal diteruskan oleh minyak rem ke semua roda: Hukum Pascal.', 1, 'KM'),
    ], { min: 4 }),
    C('C2', 'Kontinuitas dan Bernoulli', [
      S('Persamaan kontinuitas', ['Debit tetap di sepanjang pipa: **A₁v₁ = A₂v₂**. Pipa menyempit ⇒ aliran makin cepat.', 'Contoh: 20 cm² dengan 2 m/s menyempit ke 5 cm² ⇒ v = 8 m/s.'], [['Q', 'A · v'], ['A₁v₁', 'A₂v₂']]),
      S('Persamaan Bernoulli', ['**P + ½ρv² + ρgh = tetap**. Di tempat alirannya cepat, tekanannya kecil (gaya angkat sayap pesawat).', 'Teorema Torricelli: air keluar dari lubang sedalam h di bawah permukaan dengan **v = √(2gh)**.'], [['P + ½ρv² + ρgh', 'tetap'], ['Torricelli', 'v = √(2gh)']], 'h pada Torricelli diukur dari permukaan air ke lubang, bukan dari dasar.'),
    ], [
      Q('Air mengalir dalam pipa berpenampang 20 cm² dengan kecepatan 2 m/s, lalu masuk ke bagian yang penampangnya 5 cm². Kecepatan air di bagian sempit adalah …', ['0,5 m/s', '4 m/s', '8 m/s', '10 m/s'], 2, 'A₁v₁ = A₂v₂: 20 × 2 = 5 × v₂, jadi v₂ = 8 m/s.', 1),
      Q('Sebuah tangki air bocor pada lubang yang berada 5 m di bawah permukaan air (g = 10 m/s²). Kecepatan air yang keluar dari lubang adalah …', ['5 m/s', '10 m/s', '50 m/s', '100 m/s'], 1, 'v = √(2gh) = √(2 × 10 × 5) = √100 = 10 m/s.'),
      Q('Gaya angkat pada sayap pesawat terjadi karena …', ['udara di atas sayap lebih lambat sehingga tekanannya lebih besar', 'udara di atas sayap lebih cepat sehingga tekanannya lebih kecil', 'massa jenis udara di bawah sayap lebih kecil', 'gaya apung udara sama dengan berat pesawat'], 1, 'Menurut Bernoulli, aliran yang lebih cepat di atas sayap bertekanan lebih kecil, sehingga ada selisih tekanan ke atas.', 2, 'KM'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'PASCAL', 'S'], ['C1', 'C2', 'S']],
};

const TERMAL: PilotTopic = {
  code: 'FIS.C26.F.TERMAL', subject: 'FIS', title: 'Kalor dan termodinamika', subtitle: 'Asas Black, Hukum I, mesin Carnot', phase: 'F', alias: 'termodinamika',
  bekal: ['suhu dan kalor', 'usaha dan energi'],
  cores: [
    C('C1', 'Kalor & perubahan wujud', [
      S('Kalor untuk menaikkan suhu', ['**Q = m · c · ΔT** (c kalor jenis). Saat berubah wujud suhu tetap: **Q = m · L** (L kalor laten).', 'Contoh: 2 kg air dari 20°C ke 70°C (c = 4.200 J/kg°C) ⇒ Q = 420.000 J.'], [['Q', 'm · c · ΔT'], ['berubah wujud', 'Q = m · L']]),
      S('Asas Black', ['Saat dua zat dicampur: **kalor dilepas = kalor diterima**. Untuk zat yang sama: T campuran = (m₁T₁ + m₂T₂) / (m₁ + m₂).', 'Contoh: 200 g air 80°C + 300 g air 20°C ⇒ T = 44°C.'], [['Q lepas', 'Q terima']], 'Suhu campuran selalu di antara dua suhu awal.'),
    ], [
      Q('Kalor yang diperlukan untuk memanaskan 2 kg air dari 20°C menjadi 70°C (c air = 4.200 J/kg°C) adalah …', ['42.000 J', '210.000 J', '420.000 J', '840.000 J'], 2, 'Q = 2 × 4.200 × 50 = 420.000 J.', 1),
      Q('Sebanyak 200 g air bersuhu 80°C dicampur dengan 300 g air bersuhu 20°C. Jika tidak ada kalor yang hilang, suhu akhir campuran adalah …', ['44°C', '50°C', '56°C', '40°C'], 0, 'Asas Black: 200(80 − T) = 300(T − 20) ⇒ 16.000 + 6.000 = 500T ⇒ T = 44°C.'),
    ], { min: 5 }),
    C('C2', 'Hukum I termodinamika', [
      S('Kekekalan energi untuk gas', ['**Q = ΔU + W**. Q positif bila gas menerima kalor; W positif bila gas melakukan usaha (memuai).', 'Contoh: gas menyerap 500 J dan melakukan usaha 200 J ⇒ ΔU = 300 J.'], [['Q', 'ΔU + W']]),
      S('Usaha pada tekanan tetap', ['Proses **isobarik**: **W = P · ΔV**. Ubah liter ke m³: 1 L = 10⁻³ m³.', 'Contoh: P = 2 × 10⁵ Pa, volume 2 L → 5 L ⇒ W = 2 × 10⁵ × 3 × 10⁻³ = 600 J.'], [['W isobarik', 'P · ΔV'], ['1 L', '10⁻³ m³']], 'Perhatikan tanda: gas ditekan berarti W negatif.'),
    ], [
      Q('Suatu gas menyerap kalor 500 J dan melakukan usaha 200 J. Perubahan energi dalam gas adalah …', ['200 J', '300 J', '500 J', '700 J'], 1, 'ΔU = Q − W = 500 − 200 = 300 J.', 1),
      Q('Gas pada tekanan tetap 2 × 10⁵ Pa memuai dari 2 liter menjadi 5 liter. Usaha yang dilakukan gas adalah …', ['60 J', '600 J', '6.000 J', '1.000 J'], 1, 'W = P · ΔV = 2 × 10⁵ × 3 × 10⁻³ m³ = 600 J.'),
    ], { min: 5 }),
    C('MESIN', 'Mesin kalor & batas efisiensi', [
      S('Mesin kalor', ['Mesin menyerap kalor Q₁ dari reservoir panas, membuang Q₂ ke reservoir dingin, dan menghasilkan usaha **W = Q₁ − Q₂**.', 'Efisiensi **η = W / Q₁**.'], [['W', 'Q₁ − Q₂'], ['η', 'W / Q₁']]),
      S('Batas Carnot', ['Efisiensi terbesar yang mungkin (mesin Carnot): **η = 1 − T₂/T₁**, suhu dalam kelvin.', 'Contoh: 600 K dan 300 K ⇒ η = 50%. Mesin nyata selalu di bawah batas ini.'], [['η Carnot', '1 − T₂ / T₁']], 'Ubah °C ke kelvin dengan menambah 273 sebelum memakai rumus Carnot.'),
    ], [
      Q('Sebuah mesin Carnot bekerja di antara reservoir bersuhu 600 K dan 300 K. Efisiensi mesin adalah …', ['25%', '50%', '75%', '100%'], 1, 'η = 1 − 300/600 = 1/2 = 50%.', 1),
      Q('Sebuah mesin kalor menyerap 1.000 J dari reservoir panas dan membuang 600 J ke reservoir dingin. Efisiensi mesin adalah …', ['37,5%', '40%', '60%', '160%'], 1, 'W = 1.000 − 600 = 400 J. η = 400 / 1.000 = 40%.'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'C2', 'S'], ['C1', 'MESIN', 'S']],
};

const GELOMBANG: PilotTopic = {
  code: 'FIS.C26.F.GELOMBANG', subject: 'FIS', title: 'Gelombang dan penerapannya', subtitle: 'Interferensi, resonansi, optik, Doppler', phase: 'F', alias: 'gelombang',
  bekal: ['getaran', 'cepat rambat'],
  cores: [
    C('C1', 'Superposisi & interferensi', [
      S('Persamaan dasar gelombang', ['Cepat rambat gelombang **v = λ · f**. Dua gelombang yang bertemu saling menjumlah (superposisi): bisa saling menguatkan atau melemahkan.', 'Contoh: f = 50 Hz, λ = 2 m ⇒ v = 100 m/s.'], [['v', 'λ · f']]),
      S('Interferensi celah ganda', ['Pola terang pada layar: **d · y / L = n · λ** (d jarak celah, y jarak terang ke-n dari terang pusat, L jarak layar).', 'Contoh: d = 0,2 mm, L = 1 m, y₁ = 3 mm ⇒ λ = 6 × 10⁻⁷ m = 600 nm.'], [['terang ke-n', 'd · y / L = n · λ']], 'Samakan semua satuan ke meter sebelum menghitung.'),
    ], [
      Q('Sebuah gelombang memiliki frekuensi 50 Hz dan panjang gelombang 2 m. Cepat rambat gelombang adalah …', ['25 m/s', '52 m/s', '100 m/s', '200 m/s'], 2, 'v = λf = 2 × 50 = 100 m/s.', 1),
      Q('Pada percobaan celah ganda, jarak antarcelah 0,2 mm dan layar berjarak 1 m. Jarak terang pertama dari terang pusat 3 mm. Panjang gelombang cahaya adalah …', ['300 nm', '450 nm', '600 nm', '750 nm'], 2, 'λ = d · y / L = (0,2 × 10⁻³)(3 × 10⁻³)/1 = 6 × 10⁻⁷ m = 600 nm.', 3),
    ], { min: 5 }),
    C('C2', 'Resonansi dan optik', [
      S('Pipa organa', ['Pipa **terbuka** (kedua ujung terbuka): fₙ = n · v / 2L. Pipa **tertutup**: f = (2n − 1) · v / 4L, hanya harmonik ganjil.', 'Contoh: pipa terbuka 50 cm, v = 340 m/s ⇒ nada dasar 340 Hz.'], [['terbuka', 'f₁ = v / 2L'], ['tertutup', 'f₁ = v / 4L']]),
      S('Lensa', ['Persamaan lensa: **1/f = 1/s + 1/s′**. Lensa cembung f positif. s′ positif berarti bayangan nyata di belakang lensa.', 'Contoh: s = 30 cm, f = 20 cm ⇒ s′ = 60 cm.'], [['1/f', '1/s + 1/s′'], ['perbesaran', 'M = s′ / s']], 'Pakai satuan yang sama (cm) untuk s, s′, dan f.'),
    ], [
      Q('Pipa organa terbuka panjangnya 50 cm. Jika cepat rambat bunyi 340 m/s, frekuensi nada dasarnya adalah …', ['170 Hz', '340 Hz', '680 Hz', '1.360 Hz'], 1, 'f₁ = v / 2L = 340 / (2 × 0,5) = 340 Hz.'),
      Q('Benda diletakkan 30 cm di depan lensa cembung yang jarak fokusnya 20 cm. Jarak bayangan dari lensa adalah …', ['12 cm', '24 cm', '50 cm', '60 cm'], 3, '1/s′ = 1/20 − 1/30 = 1/60, jadi s′ = 60 cm (nyata).'),
    ], { min: 5 }),
    C('DOPPLER', 'Efek Doppler', [
      S('Frekuensi berubah karena gerak', ['Saat sumber bunyi dan pendengar saling mendekat, frekuensi yang terdengar **lebih tinggi**; saat menjauh, **lebih rendah**.', '**fₚ = (v ± vₚ) / (v ∓ vₛ) · fₛ**.'], [['fₚ', '(v ± vₚ)/(v ∓ vₛ) · fₛ']]),
      S('Aturan tanda', ['Pembilang (pendengar): **+vₚ** jika pendengar mendekati sumber. Penyebut (sumber): **−vₛ** jika sumber mendekati pendengar.', 'Contoh: ambulans 680 Hz mendekat 20 m/s, v = 340 m/s ⇒ fₚ = 340/320 × 680 = 722,5 Hz.'], [['mendekat', 'frekuensi naik']], 'Cek hasil: mendekat harus memberi frekuensi lebih besar dari sumber.'),
    ], [
      Q('Ambulans membunyikan sirene 680 Hz sambil bergerak mendekati pendengar yang diam dengan kecepatan 20 m/s. Jika cepat rambat bunyi 340 m/s, frekuensi yang didengar adalah …', ['640 Hz', '680 Hz', '720 Hz', '722,5 Hz'], 3, 'fₚ = 340 / (340 − 20) × 680 = 340/320 × 680 = 722,5 Hz.', 3),
      Q('Ketika sumber bunyi bergerak menjauhi pendengar yang diam, frekuensi yang didengar …', ['lebih tinggi dari frekuensi sumber', 'lebih rendah dari frekuensi sumber', 'sama dengan frekuensi sumber', 'menjadi nol'], 1, 'Saat menjauh, gelombang yang sampai ke pendengar lebih renggang, sehingga frekuensinya lebih rendah.', 1, 'KM'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'DOPPLER', 'S']],
};

const ELEKTRO: PilotTopic = {
  code: 'FIS.C26.F.ELEKTRO', subject: 'FIS', title: 'Rangkaian & elektromagnetisme', subtitle: 'Hukum Ohm, Kirchhoff, induksi', phase: 'F', alias: 'listrik',
  bekal: ['arus dan tegangan', 'magnet'],
  cores: [
    C('C1', 'Hukum rangkaian', [
      S('Hukum Ohm dan susunan resistor', ['**V = I · R**. Seri: **Rₛ = R₁ + R₂**, arusnya sama. Paralel: **1/Rₚ = 1/R₁ + 1/R₂**, tegangannya sama.', 'Contoh: 4 Ω paralel 12 Ω ⇒ Rₚ = 3 Ω.'], [['V', 'I · R'], ['paralel', '1/Rₚ = 1/R₁ + 1/R₂']]),
      S('Membagi tegangan', ['Pada rangkaian seri, tegangan terbagi sebanding dengan hambatan.', 'Contoh: 2 Ω dan 4 Ω seri pada 12 V ⇒ I = 2 A ⇒ V pada 4 Ω = 8 V. Daya **P = V · I = I²R**.'], [['P', 'V · I = I² · R']], 'Hambatan paralel selalu lebih kecil dari hambatan terkecilnya.'),
    ], [
      Q('Dua resistor 4 Ω dan 12 Ω disusun paralel. Hambatan penggantinya adalah …', ['3 Ω', '8 Ω', '16 Ω', '48 Ω'], 0, '1/Rₚ = 1/4 + 1/12 = 4/12, jadi Rₚ = 3 Ω.', 1),
      Q('Resistor 2 Ω dan 4 Ω disusun seri lalu dihubungkan ke baterai 12 V. Tegangan pada resistor 4 Ω adalah …', ['4 V', '6 V', '8 V', '12 V'], 2, 'Rₛ = 6 Ω, I = 12/6 = 2 A, V₄ = 2 × 4 = 8 V.'),
    ], { min: 5 }),
    C('C2', 'Induksi elektromagnetik', [
      S('GGL induksi', ['Perubahan fluks magnet menimbulkan GGL: **ε = −N · ΔΦ / Δt** (Hukum Faraday). Tanda minus menunjukkan arah yang melawan perubahan (Hukum Lenz).', 'Contoh: 100 lilitan, ΔΦ = 0,02 Wb dalam 0,1 s ⇒ ε = 20 V.'], [['ε', 'N · ΔΦ / Δt']]),
      S('Transformator', ['Trafo mengubah tegangan bolak-balik: **Vₚ / Vₛ = Nₚ / Nₛ**. Ideal: **Vₚ · Iₚ = Vₛ · Iₛ**.', 'Contoh: Nₚ = 1.000, Nₛ = 200, Vₚ = 220 V ⇒ Vₛ = 44 V (trafo step-down).'], [['Vₚ / Vₛ', 'Nₚ / Nₛ']], 'Lilitan sekunder lebih sedikit berarti tegangan turun, arus naik.'),
    ], [
      Q('Sebuah kumparan 100 lilitan mengalami perubahan fluks magnet 0,02 Wb dalam 0,1 s. Besar GGL induksi yang timbul adalah …', ['0,2 V', '2 V', '20 V', '200 V'], 2, 'ε = N · ΔΦ/Δt = 100 × 0,02 / 0,1 = 20 V.'),
      Q('Transformator ideal memiliki 1.000 lilitan primer dan 200 lilitan sekunder. Jika tegangan primer 220 V, tegangan sekundernya adalah …', ['22 V', '44 V', '440 V', '1.100 V'], 1, 'Vₛ = Vₚ × Nₛ/Nₚ = 220 × 200/1.000 = 44 V.', 1),
    ], { min: 5 }),
    C('KIRCHHOFF', 'Hukum Kirchhoff', [
      S('Hukum I: titik cabang', ['Jumlah arus yang **masuk** titik cabang sama dengan jumlah arus yang **keluar**: **ΣI masuk = ΣI keluar**.', 'Contoh: masuk 5 A dan 3 A, satu keluar 6 A ⇒ cabang lain keluar 2 A.'], [['Hukum I', 'ΣI masuk = ΣI keluar']]),
      S('Hukum II: loop', ['Dalam satu loop tertutup: **Σε = ΣI · R**. Baterai yang dipasang berlawanan saling mengurangi.', 'Contoh: 12 V dan 6 V berlawanan, hambatan total 3 Ω ⇒ I = (12 − 6)/3 = 2 A.'], [['Hukum II', 'Σε = ΣIR']], 'Tentukan arah loop dulu, lalu konsisten dengan tandanya.'),
    ], [
      Q('Pada sebuah titik cabang, arus 5 A dan 3 A masuk, sedangkan satu arus 6 A keluar. Besar arus pada cabang keluar lainnya adalah …', ['2 A', '4 A', '8 A', '14 A'], 0, 'ΣI masuk = ΣI keluar: 5 + 3 = 6 + I, jadi I = 2 A.', 1),
      Q('Dalam satu loop terdapat baterai 12 V dan 6 V yang dipasang berlawanan arah serta hambatan total 3 Ω. Kuat arus dalam loop adalah …', ['2 A', '3 A', '4 A', '6 A'], 0, 'GGL total 12 − 6 = 6 V. I = 6 / 3 = 2 A.'),
    ], { capstone: true, min: 6 }),
  ],
  edges: [['C1', 'KIRCHHOFF', 'S']],
};

const MODERN: PilotTopic = {
  code: 'FIS.C26.F.MODERN', subject: 'FIS', title: 'Fisika modern & teknologi digital', subtitle: 'Kuantum, relativitas, inti, logika biner', phase: 'F', alias: 'fisika-modern',
  bekal: ['energi', 'gelombang cahaya'],
  cores: [
    C('C1', 'Kuantum dan inti atom', [
      S('Cahaya sebagai paket energi', ['Cahaya terdiri dari foton dengan energi **E = h · f** (h tetapan Planck). Energi foton sebanding dengan frekuensinya.'], [['E', 'h · f']]),
      S('Efek fotolistrik', ['Elektron lepas dari logam hanya jika energi foton lebih besar dari fungsi kerja W₀: **Ekₘₐₖₛ = h·f − W₀**.', 'Contoh: foton 5 eV pada logam W₀ = 2 eV ⇒ Ek maksimum 3 eV. Intensitas hanya menambah jumlah elektron, bukan energinya.'], [['Ekₘₐₖₛ', 'h · f − W₀']], 'Frekuensi menentukan apakah elektron lepas; intensitas menentukan berapa banyak.'),
    ], [
      Q('Energi sebuah foton sebanding dengan …', ['panjang gelombangnya', 'frekuensinya', 'intensitas cahaya', 'kecepatan cahaya saja'], 1, 'E = h · f: energi foton sebanding dengan frekuensi (dan berbanding terbalik dengan panjang gelombang).', 1, 'KM'),
      Q('Foton berenergi 5 eV mengenai logam yang fungsi kerjanya 2 eV. Energi kinetik maksimum elektron yang terlepas adalah …', ['2 eV', '3 eV', '5 eV', '7 eV'], 1, 'Ekₘₐₖₛ = 5 − 2 = 3 eV.'),
    ], { min: 5 }),
    C('C2', 'Representasi biner & logika', [
      S('Bilangan biner', ['Komputer menyimpan data dengan dua keadaan: 0 dan 1. Nilai posisi biner dari kanan: 1, 2, 4, 8, 16, …', 'Contoh: 1011₂ = 8 + 0 + 2 + 1 = 11.'], [['1011₂', '11']]),
      S('Gerbang logika', ['**AND**: keluaran 1 hanya jika semua masukan 1. **OR**: 1 jika salah satu masukan 1. **NOT**: membalik masukan.'], [['AND (1, 0)', '0'], ['OR (1, 0)', '1']], 'Buat tabel kebenaran kecil bila masukannya lebih dari dua.'),
    ], [
      Q('Bilangan biner 1011 jika diubah ke bilangan desimal adalah …', ['9', '11', '13', '1011'], 1, '1×8 + 0×4 + 1×2 + 1×1 = 11.', 1, 'KM'),
      Q('Gerbang logika AND diberi masukan A = 1 dan B = 0. Keluarannya adalah …', ['0', '1', '10', 'tidak tentu'], 0, 'AND hanya menghasilkan 1 jika semua masukan bernilai 1. Karena B = 0, keluarannya 0.', 1, 'KM'),
    ], { min: 4 }),
    C('RELATIVITAS', 'Relativitas khusus', [
      S('Faktor γ', ['Benda yang bergerak mendekati kecepatan cahaya mengalami efek relativistik dengan faktor **γ = 1 / √(1 − v²/c²)**.', 'Untuk v = 0,6c ⇒ γ = 1,25. Untuk v = 0,8c ⇒ γ = 5/3.'], [['γ', '1 / √(1 − v²/c²)']]),
      S('Waktu memanjang, panjang memendek', ['**Dilatasi waktu**: Δt = γ · Δt₀ (jam yang bergerak tampak lambat). **Kontraksi panjang**: L = L₀ / γ.', 'Contoh: batang 5 m bergerak 0,8c ⇒ L = 5 × 0,6 = 3 m.'], [['Δt', 'γ · Δt₀'], ['L', 'L₀ / γ']], 'Δt₀ dan L₀ adalah besaran yang diukur oleh pengamat yang diam terhadap benda.'),
    ], [
      Q('Sebuah pesawat bergerak dengan kecepatan 0,6c. Menurut awak pesawat, perjalanan berlangsung 8 tahun. Menurut pengamat di bumi, perjalanan itu berlangsung …', ['6,4 tahun', '8 tahun', '10 tahun', '12,5 tahun'], 2, 'γ = 1/√(1 − 0,36) = 1,25. Δt = 1,25 × 8 = 10 tahun.', 3),
      Q('Sebuah batang yang panjangnya 5 m bergerak searah panjangnya dengan kecepatan 0,8c. Panjang batang menurut pengamat diam adalah …', ['3 m', '4 m', '5 m', '8,3 m'], 0, '√(1 − 0,64) = 0,6, jadi L = 5 × 0,6 = 3 m.'),
    ], { min: 5 }),
    C('INTI', 'Peluruhan dan waktu paruh', [
      S('Waktu paruh', ['Setiap **waktu paruh** T, jumlah inti radioaktif tinggal setengahnya: **N = N₀ · (1/2)^(t/T)**.', 'Contoh: T = 2 jam, setelah 6 jam (3 kali paruh) tersisa 1/8 bagian.'], [['N', 'N₀ (1/2)^(t/T)']]),
      S('Mencari waktu paruh', ['Hitung berapa kali dibagi dua, lalu bagi waktunya.', 'Contoh: 64 g menjadi 4 g = 64 → 32 → 16 → 8 → 4 (4 kali). Dalam 20 hari ⇒ T = 5 hari.'], [['64 → 4 g', '4 kali paruh']], 'Penerapan: penanggalan karbon-14, kedokteran nuklir, PLTN.'),
    ], [
      Q('Suatu unsur radioaktif memiliki waktu paruh 2 jam. Setelah 6 jam, bagian yang tersisa adalah …', ['1/3', '1/4', '1/6', '1/8'], 3, '6 jam = 3 waktu paruh, jadi tersisa (1/2)³ = 1/8.', 1),
      Q('Sampel radioaktif 64 g meluruh menjadi 4 g dalam 20 hari. Waktu paruh unsur tersebut adalah …', ['4 hari', '5 hari', '10 hari', '16 hari'], 1, '64 → 4 g berarti 4 kali paruh. T = 20 / 4 = 5 hari.'),
    ], { capstone: true, min: 5 }),
  ],
  edges: [['C1', 'RELATIVITAS', 'S'], ['C1', 'INTI', 'S']],
};

export const FIS_TOPICS: PilotTopic[] = [UKUR, GERAK2D, ENERGI, MEKANIKA, FLUIDA, TERMAL, GELOMBANG, ELEKTRO, MODERN];
export const FIS_RELATIONS: PilotRelation[] = [
  { from: 'FIS.C26.E.UKUR', to: 'FIS.C26.E.GERAK2D', kind: 'REQUIRES', label: 'pengukuran dan grafik → analisis gerak' },
  { from: 'FIS.C26.E.GERAK2D', to: 'FIS.C26.F.MEKANIKA', kind: 'REQUIRES', label: 'gerak dua dimensi → dinamika dan momentum' },
  { from: 'FIS.C26.E.ENERGI', to: 'FIS.C26.F.TERMAL', kind: 'REQUIRES', label: 'efisiensi energi → mesin kalor' },
  { from: 'FIS.C26.F.GELOMBANG', to: 'FIS.C26.F.MODERN', kind: 'REQUIRES', label: 'gelombang → fisika kuantum' },
  { from: 'FIS.C26.E.GERAK2D', to: 'MAT.TRI', kind: 'RELATED', label: 'gerak peluru ↔ sinus dan kosinus' },
  { from: 'MAT.VEK', to: 'FIS.C26.E.GERAK2D', kind: 'RELATED', label: 'vektor ↔ komponen kecepatan' },
];
