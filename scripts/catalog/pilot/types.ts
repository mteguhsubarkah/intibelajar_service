import type { BookRef } from '../../../src/catalog/manifest.js';
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
  /**
   * Inti lain yang juga dipakai (soal multi-inti). Tiap entri: id inti di topik yang sama (mis. "VEKTOR"),
   * "KODE_TOPIK:ID" untuk inti pilot di topik lain (mis. "MAT.KUA:PUNCAK"), atau kode konsep lengkap yang sudah
   * ada di katalog (mis. "MAT.TRI.SUDUT_ISTIMEWA"). Semua inti menjadi PRIMARY dan dinilai.
   */
  also?: string[];
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
  /**
   * Materi dua slide. Inti tanpa materi (dan tanpa soal) ditulis PLANNED: posisinya sudah ada di kurikulum,
   * isinya belum. Begitu slides dan soal diisi, inti menjadi READY pada pembangkitan berikutnya.
   */
  slides?: [PilotSlide, PilotSlide];
  q?: PilotQuestion[];
}

/** Topik baru (atau topik MAT yang sebelumnya PLANNED tanpa inti). */
export interface PilotTopic {
  code: string;
  subject: 'MAT' | 'FIS' | 'KIM' | 'BIO';
  title: string;
  subtitle: string;
  phase: 'D' | 'E' | 'F' | 'F+';
  bekal: string[];
  /** alias TOPIC (huruf kecil) bila topik baru */
  alias?: string;
  cores: PilotCore[];
  /** prasyarat antarinti: [dari, ke, H = keras | S = lunak] */
  edges: [string, string, 'H' | 'S'][];
  /** keputusan review (bawaan D7 konten pilot); topik dari audit kesenjangan materi memakai D9 */
  decision?: string;
  /** bukti asal inti untuk peninjau (bawaan: peta referensi IntiVerse) */
  evidence?: string[];
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

export interface PilotRelation {
  from: string; to: string; kind: 'REQUIRES' | 'RELATED'; label: string; decision?: string;
  /** bukti review pengganti bawaan (untuk relasi baru yang bukan dari peta IntiVerse) */
  evidence?: string[];
  /** catatan review tambahan di belakang bukti (mis. alasan perubahan dari audit) */
  notes?: string[];
  /** field review tambahan selain kind dan label */
  fields?: string[];
}

/** Tambahan per topik dari audit (mis. audit Fisika vs buku resmi 13 November 2026), ditempel generator menurut kode topik. */
export interface PilotAudit {
  /** padanan bab di buku teks atau dokumen CP (metadata sumber, lihat BookRef) */
  bookRefs?: BookRef[];
  /** catatan review tambahan di belakang bukti topik */
  notes?: string[];
  /** field review tambahan selain concepts dan prerequisites (mis. title) */
  fields?: string[];
}
