import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { evaluate, evaluateNumeric, evaluateOption, evaluateTower, type EvaluationInput, type StudentResponse } from '../src/assessment/evaluators/index.js';
import { findRun, tokenize } from '../src/catalog/text-pattern.js';
import type { Question } from '../src/catalog/manifest.js';
import { optionGolden, readGolden, type TowerCase } from '../scripts/catalog/golden.js';
import { draftManifest } from './fixtures/catalog.js';
// Slice 1 M5: option-v1 and numeric-v1; Slice 2 M2: tower-v1. The golden file (answers.v2.json) is shared with the
// Vue checkout (npm run test:answer-golden there), so device and server grading are held to the same cases.

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
  assert.equal(evaluate(input(question('MAT.TRI.Q.SOAL_MENARA'), text('20√3'))).verdict, 'CORRECT', 'tower-v1 is dispatched from Slice 2');
  assert.throws(() => evaluate(input({ ...question('MAT.TRI.Q.SOAL_MENARA'), rubric: { ...question('MAT.TRI.Q.SOAL_MENARA').rubric, evaluator: 'ai-assisted-v1' } }, text('x'))), /No deterministic evaluator ai-assisted-v1/);
});

test('typed multiple-choice answers: a long worked answer is quoted within the 200-character SpanRef limit', () => {
  const q = question('MAT.BAR.Q.BARISAN_ARITMETIKA_2');
  const long = 'Diketahui barisan: 5, 9, 13, …\nSuku pertama (a) = 5\nBeda (b) = 4\n' + 'Un = a + (n - 1) × b\n'.repeat(8) + 'U15 = 5 + 14 × 4 = 61\n\nJadi, suku ke-15 dari barisan tersebut adalah 61.';
  assert.ok(long.length > 200);
  const r = evaluate(input(q, text(long)));
  assert.equal(r.verdict, 'CORRECT');
  for (const ref of r.evidence.flatMap(e => e.refs)) if (ref.kind === 'SPAN') {
    assert.ok(ref.quote.length <= 200, 'contract SpanRef.quote maxLength');
    assert.equal(long.slice(ref.start, ref.end), ref.quote);
    assert.ok(ref.quote.endsWith('adalah 61.'), 'the final answer is what gets quoted');
  }
});

test('/coba Fisika and Kimia (D8): time and mass units are read, each distractor names its concept', () => {
  const bola = question('FIS.C26.E.GERAK2D.Q.SOAL_BOLA'), kompor = question('KIM.C26.E.STOIK.Q.SOAL_KOMPOR');
  for (const t of ['2', '2 s', '2 detik', 't = 2 sekon']) assert.equal(evaluateNumeric(input(bola, text(t))).verdict, 'CORRECT', t);
  for (const t of ['44', '44 g', '44 gram']) {
    const result = evaluateNumeric(input(kompor, text(t)));
    assert.equal(result.verdict, 'CORRECT', t);
    // The balanced equation is given: a correct mass must not award independent balancing mastery.
    assert.deepEqual(result.evidence.filter(e => e.classification === 'UNDERSTANDING_DEMONSTRATED').map(e => e.conceptCode), [
      'KIM.C26.E.STOIK.MOL_DAN_MASSA_MOLAR',
      'KIM.C26.E.STOIK.PERHITUNGAN_DARI_PERSAMAAN_REAKSI',
    ]);
  }
  // a unit of the wrong kind stays unreadable, never wrong
  assert.equal(evaluateNumeric(input(bola, text('2 m'))).reason, 'unknown-unit');
  assert.equal(evaluateNumeric(input(kompor, text('44 kg'))).reason, 'unknown-unit');
  const gap = (q: Question, t: string) => {
    const r = evaluateNumeric(input(q, text(t)));
    return [r.verdict, r.misconceptionCode, r.evidence.find(e => e.classification === 'MISCONCEPTION_EVIDENCED')?.conceptCode];
  };
  assert.deepEqual(gap(bola, '1 s'), ['INCORRECT', 'WAKTU_PUNCAK_SAJA', 'FIS.C26.E.GERAK2D.GERAK_PELURU_IDEAL']);
  assert.deepEqual(gap(bola, '3,46 s'), ['INCORRECT', 'KOMPONEN_TEGAK_PAKAI_COS', 'FIS.C26.E.GERAK2D.PROYEKSI_VEKTOR_GERAK']);
  assert.deepEqual(gap(bola, '4 s'), ['INCORRECT', 'KECEPATAN_TIDAK_DIURAIKAN', 'FIS.C26.E.GERAK2D.PROYEKSI_VEKTOR_GERAK']);
  assert.deepEqual(gap(kompor, '16 g'), ['INCORRECT', 'MASSA_DIANGGAP_TETAP', 'KIM.C26.E.STOIK.MOL_DAN_MASSA_MOLAR']);
  assert.deepEqual(gap(kompor, '28 g'), ['INCORRECT', 'MR_CO2_KELIRU', 'KIM.C26.E.STOIK.MOL_DAN_MASSA_MOLAR']);
  assert.deepEqual(gap(kompor, '88 g'), ['INCORRECT', 'KOEFISIEN_SALAH_BACA', 'KIM.C26.E.STOIK.PERHITUNGAN_DARI_PERSAMAAN_REAKSI']);
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
    [evaluateOption(input(mcq, text('gatau'))), 'UNREADABLE', 'empty'],
    [evaluateOption(input(mcq, text('   '))), 'UNREADABLE', 'empty'],
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

/* ---------- tower-v1 (Slice 2 M2) ---------- */

const tower = question('MAT.TRI.Q.SOAL_MENARA');
const aliasOf = new Map(manifest.topics.flatMap(t => t.concepts).map(c => [c.code, c.aliases.find(a => a.ns === 'MAP')?.value ?? c.code]));
const towerResponse = (c: TowerCase['input']): StudentResponse => c.text.trim() === '' && c.response
  ? { schemaVersion: 1, responseType: 'SELF_REPORT', selfReport: c.response === 'blank' ? 'DONT_KNOW' : 'KNOW', inputMode: 'TYPED' }
  : text(c.text);
const stateOf = (cls: string | undefined) => cls === 'UNDERSTANDING_DEMONSTRATED' ? 'ok' : cls === 'MISCONCEPTION_EVIDENCED' ? 'gap' : 'rest';

/*
 * Soal pilihan ganda yang isinya sengaja ditulis ulang sesudah v1 diarsipkan (kuncinya ikut berubah).
 * Sudut Istimewa ditulis ulang dengan bahasa yang lebih sederhana (FE b97415e): cek potongan 2 sekarang "tan 30°".
 */
const REWRITTEN_AFTER_V1 = new Set(['MAT.TRI.Q.SUDUT_ISTIMEWA_C1']);
test('golden v2 carries the v1 numeric section unchanged, and every v1 option item except deliberately rewritten ones', () => {
  const v1 = readGolden('catalog/golden/answers.v1.json');
  assert.equal(golden.schemaVersion, 2);
  assert.deepEqual(golden.numeric, v1.numeric);
  for (const old of v1.options) {
    const now = golden.options.find(x => x.question === old.question);
    assert.ok(now, `${old.question} is still in the golden file`);
    if (!REWRITTEN_AFTER_V1.has(old.question)) assert.deepEqual(now, old, `${old.question} unchanged since v1`);
  }
});

test('golden tower cases: verdict, reason, misconception and per-concept evidence with exact quotes', () => {
  const cases = golden.tower!.cases;
  assert.equal(golden.tower!.question, tower.code);
  assert.ok(tower.aliases.some(a => a.ns === 'ITEM' && a.value === golden.tower!.item));
  assert.equal(cases.length, 26);
  for (const c of cases) {
    const r = evaluateTower(input(tower, towerResponse(c.input)));
    const label = `${c.id} ${JSON.stringify(c.input.text || c.input.response)}`;
    assert.equal(r.verdict, c.expected.verdict, label);
    assert.equal(r.reason ?? undefined, c.expected.reason, label);
    assert.equal(r.misconceptionCode ?? undefined, c.expected.misconception, label);
    const got = Object.fromEntries(r.evidence.map(e => [aliasOf.get(e.conceptCode)!, {
      classification: e.classification, ...(e.misconceptionCode ? { misconception: e.misconceptionCode } : {}),
      ...(e.refs[0]?.kind === 'SPAN' ? { quote: e.refs[0].quote } : {}) }]));
    assert.deepEqual(got, c.expected.evidence, label);
  }
});

test('golden tower deltas: exactly the labelled cases differ from the recorded analysis.ts output, and none is approved', () => {
  for (const c of golden.tower!.cases) {
    const agree = (c.analysisTs.tone === 'kuat') === (c.expected.verdict === 'CORRECT')
      && ['tri-c', 'tri-d', 'tri-f'].every(id => c.analysisTs.items[id] === stateOf(c.expected.evidence[id]?.classification));
    assert.equal(c.delta === null, agree, `${c.id}: a difference from analysis.ts must be labelled, and a label must mark a real difference`);
    if (c.delta) {
      assert.equal(c.delta.label, 'delta from analysis.ts');
      assert.match(c.delta.status, /^PROPOSED/, `${c.id}: deltas await content review`);
      assert.ok(!/approved/i.test(c.delta.status.replace(/not approved/i, '')), c.id);
    }
  }
  assert.equal(golden.tower!.cases.filter(c => c.delta).length, 13);
});

test('tower-v1 final value under another name (2026-10-26): only an unknown of the working, and "x" always wins', () => {
  const verdictOf = (t: string) => evaluateTower(input(tower, text(t))).verdict;
  // Inside working, a letter that is no unknown in any ratio states no result: restating the height is not a wrong
  // answer. (A whole answer "t = 20" is read by the numeric parser as a bare value, as before this change.)
  assert.equal(verdictOf('t = 20, tan 30 = 20/d'), 'UNREADABLE');
  // An intermediate value under another letter never replaces the stated "x = …" result, either way round.
  assert.equal(verdictOf('tan 30 = 20/d, d = 40, x = 20√3'), 'CORRECT');
  assert.equal(verdictOf('tan 30 = 20/d, d = 20√3, x = 40'), 'INCORRECT');
  // Sentence ends split clauses; a decimal point does not.
  assert.equal(verdictOf('tan 30 = 20/d. d = 34.64'), 'CORRECT');
  assert.equal(verdictOf('jarak mendatar = 34,6 m.'), 'CORRECT');
});

test('06 §10 and T01-3 rows hold for tower-v1', () => {
  const byText = (t: string) => evaluateTower(input(tower, text(t)));
  const cls = (r: ReturnType<typeof byText>) => Object.fromEntries(r.evidence.map(e => [aliasOf.get(e.conceptCode), e.classification]));
  assert.deepEqual(cls(byText('tan 30 = 20/x, x = 20√3')), { 'tri-c': 'UNDERSTANDING_DEMONSTRATED', 'tri-d': 'UNDERSTANDING_DEMONSTRATED', 'tri-f': 'UNDERSTANDING_DEMONSTRATED' });
  const sin = byText('sin 30 = 20/x');
  assert.deepEqual([sin.verdict, sin.misconceptionCode, cls(sin)['tri-d'], cls(sin)['tri-f']], ['INCORRECT', 'MEMAKAI_SIN', 'MISCONCEPTION_EVIDENCED', 'NOT_ASSESSED']);
  const half = byText('tan 30 = 1/2');
  assert.deepEqual([cls(half)['tri-d'], cls(half)['tri-f']], ['UNDERSTANDING_DEMONSTRATED', 'MISCONCEPTION_EVIDENCED']);
  const forty = byText('40');
  assert.equal(forty.verdict, 'INCORRECT');
  assert.ok(forty.evidence.every(e => e.classification === 'INSUFFICIENT_EVIDENCE' && e.uncertaintyReasons.includes('INCOMPLETE_WORK')), 'T01-3: no concept is blamed for a bare wrong number');
  // T01-3 even when the bare number matches a step pattern: "1/√3" alone is tan 30°, not the distance.
  const bareStep = byText('1/√3');
  assert.equal(bareStep.verdict, 'INCORRECT');
  assert.ok(bareStep.evidence.every(e => e.classification === 'INSUFFICIENT_EVIDENCE'), 'a bare wrong value credits no step');
  // A step after the first error was never reached on this path: no credit, no blame.
  const afterError = byText('sin 30 = 20/x jadi 1/√3');
  assert.deepEqual([cls(afterError)['tri-c'], cls(afterError)['tri-d'], cls(afterError)['tri-f']], ['UNDERSTANDING_DEMONSTRATED', 'MISCONCEPTION_EVIDENCED', 'NOT_ASSESSED']);
  for (const selfReport of ['KNOW', 'DONT_KNOW'] as const) {
    const r = evaluateTower(input(tower, { schemaVersion: 1, responseType: 'SELF_REPORT', selfReport, inputMode: 'TYPED' }));
    assert.deepEqual([r.verdict, r.evidence, r.revealedAnswer], ['NOT_GRADED', [], null], '05 §4.4: a self-report is never graded and records nothing');
  }
  // Nothing is revealed before a verdict; refusals are UNREADABLE with a reason.
  assert.equal(byText('saya bingung').revealedAnswer, null);
  assert.deepEqual([byText('   ').verdict, byText('   ').reason], ['UNREADABLE', 'empty']);
  assert.equal(byText('x'.repeat(1001)).reason, 'too-long');
  assert.equal(evaluateTower(input(tower, option('a'))).reason, 'unsupported-response');
});

test('whole tokens, never substrings: tanpa, sinus and cosinus match nothing', () => {
  const tokens = (t: string) => tokenize(t).map(x => x.text);
  assert.deepEqual(tokens('tan(30°) = 20 : x'), ['tan', '30', '=', '20', '/', 'x']);
  assert.deepEqual(tokens('20 akar 3 ≈ 34,64'), ['20', '√', '3', '=', '34.64']);
  for (const t of ['tanpa 30', 'sinus 30', 'cosinus 30', 'tangen 30']) {
    const toks = tokenize(t);
    assert.equal(findRun(t, toks, 'tan 30') ?? findRun(t, toks, 'sin') ?? findRun(t, toks, 'cos'), null, t);
  }
  const r = evaluateTower(input(tower, text('tanpa sinus, cosinus atau tangen')));
  assert.ok(r.verdict === 'UNREADABLE' && !r.evidence.some(e => e.classification === 'MISCONCEPTION_EVIDENCED'));
  const quoted = findRun('jadi tan(30°) = 20/x', tokenize('jadi tan(30°) = 20/x'), 'tan 30')!;
  assert.equal(quoted.quote, 'tan(30°)', 'the quote closes over the angle mark and its parenthesis');
});

// INV-09 and 06 §2.4 for every response: random working built from the rubric's own vocabulary and noise.
const towerText = fc.array(fc.oneof(
  fc.constantFrom('tan', 'sin', 'cos', '30', '60', '20', 'x', '=', '/', '√3', '20√3', '34,6', '1/2', '0,5', '1/√3', 'm', 'jadi', ', ', '\n', '(', ')', '°', '≈', 'tanpa', 'akar 3', '40'),
  fc.string({ maxLength: 4 })), { maxLength: 14 }).map(parts => parts.join(' '));

test('INV-09 and spans: only mapped concepts, claims only on assessable ones, every quote is the exact substring', () => {
  const assessable = new Set(tower.concepts.filter(c => c.assessable).map(c => c.concept));
  const catalogued = new Map(manifest.topics.flatMap(t => t.concepts).map(c => [c.code, new Set(c.misconceptions.map(m => m.code))]));
  fc.assert(fc.property(towerText, fc.boolean(), (t, partly) => {
    // Also with one concept marked non-assessable, which must then never be claimed.
    const concepts = tower.concepts.map((c, i) => ({ code: c.concept, assessable: c.assessable && !(partly && i === 1) }));
    const r = evaluateTower(input(tower, text(t), concepts));
    // A refusal (empty working) records nothing; otherwise one row per mapped concept, no other.
    if (r.reason === 'empty') assert.deepEqual([r.verdict, r.evidence], ['UNREADABLE', []]);
    else assert.deepEqual(r.evidence.map(e => e.conceptCode), concepts.map(c => c.code), 'one row per mapped concept, no other');
    for (const e of r.evidence) {
      const claim = e.classification === 'UNDERSTANDING_DEMONSTRATED' || e.classification === 'MISCONCEPTION_EVIDENCED';
      if (claim) assert.ok(concepts.find(c => c.code === e.conceptCode)!.assessable && assessable.has(e.conceptCode), 'INV-09');
      if (claim) assert.ok(e.refs.length >= 1, '06 §1: a claim needs a reference');
      if (e.classification === 'MISCONCEPTION_EVIDENCED') {
        assert.ok(e.rationale && e.rationale.length <= 400);
        assert.ok(catalogued.get(e.conceptCode)!.has(e.misconceptionCode!), 'only catalogued misconceptions');
      }
      if (e.classification === 'INSUFFICIENT_EVIDENCE') assert.ok(e.uncertaintyReasons.length > 0);
      for (const ref of e.refs) assert.ok(ref.kind === 'SPAN' && ref.start >= 0 && ref.start < ref.end && ref.end <= t.length && t.slice(ref.start, ref.end) === ref.quote, JSON.stringify(t));
    }
    if (r.verdict === 'CORRECT') {
      assert.ok(!r.evidence.some(e => e.classification === 'MISCONCEPTION_EVIDENCED'), 'K01: a correct result is never a mistake');
      if (!partly) assert.ok(r.evidence.some(e => e.classification === 'UNDERSTANDING_DEMONSTRATED'), 'a correct verdict is supported');
    }
    if (r.verdict !== 'INCORRECT') assert.equal(r.misconceptionCode, null);
    assert.deepEqual(evaluateTower(input(tower, text(t), concepts)), r, 'deterministic');
  }), { numRuns: 1500 });
});


test('tower substitution identifies special-angle misconception in the next clause',()=>{
 for (const typed of ['tan 30 = 20 / x, x = 20 / 1/2','tan 30° = 20/d, d = 20 / (1/2)','tan 30 = 20/x, x = 20 / 0,5']) {
  const r=evaluateTower(input(tower,text(typed)));
  assert.equal(r.verdict,'INCORRECT',typed);
  assert.equal(r.evidence.find(e=>e.conceptCode==='MAT.TRI.SUDUT_ISTIMEWA')?.classification,'MISCONCEPTION_EVIDENCED',typed);
  assert.equal(r.evidence.find(e=>e.conceptCode==='MAT.TRI.DEFINISI_SIN_COS_TAN')?.classification,'UNDERSTANDING_DEMONSTRATED',typed);
 }
 for (const typed of ['tan 30 = 20/x, y = 20 / (1/2)','tan 45 = 20/x, x = 20 / (1/2)','tan 30 = 20/x, x = 20 / 12']) {
  assert.notEqual(evaluateTower(input(tower,text(typed))).evidence.find(e=>e.conceptCode==='MAT.TRI.SUDUT_ISTIMEWA')?.classification,'MISCONCEPTION_EVIDENCED',typed);
 }
 assert.equal(evaluateTower(input(tower,text('tan 30 = 20/x, x = 20/(1/2), x = 20√3'))).verdict,'CORRECT');
});

test('/coba SMP dan Biologi SMA (D8): satuan menit, °C, g/cm³, kJ, sel; titik ribuan; pangkat superskrip', () => {
  const verdict = (code: string, t: string) => {
    const r = evaluateNumeric(input(question(code), text(t)));
    return r.verdict === 'INCORRECT' ? `INCORRECT:${r.misconceptionCode}` : r.verdict === 'UNREADABLE' ? `UNREADABLE:${r.reason}` : r.verdict;
  };
  const peta = 'MAT.C26.D.RASIO.Q.SOAL_PETA', freezer = 'FIS.C26.D.SUHU.Q.SOAL_FREEZER', batu = 'KIM.C26.D.PARTIKEL.Q.SOAL_BATU',
    sawah = 'BIO.C26.D.EKOLOGI.Q.SOAL_SAWAH', nasi = 'BIO.C26.E.MIKROBA.Q.SOAL_NASI';
  for (const t of ['6', '6 menit', '6 mnt']) assert.equal(verdict(peta, t), 'CORRECT', t);
  assert.equal(verdict(peta, '0,1'), 'INCORRECT:MASIH_DALAM_JAM');
  // thousandsDot: "10.000" adalah sepuluh ribu (jarak masih cm), bukan 10 (laju terbalik)
  assert.equal(verdict(peta, '10.000'), 'INCORRECT:JARAK_BELUM_KM');
  assert.equal(verdict(peta, '10'), 'INCORRECT:LAJU_TERBALIK');
  assert.equal(verdict(peta, '6 jam'), 'UNREADABLE:unknown-unit');
  for (const t of ['42', '42 °C', '42°C', '42 ℃', '42 derajat celcius', '42°']) assert.equal(verdict(freezer, t), 'CORRECT', t);
  assert.equal(verdict(freezer, '−42 °C'), 'INCORRECT:SELISIH_NEGATIF');
  assert.equal(verdict(freezer, '32 °C'), 'INCORRECT:MENGURANGI_NEGATIF_KELIRU');
  assert.equal(verdict(freezer, '42 K'), 'UNREADABLE:unsupported-operator');
  for (const t of ['3', '3 g/cm³', '3 g/cm3', '3 gram/cm³', '3 g/mL', '3 gr/cm3']) assert.equal(verdict(batu, t), 'CORRECT', t);
  // "3 g/cm³" tidak boleh terbaca 3 / 3
  assert.equal(verdict(batu, '1 g/cm³'), 'INCORRECT:null');
  assert.equal(verdict(batu, '0,33 g/cm³'), 'INCORRECT:PEMBAGIAN_TERBALIK');
  assert.equal(verdict(batu, '1.200'), 'INCORRECT:MASSA_DIKALI_VOLUME');
  for (const t of ['10', '10 kJ', '10 kj']) assert.equal(verdict(sawah, t), 'CORRECT', t);
  // jebakan utama: energi pindah utuh ditulis dengan titik ribuan
  assert.equal(verdict(sawah, '10.000 kJ'), 'INCORRECT:ENERGI_PINDAH_UTUH');
  assert.equal(verdict(sawah, '1.000 kJ'), 'INCORRECT:PERPINDAHAN_KURANG');
  assert.equal(verdict(sawah, '1 kJ'), 'INCORRECT:PERPINDAHAN_DIHITUNG_PER_MAKHLUK');
  for (const t of ['64', '64 sel', '64 bakteri', '2⁶']) assert.equal(verdict(nasi, t), 'CORRECT', t);
  assert.equal(verdict(nasi, '12'), 'INCORRECT:PANGKAT_DIANGGAP_PERKALIAN');
  assert.equal(verdict(nasi, '2⁵'), 'INCORRECT:JUMLAH_PEMBELAHAN_KELIRU');
  // tanpa thousandsDot, satu titik tetap desimal (soal menara: 34.641 benar)
  assert.equal(evaluateNumeric(input(question('MAT.TRI.Q.TRIG_DEPRESSION_01'), text('34.641'))).verdict, 'CORRECT');
});
