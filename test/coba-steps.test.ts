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
  assert.equal(kind('soal-peta', 1, '0,1 jam'), 'correct');
  assert.equal(kind('soal-peta', 1, '3 km'), 'partial');
  assert.equal(kind('soal-peta', 1, '300.000 cm'), 'partial');
  assert.equal(kind('soal-peta', 1, '6 menit'), 'partial');
  assert.equal(kind('soal-peta', 1, '0,5'), 'incorrect');
  assert.equal(kind('soal-peta', 2, '6'), 'correct');
  assert.equal(kind('soal-peta', 2, 'enam menit'), 'undecided');
  assert.equal(kind('soal-freezer', 1, '37 °C'), 'correct');
  assert.equal(kind('soal-freezer', 2, '37 − (−5) = 32'), 'partial');
  assert.equal(kind('soal-batu', 1, '20 mL'), 'correct');
  assert.equal(kind('soal-batu', 2, '60 × 20 = 1.200'), 'partial');
  assert.equal(kind('soal-sawah', 2, '10.000 kJ'), 'partial', '10.000 is ten thousand here, not the key 10');
  assert.equal(kind('soal-sawah', 2, '10 kJ'), 'correct');
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
    const r = await app.inject({ method: 'POST', url: '/v1/trial/steps/check', payload: { sessionId: 's', questionId: 'soal-peta', step: 1, reply: '0,1 jam' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json(), { correct: true, partial: false, feedback: 'Pas, 3 km : 30 km/jam = 0,1 jam. Skala dan lajunya udah benar.', judge: 'rule', coreId: 'mat-d-rasio-c2' });
    assert.doesNotMatch(r.body, /key|0,1 jam \(/);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/trial/steps/check', payload: { sessionId: 's', questionId: 'soal-peta', step: 1 } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/trial/steps/check', payload: { sessionId: 's', questionId: 'soal-peta', step: 1, reply: 'x'.repeat(301) } })).statusCode, 400);
  } finally { await app.close(); }
});
