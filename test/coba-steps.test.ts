import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { judgeCobaStep, stepValue } from '../src/assessment/coba-steps.js';
import { trialAssessment, type TrialItem } from '../src/assessment/trial.js';
import { evaluate } from '../src/assessment/evaluators/index.js';
import { registerTrialRoutes } from '../src/platform/trial-routes.js';
import { ApiError } from '../src/platform/errors.js';
import type { Connection } from '../src/db.js';
import type { CobaStep } from '../src/catalog/manifest.js';
import { draftManifest } from './fixtures/catalog.js';
// Kotak "Coba sekarang" di petunjuk /coba: aturan angka/kata dari rubric.cobaSteps, isian bebas ke AI.

const manifest = draftManifest();
const concepts = manifest.topics.flatMap(t => t.concepts);
const byAlias = (alias: string) => { const q = manifest.questions.find(q => q.aliases.some(a => a.ns === 'ITEM' && a.value === alias)); assert.ok(q, alias); return q!; };
const step = (alias: string, n: number) => { const s = byAlias(alias).rubric.cobaSteps?.find(x => x.step === n); assert.ok(s, `${alias} step ${n}`); return s as CobaStep; };
const kind = (alias: string, n: number, reply: string) => {
  const r = judgeCobaStep(step(alias, n), reply, { thousandsDot: byAlias(alias).rubric.answer.thousandsDot === true });
  return r.kind;
};
const load = async (alias: string): Promise<TrialItem> => {
  const q = byAlias(alias);
  return { revisionId: q.code, optionOrder: q.legacyOptionOrder ?? null,
    source: { revisionId: q.code, itemType: q.itemType, body: q.body, rubric: q.rubric, familyCode: q.familyCode, contextTag: q.contextTag,
      concepts: q.concepts.map(c => ({ id: c.concept, code: c.concept, role: c.role, assessable: c.assessable })) },
    concepts: q.concepts.map(c => { const v = concepts.find(x => x.code === c.concept)!; return { code: c.concept, title: v.title, legacyMapId: v.aliases.find(a => a.ns === 'MAP')?.value ?? null, route: '' }; }) };
};

test('every /coba question has a Coba sekarang key for each hint', () => {
  for (const alias of ['soal-menara', 'soal-bola', 'soal-kompor', 'soal-peta', 'soal-freezer', 'soal-batu', 'soal-sawah', 'soal-nasi']) {
    const q = byAlias(alias);
    assert.deepEqual(q.rubric.cobaSteps?.map(s => s.step), q.body.hints.map(h => h.step), alias);
  }
});

test('step value: the last number after "=", units and words around it are ignored', () => {
  assert.equal(stepValue('3 km : 30 km/jam = 0,1 jam'), 0.1);
  assert.equal(stepValue('10.000 → 1.000 → 100 → 10 kJ', { thousandsDot: true }), 10);
  assert.equal(stepValue('300.000 cm', { thousandsDot: true }), 300000);
  assert.equal(stepValue('37 − (−5) = 42'), 42);
  assert.equal(stepValue('37 - (-5)'), 42);
  assert.equal(stepValue('x = 20√3 m')?.toFixed(2), '34.64');
  assert.equal(stepValue('20 akar 3')?.toFixed(2), '34.64');
  assert.equal(stepValue('vᵧ = 20 × ½ = 10 m/s'), 10);
  assert.equal(stepValue('60 g : 20 cm³ = 3 g/cm³'), 3);
  assert.equal(stepValue('3 g/cm³'), 3, 'g/cm³ is a unit, not a division by 3');
  assert.equal(stepValue('2⁶'), 64);
  assert.equal(stepValue('2^6 = 64'), 64);
  assert.equal(stepValue('2^6'), 64);
  assert.equal(stepValue('mol CH₄ = 16 : 16 = 1 mol'), 1);
  assert.equal(stepValue('padi → tikus → ular → elang, ada 3 panah'), 3);
  assert.equal(stepValue('tidak'), null);
  assert.equal(stepValue('nol koma satu jam'), null);
});

test('Coba sekarang rules: key, half-way answers, wrong numbers, exact words; free text is left to the AI', () => {
  assert.equal(kind('soal-peta', 1, '12 × 500.000 = 6.000.000 cm'), 'correct');
  assert.equal(kind('soal-peta', 1, '60 km'), 'partial');
  assert.equal(kind('soal-peta', 1, '50'), 'incorrect');
  assert.equal(kind('soal-peta', 2, '6.000.000 : 100.000 = 60 km'), 'correct');
  assert.equal(kind('soal-peta', 2, '60.000'), 'partial');
  assert.equal(kind('soal-peta', 2, 'enam puluh'), 'undecided');
  assert.equal(kind('soal-freezer', 1, '37 °C'), 'correct');
  assert.equal(kind('soal-freezer', 2, '37 − (−5) = 32'), 'partial');
  assert.equal(kind('soal-batu', 1, '20 mL'), 'correct');
  assert.equal(kind('soal-batu', 2, '60 × 20 = 1.200'), 'partial');
  assert.equal(kind('soal-sawah', 1, 'Padi'), 'correct');
  assert.equal(kind('soal-sawah', 1, 'tikus'), 'incorrect');
  assert.equal(kind('soal-sawah', 1, 'yang tumbuhan itu'), 'undecided');
  assert.equal(kind('soal-sawah', 2, '2 kali'), 'correct');
  assert.equal(kind('soal-sawah', 2, '3'), 'partial');
  assert.equal(kind('soal-nasi', 2, '2 × 6 = 12'), 'partial');
  assert.equal(kind('soal-menara', 1, 'Tidak.'), 'correct');
  assert.equal(kind('soal-menara', 1, 'iya'), 'incorrect');
  assert.equal(kind('soal-menara', 1, 'kayaknya sih nggak ada di soal'), 'undecided');
  assert.equal(kind('soal-menara', 2, 'Tan'), 'correct');
  assert.equal(kind('soal-menara', 2, 'cos'), 'incorrect');
  assert.equal(kind('soal-menara', 2, 'bukan sin, tapi tan'), 'undecided', 'negation is not guessed by rule');
  assert.equal(kind('soal-menara', 3, '20√3'), 'correct');
  assert.equal(kind('soal-menara', 3, '20 : √3 = 11,55'), 'partial');
  assert.equal(kind('soal-bola', 1, 'sin'), 'correct');
  assert.equal(kind('soal-bola', 2, '17,32'), 'partial');
  assert.equal(kind('soal-kompor', 2, '44 g'), 'correct');
});

test('trial steps/check: rule decides without AI, free text goes to the AI with the key, a pass ticks the core for IntiGuide', async () => {
  const calls: any[] = [];
  const ai = {
    evaluate: async (i: TrialItem, response: Parameters<typeof evaluate>[0]['response']) => evaluate({ ...i.source, response }),
    tutor: async (_i: TrialItem, _m: unknown, _a: string, used: number, done: string[] = []) => { calls.push({ done }); return { text: 'ok', quick: [], hintsUsed: used }; },
    mini: async (_i: TrialItem, input: any) => { calls.push(input); return { correct: /tan/.test(input.reply) && !/cos/.test(input.reply), feedback: 'tanggapan AI', because: '' }; },
  };
  const s = trialAssessment(load, ai);
  const base = { sessionId: 'steps', questionId: 'soal-menara' };
  const rule = await s.stepCheck('browser-s', { ...base, step: 2, reply: 'tan' });
  assert.deepEqual(rule, { correct: true, partial: false, feedback: 'Betul, tan = depan : samping.', judge: 'rule', coreId: 'tri-d' });
  assert.equal(calls.length, 0, 'an exact word needs no AI');
  const free = await s.stepCheck('browser-s', { ...base, step: 2, reply: 'bukan sin, tapi tan' });
  assert.deepEqual({ correct: free.correct, judge: free.judge, feedback: free.feedback }, { correct: true, judge: 'ai', feedback: 'tanggapan AI' });
  assert.equal(calls[0].question, 'Perbandingan yang dipakai: …');
  assert.equal(calls[0].key, 'tan (depan : samping)', 'the grader gets the private key');
  assert.equal(calls[0].decided, undefined, 'the AI decides free text');
  await s.stepCheck('browser-s', { ...base, step: 2, reply: 'bukan sin, tapi tan' });
  assert.equal(calls.length, 1, 'the same reply is not graded twice');
  // a wrong number is decided by rule; the AI only words the reply
  const wrong = await s.stepCheck('browser-s', { ...base, step: 3, reply: '40' });
  assert.deepEqual({ correct: wrong.correct, judge: wrong.judge }, { correct: false, judge: 'rule' });
  assert.equal(calls.at(-1).decided, false);
  const partial = await s.stepCheck('browser-s', { ...base, step: 3, reply: '11,55' });
  assert.deepEqual({ correct: partial.correct, partial: partial.partial, judge: partial.judge }, { correct: false, partial: true, judge: 'rule' });
  await s.tutor('browser-s', { ...base, messages: [{ from: 'bot', text: 'Halo' }, { from: 'me', text: 'a' }, { from: 'bot', text: 'b' }, { from: 'me', text: 'c' }] });
  assert.deepEqual(calls.at(-1).done, ['tri-d'], 'IntiGuide does not teach a core the learner just passed');
  await assert.rejects(s.stepCheck('browser-s', { ...base, step: 9, reply: 'x' }), (e: unknown) => e instanceof ApiError && e.status === 404);
  await assert.rejects(s.stepCheck('browser-s', { ...base, step: 1, reply: '   ' }), (e: unknown) => e instanceof ApiError && e.status === 400);
  // no AI configured: free text is unavailable (503), rule-decided replies still work
  const plain = trialAssessment(load, { evaluate: ai.evaluate, tutor: ai.tutor });
  assert.equal((await plain.stepCheck('browser-t', { ...base, step: 2, reply: 'tan' })).correct, true);
  await assert.rejects(plain.stepCheck('browser-t', { ...base, step: 2, reply: 'pakai tangen deh' }), (e: unknown) => e instanceof ApiError && e.status === 503);
  const fallback = await plain.stepCheck('browser-t', { ...base, step: 3, reply: '40' });
  assert.equal(fallback.feedback, 'Belum pas. Baca lagi rumus di atas, lalu coba lagi.');
});

test('trial route steps/check follows the contract; the key never reaches the browser', async () => {
  const app = Fastify();
  app.setErrorHandler((e, _req, reply) => reply.code(e instanceof ApiError ? e.status : 500).send({ code: e instanceof ApiError ? e.code : 'INTERNAL' }));
  const ai = { evaluate: async (i: TrialItem, response: Parameters<typeof evaluate>[0]['response']) => evaluate({ ...i.source, response }), tutor: async () => ({ text: '', quick: [], hintsUsed: 0 }) };
  registerTrialRoutes(app, null as unknown as Connection, trialAssessment(load, ai));
  try {
    const r = await app.inject({ method: 'POST', url: '/v1/trial/steps/check', payload: { sessionId: 's', questionId: 'soal-peta', step: 1, reply: '6.000.000 cm' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json(), { correct: true, partial: false, feedback: 'Pas, 12 × 500.000 = 6.000.000 cm.', judge: 'rule', coreId: 'mat-d-rasio-c2' });
    assert.doesNotMatch(r.body, /key|cm \(12/);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/trial/steps/check', payload: { sessionId: 's', questionId: 'soal-peta', step: 1 } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/trial/steps/check', payload: { sessionId: 's', questionId: 'soal-peta', step: 1, reply: 'x'.repeat(301) } })).statusCode, 400);
  } finally { await app.close(); }
});

test('trial check: a catalogued trap keeps its reviewed explanation, and a bare number is graded by the catalog, not the AI', async () => {
  // an AI that marks every answer correct without evidence: the rubric must still decide
  const lenient = {
    evaluate: async () => ({ verdict: 'CORRECT', reason: null, value: null, misconceptionCode: null, evidence: [], revealedAnswer: null }) as any,
    tutor: async () => ({ text: '', quick: [], hintsUsed: 0 }),
  };
  const s = trialAssessment(load, lenient);
  const check = (itemId: string, answer: string) => s.check('browser-c', { sessionId: 'c', itemId, answer });
  const bare = await check('soal-peta', '6.000.000');
  assert.equal(bare.correct, false, 'a bare 6.000.000 is still centimetres');
  assert.equal(bare.items?.find((x: any) => x.id === 'mat-d-rasio-panjang')?.reason, 'Itu masih dalam cm. Ubah ke km dulu: dibagi 100.000.');
  const worked = await check('soal-peta', '12 × 500.000 = 6.000.000 cm\njarak = 6.000.000 : 100 = 60.000');
  assert.equal(worked.correct, false);
  const gap = worked.items?.find((x: any) => x.state === 'gap');
  assert.deepEqual({ id: gap?.id, reason: gap?.reason, quote: gap?.quote }, { id: 'mat-d-rasio-panjang', reason: 'Itu masih dalam meter. Dari m ke km dibagi 1.000 lagi.', quote: '60.000' });
  // hasil akhir bersatuan lain (cm untuk kunci km): pengecoh tetap dikenali (jalur ini tidak pernah memberi benar)
  const cm = await check('soal-peta', '12 × 500.000 = 6.000.000 cm');
  assert.equal(cm.correct, false);
  assert.equal(cm.items?.find((x: any) => x.state === 'gap')?.reason, 'Itu masih dalam cm. Ubah ke km dulu: dibagi 100.000.');
  assert.equal(cm.items?.find((x: any) => x.state === 'gap')?.quote, '6.000.000 cm');
  // tanpa spasi antara angka dan satuan tetap terbaca
  assert.equal((await check('soal-peta', '6.000.000 cm = 60km')).correct, true);
  // jawaban benar membuktikan inti hasil akhir walau AI tidak menulis bukti: diagnosis langsung "kuat"
  const right = await check('soal-peta', '12 × 500.000 = 6.000.000 cm = 60 km');
  assert.equal(right.correct, true);
  assert.deepEqual(right.items?.map((x: any) => x.state), ['ok', 'ok']);
  const diag = await s.diagnose('browser-c', { sessionId: 'c', questionId: 'soal-peta', rawText: '6.000.000 cm = 60 km', responseMode: null });
  assert.equal(diag.status, 'completed');
  assert.equal(diag.assessment.tone, 'kuat');
  assert.equal((await check('soal-sawah', '4 kali')).correct, false);
  assert.equal((await check('soal-sawah', 'padi → tikus → ular → elang = 3 kali')).correct, true);
  assert.equal((await check('soal-freezer', '310 − 273 = 37\n37 − (−5) = 42 °C')).correct, true);
  assert.equal((await check('soal-batu', '60 : 20 = 3 g/cm³')).correct, true);
});

test('trial items: which /coba questions are in the active release, with their public prompt and Coba sekarang steps', async () => {
  const s = trialAssessment(async (alias: string) => { if (alias === 'soal-tidak-ada') throw new ApiError(404, 'NOT_FOUND'); return load(alias); },
    { evaluate: async () => { throw new Error('no grading'); }, tutor: async () => ({ text: '', quick: [], hintsUsed: 0 }) });
  const r = await s.items(['soal-peta', 'soal-tidak-ada', 'BAD ID', 'soal-peta']);
  assert.deepEqual(r.items.map(i => [i.id, i.available, i.steps]), [['soal-peta', true, [1, 2]], ['soal-tidak-ada', false, undefined]]);
  assert.match(r.items[0]!.prompt!, /^Pada peta, jarak rumah Dika ke rumah neneknya 12 cm/);
  assert.doesNotMatch(JSON.stringify(r), /6\.000\.000|key|misconception/i, 'never rubric content');
  const app = Fastify();
  app.setErrorHandler((e, _req, reply) => reply.code(e instanceof ApiError ? e.status : 500).send({ code: e instanceof ApiError ? e.code : 'INTERNAL' }));
  registerTrialRoutes(app, null as unknown as Connection, s);
  try {
    const res = await app.inject({ method: 'GET', url: '/v1/trial/items?ids=soal-peta,soal-tidak-ada' });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().items.length, 2);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/trial/items' })).statusCode, 400);
  } finally { await app.close(); }
});

test('QA 22 Nov: x/X between numbers is multiplication; spaces around √ do not matter; variable x stays', async () => {
  const { stepValue } = await import('../src/assessment/coba-steps.js');
  const { finalValue } = await import('../src/assessment/trial.js');
  const { timesX } = await import('../src/assessment/evaluators/numeric-parse.js');
  const { findQuote } = await import('../src/assessment/trial-ai.js');
  for (const t of ['1x2', '1 x 2', '1X2', '1 X 2', '1×2']) assert.equal(stepValue(t), 2, t);
  for (const t of ['= 20x√3', '= 20 X √3', '= 20 x akar 3', '= 20√ 3']) assert.ok(Math.abs(finalValue(t, 'none')!.value - 20 * Math.sqrt(3)) < 1e-9, t);
  for (const t of ['3√2', '3√ 2', '3 √ 2', '3 akar 2', '3akar2']) assert.ok(Math.abs(stepValue(t)! - 3 * Math.SQRT2) < 1e-9, t);
  for (const t of ['x = 20 / tan 30', '3x + 2 = 8', '2x = 6', 'tan 30 = x / 20']) assert.equal(timesX(t), t, t);
  assert.equal(findQuote('x = 1x2 = 2', '1 × 2')?.quote, '1x2');
  assert.equal(findQuote('v = 20X√3', '20 × √3')?.quote, '20X√3');
});
