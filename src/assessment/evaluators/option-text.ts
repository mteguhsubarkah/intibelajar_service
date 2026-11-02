// Jawaban ketikan untuk soal pilihan ganda (semua latihan berbentuk isian). Pure, tanpa impor: berkas yang sama
// disalin ke FE (src/services/optionText.ts) untuk soal lokal, supaya perangkat dan server membaca jawaban sama.
//
// Urutan: (1) sama persis setelah dinormalkan, (2) nilai angka sama (0,5 = 0.5 = 1/2; satuan boleh ditulis atau tidak),
// (3) kata-kata pembeda sebuah pilihan semuanya ada di jawaban ("bakteri Rhizobium", "golongan VIIA periode 3"),
// (4) salah ketik kecil pada jawaban pendek. Jawaban yang cocok dengan lebih dari satu pilihan, atau memakai kata
// "tidak/bukan" yang tidak ada di pilihan, tidak dicocokkan. Tidak cocok dengan pilihan mana pun = bukan jawaban kunci.

export type OptionMatch = { index: number; how: 'exact' | 'numeric' | 'words' | 'typo' } | { index: -1; how: 'empty' | 'none' | 'ambiguous' };

const STOP = new Set(['dan', 'yang', 'adalah', 'ialah', 'yaitu', 'jawaban', 'jawabannya', 'jadi', 'maka', 'nya', 'itu', 'ini', 'di', 'ke', 'dari']);
const NEG = /(^|\s)(tidak|bukan|tak|belum)(\s|$)/;
/* "gatau", "bingung": belum menjawab, bukan jawaban salah (soal tetap bisa dijawab) */
const DONT_KNOW = /^(g+a+k? ?ta+h?u+|gk ?tau|nggak? ?ta+h?u+|ngga ?ta+h?u+|tidak tahu|tdk tahu|belum tahu|blm tau|bingung|entah|lupa|\?+|-+)$/;

export function normalizeOptionText(raw: string) {
  return raw.normalize('NFKC').replace(/[​-‍﻿]/g, '').toLowerCase()
    .replace(/[−–—]/g, '-').replace(/[×·⋅]/g, 'x').replace(/÷/g, '/')
    .replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, ' ').trim().replace(/[.。]+$/, '').trim();
}
const compact = (s: string) => s.replace(/[\s,]+/g, '');
function words(s: string) {
  return new Set(s.split(/[^\p{L}\p{N}√π.+\-*/^°%→]+/u).map((w) => w.replace(/^\.+|\.+$/g, '')).filter((w) => w && !STOP.has(w)));
}
/* satuan yang ditulis lengkap disamakan dengan singkatannya: "85 meter" = "85 m" */
const UNIT_ALIAS: Record<string, string> = { meter: 'm', metre: 'm', detik: 's', sekon: 's', gram: 'g', kilogram: 'kg', kilometer: 'km', sentimeter: 'cm', liter: 'l', mol: 'mol' };
function numberOf(s: string): { value: number; unit: string } | null {
  const m = compact(s).replace(/^[a-z]=/, '').match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?([a-z%°/²³]*)$/);
  if (!m) return null;
  const value = m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
  const unit = m[3] ?? '';
  return Number.isFinite(value) ? { value, unit: UNIT_ALIAS[unit] ?? unit } : null;
}

/*
 * Jawaban dengan langkah ("s1 = 25 m ... s total = 25 + 60 = 85 m. Jadi, jaraknya adalah 85 meter."): yang dinilai
 * jawaban akhirnya — baris terakhir, setelah "adalah/ialah/yaitu" atau setelah "=" terakhir. null bila bukan jawaban
 * berlangkah (satu baris pendek tanpa "=").
 */
function finalAnswerOf(raw: string): string | null {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2 && !raw.includes('=')) return null;
  const last = lines.at(-1) ?? '';
  const afterWord = last.split(/\b(?:adalah|ialah|yaitu|jadi|maka)\b/i).at(-1) ?? last;
  const afterEq = afterWord.split('=').at(-1) ?? afterWord;
  const seg = afterEq.replace(/^[\s,:]+/, '').trim();
  return seg && seg !== raw.trim() ? seg : null;
}
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.005);
function similarity(a: string, b: string) {
  if (!a.length || !b.length) return 0;
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const cur = d[j]!; d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  }
  return 1 - d[b.length]! / Math.max(a.length, b.length);
}

export function matchOption(options: readonly string[], raw: string): OptionMatch {
  const text = normalizeOptionText(raw ?? '');
  if (!text || DONT_KNOW.test(text)) return { index: -1, how: 'empty' };
  // jawaban berlangkah: cocokkan jawaban akhirnya dulu, supaya angka di langkah tengah tidak ikut dinilai
  const final = finalAnswerOf(raw);
  if (final) {
    const hit = matchOption(options, final);
    if (hit.index >= 0) return hit;
  }
  // huruf besar-kecil bisa jadi yang diuji (mis. penulisan nama ilmiah): cocok persis dulu
  const strict = raw.normalize('NFKC').trim().replace(/[.。]+$/, '').trim();
  const sameCase = options.findIndex((o) => o.normalize('NFKC').trim() === strict);
  if (sameCase >= 0) return { index: sameCase, how: 'exact' };
  const norm = options.map(normalizeOptionText);
  const tc = compact(text);
  const exacts = norm.map((o, i) => (compact(o) === tc ? i : -1)).filter((i) => i >= 0);
  if (exacts.length === 1) return { index: exacts[0]!, how: 'exact' };
  if (exacts.length > 1) return { index: -1, how: 'ambiguous' };
  const tn = numberOf(text);
  if (tn) {
    const nums = norm.map(numberOf);
    const same = nums.map((n, i) => (n && close(tn.value, n.value) && (!tn.unit || !n.unit || tn.unit === n.unit) ? i : -1)).filter((i) => i >= 0);
    if (same.length === 1) return { index: same[0]!, how: 'numeric' };
    if (same.length > 1) return { index: -1, how: 'ambiguous' };
    if (nums.some(Boolean)) return { index: -1, how: 'none' };
  }

  // pilihan tertulis utuh dan berurutan di dalam jawaban ("jawabannya tikus berkurang dan padi meningkat")
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const within = (o: string) => o.length >= 3 && new RegExp(`(^|[\\s(=:])${esc(o)}($|[\\s.,;)])`).test(text);
  const inside = norm.map((o, i) => (within(o) ? i : -1)).filter((i) => i >= 0);
  const longest = Math.max(0, ...inside.map((i) => norm[i]!.length));
  let top = inside.filter((i) => norm[i]!.length === longest);
  // jawaban berlangkah yang menulis beberapa pilihan (langkah tengah dan jawaban akhir): yang terakhir ditulis jawabannya
  if (top.length > 1 && final !== null) {
    const lastAt = (i: number) => text.lastIndexOf(norm[i]!);
    const latest = Math.max(...top.map(lastAt));
    top = top.filter((i) => lastAt(i) === latest);
  }
  if (top.length === 1 && !NEG.test(text.replace(norm[top[0]!]!, ''))) return { index: top[0]!, how: 'exact' };

  const tw = words(text), negText = NEG.test(text);
  const ow = norm.map(words);
  const disc = ow.map((w, i) => new Set([...w].filter((x) => !ow.some((o, j) => j !== i && o.has(x)))));
  const has = (set: Set<string>) => set.size > 0 && [...set].every((x) => tw.has(x));
  let covered = norm.map((o, i) => ((has(ow[i]!) || has(disc[i]!)) && (!negText || NEG.test(o)) ? i : -1)).filter((i) => i >= 0);
  // pilihan yang katanya bagian dari pilihan lain yang juga cocok: ambil yang paling lengkap
  covered = covered.filter((i) => !covered.some((j) => j !== i && ow[j]!.size > ow[i]!.size && [...ow[i]!].every((x) => ow[j]!.has(x))));
  if (covered.length === 1) return { index: covered[0]!, how: 'words' };
  if (covered.length > 1) return { index: -1, how: 'ambiguous' };

  if (!negText && tc.length >= 4) {
    const scores = norm.map((o) => similarity(tc, compact(o)));
    const best = Math.max(...scores), at = scores.indexOf(best);
    const second = Math.max(...scores.filter((_, i) => i !== at), 0);
    if (best >= 0.85 && best - second >= 0.1) return { index: at, how: 'typo' };
  }
  return { index: -1, how: 'none' };
}

/**
 * Contoh format tanpa membocorkan jawaban: bagian yang sama di semua pilihan dipertahankan, bagian yang berbeda
 * diganti "…" ("golongan …, periode …", "… mol"). null bila pilihannya tidak punya pola bersama.
 */
export function answerFormat(options: readonly string[]): string | null {
  if (options.length < 2) return null;
  const split = (s: string) => s.trim().split(/(\s+|,\s+)/);
  const parts = options.map(split);
  const n = parts[0]!.length;
  if (!parts.every((p) => p.length === n)) return null;
  const out = parts[0]!.map((tok, i) => (/^(\s+|,\s+)$/.test(tok) ? tok : parts.every((p) => p[i] === tok) ? tok : '…'));
  const pattern = out.join('').replace(/…(\s*…)+/g, '…');
  return pattern.replace(/[…\s,]/g, '') ? pattern : null;
}
