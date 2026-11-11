import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Fisika/IPA SMP (Fase D) untuk inti PLANNED dari audit kesenjangan materi (prioritas 1).
// Kunci = "KODE_TOPIK:ID_INTI" di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 5): Content => ({ slides, q, min });

export const SMP_FIS: Record<string, Content> = {
  // ---------- Pengukuran dan kerja ilmiah ----------
  'FIS.C26.D.UKUR:C1': K([
    S('Besaran pokok dan turunan', ['Besaran pokok punya satuan SI dasar: panjang (meter), massa (kilogram), waktu (sekon), suhu (kelvin), kuat arus (ampere), jumlah zat (mol), intensitas cahaya (kandela).', 'Besaran turunan disusun dari besaran pokok, misalnya luas (m²), kecepatan (m/s), dan massa jenis (kg/m³).'], [['kecepatan', 'm/s'], ['massa jenis', 'kg/m³']]),
    S('Konversi satuan', ['Pada tangga satuan km–hm–dam–m–dm–cm–mm, turun satu anak tangga berarti dikali 10.', 'Contoh: 2,5 km = 2.500 m; 72 km/jam = 72.000 m : 3.600 s = 20 m/s.'], [['km/jam → m/s', 'bagi 3,6']], 'Tuliskan satuan di setiap langkah supaya kesalahan konversi cepat terlihat.'),
  ], [
    Q('Kelompok besaran berikut yang semuanya besaran pokok adalah …', ['panjang, massa, waktu', 'panjang, luas, volume', 'massa, berat, gaya', 'suhu, kecepatan, waktu'], 0, 'Luas, volume, berat, gaya, dan kecepatan adalah besaran turunan.', 1),
    Q('Satuan SI untuk massa jenis adalah …', ['kg/m³', 'g/cm', 'N/m²', 'kg·m'], 0, 'Massa jenis = massa : volume, jadi satuannya kg/m³.', 1),
    Q('Kecepatan 54 km/jam sama dengan …', ['15 m/s', '5,4 m/s', '150 m/s', '30 m/s'], 0, '54 : 3,6 = 15 m/s.'),
  ], 4),
  'FIS.C26.D.UKUR:C2': K([
    S('Tiga jenis variabel', ['**Variabel bebas**: yang sengaja diubah. **Variabel terikat**: yang diukur sebagai akibatnya. **Variabel kontrol**: dijaga tetap agar percobaan adil.', 'Contoh: pengaruh banyak cahaya (bebas) terhadap tinggi tanaman (terikat), dengan jenis tanaman, air, dan pot dibuat sama (kontrol).'], [['variabel bebas', 'yang diubah'], ['variabel terikat', 'yang diukur']]),
    S('Kesimpulan berbasis bukti', ['Ulangi pengukuran beberapa kali dan ambil rata-ratanya, lalu sajikan dalam tabel atau grafik.', 'Simpulkan hanya yang didukung data. Hipotesis yang ditolak oleh data tetap merupakan hasil yang berharga.'], [['nilai terbaik', 'rata-rata pengukuran berulang']], 'Ubah satu variabel saja dalam satu percobaan.'),
  ], [
    Q('Siswa menyelidiki pengaruh suhu air terhadap waktu larut gula. Variabel terikatnya adalah …', ['suhu air', 'waktu larut gula', 'jumlah gula', 'jenis gelas'], 1, 'Yang diukur sebagai akibat adalah waktu larut gula. Suhu air variabel bebas; jumlah gula dan jenis gelas variabel kontrol.', 1),
    Q('Siswa menyelidiki pengaruh suhu air terhadap waktu larut gula. Yang harus dijaga sama (variabel kontrol) adalah …', ['suhu air', 'waktu larut gula', 'jumlah gula dan volume air', 'hasil pengamatan'], 2, 'Jumlah gula dan volume air dibuat sama supaya perbedaan waktu larut hanya disebabkan oleh suhu.'),
    Q('Hasil tiga kali pengukuran panjang meja adalah 120,2 cm; 120,4 cm; dan 120,3 cm. Nilai yang paling tepat dilaporkan adalah …', ['120,2 cm', '120,3 cm', '120,4 cm', '361 cm'], 1, 'Rata-ratanya (120,2 + 120,4 + 120,3) : 3 = 120,3 cm.'),
  ], 4),
  // ---------- Gerak, gaya, dan tekanan ----------
  'FIS.C26.D.GERAK:C1': K([
    S('Gaya mengubah gerak', ['Gaya adalah tarikan atau dorongan, satuannya newton (N).', 'Gaya dapat mengubah kecepatan, arah gerak, atau bentuk benda. Contoh gaya: gaya berat, gaya gesek, gaya normal, dan gaya otot.'], [['satuan gaya', 'newton (N)']]),
    S('Gaya berat', ['Berat = massa × percepatan gravitasi: w = m × g, dengan g ≈ 9,8 m/s² (sering dibulatkan 10 m/s²).', 'Massa benda sama di mana pun, sedangkan beratnya bergantung pada gravitasi tempat itu.'], [['gaya berat', 'w = m × g']], 'Massa (kg) berbeda dengan berat (N).'),
  ], [
    Q('Gaya yang membuat bola yang menggelinding di lantai lama-kelamaan berhenti adalah …', ['gaya gesek', 'gaya magnet', 'gaya pegas', 'gaya listrik'], 0, 'Gaya gesek antara bola dan lantai melawan arah gerak sehingga bola melambat.', 1),
    Q('Sebuah benda bermassa 5 kg berada di Bumi (g = 10 m/s²). Beratnya adalah …', ['5 N', '50 N', '0,5 N', '500 N'], 1, 'w = m × g = 5 × 10 = 50 N.', 1),
    Q('Massa seorang astronaut 60 kg. Di Bulan, yang gravitasinya 1/6 gravitasi Bumi, massanya …', ['10 kg', '60 kg', '360 kg', '0 kg'], 1, 'Massa tidak berubah di mana pun; yang berubah adalah beratnya.'),
  ], 4),
  'FIS.C26.D.GERAK:C2': K([
    S('Tekanan zat padat', ['Tekanan = gaya : luas bidang tekan, satuannya pascal (1 Pa = 1 N/m²).', 'Pisau yang tajam memotong lebih mudah karena luas bidang tekannya kecil, sehingga tekanannya besar.'], [['tekanan', 'P = F / A']]),
    S('Tekanan zat cair dan gas', ['Tekanan hidrostatis bertambah dengan kedalaman: P = ρ × g × h. Karena itu dinding bendungan dibuat makin tebal ke bawah.', 'Tekanan udara makin kecil di tempat yang makin tinggi.'], [['tekanan hidrostatis', 'P = ρ × g × h']], 'Kedalaman h diukur dari permukaan zat cair.'),
  ], [
    Q('Gaya 200 N bekerja pada bidang seluas 0,5 m². Tekanannya adalah …', ['100 Pa', '400 Pa', '200,5 Pa', '40 Pa'], 1, 'P = F / A = 200 : 0,5 = 400 Pa.', 1),
    Q('Tekanan hidrostatis pada kedalaman 2 m di dalam air (ρ = 1.000 kg/m³, g = 10 m/s²) adalah …', ['2.000 Pa', '20.000 Pa', '200 Pa', '5.000 Pa'], 1, 'P = ρgh = 1.000 × 10 × 2 = 20.000 Pa.'),
    Q('Dinding bendungan dibuat makin tebal di bagian bawah karena …', ['air di bagian bawah lebih hangat', 'tekanan air makin besar di tempat yang makin dalam', 'air di bagian bawah lebih ringan', 'agar ikan tidak dapat lewat'], 1, 'Tekanan hidrostatis sebanding dengan kedalaman, jadi bagian bawah menahan tekanan terbesar.', 1),
  ]),
  'FIS.C26.D.GERAK:KELAJUAN': K([
    S('Jarak dan perpindahan', ['**Jarak** adalah panjang lintasan yang ditempuh (skalar). **Perpindahan** adalah perubahan posisi dari awal ke akhir, beserta arahnya (vektor).', 'Lari satu putaran lapangan 400 m: jaraknya 400 m, tetapi perpindahannya 0 karena kembali ke titik awal.'], [['jarak', 'panjang lintasan'], ['perpindahan', 'posisi akhir − posisi awal']]),
    S('Kelajuan dan kecepatan', ['Kelajuan rata-rata = jarak total : waktu total. Kecepatan rata-rata = perpindahan : waktu.', 'Gerak lurus beraturan (GLB): kelajuan tetap. Gerak lurus berubah beraturan (GLBB): kelajuan berubah secara teratur.'], [['kelajuan rata-rata', 'jarak total : waktu total']], 'Kelajuan rata-rata bukan rata-rata dari beberapa kelajuan; hitung dari jarak total dan waktu total.'),
  ], [
    Q('Budi berjalan 300 m ke timur, lalu 400 m ke utara. Besar perpindahannya adalah …', ['700 m', '500 m', '100 m', '350 m'], 1, 'Perpindahan adalah garis lurus dari awal ke akhir: √(300² + 400²) = 500 m. Jaraknya 700 m.'),
    Q('Sebuah sepeda menempuh 1.800 m dalam 6 menit. Kelajuan rata-ratanya adalah …', ['5 m/s', '300 m/s', '30 m/s', '10 m/s'], 0, '6 menit = 360 s; 1.800 : 360 = 5 m/s.'),
    Q('Mobil menempuh 60 km pada jam pertama dan 40 km pada jam kedua. Kelajuan rata-ratanya adalah …', ['50 km/jam', '100 km/jam', '40 km/jam', '60 km/jam'], 0, 'Jarak total 100 km dalam 2 jam, jadi 100 : 2 = 50 km/jam.', 1),
  ]),
  'FIS.C26.D.GERAK:RESULTAN': K([
    S('Resultan gaya', ['Gaya yang searah dijumlahkan; gaya yang berlawanan dikurangkan.', 'Tarik tambang 300 N ke kanan dan 250 N ke kiri menghasilkan resultan 50 N ke kanan. Jika resultannya nol, benda diam atau bergerak lurus beraturan.'], [['gaya searah', 'R = F₁ + F₂'], ['gaya berlawanan', 'R = F₁ − F₂']]),
    S('Inersia dan hukum Newton', ['**Hukum I Newton**: benda cenderung mempertahankan keadaannya (inersia). Saat bus mengerem mendadak, penumpang terdorong ke depan.', '**Hukum II Newton**: percepatan sebanding dengan resultan gaya dan berbanding terbalik dengan massa.'], [['hukum II Newton', 'a = ΣF / m']], 'Sabuk pengaman melawan efek inersia saat kendaraan berhenti mendadak.'),
  ], [
    Q('Dua anak mendorong lemari ke kanan dengan gaya 40 N dan 35 N, sedangkan gaya gesek 25 N bekerja ke kiri. Resultan gayanya adalah …', ['100 N ke kanan', '50 N ke kanan', '75 N ke kanan', '50 N ke kiri'], 1, '40 + 35 − 25 = 50 N ke kanan.'),
    Q('Penumpang terdorong ke depan saat bus mengerem mendadak. Peristiwa ini merupakan contoh …', ['hukum I Newton (inersia)', 'hukum III Newton', 'gaya gravitasi', 'tekanan udara'], 0, 'Tubuh penumpang cenderung tetap bergerak ke depan walaupun bus melambat.', 1),
    Q('Resultan gaya 20 N bekerja pada benda bermassa 4 kg. Percepatan benda adalah …', ['80 m/s²', '5 m/s²', '0,2 m/s²', '24 m/s²'], 1, 'a = ΣF / m = 20 : 4 = 5 m/s².'),
  ]),
  // ---------- Usaha, energi, dan kalor ----------
  'FIS.C26.D.ENERGI:C1': K([
    S('Usaha', ['Usaha dilakukan jika gaya memindahkan benda searah gaya: W = F × s, satuannya joule (J).', 'Mendorong tembok yang tidak bergeser: usahanya 0 walaupun terasa lelah.'], [['usaha', 'W = F × s']]),
    S('Energi berubah bentuk', ['Energi potensial gravitasi Ep = m × g × h; energi kinetik Ek = ½ × m × v².', 'Energi tidak dapat diciptakan atau dimusnahkan, hanya berubah bentuk. Buah yang jatuh mengubah energi potensial menjadi energi kinetik.'], [['energi potensial', 'Ep = m × g × h'], ['energi kinetik', 'Ek = ½ × m × v²']], 'Daya = usaha : waktu, satuannya watt (W).'),
  ], [
    Q('Gaya 50 N memindahkan kotak sejauh 4 m searah gaya. Usaha yang dilakukan adalah …', ['200 J', '12,5 J', '54 J', '46 J'], 0, 'W = F × s = 50 × 4 = 200 J.', 1),
    Q('Energi potensial buah kelapa bermassa 2 kg pada ketinggian 10 m (g = 10 m/s²) adalah …', ['20 J', '200 J', '100 J', '2.000 J'], 1, 'Ep = m × g × h = 2 × 10 × 10 = 200 J.'),
    Q('Perubahan energi pada senter yang menyala adalah …', ['kimia → listrik → cahaya dan panas', 'listrik → kimia → cahaya', 'cahaya → listrik → kimia', 'panas → kimia → listrik'], 0, 'Baterai menyimpan energi kimia, diubah menjadi energi listrik, lalu lampu mengubahnya menjadi cahaya dan panas.'),
  ]),
  'FIS.C26.D.ENERGI:C2': K([
    S('Suhu dan termometer', ['Suhu menyatakan derajat panas suatu benda. Skala Kelvin: K = °C + 273.', 'Pada tekanan 1 atm, air membeku pada 0 °C (273 K) dan mendidih pada 100 °C (373 K).'], [['Celsius ke Kelvin', 'K = °C + 273']]),
    S('Tiga cara perpindahan kalor', ['**Konduksi**: kalor merambat melalui zat tanpa zatnya berpindah (sendok yang ujungnya panas).', '**Konveksi**: kalor berpindah bersama aliran zat (air mendidih, angin laut). **Radiasi**: tanpa medium (panas Matahari).'], [['konduksi', 'merambat'], ['konveksi', 'mengalir'], ['radiasi', 'memancar']], 'Konduksi menempel, konveksi mengalir, radiasi memancar.'),
  ], [
    Q('Suhu 27 °C dalam skala Kelvin adalah …', ['246 K', '300 K', '273 K', '327 K'], 1, 'K = 27 + 273 = 300 K.', 1),
    Q('Gagang panci dari logam terasa panas saat panci dipanaskan karena perpindahan kalor secara …', ['konduksi', 'konveksi', 'radiasi', 'evaporasi'], 0, 'Kalor merambat melalui logam tanpa logamnya berpindah, yaitu konduksi.', 1),
    Q('Angin laut pada siang hari terjadi karena …', ['konduksi kalor oleh tanah', 'konveksi udara dari laut ke darat', 'radiasi dari Bulan', 'konduksi kalor oleh air'], 1, 'Daratan lebih cepat panas, udara di atasnya naik, lalu udara laut yang lebih sejuk mengalir ke darat (konveksi).'),
  ]),
  'FIS.C26.D.ENERGI:PESAWAT': K([
    S('Tuas', ['Pesawat sederhana memudahkan kerja dengan mengubah besar atau arah gaya.', 'Pada tuas berlaku beban × lengan beban = kuasa × lengan kuasa. Keuntungan mekanis = beban : kuasa.'], [['tuas', 'w × Lb = F × Lk'], ['keuntungan mekanis', 'KM = w / F']]),
    S('Katrol dan bidang miring', ['Katrol tetap hanya mengubah arah gaya (KM = 1); katrol bebas KM = 2.', 'Bidang miring: KM = panjang lintasan : tinggi. Contoh: jalan berkelok di pegunungan, sekrup, dan obeng.'], [['bidang miring', 'KM = s / h']], 'Pesawat sederhana tidak mengurangi usaha: gayanya lebih kecil, tetapi jaraknya lebih panjang.'),
  ], [
    Q('Linggis dengan lengan beban 20 cm dan lengan kuasa 100 cm dipakai untuk mengangkat batu seberat 500 N. Gaya kuasa yang diperlukan adalah …', ['100 N', '2.500 N', '25 N', '250 N'], 0, '500 × 20 = F × 100, jadi F = 100 N.'),
    Q('Keuntungan mekanis sebuah katrol tetap tunggal adalah …', ['1', '2', '0,5', 'bergantung pada beban'], 0, 'Katrol tetap hanya membelokkan arah gaya, jadi gaya kuasa sama dengan beban.', 1),
    Q('Bidang miring sepanjang 5 m dengan tinggi 1 m dipakai untuk menaikkan peti seberat 1.000 N. Jika gesekan diabaikan, gaya minimal yang diperlukan adalah …', ['5.000 N', '200 N', '1.000 N', '500 N'], 1, 'KM = 5 : 1 = 5, jadi F = 1.000 : 5 = 200 N.'),
  ]),
  'FIS.C26.D.ENERGI:KALOR': K([
    S('Kalor dan kalor jenis', ['Kalor yang diperlukan untuk menaikkan suhu: Q = m × c × ΔT.', 'Kalor jenis (c) menunjukkan seberapa sulit suatu zat dipanaskan. Kalor jenis air besar (4.200 J/kg°C), sehingga air lambat panas dan lambat dingin.'], [['kalor', 'Q = m × c × ΔT']]),
    S('Perubahan wujud', ['Saat zat mencair atau mendidih, suhunya tetap walaupun kalor terus diberikan; kalor dipakai untuk mengubah wujud.', 'Kalor perubahan wujud: Q = m × L, dengan L kalor lebur atau kalor uap.'], [['perubahan wujud', 'Q = m × L']], 'Pada grafik suhu terhadap waktu, bagian yang mendatar menandakan perubahan wujud.'),
  ], [
    Q('Kalor yang diperlukan untuk memanaskan 2 kg air dari 25 °C menjadi 75 °C (c = 4.200 J/kg°C) adalah …', ['420.000 J', '210.000 J', '630.000 J', '8.400 J'], 0, 'Q = 2 × 4.200 × (75 − 25) = 420.000 J.'),
    Q('Pada siang hari, pantai terasa lebih sejuk daripada daratan di sekitarnya terutama karena …', ['kalor jenis air besar sehingga air lambat panas', 'air memantulkan semua cahaya Matahari', 'udara di laut lebih tipis', 'pasir tidak menyerap kalor'], 0, 'Air membutuhkan banyak kalor untuk naik suhunya, jadi permukaan laut tetap relatif sejuk.'),
    Q('Es yang sedang melebur pada 0 °C terus dipanaskan. Selama proses melebur, suhunya …', ['naik dengan cepat', 'tetap 0 °C sampai semua es mencair', 'turun', 'naik lalu turun'], 1, 'Kalor dipakai untuk mengubah wujud, bukan menaikkan suhu, sampai semua es mencair.', 1),
  ]),
  // ---------- Getaran, bunyi, dan cahaya ----------
  'FIS.C26.D.GELOMBANG:C1': K([
    S('Getaran', ['Getaran adalah gerak bolak-balik melalui titik setimbang.', 'Periode (T) = waktu satu getaran; frekuensi (f) = banyak getaran per sekon, satuannya hertz (Hz). f = 1/T.'], [['frekuensi', 'f = n / t = 1 / T']]),
    S('Gelombang', ['Gelombang merambatkan energi tanpa memindahkan mediumnya.', '**Transversal**: arah getar tegak lurus arah rambat (gelombang tali). **Longitudinal**: arah getar searah arah rambat (bunyi, slinki yang didorong).'], [['cepat rambat', 'v = λ × f']], 'λ (lambda) adalah panjang satu gelombang: satu bukit + satu lembah, atau satu rapatan + satu renggangan.'),
  ], [
    Q('Sebuah bandul bergetar 30 kali dalam 15 sekon. Frekuensinya adalah …', ['2 Hz', '0,5 Hz', '45 Hz', '15 Hz'], 0, 'f = 30 : 15 = 2 Hz. Periodenya 0,5 s.', 1),
    Q('Gelombang dengan panjang gelombang 2 m dan frekuensi 5 Hz memiliki cepat rambat …', ['10 m/s', '2,5 m/s', '0,4 m/s', '7 m/s'], 0, 'v = λ × f = 2 × 5 = 10 m/s.', 1),
    Q('Contoh gelombang longitudinal adalah …', ['gelombang bunyi di udara', 'gelombang pada tali yang digoyangkan', 'gelombang cahaya', 'riak pada permukaan air'], 0, 'Bunyi merambat sebagai rapatan dan renggangan yang searah dengan arah rambatnya.'),
  ]),
  'FIS.C26.D.GELOMBANG:C2': K([
    S('Bunyi', ['Bunyi adalah gelombang longitudinal yang memerlukan medium, sehingga tidak dapat merambat di ruang hampa.', 'Tinggi nada ditentukan frekuensi; kuat bunyi ditentukan amplitudo. Telinga manusia mendengar 20–20.000 Hz (audiosonik).'], [['audiosonik', '20 – 20.000 Hz']]),
    S('Pantulan bunyi dan alat optik', ['Gema dan sonar memanfaatkan pantulan bunyi: kedalaman = v × t : 2.', 'Mata, lup, dan kamera membentuk bayangan dengan lensa. Rabun jauh (miopi) dibantu lensa cekung, rabun dekat (hipermetropi) dibantu lensa cembung.'], [['kedalaman sonar', 'd = v × t / 2']], 'Waktu sonar dibagi 2 karena bunyi berangkat lalu kembali.'),
  ], [
    Q('Astronaut di Bulan tidak dapat saling mendengar suara tanpa radio karena …', ['bunyi memerlukan medium untuk merambat', 'frekuensi suaranya terlalu tinggi', 'gravitasi Bulan kecil', 'suhunya terlalu dingin'], 0, 'Bulan hampir tidak memiliki udara, sedangkan bunyi butuh medium.', 1),
    Q('Sonar kapal menerima bunyi pantul 2 sekon setelah dipancarkan. Cepat rambat bunyi di air 1.500 m/s. Kedalaman laut adalah …', ['3.000 m', '1.500 m', '750 m', '6.000 m'], 1, 'd = v × t : 2 = 1.500 × 2 : 2 = 1.500 m.'),
    Q('Penderita rabun jauh (miopi) dibantu dengan kacamata berlensa …', ['cekung', 'cembung', 'datar', 'silinder saja'], 0, 'Lensa cekung menyebarkan cahaya sehingga bayangan benda jauh jatuh tepat di retina.'),
  ]),
  'FIS.C26.D.GELOMBANG:CAHAYA': K([
    S('Pemantulan cahaya', ['Hukum pemantulan: sudut datang = sudut pantul, keduanya diukur dari garis normal.', 'Cermin datar membentuk bayangan maya, tegak, dan sama besar. Cermin cembung (spion) selalu membentuk bayangan maya, tegak, diperkecil.'], [['hukum pemantulan', 'sudut datang = sudut pantul']]),
    S('Pembiasan cahaya', ['Cahaya dibelokkan saat melewati dua medium dengan kerapatan berbeda: pensil tampak patah di dalam air, kolam tampak lebih dangkal.', 'Untuk lensa dan cermin lengkung berlaku 1/f = 1/s + 1/s′.'], [['lensa dan cermin lengkung', '1/f = 1/s + 1/s′']], 'Dari medium renggang ke rapat (udara → air), sinar dibelokkan mendekati garis normal.'),
  ], [
    Q('Sinar datang membentuk sudut 35° terhadap garis normal sebuah cermin datar. Besar sudut pantulnya adalah …', ['35°', '55°', '70°', '145°'], 0, 'Sudut pantul sama dengan sudut datang, keduanya diukur dari garis normal.', 1),
    Q('Dasar kolam terlihat lebih dangkal daripada kedalaman sebenarnya karena peristiwa …', ['pemantulan', 'pembiasan', 'difraksi', 'interferensi'], 1, 'Cahaya dari dasar kolam dibelokkan saat keluar dari air ke udara.', 1),
    Q('Benda diletakkan 30 cm di depan lensa cembung yang jarak fokusnya 10 cm. Jarak bayangannya adalah …', ['15 cm', '20 cm', '7,5 cm', '40 cm'], 0, '1/s′ = 1/10 − 1/30 = 2/30, jadi s′ = 15 cm.'),
  ]),
  // ---------- Kelistrikan & energi ramah lingkungan ----------
  'FIS.C26.D.LISTRIK:C1': K([
    S('Arus, tegangan, dan hambatan', ['Arus listrik (I, ampere) mengalir dalam rangkaian tertutup karena ada tegangan atau beda potensial (V, volt). Hambatan (R, ohm) menghambat arus.', 'Hukum Ohm: V = I × R.'], [['hukum Ohm', 'V = I × R']]),
    S('Mengukur dan menghitung energi', ['Amperemeter dipasang seri; voltmeter dipasang paralel.', 'Daya listrik P = V × I, energi W = P × t. Tagihan listrik dihitung dalam kWh.'], [['daya', 'P = V × I'], ['energi', 'W = P × t']], '1 kWh = daya 1.000 watt yang dipakai selama 1 jam.'),
  ], [
    Q('Tegangan 12 V dipasang pada hambatan 4 Ω. Kuat arus yang mengalir adalah …', ['3 A', '48 A', '0,33 A', '16 A'], 0, 'I = V / R = 12 : 4 = 3 A.', 1),
    Q('Sebuah lampu 50 W menyala 10 jam setiap hari. Energi yang dipakai dalam 30 hari adalah …', ['15 kWh', '1,5 kWh', '150 kWh', '500 kWh'], 0, '50 × 10 × 30 = 15.000 Wh = 15 kWh.'),
    Q('Cara memasang voltmeter untuk mengukur tegangan sebuah lampu adalah …', ['paralel dengan lampu', 'seri dengan lampu', 'di sembarang tempat', 'hanya di dekat baterai'], 0, 'Voltmeter mengukur beda potensial di antara dua titik, jadi dipasang paralel.', 1),
  ]),
  'FIS.C26.D.LISTRIK:C2': K([
    S('Magnet dan elektromagnet', ['Kutub magnet senama tolak-menolak; kutub tak senama tarik-menarik.', 'Arus listrik menimbulkan medan magnet. Kumparan berarus (elektromagnet) dipakai pada bel listrik dan derek pengangkat besi.'], [['kutub senama', 'tolak-menolak']]),
    S('Induksi elektromagnetik', ['Magnet yang digerakkan keluar-masuk kumparan menimbulkan arus induksi. Inilah prinsip generator: dinamo sepeda, PLTA, dan PLTB.', 'Transformator mengubah tegangan bolak-balik (AC): Vp/Vs = Np/Ns.'], [['transformator', 'Vp / Vs = Np / Ns']], 'Generator: gerak → listrik. Motor listrik: listrik → gerak.'),
  ], [
    Q('Dua kutub utara magnet didekatkan. Keduanya akan …', ['tarik-menarik', 'tolak-menolak', 'diam saja', 'berubah kutub'], 1, 'Kutub senama saling tolak-menolak.', 1),
    Q('Alat yang mengubah energi gerak menjadi energi listrik adalah …', ['generator', 'motor listrik', 'setrika listrik', 'baterai'], 0, 'Generator memanfaatkan induksi elektromagnetik dari gerak.', 1),
    Q('Sebuah transformator memiliki 200 lilitan primer dan 1.000 lilitan sekunder. Jika tegangan primernya 220 V, tegangan sekundernya adalah …', ['44 V', '1.100 V', '220 V', '4.400 V'], 1, 'Vs = Vp × Ns / Np = 220 × 1.000 : 200 = 1.100 V.'),
  ]),
  'FIS.C26.D.LISTRIK:SERI_PARALEL': K([
    S('Rangkaian seri', ['Komponen tersusun berderet; kuat arus sama di semua bagian.', 'Rs = R₁ + R₂ + … Jika satu lampu putus, semua lampu padam.'], [['seri', 'Rs = R₁ + R₂ + …']]),
    S('Rangkaian paralel', ['Komponen tersusun bercabang; tegangan sama di setiap cabang. 1/Rp = 1/R₁ + 1/R₂ + …', 'Instalasi rumah memakai rangkaian paralel, sehingga satu lampu putus tidak memadamkan lampu lain.'], [['paralel', '1/Rp = 1/R₁ + 1/R₂ + …']], 'Hambatan pengganti paralel selalu lebih kecil daripada hambatan terkecilnya.'),
  ], [
    Q('Dua hambatan 6 Ω dan 3 Ω disusun seri. Hambatan penggantinya adalah …', ['9 Ω', '2 Ω', '18 Ω', '3 Ω'], 0, 'Rs = 6 + 3 = 9 Ω.', 1),
    Q('Dua hambatan 6 Ω dan 3 Ω disusun paralel. Hambatan penggantinya adalah …', ['9 Ω', '2 Ω', '4,5 Ω', '0,5 Ω'], 1, '1/Rp = 1/6 + 1/3 = 3/6, jadi Rp = 2 Ω.'),
    Q('Lampu-lampu di rumah dipasang paralel karena …', ['agar kuat arus di semua lampu sama', 'agar setiap lampu mendapat tegangan penuh dan tetap menyala jika satu lampu putus', 'agar hambatan totalnya besar', 'agar kabel lebih hemat'], 1, 'Pada rangkaian paralel setiap cabang mendapat tegangan sumber penuh dan bekerja sendiri-sendiri.'),
  ]),
  // ---------- Bumi dan tata surya ----------
  'FIS.C26.D.ANTARIKSA:C1': K([
    S('Anggota tata surya', ['Matahari adalah pusat tata surya. Delapan planetnya: Merkurius, Venus, Bumi, Mars (planet dalam, berbatuan) serta Yupiter, Saturnus, Uranus, Neptunus (planet luar, raksasa).', 'Anggota lain: planet kerdil, satelit, asteroid (sebagian besar di sabuk antara Mars dan Yupiter), dan komet.'], [['planet terbesar', 'Yupiter']]),
    S('Mengapa planet beredar', ['Gaya gravitasi Matahari menahan planet tetap pada orbitnya.', 'Makin jauh dari Matahari, makin lama waktu revolusinya: Merkurius 88 hari, Bumi 1 tahun, Neptunus sekitar 165 tahun.'], [['jarak makin jauh', 'revolusi makin lama']], 'Urutan dari yang terdekat: Merkurius, Venus, Bumi, Mars, Yupiter, Saturnus, Uranus, Neptunus.'),
  ], [
    Q('Planet terbesar di tata surya adalah …', ['Saturnus', 'Yupiter', 'Neptunus', 'Bumi'], 1, 'Yupiter adalah planet raksasa gas yang terbesar.', 1),
    Q('Sabuk asteroid terletak di antara orbit planet …', ['Bumi dan Mars', 'Mars dan Yupiter', 'Yupiter dan Saturnus', 'Venus dan Bumi'], 1, 'Sabuk asteroid utama berada di antara Mars dan Yupiter.', 1),
    Q('Planet yang paling lama mengelilingi Matahari adalah …', ['Merkurius', 'Bumi', 'Neptunus', 'Mars'], 2, 'Neptunus paling jauh dari Matahari, jadi orbitnya paling panjang.'),
  ], 4),
  'FIS.C26.D.ANTARIKSA:ROTASI': K([
    S('Rotasi Bumi', ['Bumi berputar pada porosnya dari barat ke timur sekali dalam sekitar 24 jam.', 'Akibatnya: siang dan malam, gerak semu harian Matahari (terbit di timur), dan perbedaan waktu antarwilayah (WIB, WITA, WIT).'], [['rotasi', '± 24 jam']]),
    S('Revolusi Bumi', ['Bumi mengelilingi Matahari dalam sekitar 365¼ hari dengan poros yang miring 23,5°.', 'Akibatnya: pergantian musim di belahan bumi utara dan selatan, perbedaan lama siang dan malam, serta gerak semu tahunan Matahari.'], [['revolusi', '± 365¼ hari']], 'Rotasi → hari (siang dan malam). Revolusi → tahun (musim).'),
  ], [
    Q('Matahari tampak terbit di timur karena …', ['Bumi berotasi dari barat ke timur', 'Bumi berevolusi', 'Matahari mengelilingi Bumi', 'poros Bumi miring'], 0, 'Rotasi Bumi ke arah timur membuat Matahari tampak bergerak dari timur ke barat.', 1),
    Q('Pergantian musim di belahan bumi utara disebabkan oleh …', ['rotasi Bumi', 'revolusi Bumi dengan poros yang miring', 'jarak Bumi ke Bulan', 'gerhana'], 1, 'Karena poros miring, belahan bumi utara dan selatan bergantian lebih condong ke Matahari selama revolusi.'),
    Q('Selisih waktu WIB dan WIT adalah 2 jam. Jika di Jakarta pukul 07.00 WIB, di Jayapura pukul …', ['05.00 WIT', '09.00 WIT', '08.00 WIT', '07.00 WIT'], 1, 'Wilayah timur mengalami siang lebih dahulu: 07.00 + 2 jam = 09.00 WIT.'),
  ], 4),
  'FIS.C26.D.ANTARIKSA:BULAN': K([
    S('Fase Bulan', ['Bulan tidak bercahaya sendiri; ia memantulkan cahaya Matahari.', 'Selama sekitar 29,5 hari (dari bulan baru ke bulan baru), bagian terang yang terlihat dari Bumi berubah: bulan baru, sabit, kuartir pertama, purnama, kuartir akhir.'], [['satu siklus fase', '± 29,5 hari']]),
    S('Pasang surut', ['Gaya gravitasi Bulan (dan Matahari) menarik air laut sehingga terjadi pasang naik dan pasang surut.', 'Pasang tertinggi terjadi saat purnama dan bulan baru, ketika Matahari, Bumi, dan Bulan segaris.'], [['pasang tertinggi', 'purnama dan bulan baru']], 'Sisi Bulan yang sama selalu menghadap Bumi karena periode rotasi dan revolusinya sama.'),
  ], [
    Q('Bulan tampak bersinar karena …', ['memancarkan cahaya sendiri', 'memantulkan cahaya Matahari', 'memantulkan cahaya Bumi saja', 'berisi gas yang terbakar'], 1, 'Bulan adalah benda gelap yang memantulkan cahaya Matahari.', 1),
    Q('Fase ketika seluruh permukaan Bulan yang menghadap Bumi tampak terang disebut …', ['bulan baru', 'bulan sabit', 'purnama', 'kuartir pertama'], 2, 'Saat purnama, sisi Bulan yang menghadap Bumi seluruhnya tersinari Matahari.', 1),
    Q('Pasang laut paling tinggi terjadi saat …', ['kuartir pertama', 'purnama dan bulan baru', 'bulan sabit saja', 'siang hari saja'], 1, 'Saat Matahari, Bumi, dan Bulan segaris, tarikan gravitasi keduanya saling menguatkan.'),
  ], 4),
  'FIS.C26.D.ANTARIKSA:GERHANA': K([
    S('Gerhana Matahari', ['Terjadi saat Bulan berada di antara Matahari dan Bumi, sehingga bayangan Bulan jatuh ke Bumi.', 'Hanya mungkin terjadi pada fase bulan baru. Ada gerhana Matahari total, sebagian, dan cincin.'], [['gerhana Matahari', 'Matahari – Bulan – Bumi']]),
    S('Gerhana Bulan', ['Terjadi saat Bumi berada di antara Matahari dan Bulan, sehingga Bulan masuk ke bayangan Bumi. Hanya mungkin saat purnama.', 'Gerhana tidak terjadi setiap bulan karena orbit Bulan miring sekitar 5° terhadap orbit Bumi.'], [['gerhana Bulan', 'Matahari – Bumi – Bulan']], 'Jangan menatap gerhana Matahari secara langsung tanpa filter khusus.'),
  ], [
    Q('Gerhana Matahari terjadi jika susunan benda langitnya …', ['Matahari – Bulan – Bumi', 'Matahari – Bumi – Bulan', 'Bumi – Matahari – Bulan', 'Bulan – Matahari – Bumi'], 0, 'Bulan menghalangi cahaya Matahari sehingga bayangannya jatuh ke Bumi.', 1),
    Q('Gerhana Bulan hanya dapat terjadi pada fase …', ['bulan baru', 'purnama', 'kuartir pertama', 'sabit'], 1, 'Bumi berada di antara Matahari dan Bulan hanya ketika Bulan purnama.'),
    Q('Gerhana tidak terjadi setiap bulan karena …', ['Bulan terlalu kecil', 'orbit Bulan miring terhadap orbit Bumi', 'Bumi berotasi', 'Matahari bergerak'], 1, 'Pada sebagian besar bulan baru dan purnama, Bulan lewat sedikit di atas atau di bawah garis Matahari–Bumi.'),
  ]),
  // ---------- Struktur Bumi dan mitigasi bencana ----------
  'FIS.C26.D.KEBUMIAN:C1': K([
    S('Tiga lapisan utama', ['**Kerak**: paling luar, padat, dan tipis. **Mantel**: paling tebal, berupa batuan panas yang dapat mengalir sangat perlahan. **Inti**: inti luar cair dan inti dalam padat, kaya besi dan nikel.', 'Makin ke dalam, suhu dan tekanan makin tinggi.'], [['lapisan paling tebal', 'mantel']]),
    S('Litosfer dan astenosfer', ['Litosfer adalah kerak ditambah bagian atas mantel yang kaku; litosfer terpecah menjadi lempeng-lempeng.', 'Di bawahnya terdapat astenosfer yang lebih lunak, tempat lempeng bergerak perlahan.'], [['litosfer', 'kerak + mantel atas yang kaku']], 'Arus konveksi di dalam mantel menjadi penggerak lempeng.'),
  ], [
    Q('Lapisan Bumi yang paling tebal adalah …', ['kerak', 'mantel', 'inti luar', 'inti dalam'], 1, 'Mantel membentuk sebagian besar volume Bumi.', 1),
    Q('Inti Bumi terutama tersusun atas …', ['besi dan nikel', 'silikon dan oksigen', 'air dan es', 'karbon dan hidrogen'], 0, 'Inti Bumi kaya logam berat, terutama besi dan nikel.', 1),
    Q('Lapisan yang lebih lunak tempat lempeng litosfer bergerak disebut …', ['astenosfer', 'atmosfer', 'hidrosfer', 'troposfer'], 0, 'Astenosfer berada di bawah litosfer dan bersifat lebih lunak.'),
  ], 4),
  'FIS.C26.D.KEBUMIAN:LEMPENG': K([
    S('Tiga jenis batas lempeng', ['**Divergen**: lempeng saling menjauh (punggung tengah samudra). **Konvergen**: lempeng saling mendekat dan bertumbukan, membentuk pegunungan, palung, dan gunung api. **Transform**: lempeng saling bergeser.', 'Pada batas konvergen, lempeng samudra dapat menunjam ke bawah lempeng lain (subduksi).'], [['divergen', 'menjauh'], ['konvergen', 'mendekat']]),
    S('Indonesia di pertemuan lempeng', ['Indonesia berada di pertemuan Lempeng Eurasia, Indo-Australia, dan Pasifik.', 'Akibatnya banyak gunung api dan gempa, tetapi juga tanah yang subur dan kaya mineral.'], [['Indonesia', 'pertemuan tiga lempeng besar']], 'Konvergen bertumbukan, divergen berpisah, transform bergesekan.'),
  ], [
    Q('Batas lempeng yang saling menjauh disebut …', ['divergen', 'konvergen', 'transform', 'subduksi'], 0, 'Pada batas divergen, magma naik mengisi celah lempeng yang saling menjauh.', 1),
    Q('Banyaknya gunung api di Indonesia terutama disebabkan oleh …', ['Indonesia negara kepulauan', 'Indonesia berada di pertemuan lempeng tektonik', 'iklim tropis', 'banyaknya hutan'], 1, 'Penunjaman lempeng di sekitar Indonesia menghasilkan magma yang membentuk gunung api.', 1),
    Q('Penunjaman lempeng samudra ke bawah lempeng benua (subduksi) terjadi pada batas …', ['divergen', 'konvergen', 'transform', 'tidak ada batas lempeng'], 1, 'Subduksi terjadi saat dua lempeng saling mendekat, yaitu batas konvergen.'),
  ]),
  'FIS.C26.D.KEBUMIAN:GEMPA': K([
    S('Gempa bumi', ['Gempa tektonik terjadi saat energi yang tertahan di batas lempeng terlepas tiba-tiba.', 'Titik sumber gempa di dalam Bumi disebut **hiposentrum**; titik di permukaan tepat di atasnya disebut **episentrum**. Gempa di dasar laut dapat memicu tsunami.'], [['episentrum', 'titik di permukaan di atas sumber gempa']]),
    S('Gunung api', ['Magma dari dalam Bumi naik ke permukaan melalui gunung api. Letusan dapat menghasilkan lava, abu, dan awan panas.', 'Gunung api juga memberi tanah yang subur dan energi panas bumi.'], [['gempa vulkanik', 'akibat aktivitas magma']], 'Gempa tektonik disebabkan gerak lempeng; gempa vulkanik disebabkan aktivitas magma.'),
  ], [
    Q('Titik di permukaan Bumi yang tepat berada di atas sumber gempa disebut …', ['hiposentrum', 'episentrum', 'magma', 'palung'], 1, 'Hiposentrum adalah sumber gempa di dalam Bumi; episentrum berada tepat di atasnya.', 1),
    Q('Gempa yang paling mungkin memicu tsunami adalah gempa …', ['di dasar laut yang menggeser dasar laut secara vertikal', 'di daerah pegunungan', 'akibat ledakan kecil', 'di gurun pasir'], 0, 'Pergeseran vertikal dasar laut mendorong kolom air di atasnya dan membentuk gelombang besar.'),
    Q('Manfaat gunung api bagi manusia adalah …', ['tanah yang subur dan energi panas bumi', 'menghentikan gempa', 'mencegah tsunami', 'menurunkan suhu Bumi'], 0, 'Abu vulkanik menyuburkan tanah, dan panas dari magma dapat dimanfaatkan sebagai energi panas bumi.', 1),
  ]),
  'FIS.C26.D.KEBUMIAN:MITIGASI': K([
    S('Sebelum dan saat bencana', ['Mitigasi adalah upaya mengurangi risiko bencana.', 'Sebelum bencana: kenali jalur evakuasi, siapkan tas siaga, dan bangun rumah tahan gempa. Saat gempa: merunduk, berlindung di bawah meja, dan berpegangan; jauhi kaca.'], [['saat gempa', 'merunduk, berlindung, berpegangan']]),
    S('Membaca tanda bahaya', ['Jika di pantai terasa gempa kuat atau air laut tiba-tiba surut, segera evakuasi ke tempat tinggi tanpa menunggu sirene.', 'Ikuti informasi resmi dari BMKG dan BNPB, bukan kabar yang belum jelas sumbernya.'], [['air laut tiba-tiba surut', 'segera ke tempat tinggi']], 'Siapkan tas siaga berisi air, makanan, senter, obat, dan dokumen penting.'),
  ], [
    Q('Saat terjadi gempa di dalam kelas, tindakan yang paling tepat adalah …', ['berlari keluar sambil berdesakan di tangga', 'berlindung di bawah meja sambil melindungi kepala', 'berdiri di dekat jendela kaca', 'menyalakan kompor'], 1, 'Berlindung di bawah meja melindungi kepala dari benda yang jatuh; berdesakan dan dekat kaca berbahaya.', 1),
    Q('Di pantai terasa gempa kuat, lalu air laut tiba-tiba surut. Tindakan yang tepat adalah …', ['mendekati pantai untuk melihat', 'segera evakuasi ke tempat tinggi', 'menunggu sirene berbunyi', 'memotret air laut'], 1, 'Air laut yang surut tiba-tiba adalah tanda alami tsunami; jangan menunggu peringatan lain.', 1),
    Q('Contoh mitigasi bencana gempa yang dilakukan sebelum bencana terjadi adalah …', ['membangun rumah tahan gempa', 'menolong korban', 'mendirikan tenda pengungsian', 'membagikan makanan'], 0, 'Mitigasi bertujuan mengurangi risiko sebelum bencana; pilihan lain dilakukan sesudah bencana.'),
  ]),
};
