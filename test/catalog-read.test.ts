import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { sql } from 'kysely';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { rollbackTo } from './fixtures/db.js';
import { buildApp } from '../src/app.js';
import { contract } from '../src/platform/contract.js';
import { catalogReader } from '../src/catalog/read.js';
import { publish } from '../src/catalog/publisher.js';
import type { Manifest } from '../src/catalog/manifest.js';
import { reviewedFixture } from './fixtures/catalog.js';
// Slice 1 M3: public catalog reads. Every 2xx body is checked against openapi.yaml by the route wrapper
// (a contract violation would surface as 500), and again here for the operations we call.

const OPS: [string, string][] = [['/v1/subjects', 'listSubjects'], ['/v1/topics', 'listTopics'], ['/v1/topics/{topicId}', 'getTopic'], ['/v1/concepts', 'listConcepts'],
  ['/v1/concepts/{conceptId}', 'getConcept'], ['/v1/questions', 'listQuestions'], ['/v1/questions/{questionId}', 'getQuestion'], ['/v1/lessons/{lessonId}', 'getLesson']];
// Names that would carry a key, a rubric or graded feedback into a learner response.
const FORBIDDEN = new Set(['rubric', 'answer', 'answers', 'acceptedForms', 'misconceptionMap', 'finalAnswerEvidence', 'solutionPaths', 'workedSolution', 'feedback',
  'correct', 'correctOptionId', 'correctAnswerId', 'isCorrect', 'ok', 'value', 'explain', 'right', 'wrong', 'indicators', 'example', 'hints', 'evaluator']);

test('Slice 1 public catalog read API', async t => {
  const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname, /_test$/, 'Tests require a dedicated *_test database');
  const db = connect(config.databaseUrl);
  const { app } = await buildApp(config, { db, logStream: new Writable({ write(_chunk, _encoding, done) { done(); } }) });
  const get = async (url: string, headers: Record<string, string> = {}) => {
    const r = await app.inject({ method: 'GET', url, headers });
    return { status: r.statusCode, headers: r.headers, body: r.body ? JSON.parse(r.body) : undefined, raw: r.body };
  };
  const ok = async (url: string) => { const r = await get(url); assert.equal(r.status, 200, `${url}: ${r.raw}`); return r.body; };
  const fixture = reviewedFixture();
  const v2 = structuredClone(fixture) as Manifest;
  v2.release.version = 2;
  v2.topics.find(x => x.code === 'MAT.TRI')!.concepts.find(c => c.code === 'MAT.TRI.RADIAN')!.title = 'Radian (diperbarui)';
  v2.questions.find(x => x.code === 'MAT.TRI.Q.TANGGA_6M')!.body.prompt += ' (Pembulatan tidak diperlukan.)';
  v2.questions = v2.questions.filter(x => x.code !== 'MAT.EKS.Q.GAB_3X_SIN');
  for (const s of v2.sets.sets) s.items = s.items.filter(i => i !== 'MAT.EKS.Q.GAB_3X_SIN');
  try {
    await t.test('without a current release the catalog is empty, not an error', async () => {
      await migrate(db); await rollbackTo(db, '0001_slice0.up.sql'); await migrate(db);
      const r = await get('/v1/subjects');
      assert.equal(r.status, 200); assert.deepEqual(r.body, { items: [] }); assert.equal(r.headers.etag, '"0"');
      assert.equal((await get('/v1/topics/0192f6b0-1111-7222-8333-944455556666')).status, 404);
      assert.deepEqual(await ok('/v1/questions'), { items: [], nextCursor: null });
    });

    await publish(db, fixture);
    const topics = (await ok('/v1/topics')).items as { id: string; code: string }[];
    const tri = topics.find(x => x.code === 'MAT.TRI')!, eks = topics.find(x => x.code === 'MAT.EKS')!;
    const concepts = (await ok('/v1/concepts')).items as { id: string; code: string; legacyMapId?: string }[];
    const allQuestions = async (query = '', limit = 100) => {
      const items: { id: string; code: string; itemType: string; isCombined: boolean; topicIds: string[]; conceptIds: string[] }[] = [];
      let cursor: string | null = null;
      do { const page = await ok(`/v1/questions?limit=${limit}${query}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); items.push(...page.items); cursor = page.nextCursor; } while (cursor);
      return items;
    };
    const lessonIds = async () => (await sql<{ id: string }>`select id from micro_lesson order by code`.execute(db)).rows.map(r => r.id);

    await t.test('every catalog endpoint answers within the contract for every entity', async () => {
      assert.deepEqual(((await ok('/v1/subjects')).items as { code: string }[]).map(s => s.code).sort(), fixture.subjects.subjects.map(s => s.code).sort());
      assert.equal(topics.length, fixture.topics.length);
      for (const code of ['MAT', 'FIS', 'KIM', 'BIO'])
        assert.equal(((await ok(`/v1/topics?subjectCode=${code}`)).items as unknown[]).length, fixture.topics.filter(x => x.subject === code).length);
      assert.deepEqual(await ok('/v1/topics?subjectCode=NOPE'), { items: [] });
      for (const topic of topics) {
        const d = await ok(`/v1/topics/${topic.id}`);
        assert.equal(d.concepts.length, fixture.topics.find(x => x.code === topic.code)!.concepts.length);
      }
      assert.equal(concepts.length, fixture.topics.reduce((n, x) => n + x.concepts.length, 0));
      for (const c of concepts) await ok(`/v1/concepts/${c.id}`);
      const questions = await allQuestions();
      assert.equal(questions.length, fixture.questions.length);
      for (const q of questions) await ok(`/v1/questions/${q.id}`);
      for (const id of await lessonIds()) await ok(`/v1/lessons/${id}`);
      const detail = await ok(`/v1/topics/${tri.id}`);
      assert.ok(detail.prerequisiteEdges.length > 0 && detail.units.length === 6);
      assert.deepEqual(detail.relations.map((r: { toTopicId: string }) => r.toTopicId), [topics.find(x => x.code === 'MAT.VEK')!.id]);
    });

    await t.test('legacy alias lookup: a known alias gives its concept, an unknown one gives an empty list', async () => {
      const triC = await ok('/v1/concepts?legacyMapId=tri-c');
      assert.deepEqual(triC.items.map((c: { code: string }) => c.code), ['MAT.TRI.SEGITIGA_SIKU_SIKU']);
      assert.deepEqual(await ok('/v1/concepts?legacyMapId=tri-zz'), { items: [] });
      assert.deepEqual(await ok(`/v1/concepts?legacyMapId=tri-c&topicId=${eks.id}`), { items: [] });
      assert.equal((await ok(`/v1/concepts?topicId=${tri.id}`)).items.length, fixture.topics.find(x => x.code === 'MAT.TRI')!.concepts.length);
      const concept = await ok(`/v1/concepts/${triC.items[0].id}`);
      assert.ok(concept.lessons.length > 0 && concept.questionCount > 0 && concept.objectives.length > 0);
    });

    await t.test('question filters and combined items', async () => {
      const numeric = await allQuestions('&itemType=NUMERIC');
      assert.deepEqual(numeric.map(q => q.code), ['MAT.TRI.Q.TRIG_DEPRESSION_01', 'MAT.TRI.Q.TRIG_DEPRESSION_01_RETRY']);
      const inEks = await allQuestions(`&topicId=${eks.id}`);
      assert.ok(inEks.length > 0 && inEks.every(q => q.topicIds.includes(eks.id)));
      const combinedEks = inEks.filter(q => q.isCombined);
      assert.ok(combinedEks.length > 0 && combinedEks.every(q => q.topicIds.length === 2), 'gabungan items touching Eksponen have assessable concepts in two topics');
      assert.ok(inEks.filter(q => !q.isCombined).every(q => q.topicIds.length === 1), 'every other Eksponen item stays inside its topic');
      const triC = concepts.find(c => c.legacyMapId === 'tri-c')!;
      const byConcept = await allQuestions(`&conceptId=${triC.id}`);
      assert.ok(byConcept.length > 0 && byConcept.every(q => q.conceptIds.includes(triC.id)));
      // Gabungan = konsep yang dinilai berasal dari dua bab atau lebih; jumlahnya dihitung dari manifest yang sama.
      const topicOf = new Map(fixture.topics.flatMap(t => t.concepts.map(c => [c.code, t.code] as const)));
      const combined = fixture.questions.filter(q => new Set(q.concepts.filter(c => c.assessable).map(c => topicOf.get(c.concept))).size >= 2).length;
      assert.ok(combined >= 4);
      assert.equal((await allQuestions()).filter(q => q.isCombined).length, combined);
    });

    await t.test('pagination is complete, ordered and tamper-proof', async () => {
      const full = await allQuestions('', 100), paged = await allQuestions('', 7);
      assert.deepEqual(paged.map(q => q.code), full.map(q => q.code));
      assert.equal(new Set(paged.map(q => q.id)).size, paged.length);
      const first = await ok('/v1/questions?limit=7');
      const cursor = first.nextCursor as string;
      assert.ok(cursor);
      const bad = async (query: string) => { const r = await get(`/v1/questions?${query}`); assert.equal(r.status, 400, query); assert.equal(r.body.code, 'VALIDATION_FAILED'); };
      const flipped = cursor.slice(0, 5) + (cursor[5] === 'A' ? 'B' : 'A') + cursor.slice(6);
      await bad(`cursor=${encodeURIComponent(flipped)}`);
      await bad(`cursor=${encodeURIComponent(cursor)}&itemType=NUMERIC`);
      await bad(`cursor=not-a-cursor`);
      const current = (await sql<{ id: string }>`select id from curriculum_release where is_current`.execute(db)).rows[0]!.id;
      const expired = catalogReader(config.key).encodeCursor('MAT', {}, current, Date.now() - 2 * 86400_000);
      await bad(`cursor=${encodeURIComponent(expired)}`);
      for (const q of ['limit=0', 'limit=101', 'limit=abc', 'limit=07', 'limit=5&limit=6', 'itemType=ESSAY', 'topicId=not-a-uuid', 'unknown=1']) await bad(q);
    });

    await t.test('INV-05.1: no catalog response schema can carry a key, rubric or graded feedback', () => {
      const names = new Set<string>(), seen = new Set<unknown>();
      const walk = (node: unknown): void => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        const o = node as Record<string, unknown>;
        if (typeof o.$ref === 'string') return walk(contract.components.schemas[o.$ref.split('/').pop()!]);
        if (o.properties) Object.keys(o.properties).forEach(k => names.add(k));
        Object.values(o).forEach(walk);
      };
      for (const [path] of OPS) for (const response of Object.values(contract.paths[path].get.responses as Record<string, { content?: unknown }>)) walk(response.content);
      assert.ok(names.has('prompt') && names.has('options'), 'the scan reached the question schemas');
      assert.deepEqual([...names].filter(n => FORBIDDEN.has(n)), []);
    });

    await t.test('INV-05.2: no catalog response contains a key, rubric text or graded feedback', async () => {
      const bodies: { url: string; text: string; body: unknown }[] = [];
      const collect = async (url: string) => { const body = await ok(url); bodies.push({ url, text: JSON.stringify(body), body }); return body; };
      await collect('/v1/subjects'); await collect('/v1/topics'); await collect('/v1/concepts');
      for (const x of topics) await collect(`/v1/topics/${x.id}`);
      for (const c of concepts) await collect(`/v1/concepts/${c.id}`);
      for (const q of await allQuestions('', 5)) await collect(`/v1/questions/${q.id}`);
      let cursor: string | null = null;
      do { const page = await collect(`/v1/questions?limit=5${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); cursor = (page as { nextCursor: string | null }).nextCursor; } while (cursor);
      for (const id of await lessonIds()) await collect(`/v1/lessons/${id}`);
      // Structural: no forbidden key at any depth.
      const keys = (node: unknown, out: string[] = []): string[] => {
        if (Array.isArray(node)) node.forEach(n => keys(n, out));
        else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { out.push(k); keys(v, out); }
        return out;
      };
      for (const b of bodies) assert.deepEqual(keys(b.body).filter(k => FORBIDDEN.has(k)), [], b.url);
      // Textual: rubric-only strings never appear anywhere.
      const secrets = new Set<string>();
      for (const q of fixture.questions) {
        const r = q.rubric;
        [r.feedback?.correct, r.feedback?.incorrect, ...(r.workedSolution?.steps.flatMap(s => [s.body]) ?? []), ...(r.workedSolution?.after ?? []),
          ...r.misconceptionMap.map(m => m.explanation)].forEach(s => s && s.length >= 12 && secrets.add(s));
      }
      for (const c of fixture.topics.flatMap(x => x.concepts)) for (const m of c.misconceptions) [m.example, ...m.indicators].forEach(s => s && secrets.add(s));
      assert.ok(secrets.size > 40);
      // Authored content that works the same example as a rubric. Not a key leak, but an exposure the content
      // reviewers must decide on (plan 03 §9). Each entry must keep matching, so the list cannot go stale.
      const KNOWN_EXPOSURES = [{ secret: 'tan 30° = 20 / x', codes: ['MAT.TRI.Q.T13_CHECK_2', 'MAT.TRI.L.MENCARI_SISI_YANG_BELUM_DIKETAHUI'],
        reason: 'The T13 lesson and its check 2 work the tower question itself (20 m, 30°), which is the worked solution of SOAL_MENARA / TRIG_DEPRESSION_01' }];
      const allowed = new Set(KNOWN_EXPOSURES.flatMap(e => e.codes));
      const without = (node: unknown): unknown => Array.isArray(node) ? node.map(without)
        : node && typeof node === 'object' ? ((node as { code?: string }).code && allowed.has((node as { code: string }).code) ? null
          : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, without(v)]))) : node;
      for (const b of bodies) {
        const text = JSON.stringify(without(b.body));
        for (const s of secrets) assert.ok(!text.includes(JSON.stringify(s).slice(1, -1)), `${b.url} leaks rubric text: ${s}`);
      }
      for (const e of KNOWN_EXPOSURES) for (const code of e.codes)
        assert.ok(bodies.some(b => (b.body as { code?: string }).code === code && b.text.includes(e.secret)), `stale known exposure: ${code}`);
      // Per question: its own views never contain its non-option answer forms or value.
      const answerForms = (q: Manifest['questions'][number]) => q.rubric.evaluator === 'option-v1' ? [] : [
        ...q.rubric.acceptedForms, ...(q.rubric.answer.value === undefined ? [] : [q.rubric.answer.value.toFixed(2), q.rubric.answer.value.toFixed(2).replace('.', ',')])];
      const views = bodies.filter(b => b.url.startsWith('/v1/questions/'));
      for (const view of views) {
        const code = (view.body as { code: string }).code, q = fixture.questions.find(x => x.code === code)!;
        for (const form of answerForms(q)) assert.ok(!view.text.includes(form), `${code} reveals its answer "${form}"`);
      }
    });

    await t.test('ETag revalidation on subjects, topics and topic detail', async () => {
      for (const url of ['/v1/subjects', '/v1/topics', `/v1/topics/${tri.id}`]) {
        const first = await get(url);
        assert.match(String(first.headers.etag), /^"1-[0-9a-f]{16}"$/);
        assert.equal(first.headers['cache-control'], 'public, max-age=60');
        for (const tag of [first.headers.etag as string, `W/${first.headers.etag}`, `"x", ${first.headers.etag}`, '*']) {
          const again = await get(url, { 'if-none-match': tag });
          assert.equal(again.status, 304, tag); assert.equal(again.raw, '');
        }
        assert.equal((await get(url, { 'if-none-match': '"0"' })).status, 200);
      }
      assert.equal((await get('/v1/concepts')).headers['cache-control'], 'no-store', 'only the operations with a declared ETag are publicly cacheable');
    });

    await t.test('unknown ids are a safe 404; malformed ids are 400', async () => {
      for (const path of ['topics', 'concepts', 'questions', 'lessons']) {
        const r = await get(`/v1/${path}/0192f6b0-1111-7222-8333-944455556666`);
        assert.equal(r.status, 404); assert.equal(r.body.code, 'NOT_FOUND');
        assert.equal((await get(`/v1/${path}/123`)).status, 400);
      }
      assert.equal((await get(`/v1/concepts/${tri.id}`)).status, 404, 'a topic id is not a concept');
    });

    await t.test('a new release is served on the next request: new revisions, retired items, new ETag', async () => {
      const oldTag = (await get('/v1/subjects')).headers.etag as string;
      const before = await allQuestions();
      const tangga = before.find(q => q.code === 'MAT.TRI.Q.TANGGA_6M')!, removed = before.find(q => q.code === 'MAT.EKS.Q.GAB_3X_SIN')!;
      const oldView = await ok(`/v1/questions/${tangga.id}`);
      const oldCursor = (await ok('/v1/questions?limit=3')).nextCursor as string;
      const lesson = (await sql<{ id: string }>`select id from micro_lesson where code = 'MAT.TRI.L.SUDUT_ISTIMEWA'`.execute(db)).rows[0]!.id;
      assert.equal((await ok(`/v1/lessons/${lesson}`)).contentVersion, 1);
      await publish(db, v2);
      const tagged = await get('/v1/subjects', { 'if-none-match': oldTag });
      assert.equal(tagged.status, 200); assert.match(String(tagged.headers.etag), /^"2-/);
      const view = await ok(`/v1/questions/${tangga.id}`);
      assert.notEqual(view.revisionId, oldView.revisionId); assert.match(view.prompt, /Pembulatan tidak diperlukan/);
      assert.equal((await get(`/v1/questions/${removed.id}`)).status, 404);
      assert.ok(!(await allQuestions()).some(q => q.id === removed.id));
      const radian = concepts.find(c => c.code === 'MAT.TRI.RADIAN')!;
      assert.equal((await ok(`/v1/concepts/${radian.id}`)).title, 'Radian (diperbarui)');
      assert.equal((await get(`/v1/questions?limit=3&cursor=${encodeURIComponent(oldCursor)}`)).status, 400, 'a cursor is bound to its release');
      assert.equal((await ok(`/v1/lessons/${lesson}`)).contentVersion, 1, 'unchanged lesson keeps its revision');
    });
  } finally { await app.close(); await db.destroy(); }
});
