/*
 * Visualisasi IntiGuide. AI hanya MEMILIH jenis gambar dan mengisi parameternya; frontend yang menggambar dengan
 * komponennya sendiri, jadi gambar selalu proporsional dan tidak ada HTML/SVG dari model yang ditampilkan.
 * Isian yang tidak lolos validasi dibuang (balasan teks tetap terkirim).
 *
 * Tiga jenis tahap pertama:
 * - segitiga-siku: segitiga siku-siku dengan sudut lancip θ di kiri bawah; sisi depan/samping/miring diberi label
 * - pola: suku-suku barisan dengan panah beda/rasio; untuk pola bilangan segitiga/persegi juga noktahnya
 * - grafik: fungsi dari keluarga tetap (linear, kuadrat, eksponen, sin, cos) dengan koefisien; titik dihitung FE
 */
export type GuideVisual =
  | { type: 'segitiga-siku'; sudut: number; label: { depan?: string; samping?: string; miring?: string }; sorot?: 'depan' | 'samping' | 'miring'; caption?: string }
  | { type: 'pola'; suku: (number | '?')[]; antara?: string; noktah?: 'segitiga' | 'persegi'; caption?: string }
  | { type: 'grafik'; fungsi: { jenis: 'linear' | 'kuadrat' | 'eksponen' | 'sin' | 'cos'; a: number; b: number; c: number }; x: [number, number]; titik?: { x: number; label?: string }[]; caption?: string };

export const VISUAL_PROMPT = `9. Boleh SATU visual bila gambar benar-benar membantu memahami intiAktif di soal ini (sisi segitiga, pola suku, bentuk grafik). Bila tidak perlu, "visual": null. Pilih salah satu bentuk:
   {"type":"segitiga-siku","sudut":30,"label":{"depan":"?","samping":"10 m","miring":"?"},"sorot":"depan","caption":"Sisi depan berhadapan dengan sudut 30°"}
     sudut = sudut lancip θ (derajat, 5-85) di kiri bawah; label tiap sisi maks 24 huruf, boleh nama benda dari soal ("tinggi menara ?"), nilai yang dicari ditulis "?"; sorot = sisi yang sedang dibahas (boleh dihapus).
   {"type":"pola","suku":[1,3,6,10,"?"],"antara":"+2, +3, +4","noktah":"segitiga","caption":"Tiap pola menambah satu baris noktah"}
     suku = 2-8 suku berurutan dari suku pertama (angka, atau "?" untuk yang dicari); antara = keterangan panah antarsuku, misal "+3" atau "×2" (maks 40 huruf); noktah hanya untuk pola bilangan segitiga/persegi, selain itu hapus.
   {"type":"grafik","fungsi":{"jenis":"eksponen","a":1,"b":2,"c":0},"x":[-2,3],"titik":[{"x":0,"label":"(0, 1)"}],"caption":"Grafik naik makin curam"}
     jenis: linear y=a·x+b, kuadrat y=a·x²+b·x+c, eksponen y=a·bˣ+c (b>0, b≠1), sin y=a·sin(b·x°)+c, cos y=a·cos(b·x°)+c (x dalam derajat); x = rentang sumbu x; titik maks 3, label maks 20 huruf.
   caption maks 90 huruf, teks biasa. Bila kamu menyebut gambar di teks ("lihat gambar"), visual WAJIB diisi.
   "visual" adalah field JSON TERPISAH di samping "reply". JANGAN menulis JSON, kurung kurawal, atau kata "type" di dalam teks reply. Visual DILARANG memuat jawaban akhir soal utama: nilai yang sedang dicari selalu "?".`;

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
/* teks pendamping: kosong/bukan teks = tidak ada; terlalu panjang = dilepas (bukan menggagalkan seluruh gambar) */
const text = (v: unknown, max: number, clean: (s: string) => string): string | undefined => {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const s = clean(String(v)).replace(/\s+/g, ' ').trim();
  return s && s.length <= max ? s : undefined;
};
const cut = (v: unknown, max: number, clean: (s: string) => string): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = clean(v).replace(/\s+/g, ' ').trim();
  if (!s) return undefined;
  return s.length <= max ? s : s.slice(0, s.lastIndexOf(' ', max - 1) > 40 ? s.lastIndexOf(' ', max - 1) : max - 1).trim() + '…';
};
/* Alasan gambar dibuang dicatat tanpa isi percakapan, supaya bisa dilacak dari journalctl. */
const dropped = (type: unknown, reason: string) => { console.warn(JSON.stringify({ event: 'intiguide_visual_dropped', type: typeof type === 'string' ? type.slice(0, 20) : typeof type, reason })); return null; };

/** Validasi isian `visual` dari model; `clean` merapikan sisa LaTeX. null = tidak ada atau tidak sah. */
export function readVisual(input: unknown, clean: (s: string) => string = (s) => s): GuideVisual | null {
  let raw = input;
  if (typeof input === 'string') { try { raw = JSON.parse(input); } catch { return input.trim() ? dropped('string', 'not-json') : null; } }
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const caption = cut(v.caption, 90, clean);
  const withCaption = <T extends object>(o: T) => (caption ? { ...o, caption } : o);

  if (v.type === 'segitiga-siku') {
    const s = typeof v.sudut === 'string' ? Number.parseFloat(v.sudut) : v.sudut;
    if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0 || s >= 90) return dropped(v.type, 'sudut');
    const sudut = Math.round(Math.min(85, Math.max(5, s)));
    const l = (v.label && typeof v.label === 'object' ? v.label : {}) as Record<string, unknown>;
    const label: { depan?: string; samping?: string; miring?: string } = {};
    for (const k of ['depan', 'samping', 'miring'] as const) { const t = text(l[k], 28, clean); if (t) label[k] = t; }
    const sorot = ['depan', 'samping', 'miring'].includes(v.sorot as string) ? (v.sorot as 'depan' | 'samping' | 'miring') : undefined;
    return withCaption({ type: 'segitiga-siku' as const, sudut, label, ...(sorot ? { sorot } : {}) });
  }

  if (v.type === 'pola') {
    if (!Array.isArray(v.suku) || v.suku.length < 2) return dropped(v.type, 'suku');
    const suku = v.suku.slice(0, 8).map((s) => (s === '?' ? '?' : num(typeof s === 'string' ? Number(s) : s, -1e6, 1e6)));
    if (suku.some((s) => s === null) || !suku.some((s) => s !== '?')) return dropped(v.type, 'suku');
    const antara = text(v.antara, 40, clean);
    const noktah = ['segitiga', 'persegi'].includes(v.noktah as string) ? (v.noktah as 'segitiga' | 'persegi') : undefined;
    return withCaption({ type: 'pola' as const, suku: suku as (number | '?')[], ...(antara ? { antara } : {}), ...(noktah ? { noktah } : {}) });
  }

  if (v.type === 'grafik') {
    const f = (v.fungsi && typeof v.fungsi === 'object' ? v.fungsi : {}) as Record<string, unknown>;
    const jenis = ['linear', 'kuadrat', 'eksponen', 'sin', 'cos'].includes(f.jenis as string) ? (f.jenis as 'linear' | 'kuadrat' | 'eksponen' | 'sin' | 'cos') : null;
    const a = num(f.a ?? 1, -1000, 1000), b = num(f.b ?? 0, -1000, 1000), c = num(f.c ?? 0, -1000, 1000);
    const x = Array.isArray(v.x) && v.x.length === 2 ? [num(v.x[0], -3600, 3600), num(v.x[1], -3600, 3600)] : [null, null];
    if (!jenis) return dropped(v.type, 'jenis');
    if (a === null || b === null || c === null) return dropped(v.type, 'koefisien');
    if (x[0] === null || x[1] === null || x[1]! <= x[0]!) return dropped(v.type, 'x');
    if (jenis === 'eksponen' && (b <= 0 || b === 1)) return dropped(v.type, 'basis');
    const titik: { x: number; label?: string }[] = [];
    for (const t of (Array.isArray(v.titik) ? v.titik : []).slice(0, 3) as Record<string, unknown>[]) {
      const tx = num(t?.x, x[0]!, x[1]!), label = text(t?.label, 24, clean);
      if (tx !== null) titik.push({ x: tx, ...(label ? { label } : {}) });
    }
    return withCaption({ type: 'grafik' as const, fungsi: { jenis, a, b, c }, x: [x[0]!, x[1]!] as [number, number], ...(titik.length ? { titik } : {}) });
  }
  return v.type === undefined && Object.keys(v).length === 0 ? null : dropped(v.type, 'type');
}
