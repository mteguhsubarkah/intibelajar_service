import {evaluate} from '../src/assessment/evaluators/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { trialAssessment, type TrialItem } from '../src/assessment/trial.js';
import { registerTrialRoutes } from '../src/platform/trial-routes.js';
import { draftManifest } from './fixtures/catalog.js';
import { ApiError } from '../src/platform/errors.js';
import type { Connection } from '../src/db.js';

const manifest = draftManifest();
const concepts = manifest.topics.flatMap(t => t.concepts);
const load = async (alias: string): Promise<TrialItem> => {
  const q = manifest.questions.find(q => q.aliases.some(a => a.ns === 'ITEM' && a.value === alias));
  assert.ok(q, `catalog alias ${alias}`);
  return { revisionId: q.code, optionOrder: q.legacyOptionOrder ?? null,
    source: { revisionId: q.code, itemType: q.itemType, body: q.body, rubric: q.rubric, familyCode: q.familyCode, contextTag: q.contextTag,
      concepts: q.concepts.map(c => ({ id: c.concept, code: c.concept, role: c.role, assessable: c.assessable })) },
    concepts: q.concepts.map(c => {
      const v = concepts.find(x => x.code === c.concept)!;
      return { code: c.concept, title: v.title, legacyMapId: v.aliases.find(a => a.ns === 'MAP')?.value ?? null, route: 'definisi-sin-cos-tan' };
    }) };
};
// Explicit deterministic test double, never selected by production trial routes.
const fixtureAi = {
 evaluate: async (i:TrialItem,response:Parameters<typeof evaluate>[0]['response']) => evaluate({...i.source,response}),
 tutor: async(i:TrialItem,messages:{from:string;text:string}[],_answer:string,used:number)=>{
  const ladder=manifest.questions.find(q=>q.code===i.revisionId)!.rubric.tutorLadder!;
  const text=messages.at(-1)!.text;
  const node=ladder.nodes.find(n=>n.ask.toLowerCase()===text.toLowerCase()) ?? ladder.nodes[0]!;
  return {text:node.text,quick:node.quick,hintsUsed:used};
 }
};
const service = (now?:()=>number) => trialAssessment(load,fixtureAi,now);
const body = { sessionId: 'guest-first-visit', questionId: 'soal-menara', topicId: 'trigonometri', hintOpened: false, responseMode: null, rawText: 'sin 30 = 20/x' };

test('trial: genuine catalog evaluation without user, learner or consent', async () => {
  const s = service();
  const result = await s.diagnose('browser-a', body);
  assert.equal(result.status, 'completed');
  assert.equal(result.assessment.tone, 'gap');
  assert.ok(result.items.some((x: any) => x.state === 'gap'));
  // the gap carries the quoted part of the answer for the client highlight; other states never do
  const gapItem = result.items.find((x: any) => x.state === 'gap');
  assert.ok(gapItem.quote && body.rawText.includes(gapItem.quote), 'gap quotes the learner text');
  assert.ok(result.items.filter((x: any) => x.state !== 'gap').every((x: any) => x.quote === undefined));
  assert.deepEqual(await s.diagnose('browser-a', body), result, 'same request keeps the same run');
  assert.deepEqual(s.run('browser-a', result.diagnosisRunId), result);
  assert.throws(() => s.run('browser-b', result.diagnosisRunId), (e: any) => e instanceof ApiError && e.status === 404);
  const correct = await s.diagnose('browser-a', { ...body, rawText: 'tan 30 = 20/x; x = 20√3' });
  assert.equal(correct.assessment.tone, 'kuat');
  const insufficient = await s.diagnose('browser-a', { ...body, rawText: '???' });
  assert.equal(insufficient.status, 'insufficient_evidence');
  assert.equal(insufficient.assessment, undefined, 'never invent a gap');
  assert.equal((await s.check('browser-a', { ...body, itemId: 'soal-menara', answer: '20√3' })).correct, true);
  for (const id of ['c1', 'c2', 'c3', 'c4', 'p1', 'p2', 'p3']) {
    const i = await load(id), index = i.optionOrder!.indexOf(i.source.rubric.answer.optionId!);
    assert.ok(index >= 0, id);
    assert.equal((await s.check('browser-a', { ...body, itemId: id, answer: index })).correct, true, id);
  }
  assert.ok((await s.solution('browser-a', body)).steps.length);
  assert.ok((await s.tutor('browser-a', { ...body, messages: [{ from: 'me', text: 'Hubungkan soal dengan inti' }] })).text);
});

test('trial: expiry and catalog/service failure are never replaced by a synthetic result', async () => {
  let now = 0;
  const s = service(() => now), run = await s.diagnose('browser', body);
  now = 3 * 60 * 60 * 1000;
  assert.throws(() => s.run('browser', run.diagnosisRunId), (e: any) => e.status === 404);
  const broken = trialAssessment(async () => { throw new Error('database unavailable'); }, fixtureAi);
  await assert.rejects(broken.diagnose('browser', body), /database unavailable/);
  await assert.rejects(broken.check('browser', { ...body, itemId: 'c1', answer: 0 }), /database unavailable/);
});

test('trial routes: first visit has no login, no consent, no legacy flag; schema and owner isolation hold', async () => {
  const app = Fastify();
  app.setErrorHandler((e, _req, reply) => reply.code(e instanceof ApiError ? e.status : 500).send({ code: e instanceof ApiError ? e.code : 'INTERNAL' }));
  registerTrialRoutes(app, null as unknown as Connection, service());
  try {
    const r = await app.inject({ method: 'POST', url: '/v1/trial/diagnosis', payload: body });
    assert.equal(r.statusCode, 200, r.body);
    const cookie = String(r.headers['set-cookie']).split(';')[0]!;
    assert.match(cookie, /^inti_trial=/);
    const id = r.json().diagnosisRunId;
    assert.equal((await app.inject({ method: 'GET', url: '/v1/trial/diagnosis/' + id, headers: { cookie } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/trial/diagnosis/' + id })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/trial/diagnosis', payload: { rawText: 'x' } })).statusCode, 400);
    const check = await app.inject({ method: 'POST', url: '/v1/trial/answers/check', headers: { cookie }, payload: { ...body, attemptId: 'attempt-1', kind: 'retry_original', itemId: 'soal-menara', answer: '20√3' } });
    assert.equal(check.statusCode, 200, check.body);
    assert.equal(check.json().correct, true);
    assert.deepEqual(check.json().items.filter((i: any) => i.state === "ok").map((i: any) => i.id).sort(), ["tri-c", "tri-d", "tri-f"]);
    const solution = await app.inject({ method: 'POST', url: '/v1/trial/solution', headers: { cookie }, payload: { ...body, reason: 'requested' } });
    assert.equal(solution.statusCode, 200, solution.body);
  } finally { await app.close(); }
});

test('trial IntiGuide: reopening the dialog starts a fresh conversation, cores ticked in the old chat are not carried over', async () => {
  const seen: string[][] = [];
  const ai = { ...fixtureAi, tutor: async (_i: TrialItem, messages: { from: string; text: string }[], _a: string, used: number, done: string[] = []) => {
    seen.push(done);
    // first conversation: the guide ticks all three cores
    return { text: 'ok', quick: [], hintsUsed: used, coreProgress: { active: null, done: ['tri-c', 'tri-d', 'tri-f'] } };
  } };
  const s = trialAssessment(load, ai);
  const welcome = { from: 'bot', text: 'Halo! Aku IntiGuide.' };
  await s.tutor('browser-r', { ...body, messages: [welcome, { from: 'me', text: 'Ok' }] });
  await s.tutor('browser-r', { ...body, messages: [welcome, { from: 'me', text: 'Ok' }, { from: 'bot', text: 'inti 1?' }, { from: 'me', text: 'depan' }] });
  assert.deepEqual(seen[1], ['tri-c', 'tri-d', 'tri-f'], 'the same conversation keeps its ticks');
  await s.tutor('browser-r', { ...body, messages: [welcome, { from: 'me', text: 'Ok' }] });
  assert.deepEqual(seen[2], [], 'a reopened dialog does not inherit the old chat');
});

test('trial mini check: grades against the question the server wrote, and a pass ticks the core for IntiGuide', async () => {
  const calls: any[] = [];
  const ai = { ...fixtureAi, mini: async (_i: TrialItem, input: any) => { calls.push(input);
    return input.question === undefined ? { question: 'Tinggi menara itu sisi apa?', hint: 'Lihat sudutnya.', key: 'depan' } : { correct: input.reply === 'depan', feedback: 'ok', because: input.reply === 'depan' ? 'kamu tahu sisi depan' : '' }; },
    tutor: async (_i: TrialItem, _m: unknown, _a: string, used: number, done: string[] = []) => { calls.push({ done }); return { text: 'ok', quick: [], hintsUsed: used }; } };
  const s = trialAssessment(load, ai);
  const mini = { sessionId: 'mini', questionId: 'soal-menara', topicId: 'trigonometri', hintOpened: false, coreId: 'tri-c', currentAnswer: 'sin 30 = 20/x' };
  await assert.rejects(s.miniCheck('browser-m', { ...mini, reply: 'depan' }), (e: unknown) => e instanceof ApiError && e.status === 400, 'no grading before the question exists');
  const asked = await s.miniCheck('browser-m', mini);
  assert.deepEqual(asked, { question: 'Tinggi menara itu sisi apa?', hint: 'Lihat sudutnya.' });
  await s.miniCheck('browser-m', mini);
  assert.equal(calls.length, 1, 'the same core and answer reuse the question');
  const wrong = await s.miniCheck('browser-m', { ...mini, reply: 'miring' });
  assert.equal(wrong.correct, false);
  const right = await s.miniCheck('browser-m', { ...mini, reply: 'depan' });
  assert.deepEqual({ correct: right.correct, because: right.because }, { correct: true, because: 'kamu tahu sisi depan' });
  assert.equal(calls[2].question, 'Tinggi menara itu sisi apa?');
  assert.equal(calls[2].key, 'depan', 'the grader gets the key');
  await s.tutor('browser-m', { ...mini, messages: [{ from: 'bot', text: 'Halo' }, { from: 'me', text: 'a' }, { from: 'bot', text: 'b' }, { from: 'me', text: 'c' }] });
  assert.deepEqual(calls.at(-1).done, ['tri-c']);
  await assert.rejects(s.miniCheck('browser-m', { ...mini, coreId: 'bukan-inti' }), (e: unknown) => e instanceof ApiError && e.status === 404);
});

test('trial grading: the reviewed rubric wins over an AI that marks a correct answer wrong; options never go to AI', async () => {
  const { gradeTrial } = await import('../src/assessment/trial.js');
  const i = await load('soal-menara');
  const strictAi = { ...fixtureAi, evaluate: async () => ({ verdict: 'INCORRECT', reason: null, value: null, misconceptionCode: null, revealedAnswer: null,
    evidence: [{ conceptCode: i.concepts[0]!.code, classification: 'MISCONCEPTION_EVIDENCED', rationale: 'salah', refs: [], uncertaintyReasons: [] }] }) as any };
  const text = (t: string) => ({ schemaVersion: 1, responseType: 'TEXT', text: t, inputMode: 'TYPED' }) as any;
  assert.equal((await gradeTrial(strictAi, i, text('Tan 30 = 20/x\nX = 20/1/√3 = 20√3'))).verdict, 'CORRECT', 'the final value 20√3 decides');
  assert.equal((await gradeTrial(strictAi, i, text('sin 30 = 20/x\nx = 40'))).verdict, 'INCORRECT', 'a wrong answer stays the AI verdict');
  let asked = 0;
  const counting = { ...fixtureAi, evaluate: async (...a: Parameters<typeof fixtureAi.evaluate>) => { asked++; return fixtureAi.evaluate(...a); } };
  const check = await load('core:sudut-istimewa:c1');
  const r = await gradeTrial(counting, check, { schemaVersion: 1, responseType: 'OPTION', optionId: check.optionOrder![0]!, inputMode: 'TYPED' } as any);
  assert.equal(r.verdict, 'CORRECT'); assert.equal(asked, 0);
});

test('trial grading decides by the final number: "20*1/akar 3" is wrong even when the AI says right, "= 20√3" is right even when it says wrong', async () => {
  const { gradeTrial, finalValue } = await import('../src/assessment/trial.js');
  const i = await load('soal-menara');
  const text = (t: string) => ({ schemaVersion: 1, responseType: 'TEXT', text: t, inputMode: 'TYPED' }) as any;
  const says = (verdict: string) => ({ ...fixtureAi, evaluate: async () => ({ verdict, reason: null, value: null, misconceptionCode: null, revealedAnswer: null,
    evidence: i.concepts.map(c => ({ conceptCode: c.code, classification: 'UNDERSTANDING_DEMONSTRATED', rationale: 'ok', refs: [], uncertaintyReasons: [] })) }) as any });
  const wrong = await gradeTrial(says('CORRECT'), i, text('Tan 30 = 20/x\nX= 20*1/akar 3'));
  assert.equal(wrong.verdict, 'INCORRECT');
  const gap = wrong.evidence.find(e => e.classification === 'MISCONCEPTION_EVIDENCED')!;
  assert.deepEqual(gap.refs, [{ kind: 'SPAN', start: 17, end: 28, quote: '20*1/akar 3' }]);
  assert.equal((await gradeTrial(says('INCORRECT'), i, text('Tan 30 = 20/x\nX = 20/1/√3 = 20√3'))).verdict, 'CORRECT');
  assert.equal((await gradeTrial(says('CORRECT'), i, text('tan 30 = 20/x\nX = 20 / akar 3'))).verdict, 'INCORRECT');
  assert.equal((await gradeTrial(says('INCORRECT'), i, text('tan 30 = 20/x\nx = 34,6 m jaraknya'))).verdict, 'CORRECT');
  assert.equal(finalValue('tan 30 = 20/x', 'length'), null, 'not computed yet: the AI decides');
  assert.equal((await gradeTrial(says('INCORRECT'), i, text('Tan 30= 20/X\nX = 20/1/√3'))).verdict, 'CORRECT', '"20/1/√3" means 20 divided by 1/√3');
  assert.equal((await gradeTrial(says('CORRECT'), i, text('Tan 30 = 20/x\nX = 20/√3'))).verdict, 'INCORRECT', 'no sensible reading gives 34,6');
  assert.equal((await gradeTrial(says('INCORRECT'), i, text('tan 30 = 20/x'))).verdict, 'INCORRECT');
});

test('trial mini check: after a correction that is still wrong, the same core gets a fresh question for the new round', async () => {
  const asks: any[] = [];
  const ai = { ...fixtureAi, mini: async (_i: TrialItem, input: any) => {
    if (input.question === undefined) { asks.push(input); return { question: `Pertanyaan ${asks.length}`, hint: 'h', key: 'depan' }; }
    return { correct: true, feedback: 'ok', because: 'x' }; } };
  const s = trialAssessment(load, ai);
  const mini = { sessionId: 'round', questionId: 'soal-menara', topicId: 'trigonometri', hintOpened: false, coreId: 'tri-c', currentAnswer: 'sin 30 = 20/x' };
  assert.equal((await s.miniCheck('browser-n', mini)).question, 'Pertanyaan 1');
  await s.miniCheck('browser-n', { ...mini, reply: 'depan' });
  assert.equal((await s.miniCheck('browser-n', mini)).question, 'Pertanyaan 1', 'same round: same question');
  assert.equal((await s.miniCheck('browser-n', { ...mini, round: 1 })).question, 'Pertanyaan 2', 'a new round asks again');
  assert.equal(asks[1].previous, 'Pertanyaan 1', 'and is told the previous question');
  const graded = await s.miniCheck('browser-n', { ...mini, round: 1, reply: 'depan' });
  assert.equal(graded.question, 'Pertanyaan 2', 'grading uses that round\'s question');
});

test('trial: jawaban "bingung" tetap dirangkul walau penilai AI tidak tersedia; jawaban lain tetap 503', async () => {
  const { fail } = await import('../src/platform/errors.js');
  const down = { ...fixtureAi, evaluate: async () => fail(503, 'DEPENDENCY_UNAVAILABLE', { blockers: ['TRIAL_AI_PROVIDER_UNAVAILABLE'] }) };
  const s = trialAssessment(load, down as any);
  const confused = await s.diagnose('browser-bingung-1', { ...body, rawText: 'bingung ah gatau' });
  assert.equal(confused.status, 'completed');
  assert.equal(confused.assessment.title, 'Nggak apa-apa kalau masih bingung.');
  assert.equal(confused.assessment.gap.label, 'Mulai dari inti ini');
  assert.match(confused.assessment.gap.reason, /^Nggak apa-apa\. Mulai dari inti ini dulu/);
  assert.ok(confused.items.length > 0 && confused.items.every((x: { state: string }) => x.state === 'rest'), 'tidak ada inti yang ditandai salah atau dikuasai');
  // tombol "Belum tahu caranya" (jawaban kosong, responseMode blank) lewat jalur yang sama
  const blank = await s.diagnose('browser-bingung-2', { ...body, rawText: '', responseMode: 'blank' });
  assert.equal(blank.assessment.title, 'Nggak apa-apa kalau masih bingung.');
  // jawaban berisi langkah tidak ditebak tanpa AI: tetap galat 503 seperti sebelumnya
  for (const rawText of ['sin 30 = 20/x', 'bingung, tapi x = 40', 'jawabannya yang B kayaknya']) {
    await assert.rejects(s.diagnose('browser-bingung-3', { ...body, rawText }), (e: unknown) => e instanceof ApiError && e.status === 503, rawText);
  }
});

test('trial: soal katalog tanpa urutan pilihan lama memakai urutan pilihan katalog (latihan inti tamu)', async () => {
  const { optionOrderOf } = await import('../src/assessment/trial.js');
  const i = await load('soal-menara');
  const withOptions = { ...i.source, body: { ...i.source.body, options: [{ id: 'o-a', label: 'A' }, { id: 'o-b', label: 'B' }] } } as any;
  assert.deepEqual(optionOrderOf(null, withOptions), ['o-a', 'o-b'], 'urutan GET /v1/questions/{id}');
  assert.deepEqual(optionOrderOf(['o-b', 'o-a'], withOptions), ['o-b', 'o-a'], 'soal /coba lama tetap memakai urutan tetapnya');
  assert.equal(optionOrderOf(null, { ...i.source, body: { ...i.source.body, options: undefined } } as any), null, 'soal isian tanpa pilihan');
});

test('QA 21 Nov: special-angle values, catalog traps and half-finished answers (TC-PANDU-024/031/044/053/058)', async () => {
  const { gradeTrial } = await import('../src/assessment/trial.js');
  const text = (t: string) => ({ schemaVersion: 1, responseType: 'TEXT', text: t, inputMode: 'TYPED' }) as any;
  // penilai tiruan: keadaan tiap inti seperti yang dikembalikan DeepSeek di produksi
  const judge = (verdict: string, states: Record<string, 'ok' | 'gap' | 'rest'>) => ({ ...fixtureAi, evaluate: async (i: TrialItem) => ({ verdict, reason: verdict === 'NOT_GRADED' ? 'insufficient-working' : null,
    value: null, misconceptionCode: null, revealedAnswer: null,
    evidence: i.concepts.map(c => { const s = Object.entries(states).find(([k]) => c.code.includes(k))?.[1] ?? 'rest';
      return { conceptCode: c.code, classification: s === 'ok' ? 'UNDERSTANDING_DEMONSTRATED' : s === 'gap' ? 'MISCONCEPTION_EVIDENCED' : 'INSUFFICIENT_EVIDENCE', rationale: s, refs: [], uncertaintyReasons: s === 'rest' ? ['INCOMPLETE_WORK'] : [] }; }) }) as any });
  const state = (e: { evidence: { conceptCode: string; classification: string }[] }, part: string) => e.evidence.find(x => x.conceptCode.includes(part))?.classification;

  const bola = await load('soal-bola');
  // 053: sin dipakai benar, nilai sin 30° salah → Sudut Istimewa, bukan pengecoh "pakai cos" (angkanya kebetulan sama)
  const r53 = await gradeTrial(judge('INCORRECT', { PROYEKSI: 'ok', PELURU: 'ok' }), bola, text('vᵧ = 20 × sin 30° = 20 × √3/2 = 17,3 m/s\nt = 2 × 17,3 : 10 = 3,46 s'));
  assert.equal(state(r53, 'SUDUT_ISTIMEWA'), 'MISCONCEPTION_EVIDENCED');
  assert.equal(state(r53, 'PROYEKSI'), 'UNDERSTANDING_DEMONSTRATED');
  // 058: tiga kesalahan sekaligus — pakai cos (penilai), cos 30° = ½ (tabel), hanya waktu naik (pengecoh)
  const r58 = await gradeTrial(judge('INCORRECT', { PROYEKSI: 'gap', SUDUT_ISTIMEWA: 'ok' }), bola, text('vᵧ = 20 × cos 30° = 20 × ½ = 10 m/s\nt = 10 : 10 = 1 s'));
  assert.deepEqual(['PROYEKSI', 'SUDUT_ISTIMEWA', 'PELURU'].map(k => state(r58, k)), ['MISCONCEPTION_EVIDENCED', 'MISCONCEPTION_EVIDENCED', 'MISCONCEPTION_EVIDENCED']);

  // 044: nilai tan 30° = 1/√3 benar → tanda salah dari penilai untuk Sudut Istimewa dicabut
  const menara = await load('soal-menara');
  const r44 = await gradeTrial(judge('INCORRECT', { SEGITIGA: 'gap', SUDUT_ISTIMEWA: 'gap' }), menara, text('tan 30° = 1/√3\ntan 30° = x / 20\nx = 20 × 1/√3 ≈ 11,5 m'));
  assert.equal(state(r44, 'SUDUT_ISTIMEWA'), 'UNDERSTANDING_DEMONSTRATED');
  assert.equal(state(r44, 'SEGITIGA'), 'MISCONCEPTION_EVIDENCED');

  // 031 / 024: berhenti di hasil antara yang benar → "sudah di jalur yang benar", langkah berikutnya menurut urutan penyelesaian
  const s = trialAssessment(load, judge('NOT_GRADED', {}));
  const batu = await s.diagnose('qa-batu', { sessionId: 'qa-batu', questionId: 'soal-batu', rawText: 'volume batu = 20 mL, lanjutnya gimana', responseMode: null });
  assert.equal(batu.assessment.title, 'Kamu sudah di jalur yang benar. Tinggal lanjutkan.');
  assert.ok(!batu.items.some((x: { state: string }) => x.state === 'gap'), 'tidak ada inti "perlu diperkuat"');
  const freezer = await s.diagnose('qa-freezer', { sessionId: 'qa-freezer', questionId: 'soal-freezer', rawText: '310 − 273 = 37 °C, habis itu bingung', responseMode: null });
  assert.equal(freezer.assessment.title, 'Kamu sudah di jalur yang benar. Tinggal lanjutkan.');
  assert.ok(!freezer.items.some((x: { state: string }) => x.state === 'gap'));
  const done = (await load('soal-freezer')).concepts;
  assert.equal(freezer.assessment.gap.name, done.find(c => c.code.includes('OPERASI_BILANGAN_BULAT'))!.title, 'langkah berikutnya: selisih suhu');
  assert.equal(batu.assessment.gap.name, (await load('soal-batu')).concepts.find(c => c.code.includes('BESARAN_DAN_SATUAN'))!.title, 'langkah berikutnya: ubah mL ke cm³');
});

test('special angle value used on another line counts (TC-PANDU-044); spacing does not change the text sent to AI (TC-PANDU-045/049)', async () => {
  const { specialAngleUses } = await import('../src/assessment/special-angles.js');
  const { canonicalText } = await import('../src/assessment/trial-ai.js');
  const uses = specialAngleUses('depan = x, samping = 20 m\ntan 30° = x / 20\nx = 20 × 1/√3 ≈ 11,5 m');
  assert.ok(uses.some(u => u.fn === 'tan' && u.angle === 30 && u.right));
  assert.equal(specialAngleUses('tan 30° = x / 20\nx = 20 × 10').length, 0, 'integers never count');
  assert.equal(specialAngleUses('x = 20 × 1/√3').length, 0, 'no trig named, no claim');
  assert.equal(canonicalText('tan 30° = x/20'), canonicalText('tan 30°  =  x / 20'));
});

test('TC-PANDU-049: "tan 30° = 20 / x, terus bingung" dinilai sama dengan "20/x" walau AI menjawab semua inti belum terlihat', async () => {
  const { gradeTrial } = await import('../src/assessment/trial.js');
  const menara = await load('soal-menara');
  const text = (t: string) => ({ schemaVersion: 1, responseType: 'TEXT', text: t, inputMode: 'TYPED' }) as any;
  // AI yang kadang menilai jawaban setengah jadi ini "belum ada langkah" (semua inti belum terlihat)
  const allRest = { ...fixtureAi, evaluate: async (i: TrialItem) => ({ verdict: 'NOT_GRADED', reason: 'insufficient-working', value: null, misconceptionCode: null, revealedAnswer: null,
    evidence: i.concepts.map(c => ({ conceptCode: c.code, classification: 'INSUFFICIENT_EVIDENCE', rationale: 'Langkah ini belum ada di jawabanmu.', refs: [], uncertaintyReasons: ['INCOMPLETE_WORK'] })) }) as any };
  const state = (e: { evidence: { conceptCode: string; classification: string }[] }, part: string) => e.evidence.find(x => x.conceptCode.includes(part))?.classification;
  const variants = ['tan 30° = 20 / x, terus bingung', 'tan 30° = 20/x, terus bingung', 'tan 30° = 20 /x, terus bingung', 'tan 30°=20/ x, terus bingung'];
  const results = await Promise.all(variants.map(t => gradeTrial(allRest, menara, text(t))));
  for (const [k, r] of results.entries()) {
    assert.equal(r.verdict, 'NOT_GRADED', variants[k]);
    assert.equal(state(r, 'SEGITIGA'), 'UNDERSTANDING_DEMONSTRATED', variants[k]);
    assert.equal(state(r, 'DEFINISI'), 'UNDERSTANDING_DEMONSTRATED', variants[k]);
    assert.equal(state(r, 'SUDUT_ISTIMEWA'), 'INSUFFICIENT_EVIDENCE', variants[k]);
    const seg = r.evidence.find(x => x.conceptCode.includes('SEGITIGA'))!;
    assert.ok(seg.refs.length === 1 && variants[k]!.includes((seg.refs[0] as { quote: string }).quote), 'sorotan dari teks asli');
  }
  // tanda salah dari AI tidak diubah oleh pola langkah
  const gapAi = { ...fixtureAi, evaluate: async (i: TrialItem) => ({ verdict: 'INCORRECT', reason: null, value: null, misconceptionCode: null, revealedAnswer: null,
    evidence: i.concepts.map(c => ({ conceptCode: c.code, classification: c.code.includes('DEFINISI') ? 'MISCONCEPTION_EVIDENCED' : 'INSUFFICIENT_EVIDENCE', rationale: 'x', refs: [], uncertaintyReasons: [] })) }) as any };
  assert.equal(state(await gradeTrial(gapAi, menara, text('tan 30° = 20 / x, terus bingung')), 'DEFINISI'), 'MISCONCEPTION_EVIDENCED');
  // diagnosis: sama untuk semua variasi spasi, "di jalur yang benar", langkah berikutnya Sudut Istimewa
  const s = trialAssessment(load, allRest);
  const titles = new Set<string>(), next = new Set<string>();
  for (const [k, t] of variants.entries()) {
    const d = await s.diagnose('qa-049-' + k, { sessionId: 'qa-049-' + k, questionId: 'soal-menara', rawText: t, responseMode: null });
    titles.add(d.assessment.title); next.add(d.assessment.gap?.name);
    assert.ok(!d.items.some((x: { state: string }) => x.state === 'gap'), 'tidak ada inti "perlu diperkuat"');
  }
  assert.deepEqual([...titles], ['Kamu sudah di jalur yang benar. Tinggal lanjutkan.']);
  assert.deepEqual([...next], [menara.concepts.find(c => c.code.includes('SUDUT_ISTIMEWA'))!.title]);
});
