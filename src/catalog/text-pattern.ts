// Token runs for authored text patterns (tower-v1 steps and misconceptions, Slice 2 M1/M2). A rubric pattern
// such as "tan 30 = 20 / x" is tokenized like the learner's text, and matches where the same tokens appear
// consecutively. Matching is by whole tokens, never substrings: "tan" does not match "tanpa", "sin" does not
// match "sinus" (the frontend's hasTerm rule, kept). Every token keeps its offsets in the original text, so a
// match is quoted as the exact substring the learner wrote (06 §2.4).
//
// Normalisation, applied to both sides: lower case; numbers compare with "," and "." as the same decimal
// mark; "akar"/"sqrt" are "√"; "≈" is "="; "×", "·", "⋅", "*" are "*"; "÷" and ":" are "/". Parentheses,
// brackets and "°" are skipped, so "tan(30°)" reads as "tan 30". Any other punctuation is a separator token
// that no pattern contains, so a run never spans it.

export interface Token { text: string; start: number; end: number }
export interface Match { start: number; end: number; quote: string; tokenIndex: number; tokenCount: number }

const SKIPPED = new Set(['(', ')', '[', ']', '°', 'º']);
const SYMBOLS: Record<string, string> = { '=': '=', '≈': '=', '/': '/', '÷': '/', ':': '/', '*': '*', '×': '*', '·': '*', '⋅': '*', '+': '+', '-': '-', '−': '-', '^': '^', '√': '√', '½': '½' };
const WORDS: Record<string, string> = { akar: '√', sqrt: '√' };
export const MAX_PATTERN_TOKENS = 12;

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  while (i < lower.length) {
    const c = lower[i]!;
    if (/\s/.test(c) || SKIPPED.has(c)) { i++; continue; }
    if (/[a-z]/.test(c)) {
      let j = i; while (j < lower.length && /[a-z]/.test(lower[j]!)) j++;
      const word = lower.slice(i, j);
      out.push({ text: WORDS[word] ?? word, start: i, end: j }); i = j; continue;
    }
    if (/\d/.test(c)) {
      const m = /^\d+(?:[.,]\d+)*/.exec(lower.slice(i))!;
      out.push({ text: m[0].replaceAll(',', '.'), start: i, end: i + m[0].length }); i += m[0].length; continue;
    }
    out.push({ text: SYMBOLS[c] ?? '|', start: i, end: i + 1 }); i++;
  }
  return out;
}

/** The pattern's tokens, or null when it is empty, too long, or contains a separator (it could never match). */
export function patternTokens(pattern: string): string[] | null {
  const tokens = tokenize(pattern).map(t => t.text);
  return tokens.length === 0 || tokens.length > MAX_PATTERN_TOKENS || tokens.includes('|') ? null : tokens;
}

/** The first place the pattern's tokens appear consecutively in the text's tokens. */
export function findRun(text: string, tokens: Token[], pattern: string): Match | null {
  const want = patternTokens(pattern);
  if (!want) return null;
  for (let i = 0; i + want.length <= tokens.length; i++) {
    if (want.every((w, k) => tokens[i + k]!.text === w)) {
      const start = tokens[i]!.start;
      let end = tokens[i + want.length - 1]!.end;
      // Close the quote over skipped characters that belong to it: "tan(30°)" rather than "tan(30".
      while (end < text.length && /[°º]/.test(text[end]!)) end++;
      const open = (s: string) => (s.match(/\(/g) ?? []).length - (s.match(/\)/g) ?? []).length;
      while (end < text.length && text[end] === ')' && open(text.slice(start, end)) > 0) end++;
      return { start, end, quote: text.slice(start, end), tokenIndex: i, tokenCount: want.length };
    }
  }
  return null;
}

/** The first of several alternative patterns that matches (authored order is priority order). */
export const findAny = (text: string, tokens: Token[], patterns: readonly string[]) => {
  for (const p of patterns) { const m = findRun(text, tokens, p); if (m) return m; }
  return null;
};
