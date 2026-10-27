import type { QuestionBody, Rubric } from '../../catalog/manifest.js';
import { normalizeAnswerText, parseAnswerValue, unitKindOf, withinTolerance, type UnreadableReason } from './numeric-parse.js';
import { evaluateTower } from './tower-v1.js';
// Deterministic evaluators (Slice 1 M5; 06 §1–§2). Pure functions: (question, response) → verdict and
// candidate evidence per concept. No I/O, no clock, no exposure or eligibility: assessment adds those
// when it stores evidence (06 §5), because they depend on the learner's history, not on the answer.

/** StudentResponse VO (03 §7). */
export interface StudentResponse {
  schemaVersion: 1; responseType: 'TEXT' | 'OPTION' | 'NUMERIC' | 'SELF_REPORT';
  text?: string; optionId?: string; numeric?: number; selfReport?: 'KNOW' | 'DONT_KNOW'; inputMode: 'TYPED' | 'OCR_CONFIRMED' | 'DEVICE_IMPORT';
}
export interface EvaluationInput {
  body: QuestionBody; rubric: Rubric;
  /** Concepts mapped on the revision (question_concept). Only these may appear in the output (INV-09). */
  concepts: { code: string; assessable: boolean }[];
  response: StudentResponse;
}
export type EvidenceRef = { kind: 'SPAN'; start: number; end: number; quote: string } | { kind: 'OPTION'; optionId: string };
export interface CandidateEvidence {
  conceptCode: string;
  classification: 'UNDERSTANDING_DEMONSTRATED' | 'MISCONCEPTION_EVIDENCED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_ASSESSED';
  misconceptionCode?: string; rationale?: string; refs: EvidenceRef[];
  uncertaintyReasons: ('AMBIGUOUS_NOTATION' | 'INCOMPLETE_WORK' | 'ALTERNATIVE_PATH' | 'LOW_CONFIDENCE' | 'UNREADABLE_INPUT' | 'OUT_OF_SCOPE')[];
}
export interface Evaluation {
  clarification?: string;
  verdict: 'CORRECT' | 'INCORRECT' | 'UNREADABLE' | 'NOT_GRADED';
  /** Why the answer could not be graded; null otherwise. Codes match the frontend checker, plus tower-v1's
   *  'insufficient-working' (readable working that shows neither a result nor a catalogued error). */
  reason: UnreadableReason | 'insufficient-working' | null;
  /** The value read from a numeric answer. */
  value: number | null;
  /** The catalogued misconception the wrong answer matches, if any. */
  misconceptionCode: string | null;
  evidence: CandidateEvidence[];
  /** The key, for display after grading (records FINAL_ANSWER_SHOWN when shown, 06 §5.3). Never before. */
  revealedAnswer: { optionId: string } | { forms: string[] } | null;
}

const ungraded = (verdict: 'UNREADABLE' | 'NOT_GRADED', reason: Evaluation['reason']): Evaluation =>
  ({ verdict, reason, value: null, misconceptionCode: null, evidence: [], revealedAnswer: null });

/**
 * Evidence for a graded answer (06 §1). A correct final answer demonstrates every concept the rubric lists as
 * required by all valid paths. A wrong one evidences a misconception only when it matches a catalogued
 * pattern; otherwise the final-answer concepts are INSUFFICIENT_EVIDENCE, never an invented gap (blueprint D07).
 * Mapped concepts outside the final-answer list, and non-assessable ones, are NOT_ASSESSED.
 */
function evidenceFor(input: EvaluationInput, correct: boolean, refs: EvidenceRef[], miss: Rubric['misconceptionMap'][number] | null): CandidateEvidence[] {
  const finals = new Set(input.rubric.finalAnswerEvidence);
  return input.concepts.map(({ code, assessable }): CandidateEvidence => {
    if (!assessable || (!finals.has(code) && miss?.conceptCode !== code)) return { conceptCode: code, classification: 'NOT_ASSESSED', refs: [], uncertaintyReasons: [] };
    if (correct) return { conceptCode: code, classification: 'UNDERSTANDING_DEMONSTRATED', refs, uncertaintyReasons: [] };
    if (miss?.conceptCode === code) return { conceptCode: code, classification: 'MISCONCEPTION_EVIDENCED', misconceptionCode: miss.misconceptionCode, rationale: miss.explanation, refs, uncertaintyReasons: [] };
    return { conceptCode: code, classification: 'INSUFFICIENT_EVIDENCE', refs: [], uncertaintyReasons: ['INCOMPLETE_WORK'] };
  });
}

/** option-v1: multiple choice. The response names an option id; an unknown id is unreadable, never wrong. */
export function evaluateOption(input: EvaluationInput): Evaluation {
  const { rubric, body, response } = input;
  if (response.responseType === 'SELF_REPORT') return ungraded('NOT_GRADED', null);
  const key = rubric.answer.optionId;
  if (key === undefined || !body.options?.some(o => o.id === key)) return ungraded('UNREADABLE', 'missing-answer-key');
  if (response.responseType !== 'OPTION' || response.optionId === undefined) return ungraded('UNREADABLE', 'unsupported-response');
  if (!body.options.some(o => o.id === response.optionId)) return ungraded('UNREADABLE', 'unsupported-response');
  const correct = response.optionId === key;
  const miss = correct ? null : rubric.misconceptionMap.find(m => m.pattern.kind === 'OPTION' && m.pattern.optionId === response.optionId) ?? null;
  return { verdict: correct ? 'CORRECT' : 'INCORRECT', reason: null, value: null, misconceptionCode: miss?.misconceptionCode ?? null,
    evidence: evidenceFor(input, correct, [{ kind: 'OPTION', optionId: response.optionId }], miss), revealedAnswer: { optionId: key } };
}

/**
 * numeric-v1: a typed number, graded within the rubric's tolerance. The key is checked before any
 * distractor, so overlapping data can never turn a correct answer into a wrong one (frontend rule).
 */
export function evaluateNumeric(input: EvaluationInput): Evaluation {
  const { rubric, response } = input;
  if (response.responseType === 'SELF_REPORT') return ungraded('NOT_GRADED', null);
  const expected = rubric.answer.value;
  if (typeof expected !== 'number' || !Number.isFinite(expected)) return ungraded('UNREADABLE', 'missing-answer-key');
  // Graded from what the learner typed, never a pre-parsed number: evidence must quote a span of the
  // response (06 §2.4), and device and server must read the same text the same way.
  if (response.responseType !== 'TEXT' || typeof response.text !== 'string') return ungraded('UNREADABLE', 'unsupported-response');
  const parsed = parseAnswerValue(response.text, unitKindOf(rubric.answer.unit));
  if (parsed.kind === 'unreadable') return ungraded('UNREADABLE', parsed.reason);
  const value = parsed.value;
  const start = response.text.length - response.text.trimStart().length, end = response.text.trimEnd().length;
  const refs: EvidenceRef[] = [{ kind: 'SPAN', start, end, quote: response.text.slice(start, end) }];
  const { relative, floor } = rubric.answer.tolerance ?? { relative: 0.02, floor: 1 };
  const correct = withinTolerance(value, expected, relative, floor);
  const miss = correct ? null : rubric.misconceptionMap.find(m => m.pattern.kind === 'NUMERIC' && typeof m.pattern.value === 'number' && withinTolerance(value, m.pattern.value, relative, floor)) ?? null;
  return { verdict: correct ? 'CORRECT' : 'INCORRECT', reason: null, value, misconceptionCode: miss?.misconceptionCode ?? null,
    evidence: evidenceFor(input, correct, refs, miss), revealedAnswer: { forms: rubric.acceptedForms } };
}

export const EVALUATORS = { 'option-v1': evaluateOption, 'numeric-v1': evaluateNumeric, 'tower-v1': evaluateTower } as const;
export { evaluateTower };
export function evaluate(input: EvaluationInput): Evaluation {
  const evaluator = EVALUATORS[input.rubric.evaluator as keyof typeof EVALUATORS];
  if (!evaluator) throw new Error(`No deterministic evaluator ${input.rubric.evaluator}`);
  return evaluator(input);
}
export { normalizeAnswerText };
