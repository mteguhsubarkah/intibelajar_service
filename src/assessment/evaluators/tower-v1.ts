import type { Rubric } from '../../catalog/manifest.js';
import { findAny, tokenize, type Match, type Token } from '../../catalog/text-pattern.js';
import { parseAnswerValue, unitKindOf, withinTolerance } from './numeric-parse.js';
import type { CandidateEvidence, Evaluation, EvaluationInput, EvidenceRef } from './index.js';
// tower-v1 (Slice 2 M2; plan 05 D1, approved 2026-10-19): written working for an authored question, graded by the
// rubric's step patterns and catalogued misconception patterns. Pure and deterministic.
//
// It keeps the structure of the frontend's services/analysis.ts (ratio choice, special value, the result) and
// replaces its evidence rules with D1:
// - a concept is UNDERSTANDING_DEMONSTRATED only from a matched step span on the chosen path, or from a correct
//   final value through finalAnswerEvidence (06 §10 row 2);
// - MISCONCEPTION_EVIDENCED only from a catalogued pattern (never "else blame tri-c", blueprint D07);
// - a correct final value is never a mistake: misconception patterns are not applied to it (K01);
// - everything else is INSUFFICIENT_EVIDENCE, or NOT_ASSESSED for steps after the first error (never reached).
// Each behaviour change against analysis.ts is a golden case labelled "delta from analysis.ts" (answers.v2.json).

/** The response is too long to be working for one question (the attempt API caps text separately). */
export const MAX_WORKING_LENGTH = 1000;
const ungraded = (verdict: 'UNREADABLE' | 'NOT_GRADED', reason: Evaluation['reason']): Evaluation =>
  ({ verdict, reason, value: null, misconceptionCode: null, evidence: [], revealedAnswer: null });
const span = (m: { start: number; end: number; quote: string }): EvidenceRef => ({ kind: 'SPAN', start: m.start, end: m.end, quote: m.quote });

/**
 * The learner's final value: the whole response when it is just a value ("34,6", "x = 20√3"), or the value of an
 * "x = …" clause (the unknown the question names). Each side of a chained "x = 20√3 ≈ 34,6" counts; a clause
 * whose sides do not parse (x = 20 / tan 30) states no value. Clauses split at line breaks, ";" and ", ".
 */
function finalValue(text: string, rubric: Rubric): { correct: boolean; ref: EvidenceRef; bare: boolean } | null {
  const kind = unitKindOf(rubric.answer.unit), expected = rubric.answer.value!;
  const { relative, floor } = rubric.answer.tolerance ?? { relative: 0.02, floor: 1 };
  const trimmedStart = text.length - text.trimStart().length, trimmedEnd = text.trimEnd().length;
  const whole = parseAnswerValue(text, kind);
  if (whole.kind === 'value')
    return { correct: withinTolerance(whole.value, expected, relative, floor), bare: true, ref: span({ start: trimmedStart, end: trimmedEnd, quote: text.slice(trimmedStart, trimmedEnd) }) };
  let found: { correct: boolean; ref: EvidenceRef; bare: boolean } | null = null;
  let cursor = 0;
  for (const body of text.split(/(,\s+|\n|;)/)) {
    const at = cursor; cursor += body.length;
    const head = /^\s*(?:jadi|maka)?\s*x\s*[=≈]/i.exec(body);
    if (!head) continue;
    // Each side after the first "=": "20√3 ≈ 34,6 m" gives "20√3" and "34,6 m".
    let offset = head[0].length;
    for (const side of body.slice(offset).split(/[=≈]/)) {
      const parsed = parseAnswerValue(side, kind);
      const s = at + offset + (side.length - side.trimStart().length), e = at + offset + side.trimEnd().length;
      offset += side.length + 1;
      if (parsed.kind !== 'value' || e <= s) continue;
      const correct = withinTolerance(parsed.value, expected, relative, floor);
      // A correct side wins over a wrong one in the same chain (rounding in "≈ 34" must not undo "20√3").
      if (!found || (correct && !found.correct)) found = { correct, bare: false, ref: span({ start: s, end: e, quote: text.slice(s, e) }) };
    }
  }
  return found;
}

interface PathMatch { code: string; steps: { concepts: string[]; match: Match | null }[]; matched: number }

export function evaluateTower(input: EvaluationInput): Evaluation {
  const { rubric, response } = input;
  if (response.responseType === 'SELF_REPORT') return ungraded('NOT_GRADED', null);
  if (typeof rubric.answer.value !== 'number' || !Number.isFinite(rubric.answer.value)) return ungraded('UNREADABLE', 'missing-answer-key');
  if (response.responseType !== 'TEXT' || typeof response.text !== 'string') return ungraded('UNREADABLE', 'unsupported-response');
  const text = response.text;
  if (text.trim().length === 0) return ungraded('UNREADABLE', 'empty');
  if (text.length > MAX_WORKING_LENGTH) return ungraded('UNREADABLE', 'too-long');
  const tokens: Token[] = tokenize(text);

  // Paths: the one with the most matched steps; authored order breaks ties.
  const paths: PathMatch[] = rubric.solutionPaths.map(p => {
    const steps = p.steps.map(s => ({ concepts: s.concepts.filter(c => c.role === 'REQUIRED').map(c => c.code), match: findAny(text, tokens, s.patterns ?? []) }));
    return { code: p.code, steps, matched: steps.filter(s => s.match).length };
  });
  const path = paths.reduce<PathMatch | null>((best, p) => !best || p.matched > best.matched ? p : best, null);
  const complete = !!path && path.steps.length > 0 && path.matched === path.steps.length;
  const final = finalValue(text, rubric);
  const finalCorrect = final?.correct === true;

  // Catalogued misconceptions, first matching pattern per concept, in authored order. Not applied to a correct result (K01).
  const misses = new Map<string, { code: string; explanation: string; match: Match }>();
  if (!finalCorrect) for (const x of rubric.misconceptionMap) {
    if (x.pattern.kind !== 'TEXT' || misses.has(x.conceptCode)) continue;
    const m = findAny(text, tokens, x.pattern.tokens ?? []);
    if (m) misses.set(x.conceptCode, { code: x.misconceptionCode, explanation: x.explanation, match: m });
  }

  const verdict: Evaluation['verdict'] = finalCorrect || (complete && misses.size === 0) ? 'CORRECT'
    : misses.size > 0 || final ? 'INCORRECT'
    : 'UNREADABLE';
  // A step after the first step that shows an error was never reached.
  const stepOf = (concept: string) => path ? path.steps.findIndex(s => s.concepts.includes(concept)) : -1;
  const firstError = Math.min(...[...misses.keys()].map(stepOf).filter(i => i >= 0), Infinity);
  const finals = new Set(rubric.finalAnswerEvidence);
  const bareWrong = !!final && !final.correct && final.bare;

  const evidence = input.concepts.map(({ code, assessable }): CandidateEvidence => {
    const none = (classification: 'NOT_ASSESSED') => ({ conceptCode: code, classification, refs: [], uncertaintyReasons: [] });
    const insufficient = (): CandidateEvidence => ({ conceptCode: code, classification: 'INSUFFICIENT_EVIDENCE', refs: [], uncertaintyReasons: ['INCOMPLETE_WORK'] });
    const step = stepOf(code);
    if (!assessable || (step < 0 && !finals.has(code))) return none('NOT_ASSESSED');
    // T01-3: a wrong value with no working shows no concept, so none is credited or blamed.
    if (bareWrong) return insufficient();
    const miss = misses.get(code);
    if (miss) return { conceptCode: code, classification: 'MISCONCEPTION_EVIDENCED', misconceptionCode: miss.code, rationale: miss.explanation, refs: [span(miss.match)], uncertaintyReasons: [] };
    const shown = step >= 0 ? path!.steps[step]!.match : null;
    if (shown && step < firstError) return { conceptCode: code, classification: 'UNDERSTANDING_DEMONSTRATED', refs: [span(shown)], uncertaintyReasons: [] };
    if (finalCorrect && finals.has(code)) return { conceptCode: code, classification: 'UNDERSTANDING_DEMONSTRATED', refs: [final!.ref], uncertaintyReasons: [] };
    if (finalCorrect || step > firstError) return none('NOT_ASSESSED');
    return insufficient();
  });

  const miss = [...misses.values()][0] ?? null;
  return {
    verdict, reason: verdict === 'UNREADABLE' ? 'insufficient-working' : null, value: null,
    misconceptionCode: verdict === 'INCORRECT' ? miss?.code ?? null : null, evidence,
    revealedAnswer: verdict === 'UNREADABLE' ? null : { forms: rubric.acceptedForms },
  };
}
