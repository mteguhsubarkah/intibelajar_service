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
     sudut = sudut lancip θ (derajat, 5-85) di kiri bawah; label tiap sisi maks 12 huruf, nilai yang dicari ditulis "?"; sorot = sisi yang sedang dibahas (boleh dihapus).
   {"type":"pola","suku":[1,3,6,10,"?"],"antara":"+2, +3, +4","noktah":"segitiga","caption":"Tiap pola menambah satu baris noktah"}
     suku = 2-8 suku berurutan dari suku pertama (angka, atau "?" untuk yang dicari); antara = keterangan panah antarsuku, misal "+3" atau "×2" (maks 20 huruf); noktah hanya untuk pola bilangan segitiga/persegi, selain itu hapus.
   {"type":"grafik","fungsi":{"jenis":"eksponen","a":1,"b":2,"c":0},"x":[-2,3],"titik":[{"x":0,"label":"(0, 1)"}],"caption":"Grafik naik makin curam"}
     jenis: linear y=a·x+b, kuadrat y=a·x²+b·x+c, eksponen y=a·bˣ+c (b>0, b≠1), sin y=a·sin(b·x°)+c, cos y=a·cos(b·x°)+c (x dalam derajat); x = rentang sumbu x; titik maks 3, label maks 16 huruf.
   caption maks 90 huruf, teks biasa. Visual DILARANG memuat jawaban akhir soal utama: nilai yang sedang dicari selalu "?".`;

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const text = (v: unknown, max: number, clean: (s: string) => string) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return null;
  const s = clean(v).replace(/\s+/g, ' ').trim();
  return s && s.length <= max ? s : null;
};

/** Validasi isian `visual` dari model; `clean` merapikan sisa LaTeX. null = tidak ada atau tidak sah. */
export function readVisual(raw: unknown, clean: (s: string) => string = (s) => s): GuideVisual | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const caption = text(v.caption, 90, clean);
  if (caption === null) return null;
  const withCaption = <T extends object>(o: T) => (caption ? { ...o, caption } : o);

  if (v.type === 'segitiga-siku') {
    const sudut = num(v.sudut, 5, 85);
    const l = (v.label && typeof v.label === 'object' ? v.label : {}) as Record<string, unknown>;
    const label: { depan?: string; samping?: string; miring?: string } = {};
    for (const k of ['depan', 'samping', 'miring'] as const) {
      const t = text(l[k], 12, clean);
      if (t === null) return null;
      if (t) label[k] = t;
    }
    const sorot = v.sorot === undefined || v.sorot === null ? undefined : ['depan', 'samping', 'miring'].includes(v.sorot as string) ? (v.sorot as 'depan') : null;
    if (sudut === null || sorot === null) return null;
    return withCaption({ type: 'segitiga-siku' as const, sudut: Math.round(sudut), label, ...(sorot ? { sorot } : {}) });
  }

  if (v.type === 'pola') {
    if (!Array.isArray(v.suku) || v.suku.length < 2 || v.suku.length > 8) return null;
    const suku = v.suku.map((s) => (s === '?' ? '?' : num(s, -1e6, 1e6)));
    if (suku.some((s) => s === null) || !suku.some((s) => s !== '?')) return null;
    const antara = text(v.antara, 20, clean);
    const noktah = v.noktah === undefined || v.noktah === null ? undefined : ['segitiga', 'persegi'].includes(v.noktah as string) ? (v.noktah as 'segitiga') : null;
    if (antara === null || noktah === null) return null;
    return withCaption({ type: 'pola' as const, suku: suku as (number | '?')[], ...(antara ? { antara } : {}), ...(noktah ? { noktah } : {}) });
  }

  if (v.type === 'grafik') {
    const f = (v.fungsi && typeof v.fungsi === 'object' ? v.fungsi : {}) as Record<string, unknown>;
    const jenis = ['linear', 'kuadrat', 'eksponen', 'sin', 'cos'].includes(f.jenis as string) ? (f.jenis as 'linear' | 'kuadrat' | 'eksponen' | 'sin' | 'cos') : null;
    const a = num(f.a, -1000, 1000), b = num(f.b ?? 0, -1000, 1000), c = num(f.c ?? 0, -1000, 1000);
    const x = Array.isArray(v.x) && v.x.length === 2 ? [num(v.x[0], -3600, 3600), num(v.x[1], -3600, 3600)] : [null, null];
    if (!jenis || a === null || b === null || c === null || x[0] === null || x[1] === null || x[1]! <= x[0]!) return null;
    if (jenis === 'eksponen' && (b <= 0 || b === 1)) return null;
    const titik: { x: number; label?: string }[] = [];
    if (v.titik !== undefined && v.titik !== null) {
      if (!Array.isArray(v.titik) || v.titik.length > 3) return null;
      for (const t of v.titik as Record<string, unknown>[]) {
        const tx = num(t?.x, x[0]!, x[1]!), label = text(t?.label, 16, clean);
        if (tx === null || label === null) return null;
        titik.push({ x: tx, ...(label ? { label } : {}) });
      }
    }
    return withCaption({ type: 'grafik' as const, fungsi: { jenis, a, b, c }, x: [x[0]!, x[1]!] as [number, number], ...(titik.length ? { titik } : {}) });
  }
  return null;
}
