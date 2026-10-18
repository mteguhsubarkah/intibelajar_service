import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, evaluateNumeric, evaluateOption, type EvaluationInput, type StudentResponse } from '../src/assessment/evaluators/index.js';
import type { Question } from '../src/catalog/manifest.js';
import { optionGolden, readGolden } from '../scripts/catalog/golden.js';
import { draftManifest } from './fixtures/catalog.js';
// Slice 1 M5: option-v1 and numeric-v1. The golden file is shared with the Vue checkout
// (npm run test:answer-golden there), so device and server grading are held to the same cases.

const manifest = draftManifest(), golden = readGolden();
const question = (code: string) => { const q = manifest.questions.find(x => x.code === code); assert.ok(q, code); return q!; };
const input = (q: Question, response: StudentResponse, concepts = q.concepts.map(c => ({ code: c.concept, assessable: c.assessable }))): EvaluationInput =>
  ({ body: q.body, rubric: q.rubric, concepts, response });
const text = (t: string): StudentResponse => ({ schemaVersion: 1, responseType: 'TEXT', text: t, inputMode: 'TYPED' });
const option = (optionId: string): StudentResponse => ({ schemaVersion: 1, responseType: 'OPTION', optionId, inputMode: 'TYPED' });

test('golden numeric cases: verdict, unreadable reason and misconception match the shared file', () => {
  let n = 0;
  for (const entry of golden.numeric) {
    const q = question(entry.question);
    assert.ok(q.aliases.some(a => a.ns === 'ITEM' && a.value === entry.item), `${entry.question} is the frontend's ${entry.item}`);
    for (const c of entry.cases) {
      const r = evaluateNumeric(input(q, text(c.typed)));
      const label = `${entry.item} ${JSON.stringify(c.typed)}`;
      assert.equal(r.verdict, c.verdict, label);
      assert.equal(r.reason, c.verdict === 'UNREADABLE' ? c.reason : null, label);
      assert.equal(r.misconceptionCode, c.verdict === 'INCORRECT' ? c.misconception ?? null : null, label);
      n++;
    }
  }
  assert.equal(n, 81);
});

test('golden option section is in sync with the manifest and every index grades as the key says', () => {
  assert.deepEqual(golden.options, optionGolden(manifest), 'run npm run catalog:golden -- --write and review the diff');
  for (const g of golden.options) {
    const q = question(g.question), order = q.legacyOptionOrder!;
    assert.equal(order.length, g.optionCount);
    for (let i = 0; i < g.optionCount; i++)
      assert.equal(evaluateOption(input(q, option(order[i]!))).verdict, i === g.correctIndex ? 'CORRECT' : 'INCORRECT', `${g.items[0]} #${i}`);
  }
});

test('every deterministic item accepts its own key and its first accepted form', () => {
  const deterministic = manifest.questions.filter(q => ['option-v1', 'numeric-v1'].includes(q.rubric.evaluator));
  assert.equal(deterministic.length, manifest.questions.length - 1, 'all but the tower question (tower-v1, Slice 2)');
  for (const q of deterministic) {
    const r = evaluate(input(q, q.rubric.evaluator === 'option-v1' ? option(q.rubric.answer.optionId!) : text(q.rubric.acceptedForms[0]!)));
    assert.equal(r.verdict, 'CORRECT', q.code);
  }
  assert.throws(() => evaluate(input(question('MAT.TRI.Q.SOAL_MENARA'), text('20√3'))), /No deterministic evaluator tower-v1/);
});

test('evidence: correct answers demonstrate the final-answer concepts and quote what was written', () => {
  const q = question('MAT.TRI.Q.TRIG_DEPRESSION_01'), typed = '  x = 34,64 m ';
  const r = evaluateNumeric(input(q, text(typed)));
  assert.equal(r.verdict, 'CORRECT');
  const final = r.evidence.filter(e => e.classification === 'UNDERSTANDING_DEMONSTRATED');
  assert.deepEqual(final.map(e => e.conceptCode), q.rubric.finalAnswerEvidence);
  const span = final[0]!.refs[0]!;
  assert.ok(span.kind === 'SPAN' && typed.slice(span.start, span.end) === span.quote && span.quote === 'x = 34,64 m', '06 §2.4: the quote is the exact substring');
  assert.ok(r.evidence.filter(e => !q.rubric.finalAnswerEvidence.includes(e.conceptCode)).every(e => e.classification === 'NOT_ASSESSED'));
  assert.deepEqual(r.revealedAnswer, { forms: q.rubric.acceptedForms });
  // Every graded golden case cites a valid span.
  for (const entry of golden.numeric) for (const c of entry.cases.filter(x => x.verdict !== 'UNREADABLE'))
    for (const e of evaluateNumeric(input(question(entry.question), text(c.typed))).evidence)
      for (const ref of e.refs) assert.ok(ref.kind === 'SPAN' && c.typed.slice(ref.start, ref.end) === ref.quote && ref.quote.length > 0, JSON.stringify(c.typed));
});

test('evidence: a catalogued wrong answer evidences its misconception; an unexplained one never invents a gap', () => {
  const q = question('MAT.TRI.Q.TRIG_DEPRESSION_01');
  const cos = evaluateNumeric(input(q, text('17,32')));
  const miss = cos.evidence.find(e => e.classification === 'MISCONCEPTION_EVIDENCED')!;
  assert.deepEqual([miss.conceptCode, miss.misconceptionCode, miss.rationale], ['MAT.TRI.DEFINISI_SIN_COS_TAN', 'MEMAKAI_COS', 'Kamu memakai cos.']);
  assert.ok(miss.refs.length === 1, 'a misconception needs a reference and a rationale (06 §2.4)');
  assert.deepEqual(cos.evidence.find(e => e.conceptCode === 'MAT.TRI.MENCARI_SISI_YANG_BELUM_DIKETAHUI')!.classification, 'INSUFFICIENT_EVIDENCE');
  const unexplained = evaluateNumeric(input(q, text('24')));
  assert.equal(unexplained.verdict, 'INCORRECT');
  assert.ok(!unexplained.evidence.some(e => e.classification === 'MISCONCEPTION_EVIDENCED' || e.classification === 'UNDERSTANDING_DEMONSTRATED'));
  assert.deepEqual(unexplained.evidence.filter(e => e.classification === 'INSUFFICIENT_EVIDENCE').map(e => e.uncertaintyReasons), [['INCOMPLETE_WORK']]);
  // option-v1 with an OPTION pattern (no extracted item has one yet).
  const mcq = structuredClone(question('MAT.TRI.Q.FUNNEL_P2'));
  mcq.rubric.misconceptionMap = [{ pattern: { kind: 'OPTION', optionId: 'a' }, conceptCode: 'MAT.TRI.DEFINISI_SIN_COS_TAN', misconceptionCode: 'MEMAKAI_SIN', explanation: 'sin memakai sisi depan.' }];
  const sin = evaluateOption(input(mcq, option('a')));
  assert.deepEqual([sin.verdict, sin.misconceptionCode, sin.evidence[0]!.refs], ['INCORRECT', 'MEMAKAI_SIN', [{ kind: 'OPTION', optionId: 'a' }]]);
  assert.deepEqual(evaluateOption(input(mcq, option('c'))).misconceptionCode, null);
});

test('INV-16 and refusals: unreadable, self-reports and malformed inputs produce no evidence and no verdict claim', () => {
  const numeric = question('MAT.TRI.Q.TRIG_DEPRESSION_01'), mcq = question('MAT.TRI.Q.TAN60_SIN30');
  const cases: [ReturnType<typeof evaluate>, string, string | null][] = [
    [evaluateNumeric(input(numeric, text('gatau'))), 'UNREADABLE', 'no-number'],
    [evaluateNumeric(input(numeric, { schemaVersion: 1, responseType: 'NUMERIC', numeric: 34.64, inputMode: 'TYPED' })), 'UNREADABLE', 'unsupported-response'],
    [evaluateNumeric(input(numeric, option('a'))), 'UNREADABLE', 'unsupported-response'],
    [evaluateNumeric(input(numeric, { schemaVersion: 1, responseType: 'SELF_REPORT', selfReport: 'KNOW', inputMode: 'TYPED' })), 'NOT_GRADED', null],
    [evaluateOption(input(mcq, option('z'))), 'UNREADABLE', 'unsupported-response'],
    [evaluateOption(input(mcq, text('a'))), 'UNREADABLE', 'unsupported-response'],
    [evaluateOption(input(mcq, { schemaVersion: 1, responseType: 'SELF_REPORT', selfReport: 'DONT_KNOW', inputMode: 'TYPED' })), 'NOT_GRADED', null],
  ];
  for (const [r, verdict, reason] of cases) {
    assert.deepEqual([r.verdict, r.reason], [verdict, reason]);
    assert.deepEqual([r.evidence, r.revealedAnswer, r.misconceptionCode], [[], null, null], 'nothing is revealed or recorded for an ungraded answer');
  }
  const broken = structuredClone(numeric); delete broken.rubric.answer.value;
  assert.deepEqual([evaluateNumeric(input(broken, text('20√3'))).verdict, evaluateNumeric(input(broken, text('20√3'))).reason], ['UNREADABLE', 'missing-answer-key']);
  const keyless = structuredClone(mcq); keyless.rubric.answer.optionId = 'zz';
  assert.equal(evaluateOption(input(keyless, option('a'))).reason, 'missing-answer-key');
});

test('non-assessable concepts are never claimed, and evaluation is deterministic', () => {
  const q = question('MAT.TRI.Q.TRIG_DEPRESSION_01');
  const r = evaluateNumeric(input(q, text('20√3'), q.concepts.map(c => ({ code: c.concept, assessable: false }))));
  assert.equal(r.verdict, 'CORRECT');
  assert.ok(r.evidence.every(e => e.classification === 'NOT_ASSESSED'));
  assert.deepEqual(evaluateNumeric(input(q, text('17,32'))), evaluateNumeric(input(q, text('17,32'))));
});
