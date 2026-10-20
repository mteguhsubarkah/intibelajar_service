// Typed-number reader for numeric-v1. A faithful port of the frontend's services/answer/answerChecker.ts
// (parseAnswerValue, withinTolerance): guests are graded on the device and learners on the server, so the
// two must agree on every input. catalog/golden/answers.v2.json (numeric section unchanged from v1) is run against both implementations.
//
// The governing rule is the frontend's: never penalise what cannot be read. Anything outside the small,
// closed grammar (digits, decimal comma or point, √/akar/sqrt, × · *, ÷ /, + -, parentheses, accepted
// units) is UNREADABLE with a specific reason, never INCORRECT.

export type UnreadableReason =
  | 'empty' | 'no-number' | 'unsupported-operator' | 'malformed-number' | 'undefined-fraction' | 'root-without-radicand'
  | 'negative-root' | 'not-finite' | 'unknown-unit' | 'too-long' | 'missing-answer-key' | 'unsupported-response';

/** Accepted units are those of the rubric's answer: length (m), angle (°), or none. */
export type UnitKind = 'length' | 'angle' | 'none';
export const unitKindOf = (unit: string | undefined): UnitKind =>
  unit === undefined ? 'none' : ['m', 'meter', 'metre'].includes(unit) ? 'length' : ['°', 'deg', 'derajat'].includes(unit) ? 'angle' : 'none';

export type ParseOutcome = { kind: 'value'; value: number } | { kind: 'unreadable'; reason: UnreadableReason };

/** Relative 2% with a scale floor of 1: rounding to two significant figures passes, one does not. */
export const RELATIVE_TOLERANCE = 0.02;
const MIN_SCALE = 1;
const MAX_INPUT_LENGTH = 64;

export function withinTolerance(value: number, expected: number, relative = RELATIVE_TOLERANCE, floor = MIN_SCALE) {
  return Math.abs(value - expected) <= relative * Math.max(Math.abs(expected), floor);
}

/** NFKC folds full-width digits and NBSP; zero-width characters and BOM are removed separately. */
export function normalizeAnswerText(raw: string) {
  return raw.normalize('NFKC').replace(/[​-‍﻿]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const LENGTH_UNITS = new Set(['m', 'meter', 'metre', 'mtr']);
const ANGLE_UNITS = new Set(['derajat', 'deg']);
// Units that are recognised, including ones that are rejected; longer alternatives first, \b on both sides.
const UNIT_PATTERN = /\b(?:meter|metre|derajat|persen|sekon|detik|menit|radian|gram|liter|mtr|deg|rad|cm|mm|km|dm|kg|ml|jam|m|g|s|l)\b/g;
const accepted = (kind: UnitKind) => kind === 'length' ? LENGTH_UNITS : kind === 'angle' ? ANGLE_UNITS : new Set<string>();

export function parseAnswerValue(raw: string, kind: UnitKind): ParseOutcome {
  if (raw.length > MAX_INPUT_LENGTH) return { kind: 'unreadable', reason: 'too-long' };
  const trimmed = normalizeAnswerText(raw).replace(/^\s*[a-z]\s*=\s*/, '').replace(/\.$/, '');
  if (trimmed.length === 0) return { kind: 'unreadable', reason: 'empty' };
  const units = stripUnits(trimmed, kind);
  if (!units.ok) return { kind: 'unreadable', reason: units.reason };
  // Spaces are kept: "20 3" must not become 203.
  const source = units.text.replace(/akar|sqrt/g, '√').replace(/[×·⋅]/g, '*').replace(/÷/g, '/');
  const tokens = tokenize(source);
  if (!tokens.ok) {
    if (tokens.reason === 'unsupported-operator' && !/\d/.test(source)) return { kind: 'unreadable', reason: 'no-number' };
    return { kind: 'unreadable', reason: tokens.reason };
  }
  const evaluated = evaluate(tokens.tokens);
  if (!evaluated.ok) return { kind: 'unreadable', reason: evaluated.reason };
  return Number.isFinite(evaluated.value) ? { kind: 'value', value: evaluated.value } : { kind: 'unreadable', reason: 'not-finite' };
}

function stripUnits(text: string, kind: UnitKind): { ok: true; text: string } | { ok: false; reason: UnreadableReason } {
  const found = text.match(UNIT_PATTERN) ?? [];
  if (found.some(unit => !accepted(kind).has(unit))) return { ok: false, reason: 'unknown-unit' };
  const degree = text.includes('°');
  if (degree && kind !== 'angle') return { ok: false, reason: 'unknown-unit' };
  const words = found.length > 0 ? text.replace(UNIT_PATTERN, ' ') : text;
  return { ok: true, text: degree ? words.replace(/°/g, ' ') : words };
}

type Token = { kind: 'number'; value: number } | { kind: 'op'; op: '+' | '-' | '*' | '/' } | { kind: 'root' } | { kind: 'lparen' } | { kind: 'rparen' };
const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';

function tokenize(source: string): { ok: true; tokens: Token[] } | { ok: false; reason: UnreadableReason } {
  const tokens: Token[] = [];
  for (let i = 0; i < source.length;) {
    const c = source[i]!;
    if (c === ' ') { i++; continue; }
    if (c === '√') { tokens.push({ kind: 'root' }); i++; continue; }
    if (c === '(') { tokens.push({ kind: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ kind: 'rparen' }); i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/') { tokens.push({ kind: 'op', op: c }); i++; continue; }
    if (isDigit(c) || c === '.' || c === ',') {
      let end = i;
      while (end < source.length && (isDigit(source[end]) || source[end] === '.' || source[end] === ',')) end++;
      const value = parseNumberToken(source.slice(i, end));
      if (value === null) return { ok: false, reason: 'malformed-number' };
      tokens.push({ kind: 'number', value }); i = end; continue;
    }
    return { ok: false, reason: 'unsupported-operator' };
  }
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.kind !== 'root') continue;
    const next = tokens[i + 1];
    // "√-4" passes here so that its reason is negative-root.
    if (next === undefined || next.kind === 'rparen' || (next.kind === 'op' && next.op !== '-')) return { ok: false, reason: 'root-without-radicand' };
  }
  return { ok: true, tokens };
}

// One separator is a decimal; more than one are thousands; with both kinds, the last one is the decimal.
// "34.641" is therefore 34.641, never 34641: the exact correct answer must not read as wrong.
function parseNumberToken(token: string): number | null {
  if (!/\d/.test(token)) return null;
  const commas = [...token].filter(c => c === ',').length, dots = [...token].filter(c => c === '.').length;
  const decimal = commas > 0 && dots > 0 ? Math.max(token.lastIndexOf(','), token.lastIndexOf('.'))
    : commas + dots === 1 ? (commas === 1 ? token.indexOf(',') : token.indexOf('.')) : -1;
  const integerRaw = decimal === -1 ? token : token.slice(0, decimal), fraction = decimal === -1 ? '' : token.slice(decimal + 1);
  if (decimal !== -1 && fraction.length === 0) return null;
  if (!/^\d*$/.test(fraction)) return null;
  const integer = integerRaw.length === 0 ? '' : /^\d+$/.test(integerRaw) ? integerRaw : /^\d{1,3}([.,]\d{3})+$/.test(integerRaw) ? integerRaw.replace(/[.,]/g, '') : null;
  if (integer === null) return null;
  const value = Number(fraction.length > 0 ? `${integer || '0'}.${fraction}` : integer || '0');
  return Number.isFinite(value) ? value : null;
}

// Recursive descent: expression, term (with implied multiplication only before √ or a parenthesis), unary, primary.
function evaluate(tokens: Token[]): { ok: true; value: number } | { ok: false; reason: UnreadableReason } {
  let position = 0, failure: UnreadableReason = 'malformed-number';
  const peek = () => tokens[position];
  const fail = (reason: UnreadableReason) => { failure = reason; return null; };
  const expression = (): number | null => {
    let left = term();
    for (let t = peek(); left !== null && t?.kind === 'op' && (t.op === '+' || t.op === '-'); t = peek()) {
      position++;
      const right = term();
      if (right === null) return null;
      left = t.op === '+' ? left + right : left - right;
    }
    return left;
  };
  const term = (): number | null => {
    let left = unary();
    while (left !== null) {
      const t = peek();
      if (t?.kind === 'op' && (t.op === '*' || t.op === '/')) {
        position++;
        const right = unary();
        if (right === null) return null;
        if (t.op === '/') { if (right === 0) return fail('undefined-fraction'); left /= right; } else left *= right;
        continue;
      }
      if (t?.kind === 'root' || t?.kind === 'lparen') { const right = unary(); if (right === null) return null; left *= right; continue; }
      return left;
    }
    return null;
  };
  const unary = (): number | null => {
    const t = peek();
    if (t?.kind === 'op' && (t.op === '+' || t.op === '-')) { position++; const v = unary(); return v === null ? null : t.op === '-' ? -v : v; }
    return primary();
  };
  const primary = (): number | null => {
    const t = peek();
    if (t === undefined) return null;
    if (t.kind === 'number') { position++; return t.value; }
    if (t.kind === 'root') { position++; const r = unary(); if (r === null) return null; return r < 0 ? fail('negative-root') : Math.sqrt(r); }
    if (t.kind === 'lparen') {
      position++;
      const inner = expression();
      if (inner === null || peek()?.kind !== 'rparen') return null;
      position++;
      return inner;
    }
    return null;
  };
  const value = expression();
  if (value === null) return { ok: false, reason: failure };
  if (position !== tokens.length) return { ok: false, reason: 'malformed-number' };
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: 'not-finite' };
}
