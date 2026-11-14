// Kelas (7–12) tempat tiap inti diajarkan. Aplikasi mengelompokkan bab per kelas; bab yang intinya tersebar di beberapa
// kelas muncul di tiap kelas itu dengan inti kelas tersebut saja. Inti tidak bisa pindah bab (publisher menolak
// CONCEPT_TOPIC_CHANGED), jadi pembagian per kelas dicatat per inti, bukan dengan memecah bab.
//
// Acuan pembagian: daftar isi Buku Siswa Kurikulum Merdeka terbitan Pusbuk Kemendikbudristek per kelas (Matematika VII–XII
// dan Matematika Tingkat Lanjut XI–XII; IPA VII–IX; IPA X; Fisika, Kimia, Biologi XI–XII), sebagaimana dirangkum di hasil
// pencarian (Ruangguru, Mamikos, Tirto, detikEdu, Gramedia) karena PDF buku.kemdikbud.go.id tidak bisa dibuka dari
// lingkungan pembuatnya; dan rentang fase Kepka BSKAP 046/H/KR/2025. Pembagian antarkelas di dalam satu fase berbeda
// antarbuku dan antarsekolah (ATP), jadi guru mapel memeriksanya saat sign-off per lingkup.
import { GRADES_OF_PHASE, type Topic } from '../../../src/catalog/manifest.js';

/** Per bab: satu kelas untuk semua inti, atau kelas bawaan + pengecualian per akhiran kode inti. */
type Placement = number | { all: number; [suffix: string]: number };

export const GRADES: Record<string, Placement> = {
  // ---------------- Matematika SMP (Fase D) ----------------
  'MAT.C26.D.BILANGAN': { all: 7, PANGKAT_AKAR_DAN_NOTASI_ILMIAH: 8, NOTASI_ILMIAH: 8 }, // VIII: bilangan berpangkat
  'MAT.C26.D.RASIO': 7,
  'MAT.C26.D.ALJABAR': 7, // VII: bentuk aljabar, persamaan & pertidaksamaan linear satu variabel
  'MAT.C26.D.FUNGSI': { all: 8, SISTEM_PERSAMAAN_LINEAR: 9, ELIMINASI_DAN_SUBSTITUSI_SPLDV: 9 }, // VIII relasi-fungsi-garis; IX SPLDV
  'MAT.C26.D.GEOMETRI': { all: 7, TEOREMA_PYTHAGORAS: 8, KONGRUEN_DAN_SEBANGUN: 9 },
  'MAT.C26.D.PENGUKURAN': { all: 8, TRANSFORMASI_KOORDINAT: 9 },
  'MAT.C26.D.DATA': { all: 8, PELUANG_DAN_FREKUENSI_RELATIF: 9, SAMPEL_REPRESENTATIF: 9 },
  // ---------------- Matematika SMA ----------------
  'MAT.EKS': 10, 'MAT.BAR': 10, 'MAT.VEK': 10, 'MAT.TRI': 10, 'MAT.SPL': 10, 'MAT.KUA': 10, 'MAT.STP': 10, 'MAT.C26.E.SPLTV': 10,
  'MAT.INV': { all: 11, TRANSFORMASI_FUNGSI: 12 }, // XI: komposisi & invers; XII: transformasi fungsi
  'MAT.CP25.F.LINGKARAN': 11,
  'MAT.C26.F.REGRESI': 11, // XI semester 2: statistika (regresi, korelasi)
  'MAT.CP25.F.PELUANG': 12,
  'MAT.BNG': 12, // XII: bunga, investasi, dan pinjaman anuitas
  'MAT.MTX': 11, // Matematika Tingkat Lanjut XI: matriks
  'MAT.C26.FPLUS.KOMPLEKS': 11, 'MAT.C26.FPLUS.POLINOMIAL': 11, 'MAT.C26.FPLUS.TRANSFORMASI': 11, 'MAT.C26.FPLUS.FUNGSI': 11,
  'MAT.KAL': 12, 'MAT.C26.FPLUS.KERUCUT': 12, 'MAT.C26.FPLUS.DISTRIBUSI': 12,
  'MAT.C26.FPLUS.LINGKARAN': 12, 'MAT.C26.FPLUS.LIMIT': 12, 'MAT.C26.FPLUS.TURUNAN': 12, 'MAT.C26.FPLUS.INTEGRAL': 12,
  // ---------------- Fisika (IPA SMP, IPA X, Fisika XI–XII) ----------------
  'FIS.C26.D.UKUR': 7, 'FIS.C26.D.ANTARIKSA': 7,
  'FIS.C26.D.SUHU': 7, 'FIS.C26.D.GERAK': 7, // VII Bab 3 Suhu, Kalor, dan Pemuaian; VII Bab 4 Gerak dan Gaya
  'FIS.C26.D.TEKANAN': 8, // VIII rev 2024 Bab IV Teknologi Penerapan Tekanan pada Zat
  'FIS.C26.D.ENERGI': 8, // VIII Bab III usaha, energi, dan pesawat sederhana (suhu & kalor pindah ke D.SUHU, Tahap 3)
  'FIS.C26.D.GELOMBANG': 8, 'FIS.C26.D.KEBUMIAN': 8,
  'FIS.C26.D.LISTRIK': 9, // IX: listrik, magnet, dan sumber energi alternatif
  'FIS.C26.E.UKUR': 10, 'FIS.C26.E.GERAK2D': 10, 'FIS.C26.E.ENERGI': 10, 'FIS.C26.E.IKLIM': 10, 'FIS.C26.E.TERBARUKAN': 10,
  'FIS.C26.F.MEKANIKA': 11, 'FIS.C26.F.FLUIDA': 11, 'FIS.C26.F.GELOMBANG': 11, 'FIS.C26.F.TERMAL': 11,
  'FIS.C26.F.MEDAN': 12, 'FIS.C26.F.ELEKTRO': 12, 'FIS.C26.F.MODERN': 12,
  // ---------------- Kimia ----------------
  'KIM.C26.D.PARTIKEL': 7, // VII bab 2: zat dan perubahannya (wujud zat, model partikel, kerapatan)
  'KIM.C26.D.MATERI': { all: 8, PERUBAHAN_DAN_PEMISAHAN: 7 }, // VIII bab 5: unsur, senyawa, campuran; VII bab 2: perubahan fisika dan kimia
  'KIM.C26.D.ATOM': 9, 'KIM.C26.D.REAKSI': 9, 'KIM.C26.D.ZAT': 9, // IX: reaksi kimia, zat aditif & adiktif
  'KIM.C26.E.ATOM': 10, 'KIM.C26.E.STOIK': 10, 'KIM.C26.E.HUKUMDASAR': 10, 'KIM.C26.E.HIJAU': 10, 'KIM.C26.E.MODELATOM': 10,
  'KIM.C26.F.STRUKTUR': 11, 'KIM.C26.F.HIDROKARBON': 11, 'KIM.C26.F.TERMOKIMIA': 11, 'KIM.C26.F.LAJU': 11,
  'KIM.C26.F.SETIMBANG': { all: 11, ASAM_BASA_DAN_PH: 12, HIDROLISIS_DAN_PENYANGGA: 12 },
  'KIM.C26.F.ELEKTROLIT': 12, 'KIM.C26.F.KOLIGATIF': 12, 'KIM.C26.F.KOLOID': 12, 'KIM.C26.F.ASAMBASA': 12,
  'KIM.C26.F.REDOKS': 12, 'KIM.C26.F.KARBON': 12, 'KIM.C26.F.GUGUS': 12,
  // ---------------- Biologi ----------------
  'BIO.C26.D.KLASIFIKASI': 7, 'BIO.C26.D.EKOLOGI': 7,
  'BIO.C26.D.ORGAN': 8,
  'BIO.C26.D.KOORDINASI': 9, 'BIO.C26.D.GENETIKA': 9, 'BIO.C26.D.TUMBUH': 9,
  'BIO.C26.E.BIODIVERSITAS': 10, 'BIO.C26.E.EKOSISTEM': 10, 'BIO.C26.E.MIKROBA': 10, 'BIO.C26.E.KLASIFIKASI': 10, 'BIO.C26.E.LIMBAH': 10,
  'BIO.C26.F.SEL': { all: 11, ENZIM_DAN_METABOLISME: 12, RESPIRASI_SEL_DAN_ATP: 12, FOTOSINTESIS_DAN_ANABOLISME: 12 },
  'BIO.C26.F.ORGAN': 11, 'BIO.C26.F.TUMBUHAN': 11, 'BIO.C26.F.GERAK': 11, 'BIO.C26.F.IMUN': 11,
  'BIO.C26.F.TUMBUH': 12, 'BIO.C26.F.GENETIKA': 12, 'BIO.C26.F.HEREDITAS': 12, 'BIO.C26.F.MUTASI': 12,
  'BIO.C26.F.EVOLUSI': 12, 'BIO.C26.F.BIOTEK': 12,
};

/** Kelas inti `concept` di bab `topic`, atau undefined bila belum ditetapkan. Melempar galat bila di luar fase bab. */
export function gradeOf(topic: Pick<Topic, 'code' | 'phase'>, concept: string): number | undefined {
  const p = GRADES[topic.code];
  if (p === undefined) return undefined;
  const suffix = concept.startsWith(topic.code + '.') ? concept.slice(topic.code.length + 1) : concept;
  const grade = typeof p === 'number' ? p : (p[suffix] ?? p.all);
  if (!GRADES_OF_PHASE[topic.phase].includes(grade)) throw new Error(`${concept}: kelas ${grade} di luar fase ${topic.phase}`);
  return grade;
}

/** Pengecualian per inti yang tidak lagi cocok dengan inti mana pun (salah ketik atau inti dihapus). */
export function staleOverrides(topics: Pick<Topic, 'code' | 'concepts'>[]): string[] {
  const out: string[] = [];
  for (const [code, p] of Object.entries(GRADES)) {
    if (typeof p === 'number') continue;
    const t = topics.find(x => x.code === code);
    for (const suffix of Object.keys(p)) if (suffix !== 'all' && !t?.concepts.some(c => c.code === `${code}.${suffix}`)) out.push(`${code}.${suffix}`);
  }
  return out;
}
