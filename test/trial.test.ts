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
const service = (now?: () => number) => trialAssessment(load, async (revision, text, used) => {
  const ladder = manifest.questions.find(q => q.code === revision)!.rubric.tutorLadder!;
  const node = ladder.nodes.find(n => n.ask.toLowerCase() === text.toLowerCase()) ?? ladder.nodes[0]!;
  return { full: false, hint: false, text: node.text, quick: node.quick, hintsUsed: used };
}, now);
const body = { sessionId: 'guest-first-visit', questionId: 'soal-menara', topicId: 'trigonometri', hintOpened: false, responseMode: null, rawText: 'sin 30 = 20/x' };

test('trial: genuine catalog evaluation without user, learner or consent', async () => {
  const s = service();
  const result = await s.diagnose('browser-a', body);
  assert.equal(result.status, 'completed');
  assert.equal(result.assessment.tone, 'gap');
  assert.ok(result.items.some((x: any) => x.state === 'gap'));
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
  const broken = trialAssessment(async () => { throw new Error('database unavailable'); }, async () => null);
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
    const solution = await app.inject({ method: 'POST', url: '/v1/trial/solution', headers: { cookie }, payload: { ...body, reason: 'requested' } });
    assert.equal(solution.statusCode, 200, solution.body);
  } finally { await app.close(); }
});
