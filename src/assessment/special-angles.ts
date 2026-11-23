/*
 * Nilai sudut istimewa yang ditulis siswa ("sin 30° = ½", "20 × cos 30° = 20 × ½"), dibaca tanpa AI.
 * Penilai AI pernah menerima "cos 30° = ½" sebagai benar dan menolak "tan 30° = 1/√3" (QA TC-PANDU-044/053/058);
 * nilai sudut istimewa itu fakta, jadi diputuskan aturan.
 */
const R3 = Math.sqrt(3), R2 = Math.SQRT2;
const TABLE: Record<'sin' | 'cos' | 'tan', Record<number, number>> = {
  sin: { 0: 0, 30: 0.5, 37: 0.6, 45: R2 / 2, 53: 0.8, 60: R3 / 2, 90: 1 },
  cos: { 0: 1, 30: R3 / 2, 37: 0.8, 45: R2 / 2, 53: 0.6, 60: 0.5, 90: 0 },
  tan: { 0: 0, 30: 1 / R3, 37: 0.75, 45: 1, 53: 4 / 3, 60: R3 },
};

/** Ekspresi angka sederhana: 0,5 · ½ · √3/2 · 1/√3 · 2√3 · (1/2) · 3:4. Selain itu null. */
export function numberOf(raw: string): number | null {
  const s = raw.replace(/½/g, '(1/2)').replace(/¼/g, '(1/4)').replace(/¾/g, '(3/4)').normalize('NFKC').replace(/⁄/g, '/').replace(/\s+/g, '').replace(/akar/gi, '√').replace(/[×·*]/g, '*').replace(/[:÷]/g, '/').replace(/[−–]/g, '-')
    .replace(/(\d),(\d)/g, '$1.$2');
  if (!s || !/^[-0-9.()/*+√]+$/.test(s)) return null;
  let k = 0;
  const peek = () => s[k];
  const num = (): number | null => {
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(k));
    if (!m) return null;
    k += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number | null => {
    if (peek() === '-') { k++; const v = factor(); return v === null ? null : -v; }
    if (peek() === '√') { k++; const v = factor(); return v === null || v < 0 ? null : Math.sqrt(v); }
    if (peek() === '(') { k++; const v = expr(); if (v === null || peek() !== ')') return null; k++; return v; }
    return num();
  };
  // "2√3" = 2 × √3 (perkalian tanpa tanda)
  const implicit = (): number | null => {
    let v = factor();
    while (v !== null && (peek() === '√' || peek() === '(')) { const w = factor(); v = w === null ? null : v * w; }
    return v;
  };
  const term = (): number | null => {
    let v = implicit();
    while (v !== null && (peek() === '*' || peek() === '/')) {
      const op = s[k++]; const w = implicit();
      if (w === null || (op === '/' && w === 0)) return null;
      v = op === '*' ? v * w : v / w;
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    while (v !== null && (peek() === '+' || peek() === '-')) { const op = s[k++]; const w = term(); if (w === null) return null; v = op === '+' ? v + w : v - w; }
    return v;
  };
  const v = expr();
  return v !== null && k === s.length && Number.isFinite(v) ? v : null;
}

export interface AngleSlip { fn: 'sin' | 'cos' | 'tan'; angle: number; written: string; right: boolean }

const TRIG = /(sin|cos|tan)\s*\(?\s*(\d{1,2})\s*(?:°|º|derajat|o\b)?\s*\)?/i;
const compact = (s: string) => s.replace(/\s+/g, '');

/**
 * Setiap "f θ = nilai" di jawaban, juga di dalam rantai "20 × sin 30° = 20 × √3/2" (pengali yang sama di kedua sisi dilepas).
 * Hanya sudut di tabel; ruas kanan yang bukan angka ("x / 20") dilewati.
 */
export function specialAngleSlips(text: string): AngleSlip[] {
  const out: AngleSlip[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/=|≈/);
    for (let n = 0; n + 1 < parts.length; n++) {
      const a = parts[n]!, b = parts[n + 1]!;
      const m = TRIG.exec(a);
      if (!m) continue;
      const fn = m[1]!.toLowerCase() as AngleSlip['fn'], angle = Number(m[2]);
      const truth = TABLE[fn][angle];
      if (truth === undefined) continue;
      // ruas kanan berhenti di koma atau kata sambung ("tan 30° = ½, jadi x = 10")
      const right = b.split(/,\s|;|\s(?:jadi|maka|sehingga|dan)\s/i)[0]!;
      const pre = compact(a.slice(0, m.index)), post = compact(a.slice(m.index + m[0].length)), rhs = compact(right);
      if (!rhs.startsWith(pre) || !rhs.endsWith(post) || rhs.length <= pre.length + post.length) continue;
      const middle = rhs.slice(pre.length, rhs.length - post.length);
      const value = numberOf(middle);
      if (value === null) continue;
      out.push({ fn, angle, written: middle, right: Math.abs(value - truth) <= 0.02 * Math.max(1, Math.abs(truth)) });
    }
  }
  return out;
}

/**
 * Nilai sudut istimewa yang dipakai tanpa ditulis "f θ = nilai", mis. "tan 30° = x / 20" lalu "x = 20 × 1/√3"
 * (QA TC-PANDU-044). Hanya bilangan tak bulat (pecahan, akar, desimal) yang cocok dengan nilai sudut yang disebut di
 * jawaban; bilangan bulat tidak dihitung supaya "20" atau "1" tidak dianggap nilai tan 45°.
 */
export function specialAngleUses(text: string): AngleSlip[] {
  const named = new Set<string>();
  for (const m of text.matchAll(new RegExp(TRIG.source, 'gi'))) named.add(m[1]!.toLowerCase() + ':' + Number(m[2]));
  if (!named.size) return [];
  const out: AngleSlip[] = [];
  const TOKEN = /(?:\d+(?:[.,]\d+)?\s*\/\s*√?\s*\d+(?:[.,]\d+)?|√\s*\d+\s*\/\s*\d+|\d*\s*√\s*\d+|[½¼¾]|\d+[.,]\d+)/g;
  for (const m of text.matchAll(TOKEN)) {
    const v = numberOf(m[0]);
    if (v === null || Number.isInteger(v)) continue;
    for (const key of named) {
      const [fn, a] = key.split(':') as [AngleSlip['fn'], string];
      const truth = TABLE[fn]?.[Number(a)];
      if (truth !== undefined && Math.abs(v - truth) <= 0.02 * Math.max(1, Math.abs(truth))) out.push({ fn, angle: Number(a), written: m[0], right: true });
    }
  }
  return out;
}
