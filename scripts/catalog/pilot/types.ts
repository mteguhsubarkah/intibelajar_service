// Konten pilot (MaFiKiBio): format tulis ringkas yang diubah scripts/catalog/pilot.ts menjadi file manifest.
// Satu inti = satu konsep katalog, satu materi dua slide, dan beberapa soal pilihan ganda.

/** Soal pilihan ganda. `a` = indeks opsi benar (0 = A). */
export interface PilotQuestion {
  /** teks soal; satu baris atau beberapa kalimat */
  p: string;
  /** 4–5 opsi jawaban */
  o: string[];
  a: number;
  /** pembahasan singkat: dipakai sebagai umpan balik benar dan salah */
  why: string;
  /** 1 mudah · 2 sedang · 3 sulit (bawaan 2) */
  d?: 1 | 2 | 3;
  /** perkiraan menit (bawaan 2) */
  min?: number;
  /** gaya rujukan soal: UN SMA, UTBK/SNBT, atau asesmen Kurikulum Merdeka */
  src?: 'UN' | 'SNBT' | 'KM';
}

/** Satu slide materi: judul, paragraf (boleh **tebal**), rumus opsional, dan tip opsional. */
export interface PilotSlide {
  h: string;
  t: string[];
  /** [nama, ekspresi]; ekspresi pertama disorot */
  m?: [string, string][];
  tip?: string;
}

export interface PilotCore {
  /** id inti di peta referensi IntiVerse (mis. C1, VEKTOR); menjadi bagian alias MAP */
  id: string;
  title: string;
  sub?: string;
  min?: number;
  capstone?: boolean;
  slides: [PilotSlide, PilotSlide];
  q: PilotQuestion[];
}

/** Topik baru (atau topik MAT yang sebelumnya PLANNED tanpa inti). */
export interface PilotTopic {
  code: string;
  subject: 'MAT' | 'FIS' | 'KIM' | 'BIO';
  title: string;
  subtitle: string;
  phase: 'E' | 'F' | 'F+';
  bekal: string[];
  /** alias TOPIC (huruf kecil) bila topik baru */
  alias?: string;
  cores: PilotCore[];
  /** prasyarat antarinti: [dari, ke, H = keras | S = lunak] */
  edges: [string, string, 'H' | 'S'][];
}

/** Materi dan soal untuk konsep yang sudah ada di katalog (MAT.EKS, MAT.BAR, MAT.VEK). */
export interface PilotExisting {
  topic: string;
  /** kode konsep yang sudah ada, mis. MAT.EKS.SIFAT_SIFAT_EKSPONEN */
  concept: string;
  /** potongan kode untuk soal/materi, mis. SIFAT_EKSPONEN */
  key: string;
  title: string;
  min?: number;
  slides: [PilotSlide, PilotSlide];
  q: PilotQuestion[];
}

export interface PilotRelation { from: string; to: string; kind: 'REQUIRES' | 'RELATED'; label: string }
