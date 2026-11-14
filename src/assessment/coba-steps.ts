import type { CobaStep } from '../catalog/manifest.js';
import { parseAnswerValue, powers, withinTolerance, type ParseOptions } from './evaluators/numeric-parse.js';

/*
 * Kotak "Coba sekarang" di petunjuk /coba: satu jawaban pendek untuk satu inti.
 * Aturan dulu (deterministik, tanpa AI):
 * - angka hasil akhir siswa (bagian terakhir sesudah "=") sama dengan kunci → benar; sama dengan jawaban setengah jalan → hampir;
 *   angka lain → belum (tanggapannya boleh ditulis AI, keputusannya tetap aturan);
 * - kata yang persis sama dengan daftar benar/salah → benar/belum.
 * Selain itu (kalimat, kata lain, angka yang ditulis huruf) keputusannya diserahkan ke AI dengan key: "undecided".
 */
export type StepRule =
  | { kind: 'correct' }
  | { kind: 'partial'; feedback: string }
  | { kind: 'incorrect'; feedback?: string; by: 'number' | 'word' }
  | { kind: 'undecided' };

const SUPERSCRIPTS = /[⁰¹²³⁴⁵⁶⁷⁸⁹]/g;
const CHUNK = /[0-9.,√()+\-*/ ]*\d[0-9.,√()+\-*/ ]*/g;

/** Angka hasil akhir dari jawaban pendek, mis. "3 km : 30 km/jam = 0,1 jam" → 0,1; "10.000 → 1.000 → 100 → 10 kJ" → 10. */
export function stepValue(reply: string, options: ParseOptions = {}): number | null {
  let t = powers(reply.normalize('NFC'))
    .replace(/(\d+)\s*\^\s*(\d{1,2})\b/g, (_, b: string, e: string) => String(Number(b) ** Number(e)))
    .replace(/[−–]/g, '-').replace(/½/g, '(1/2)').replace(/[×·⋅]/g, '*').replace(/[÷:]/g, '/')
    .replace(/[₀-₉]/g, '').replace(/([A-Za-z])\d+/g, '$1').replace(SUPERSCRIPTS, '').replace(/akar|sqrt/gi, '√');
  const last = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean).at(-1) ?? '';
  t = last.split(/[=≈]/).at(-1) ?? '';
  const chunk = (t.match(CHUNK) ?? []).at(-1);
  if (!chunk) return null;
  let c = chunk.trim().replace(/^[+*/\s]+/, '').replace(/[+\-*/\s]+$/, '');
  // kurung yang tidak berpasangan (potongan dari kalimat) dibuang
  while ((c.match(/\(/g)?.length ?? 0) > (c.match(/\)/g)?.length ?? 0) && c.includes('(')) c = c.replace('(', '');
  while ((c.match(/\)/g)?.length ?? 0) > (c.match(/\(/g)?.length ?? 0) && c.includes(')')) c = c.replace(/\)(?!.*\))/, '');
  const v = parseAnswerValue(c, 'none', options);
  return v.kind === 'value' ? v.value : null;
}

/** "Tan." → "tan", "  Tidak  diketahui " → "tidak diketahui" */
const word = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}°θ ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const near = (v: number, target: number, tolerance?: { relative: number; floor: number }) =>
  withinTolerance(v, target, tolerance?.relative ?? 0.02, tolerance?.floor ?? 1);

export function judgeCobaStep(step: CobaStep, reply: string, options: ParseOptions = {}): StepRule {
  const text = reply.trim();
  const squash = (s: string) => s.normalize('NFKC').toLowerCase().replace(/akar|sqrt/g, '√').replace(/\s+/g, '');
  if (step.accept?.some(a => squash(text).includes(squash(a)))) return { kind: 'correct' };
  const w = word(text);
  if (step.words) {
    if (step.words.correct.some(x => word(x) === w)) return { kind: 'correct' };
    const wrong = step.words.wrong?.find(x => x.words.some(y => word(y) === w));
    if (wrong) return { kind: 'incorrect', feedback: wrong.explanation, by: 'word' };
  }
  if (step.answer) {
    const value = stepValue(text, options);
    if (value !== null) {
      if (near(value, step.answer.value, step.answer.tolerance)) return { kind: 'correct' };
      const partial = step.partials?.find(p => near(value, p.value, p.tolerance ?? step.answer!.tolerance));
      if (partial) return { kind: 'partial', feedback: partial.explanation };
      return { kind: 'incorrect', by: 'number' };
    }
  }
  return { kind: 'undecided' };
}
