import type { PilotCore, PilotQuestion, PilotSlide } from './types.js';
// Materi dan soal Fisika SMA (Fase F) untuk inti PLANNED dari audit kesenjangan materi (prioritas 2).
// Kunci = "KODE_TOPIK:ID_INTI" di planned.ts. Soal disusun ulang bergaya asesmen Kurikulum Merdeka, bukan salinan soal resmi.

const S = (h: string, t: string[], m?: [string, string][], tip?: string): PilotSlide => ({ h, t, ...(m ? { m } : {}), ...(tip ? { tip } : {}) });
const Q = (p: string, o: string[], a: number, why: string, d: 1 | 2 | 3 = 2): PilotQuestion => ({ p, o, a, why, d, src: 'KM' });
type Content = Pick<PilotCore, 'slides' | 'q' | 'min'>;
const K = (slides: [PilotSlide, PilotSlide], q: PilotQuestion[], min = 6): Content => ({ slides, q, min });

export const SMA_FIS: Record<string, Content> = {
  // ---------- Listrik statis dan medan ----------
  'FIS.C26.F.MEDAN:C1': K([
    S('Muatan listrik', ['Ada dua jenis muatan: positif dan negatif. Muatan sejenis **tolak-menolak**, muatan berlawanan jenis **tarik-menarik**.', 'Satuan muatan adalah coulomb (C). Muatan sebuah elektron −1,6 × 10⁻¹⁹ C.'], [['muatan elektron', '−1,6 × 10⁻¹⁹ C']]),
    S('Hukum Coulomb', ['Besar gaya antara dua muatan titik: **F = k · q₁q₂ / r²**, dengan k = 9 × 10⁹ N·m²/C².', 'Gaya sebanding dengan hasil kali muatan dan berbanding terbalik dengan **kuadrat** jarak: jarak dua kali lipat, gaya menjadi ¼.'], [['hukum Coulomb', 'F = k q₁q₂ / r²'], ['k', '9 × 10⁹ N·m²/C²']], 'Ubah µC ke C (× 10⁻⁶) dan cm ke m sebelum menghitung.'),
  ], [
    Q('Dua muatan masing-masing 2 µC dan 3 µC berjarak 30 cm. Besar gaya Coulomb antara keduanya adalah …', ['0,6 N', '0,06 N', '6 N', '1,8 N'], 0, 'F = 9 × 10⁹ × (2 × 10⁻⁶)(3 × 10⁻⁶) / (0,3)² = 0,054 / 0,09 = 0,6 N.'),
    Q('Jarak antara dua muatan dijadikan 3 kali semula. Gaya Coulomb menjadi … kali semula.', ['1/9', '1/3', '3', '9'], 0, 'F berbanding terbalik dengan r². Jika r menjadi 3r, F menjadi F/3² = F/9.', 1),
    Q('Benda bermuatan A dan B saling tarik-menarik, sedangkan B dan benda C yang bermuatan negatif saling tolak-menolak. Muatan benda A adalah …', ['positif', 'negatif', 'netral', 'tidak dapat ditentukan'], 0, 'B menolak C yang negatif, jadi B negatif. A yang bermuatan menarik B yang negatif, jadi A positif.'),
  ]),
  'FIS.C26.F.MEDAN:MEDANLISTRIK': K([
    S('Kuat medan listrik', ['Medan listrik adalah daerah di sekitar muatan tempat muatan lain mengalami gaya. Kuat medan **E = F / q**, satuannya N/C.', 'Untuk muatan titik Q: **E = k · Q / r²**.'], [['kuat medan', 'E = F / q = kQ / r²']]),
    S('Arah dan garis medan', ['Garis medan keluar dari muatan positif dan masuk ke muatan negatif. Makin rapat garisnya, makin kuat medannya.', 'Muatan positif mengalami gaya searah medan; muatan negatif mengalami gaya berlawanan arah medan.'], [['arah medan', 'keluar dari +, masuk ke −']], 'Medan dari beberapa muatan dijumlahkan sebagai vektor, jadi perhatikan arahnya.'),
  ], [
    Q('Kuat medan listrik pada jarak 3 cm dari muatan titik 4 µC adalah …', ['4 × 10⁷ N/C', '4 × 10⁵ N/C', '1,2 × 10⁶ N/C', '3,6 × 10⁴ N/C'], 0, 'E = kQ/r² = 9 × 10⁹ × 4 × 10⁻⁶ / (3 × 10⁻²)² = 3,6 × 10⁴ / 9 × 10⁻⁴ = 4 × 10⁷ N/C.'),
    Q('Sebuah muatan 2 × 10⁻⁶ C mengalami gaya 0,01 N di suatu titik. Kuat medan di titik itu adalah …', ['5 × 10³ N/C', '2 × 10⁻⁸ N/C', '5 × 10⁻³ N/C', '2 × 10⁴ N/C'], 0, 'E = F/q = 0,01 / (2 × 10⁻⁶) = 5 × 10³ N/C.', 1),
    Q('Sebuah elektron berada dalam medan listrik yang mengarah ke timur. Arah gaya pada elektron adalah ke …', ['barat', 'timur', 'utara', 'tidak ada gaya'], 0, 'Elektron bermuatan negatif, sehingga gayanya berlawanan dengan arah medan.', 1),
  ]),
  'FIS.C26.F.MEDAN:POTENSIAL': K([
    S('Potensial listrik', ['Potensial listrik **V** adalah energi potensial per satuan muatan, satuannya volt (1 V = 1 J/C). Untuk muatan titik: **V = kQ / r**.', 'Potensial adalah besaran skalar: tanda muatan ikut dihitung, dan potensial dari beberapa muatan cukup dijumlahkan.'], [['potensial muatan titik', 'V = kQ / r']]),
    S('Energi dan usaha', ['Energi potensial muatan q di titik berpotensial V: **Ep = qV**.', 'Usaha untuk memindahkan muatan q dari A ke B: **W = q(V_B − V_A)**.'], [['energi potensial', 'Ep = qV'], ['usaha', 'W = q · ΔV']], 'Kuat medan E berbanding dengan 1/r², tetapi potensial V berbanding dengan 1/r.'),
  ], [
    Q('Potensial listrik pada jarak 0,3 m dari muatan titik 2 µC adalah …', ['6 × 10⁴ V', '2 × 10⁵ V', '6 × 10³ V', '1,8 × 10⁴ V'], 0, 'V = kQ/r = 9 × 10⁹ × 2 × 10⁻⁶ / 0,3 = 1,8 × 10⁴ / 0,3 = 6 × 10⁴ V.'),
    Q('Usaha untuk memindahkan muatan 5 µC dari titik berpotensial 20 V ke titik berpotensial 80 V adalah …', ['3 × 10⁻⁴ J', '4 × 10⁻⁴ J', '1 × 10⁻⁴ J', '3 × 10⁻² J'], 0, 'W = q(V_B − V_A) = 5 × 10⁻⁶ × (80 − 20) = 3 × 10⁻⁴ J.'),
    Q('Jika jarak dari sebuah muatan titik dijadikan 2 kali, potensial listriknya menjadi …', ['½ kali semula', '¼ kali semula', '2 kali semula', 'tetap'], 0, 'V = kQ/r berbanding terbalik dengan r, bukan r², jadi menjadi setengahnya.', 1),
  ]),
  'FIS.C26.F.MEDAN:KAPASITOR': K([
    S('Kapasitas kapasitor', ['Kapasitor menyimpan muatan. Kapasitasnya **C = Q / V**, satuannya farad (F).', 'Untuk keping sejajar: **C = ε₀A / d**. Kapasitas makin besar jika luas keping A besar, jarak keping d kecil, atau di antara keping diberi bahan dielektrik.'], [['kapasitas', 'C = Q / V'], ['keping sejajar', 'C = ε₀A / d']]),
    S('Susunan dan energi', ['**Paralel**: C_total = C₁ + C₂ + … (tegangannya sama). **Seri**: 1/C_total = 1/C₁ + 1/C₂ + … (muatannya sama).', 'Energi yang tersimpan: **W = ½CV² = ½QV**.'], [['paralel', 'C₁ + C₂'], ['seri', '1/C = 1/C₁ + 1/C₂'], ['energi', 'W = ½CV²']], 'Rumus kapasitor seri dan paralel kebalikan dari rumus resistor.'),
  ], [
    Q('Dua kapasitor 3 µF dan 6 µF disusun seri. Kapasitas totalnya adalah …', ['2 µF', '9 µF', '4,5 µF', '18 µF'], 0, '1/C = 1/3 + 1/6 = 1/2, jadi C = 2 µF.', 1),
    Q('Kapasitor 4 µF dihubungkan ke sumber 10 V. Energi yang tersimpan adalah …', ['2 × 10⁻⁴ J', '4 × 10⁻⁴ J', '2 × 10⁻⁵ J', '4 × 10⁻⁵ J'], 0, 'W = ½CV² = ½ × 4 × 10⁻⁶ × 10² = 2 × 10⁻⁴ J.'),
    Q('Jarak antarkeping sebuah kapasitor keping sejajar diperkecil menjadi setengahnya. Kapasitasnya menjadi …', ['2 kali semula', '½ kali semula', '4 kali semula', 'tetap'], 0, 'C = ε₀A/d berbanding terbalik dengan d, jadi d yang setengahnya membuat C dua kali lipat.'),
  ]),
  'FIS.C26.F.MEDAN:LORENTZ': K([
    S('Medan magnet di sekitar arus', ['Arus listrik menimbulkan medan magnet. Arahnya mengikuti **kaidah tangan kanan**: ibu jari searah arus, lipatan jari menunjukkan arah medan.', 'Di sekitar kawat lurus panjang: **B = μ₀I / (2πa)**, dengan μ₀ = 4π × 10⁻⁷ Wb/(A·m) dan a jarak ke kawat.'], [['kawat lurus', 'B = μ₀I / 2πa']]),
    S('Gaya Lorentz', ['Kawat berarus dalam medan magnet mengalami gaya **F = B · I · L · sin θ**. Muatan yang bergerak mengalami **F = q · v · B · sin θ**.', 'Gaya paling besar saat arus atau kecepatan tegak lurus medan (θ = 90°) dan nol saat sejajar medan.'], [['pada kawat', 'F = BIL sin θ'], ['pada muatan', 'F = qvB sin θ']], 'Arah gaya Lorentz tegak lurus terhadap arus (atau kecepatan) dan terhadap medan sekaligus.'),
  ], [
    Q('Kuat medan magnet pada jarak 2 cm dari kawat lurus panjang berarus 5 A adalah …', ['5 × 10⁻⁵ T', '1 × 10⁻⁴ T', '5 × 10⁻⁷ T', '2,5 × 10⁻⁵ T'], 0, 'B = μ₀I/(2πa) = (4π × 10⁻⁷ × 5) / (2π × 0,02) = 5 × 10⁻⁵ T.'),
    Q('Kawat sepanjang 0,5 m berarus 4 A berada tegak lurus dalam medan magnet 0,2 T. Besar gaya Lorentz pada kawat adalah …', ['0,4 N', '0,8 N', '4 N', '0,1 N'], 0, 'F = BIL sin 90° = 0,2 × 4 × 0,5 × 1 = 0,4 N.', 1),
    Q('Sebuah proton bergerak sejajar dengan arah medan magnet. Gaya Lorentz yang dialaminya …', ['nol', 'maksimum', 'sama dengan qvB', 'berlawanan arah gerak'], 0, 'F = qvB sin θ dengan θ = 0°, sehingga sin θ = 0 dan gayanya nol.'),
  ]),
};
