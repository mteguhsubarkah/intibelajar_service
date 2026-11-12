import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Fisika kelas 10 (Fase E) dari pemeriksaan per kelas 12 November 2026: pemanasan global dan energi
// terbarukan (bab fisika di buku siswa IPA kelas X) yang belum punya bab sendiri di katalog. Kunci = "KODE_TOPIK:ID_INTI".

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 4): Content => ({ slides, q, min });

export const IPA_FIS_E: Record<string, Content> = {
  // ---------- Pemanasan global dan perubahan iklim ----------
  'FIS.C26.E.IKLIM:C1': K([
    S('Cara kerja efek rumah kaca', ['Sinar Matahari, sebagian besar berupa cahaya tampak, menembus atmosfer dan memanaskan permukaan Bumi. Permukaan yang hangat memancarkan kembali energi sebagai **radiasi inframerah**.', '**Gas rumah kaca** seperti CO₂, CH₄ (metana), N₂O, dan uap air menyerap sebagian inframerah itu lalu memancarkannya kembali ke segala arah, termasuk ke Bumi.'], [['gas rumah kaca', 'CO₂, CH₄, N₂O, H₂O']]),
    S('Alami dan berlebihan', ['Efek rumah kaca alami membuat suhu rata-rata Bumi sekitar 15°C. Tanpa efek ini, suhunya sekitar −18°C.', 'Masalahnya adalah **tambahan** gas rumah kaca dari aktivitas manusia, yang membuat lebih banyak energi tertahan sehingga suhu rata-rata naik.'], undefined, 'Penipisan lapisan ozon adalah masalah lain, bukan penyebab utama efek rumah kaca.'),
  ], [
    Q('Radiasi yang terutama diserap gas rumah kaca adalah …', ['inframerah yang dipancarkan permukaan Bumi', 'cahaya tampak dari Matahari', 'sinar ultraviolet dari Matahari', 'gelombang radio'], 0, 'Permukaan Bumi yang hangat memancarkan inframerah, dan radiasi itulah yang ditahan CO₂, metana, dan uap air.'),
    Q('Gas berikut yang termasuk gas rumah kaca adalah …', ['metana (CH₄)', 'nitrogen (N₂)', 'oksigen (O₂)', 'argon (Ar)'], 0, 'Metana menyerap inframerah dengan kuat; N₂, O₂, dan Ar hampir tidak menyerapnya.', 1),
    Q('Pernyataan yang tepat tentang efek rumah kaca adalah …', ['efek alaminya membuat Bumi layak huni, tetapi tambahan gas dari manusia menaikkan suhu', 'efek rumah kaca seluruhnya disebabkan manusia', 'efek rumah kaca disebabkan oleh lubang ozon', 'efek rumah kaca mendinginkan Bumi'], 0, 'Tanpa gas rumah kaca alami Bumi akan jauh lebih dingin; yang menjadi masalah adalah tambahan emisi dari aktivitas manusia.'),
  ]),
  'FIS.C26.E.IKLIM:C2': K([
    S('Bukti pemanasan global', ['Pengukuran menunjukkan suhu rata-rata permukaan Bumi kini lebih dari 1°C di atas masa praindustri.', 'Bukti lainnya: gletser dan es laut Arktik menyusut, permukaan laut naik, dan gelombang panas makin sering.'], [['kenaikan suhu', '> 1°C sejak praindustri']]),
    S('Penyebab', ['Penyebab utamanya adalah pembakaran **bahan bakar fosil** (batu bara, minyak, gas) yang melepaskan CO₂, serta **deforestasi** yang mengurangi penyerap CO₂.', 'Peternakan, sawah, dan sampah organik menambah metana, sedangkan pupuk menambah N₂O.'], undefined, 'Konsentrasi CO₂ di atmosfer kini jauh lebih tinggi daripada sebelum revolusi industri.'),
  ], [
    Q('Kegiatan yang paling banyak menambah CO₂ ke atmosfer adalah …', ['pembakaran bahan bakar fosil', 'penanaman pohon', 'penggunaan panel surya', 'pemakaian sepeda'], 0, 'Batu bara, minyak, dan gas yang dibakar di pembangkit listrik, industri, dan kendaraan adalah sumber CO₂ terbesar.', 1),
    Q('Penebangan hutan mempercepat pemanasan global karena …', ['berkurangnya tumbuhan yang menyerap CO₂ lewat fotosintesis', 'pohon menghasilkan metana', 'tanah menjadi lebih dingin', 'oksigen di udara bertambah'], 0, 'Pohon menyimpan karbon dan menyerap CO₂; deforestasi melepas karbon itu dan mengurangi penyerapannya.'),
    Q('Berikut yang merupakan bukti pemanasan global adalah …', ['permukaan air laut rata-rata terus naik', 'suhu siang lebih tinggi daripada malam', 'musim hujan terjadi setiap tahun', 'Matahari terbit dari timur'], 0, 'Kenaikan muka laut terjadi karena air laut yang menghangat memuai dan es daratan mencair.', 1),
  ]),
  'FIS.C26.E.IKLIM:DAMPAK': K([
    S('Dampak fisik', ['Suhu yang lebih tinggi mengubah pola cuaca: kemarau lebih panjang di satu tempat, hujan ekstrem dan banjir di tempat lain.', 'Es daratan mencair dan air laut memuai, sehingga muka laut naik dan mengancam pesisir serta pulau-pulau kecil.']),
    S('Dampak pada kehidupan', ['Terumbu karang memutih saat laut terlalu hangat, panen terganggu, dan sebaran penyakit seperti demam berdarah bisa meluas.', 'Sebagai negara kepulauan, Indonesia rentan terhadap banjir rob di pesisir, kekeringan, dan kebakaran hutan.'], undefined, 'Perubahan iklim mencakup cuaca ekstrem, bukan hanya kenaikan suhu.'),
  ], [
    Q('Dampak kenaikan muka laut yang paling dirasakan kota pesisir adalah …', ['banjir rob dan abrasi pantai', 'gempa bumi', 'meningkatnya salju', 'berkurangnya gelombang laut'], 0, 'Air laut yang lebih tinggi lebih mudah menggenangi daratan rendah dan mengikis garis pantai.', 1),
    Q('Pemutihan terumbu karang terutama dipicu oleh …', ['suhu air laut yang terlalu tinggi', 'bertambahnya ikan karang', 'air laut yang terlalu dingin', 'meningkatnya cahaya bulan'], 0, 'Pada air yang terlalu hangat, karang melepas alga simbionnya sehingga warnanya memudar dan karang bisa mati.'),
    Q('Pernyataan yang tepat tentang perubahan iklim adalah …', ['dapat menyebabkan kekeringan di satu daerah dan hujan ekstrem di daerah lain', 'hanya membuat semua tempat menjadi lebih panas secara merata', 'tidak berpengaruh pada pertanian', 'hanya terjadi di wilayah kutub'], 0, 'Pemanasan mengubah pola sirkulasi atmosfer, sehingga dampaknya berbeda di setiap wilayah.'),
  ]),
  'FIS.C26.E.IKLIM:MITIGASI': K([
    S('Mitigasi', ['**Mitigasi** berarti mengurangi penyebab, yaitu menekan emisi gas rumah kaca. Contohnya beralih ke energi terbarukan, menghemat listrik, dan memakai transportasi umum.', 'Menjaga dan menanam hutan, termasuk mangrove, menambah penyerapan karbon.']),
    S('Adaptasi', ['**Adaptasi** berarti menyesuaikan diri dengan dampak yang sudah atau akan terjadi, misalnya membangun tanggul laut, menanam varietas padi tahan kekeringan, dan membuat sistem peringatan dini banjir.', 'Keduanya dibutuhkan: mitigasi memperlambat perubahan, adaptasi mengurangi kerugian.'], undefined, 'Tanyakan: apakah tindakan ini mengurangi emisi (mitigasi) atau mengurangi kerugian (adaptasi)?'),
  ], [
    Q('Tindakan berikut yang termasuk mitigasi perubahan iklim adalah …', ['mengganti lampu pijar dengan lampu LED', 'meninggikan rumah di daerah rawan banjir', 'membangun tanggul laut', 'menanam padi tahan kekeringan'], 0, 'Lampu LED memakai listrik lebih sedikit, sehingga emisi dari pembangkit berkurang; tiga pilihan lain adalah adaptasi.'),
    Q('Pembuatan sistem peringatan dini banjir termasuk …', ['adaptasi', 'mitigasi', 'penyebab pemanasan global', 'efek rumah kaca alami'], 0, 'Peringatan dini tidak mengurangi emisi, tetapi mengurangi kerugian akibat banjir.', 1),
    Q('Menanam mangrove di pesisir disebut bermanfaat ganda karena …', ['menyerap karbon sekaligus melindungi pantai dari abrasi', 'hanya mengurangi emisi kendaraan', 'menaikkan suhu laut', 'mempercepat kenaikan muka laut'], 0, 'Mangrove menyimpan banyak karbon (mitigasi) dan meredam gelombang serta abrasi (adaptasi).'),
  ]),
  // ---------- Pembangkit energi terbarukan ----------
  'FIS.C26.E.TERBARUKAN:C1': K([
    S('Sel surya', ['**Sel surya** (fotovoltaik) mengubah energi cahaya langsung menjadi energi listrik arus searah. Beberapa sel disusun menjadi panel surya.', 'Daya keluarannya bergantung pada intensitas cahaya, luas panel, dan **efisiensi** panel.'], [['daya keluaran', 'P = efisiensi × intensitas × luas']]),
    S('Menghitung dan menilai', ['Contoh: panel seluas 2 m² menerima 1.000 W/m² dengan efisiensi 20%. Daya listriknya 0,20 × 1.000 × 2 = 400 W.', 'Kelebihan: bersih dan cocok untuk Indonesia yang tropis. Keterbatasan: tidak menghasilkan listrik di malam hari, sehingga perlu baterai atau jaringan listrik.'], undefined, 'Efisiensi panel surya umumnya sekitar 15–22%.'),
  ], [
    Q('Perubahan energi pada sel surya adalah …', ['energi cahaya menjadi energi listrik', 'energi kimia menjadi energi listrik', 'energi gerak menjadi energi listrik', 'energi listrik menjadi energi cahaya'], 0, 'Sel fotovoltaik menyerap foton dan menghasilkan arus listrik secara langsung.', 1),
    Q('Panel surya seluas 1,5 m² menerima intensitas 800 W/m² dengan efisiensi 15%. Daya listriknya adalah …', ['180 W', '1.200 W', '120 W', '800 W'], 0, 'P = 0,15 × 800 × 1,5 = 180 W.'),
    Q('Rumah yang hanya memakai panel surya tetap membutuhkan baterai karena …', ['panel tidak menghasilkan listrik saat malam', 'panel menghasilkan listrik bolak-balik', 'baterai menaikkan efisiensi panel', 'panel hanya bekerja saat hujan'], 0, 'Energi berlebih di siang hari disimpan di baterai untuk dipakai saat tidak ada cahaya.'),
  ]),
  'FIS.C26.E.TERBARUKAN:C2': K([
    S('PLTA', ['Air bendungan yang jatuh mengubah **energi potensial** menjadi energi kinetik yang memutar turbin dan generator.', 'Daya listriknya P = η · ρ · Q · g · h, dengan Q debit air (m³/s), h tinggi jatuh air, dan η efisiensi pembangkit.'], [['daya PLTA', 'P = η ρ Q g h']]),
    S('PLTB (bayu)', ['Angin memutar baling-baling turbin; energi kinetik udara diubah menjadi energi listrik oleh generator.', 'Dayanya sebanding dengan **pangkat tiga kecepatan angin**, sehingga angin dua kali lebih kencang memberi daya delapan kali lebih besar.'], [['daya angin', 'P ∝ v³']], 'PLTB Sidrap di Sulawesi Selatan adalah salah satu pembangkit tenaga bayu besar di Indonesia.'),
  ], [
    Q('Urutan perubahan energi pada PLTA adalah …', ['potensial → kinetik → listrik', 'kinetik → potensial → listrik', 'kimia → panas → listrik', 'listrik → kinetik → potensial'], 0, 'Air di ketinggian memiliki energi potensial, berubah menjadi kinetik saat jatuh, lalu turbin dan generator mengubahnya menjadi listrik.', 1),
    Q('Air dengan debit 10 m³/s jatuh dari ketinggian 20 m (ρ = 1.000 kg/m³, g = 10 m/s²). Jika efisiensinya 80%, daya listriknya adalah …', ['1,6 MW', '2 MW', '160 kW', '16 MW'], 0, 'P = 0,8 × 1.000 × 10 × 10 × 20 = 1.600.000 W = 1,6 MW.', 3),
    Q('Jika kecepatan angin naik dari 4 m/s menjadi 8 m/s, daya turbin angin menjadi …', ['8 kali semula', '2 kali semula', '4 kali semula', '16 kali semula'], 0, 'Daya sebanding v³, sehingga kecepatan dua kali lipat membuat daya menjadi 2³ = 8 kali.'),
  ]),
  'FIS.C26.E.TERBARUKAN:PANASBUMI': K([
    S('Panas bumi', ['**PLTP** memanfaatkan uap panas dari dalam Bumi untuk memutar turbin. Indonesia yang berada di jalur gunung api memiliki potensi panas bumi yang sangat besar.', 'Kelebihannya: dapat beroperasi siang dan malam tanpa bergantung cuaca.']),
    S('Bioenergi dan menilai pilihan', ['**Bioenergi** berasal dari biomassa: biogas dari kotoran ternak, biodiesel dari minyak sawit, atau limbah pertanian. Karbonnya berasal dari tumbuhan yang baru tumbuh.', 'Setiap sumber punya syarat lokasi dan dampak, sehingga pilihan energi dinilai dari ketersediaan, biaya, kestabilan pasokan, dan dampak lingkungannya.'], undefined, 'Biomassa disebut terbarukan jika tanamannya ditanam kembali secara berkelanjutan.'),
  ], [
    Q('Kelebihan PLTP dibanding PLTS adalah …', ['dapat menghasilkan listrik terus-menerus, siang dan malam', 'tidak memerlukan turbin', 'dapat dibangun di mana saja', 'tidak menghasilkan uap'], 0, 'Sumber panasnya berasal dari dalam Bumi dan tidak bergantung pada cahaya Matahari.'),
    Q('Biogas dari kotoran sapi terutama mengandung gas …', ['metana', 'oksigen', 'nitrogen', 'helium'], 0, 'Penguraian bahan organik tanpa oksigen oleh bakteri menghasilkan gas metana yang dapat dibakar.', 1),
    Q('Sebuah pulau kecil terpencil yang cerah sepanjang tahun dan jauh dari gunung api paling cocok memakai …', ['pembangkit listrik tenaga surya dengan baterai', 'pembangkit listrik tenaga panas bumi', 'PLTA bendungan besar', 'pembangkit listrik tenaga batu bara skala besar'], 0, 'Sinar Matahari melimpah dan panel dapat dipasang bertahap, sementara panas bumi dan bendungan besar butuh kondisi geologi atau sungai tertentu.'),
  ]),
};
