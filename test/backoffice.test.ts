import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store, command, enqueue, claim, importSeed, seedKey } from '../scripts/backoffice/store.js';
import { buildBackoffice } from '../scripts/backoffice/server.js';
import { lintManifest, loadManifest } from '../src/catalog/manifest.js';
import Parser from '@apidevtools/swagger-parser';

const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ib-backoffice-')), store = new Store(dir); store.init();
  return { dir, store, done: () => rmSync(dir, { recursive: true, force: true }) };
};
const topic = (code = 'MAT.TEST') => ({ kind: 'topic', code, title: 'Topik uji', phase: 'E' });
const core = (code = 'MAT.TEST.C01') => ({ kind: 'core', code, topic: 'MAT.TEST', title: 'Inti uji', definition: 'Definisi yang ditulis editor', objectives: 'Menjelaskan inti' });

test('backoffice: explicit subject on create, retained on edit, unknown and reassignment rejected', () => {
  const f=fixture();try{
    f.store.change(0,'create',s=>command(s,{...topic('FIS.TEST'),subject:'FIS'}));
    assert.equal(f.store.read().manifest.topics.find(t=>t.code==='FIS.TEST')?.subject,'FIS');
    f.store.change(1,'edit',s=>command(s,{...topic('FIS.TEST'),title:'Updated'}));
    assert.equal(f.store.read().manifest.topics.find(t=>t.code==='FIS.TEST')?.subject,'FIS');
    assert.throws(()=>f.store.change(2,'bad',s=>command(s,{...topic('FIS.TEST'),subject:'MAT'})));
    assert.throws(()=>f.store.change(2,'bad',s=>command(s,{...topic('ZZZ.TEST'),subject:'ZZZ'})));
    assert.equal(f.store.read().revision,2);
  }finally{f.done();}
});
test('backoffice: auth, exact Host, CSRF Origin, private data and response headers', async () => {
  const f = fixture(), app = buildBackoffice(f.store, 'a'.repeat(64));
  const headers = { host: 'localhost:8010', authorization: 'Bearer ' + 'a'.repeat(64) };
  try {
    assert.equal((await app.inject({ url: '/api/state', headers: { host: 'localhost:8010' } })).statusCode, 401);
    assert.equal((await app.inject({ url: '/api/state', headers: { ...headers, host: 'evil.example' } })).statusCode, 403);
    const r = await app.inject({ url: '/api/state', headers }); assert.equal(r.statusCode, 200);
    assert.equal(r.headers['cache-control'], 'no-store'); assert.match(String(r.headers['content-security-policy']), /frame-ancestors 'none'/);
    assert.equal(r.json().questions, undefined); assert.equal(r.json().manifest, undefined);
    for (const origin of [undefined, 'https://evil.example', 'http://localhost:8011']) {
      const r = await app.inject({ method: 'POST', url: '/api/commands', headers: { ...headers, ...(origin ? { origin } : {}) }, payload: { revision: 0, ...topic() } });
      assert.equal(r.statusCode, 403);
    }
    assert.equal(f.store.read().revision, 0);
    const good = await app.inject({ method: 'POST', url: '/api/commands', headers: { ...headers, origin: 'http://localhost:8010' }, payload: { revision: 0, ...topic() } });
    assert.equal(good.statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/api/commands', headers: { ...headers, origin: 'http://localhost:8010' }, payload: { revision: 0, ...topic('MAT.STALE') } })).statusCode, 409);
    assert.equal((await app.inject({ url: '/v1/topics', headers })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: '/api/publish', headers: { ...headers, origin: 'http://localhost:8010' }, payload: {} })).statusCode, 404);
  } finally { await app.close(); f.done(); }
});
test('backoffice: reject cyclic and unknown references atomically, no revision lost', () => {
  const f = fixture(); try {
    f.store.change(0, 'topic', s => command(s, topic()));
    f.store.change(1, 'core', s => command(s, core()));
    f.store.change(2, 'core', s => command(s, core('MAT.TEST.C02')));
    f.store.change(3, 'prereq', s => command(s, { kind: 'prerequisite', code: 'MAT.TEST.C02', to: 'MAT.TEST.C01', type: 'HARD' }));
    assert.throws(() => f.store.change(4, 'cycle', s => command(s, { kind: 'prerequisite', code: 'MAT.TEST.C01', to: 'MAT.TEST.C02', type: 'HARD' })), /valid/);
    assert.equal(f.store.read().revision, 4);
    assert.throws(() => f.store.change(4, 'unknown', s => command(s, { kind: 'relation', code: 'MAT.TEST', to: 'MAT.UNKNOWN', type: 'RELATED', label: 'Uji' })), /valid/);
    assert.throws(() => f.store.change(4, 'path', s => command(s, topic('../../escape'))), /Kode/);
    assert.equal(f.store.read().revision, 4);
  } finally { f.done(); }
});
test('backoffice: exactly two lesson slides, preservation of canonical manifest and strict review gate', () => {
  const f = fixture(), before = readFileSync('catalog/manifest/release.yaml', 'utf8');
  try {
    f.store.change(0, 'topic', s => command(s, topic())); f.store.change(1, 'core', s => command(s, core()));
    f.store.change(2, 'lesson', s => command(s, { kind: 'lesson', code: 'MAT.TEST.L01', title: 'Dua slide', concepts: 'MAT.TEST.C01', slide1: 'Pahami konsep', slide2: 'Terapkan konsep' }));
    const lesson = f.store.read().manifest.lessons.find(l => l.code === 'MAT.TEST.L01')!;
    assert.deepEqual(lesson.blocks.map(b => b.slide), [0, 1]); assert.equal(lesson.review?.status, 'PROPOSED');
    const result = f.store.export(), restored = loadManifest(result.directory);
    assert.equal(lintManifest(restored).filter(f => f.severity === 'error').length, 0);
    assert.ok(lintManifest(restored, { strict: true }).some(f => f.rule === 'UNREVIEWED'));
    assert.equal(readFileSync('catalog/manifest/release.yaml', 'utf8'), before);
    assert.equal(restored.release.signOff.status, 'PENDING');
  } finally { f.done(); }
});
test('backoffice worker: durable idempotent seed, lease fencing, recovery and no overwrite of edits', () => {
  const f = fixture(); try {
    const j = f.store.change(undefined, 'enqueue', enqueue); assert.equal(j.key, seedKey());
    const old = f.store.change(undefined, 'claim', s => claim(s, Date.now()))!;
    assert.equal(f.store.change(undefined, 'no double claim', s => claim(s, Date.now())), undefined);
    // Simulate process death with persisted expired lease; a new worker claims a different fencing token.
    f.store.change(undefined, 'expire', s => { s.jobs[0]!.leaseUntil = Date.now() - 1; });
    const recovered = f.store.change(undefined, 'recover', s => claim(s, Date.now()))!;
    assert.notEqual(old.leaseToken, recovered.leaseToken);
    assert.throws(() => f.store.change(undefined, 'stale', s => importSeed(s, old)), /Lease/);
    f.store.change(undefined, 'import', s => importSeed(s, recovered));
    assert.equal(f.store.read().jobs[0]!.status, 'DONE');
    const total = f.store.read().manifest.topics.length;
    assert.equal(f.store.change(undefined, 'dedupe', enqueue).id, j.id);
    const seeded = f.store.read().manifest.topics.find(t => t.code.startsWith('MAT.CP25.'))!;
    assert.ok(seeded);
    f.store.change(undefined, 'edit', s => command(s, { ...topic(seeded.code), title: 'Editor sudah memperbaiki ini' }));
    // A consciously retried job never replaces an editor's work.
    f.store.change(undefined, 'retry', s => { s.jobs[0]!.status = 'QUEUED'; s.jobs[0]!.attempts = 0; });
    const again = f.store.change(undefined, 'claim', s => claim(s, Date.now()))!;
    f.store.change(undefined, 'import', s => importSeed(s, again));
    assert.equal(f.store.read().manifest.topics.length, total);
    assert.equal(f.store.read().manifest.topics.find(t => t.code === seeded.code)!.title, 'Editor sudah memperbaiki ini');
    assert.equal(lintManifest(f.store.read().manifest).filter(f => f.severity === 'error').length, 0);
  } finally { f.done(); }
});
test('backoffice: failed mutation cannot partially persist, review cannot be supplied by client', () => {
  const f = fixture(); try {
    assert.throws(() => f.store.change(0, 'fail', s => { command(s, topic()); throw new Error('disk transaction aborted'); }), /aborted/);
    assert.equal(f.store.read().revision, 0);
    f.store.change(0, 'review injection', s => command(s, { ...topic(), review: { status: 'REVIEWED' } }));
    assert.equal(f.store.read().manifest.topics.find(t => t.code === 'MAT.TEST')!.review!.status, 'PROPOSED');
    assert.equal(f.store.read().manifest.release.signOff.status, 'PENDING');
    // Corrupt source pin fails before importing content.
    f.store.change(undefined, 'queue', enqueue);
    const j = f.store.change(undefined, 'claim', s => claim(s, Date.now()))!;
    assert.throws(() => f.store.change(undefined, 'bad key', s => importSeed(s, { ...j, key: 'bad' })), /Seed/);
  } finally { f.done(); }
});
test('backoffice: structured lesson and later-slide checks cannot be silently flattened', () => {
  const f = fixture(); try {
    const structured = f.store.read().manifest.lessons.find(l => l.blocks.some(b => b.type !== 'text' || b.slide > 1))!;
    assert.ok(structured);
    assert.throws(() => f.store.change(0, 'flatten', s => command(s, { kind: 'lesson', code: structured.code, title: 'Overwrite', concepts: structured.concepts.join(','), slide1: 'One', slide2: 'Two' })), /terstruktur/);
    assert.equal(f.store.read().revision, 0);
    assert.deepEqual(f.store.read().manifest.lessons.find(l => l.code === structured.code), structured);
  } finally { f.done(); }
});
test('backoffice: standalone OpenAPI 3.1 contract validates', async () => {
  await Parser.validate('backoffice/openapi.yaml');
});
test('backoffice HTTPS proxy: exact domain, transport, authenticated proxy, separate access key and Origin', async () => {
  const f = fixture(), token = 'b'.repeat(64);
  assert.throws(() => buildBackoffice(f.store, token, 8010, 'http://intibelajar.com'), /HTTPS/);
  assert.throws(() => buildBackoffice(f.store, token, 8010, 'https://intibelajar.com/'), /HTTPS/);
  const app = buildBackoffice(f.store, token, 8010, 'https://intibelajar.com');
  const h = { host: 'intibelajar.com', 'x-forwarded-proto': 'https', 'x-backoffice-user': 'owner', 'x-backoffice-key': token,
    authorization: 'Basic dXNlcjpwYXNz' };
  try {
    assert.equal((await app.inject({url:'/',headers:{host:'localhost:8010'}})).statusCode,403);
    for (const overrides of [{host:'www.intibelajar.com'},{'x-forwarded-proto':'http'},{'x-backoffice-user':''}])
      assert.equal((await app.inject({url:'/',headers:{...h,...overrides}})).statusCode,403);
    assert.equal((await app.inject({url:'/',headers:h,remoteAddress:'192.0.2.10'})).statusCode,403);
    assert.equal((await app.inject({url:'/api/state',headers:{...h,'x-backoffice-key':''}})).statusCode,401);
    assert.equal((await app.inject({url:'/api/state',headers:h})).statusCode,200);
    const page = await app.inject({url:'/',headers:h});
    assert.equal(page.statusCode,200); assert.match(page.body,/src="app.js"/); assert.match(page.body,/href="style.css"/);
    for (const origin of ['http://intibelajar.com','https://evil.example','http://localhost:8010'])
      assert.equal((await app.inject({method:'POST',url:'/api/commands',headers:{...h,origin},payload:{revision:0,...topic()}})).statusCode,403);
    assert.equal((await app.inject({method:'POST',url:'/api/commands',headers:{...h,origin:'https://intibelajar.com'},payload:{revision:0,...topic()}})).statusCode,200);
  } finally { await app.close(); f.done(); }
});

test('backoffice: structured lesson blocks are editable, validated, and keep checks on their slides', () => {
  const f = fixture(); try {
    const old = f.store.read().manifest.lessons.find(l => l.code === 'MAT.TRI.L.PERBANDINGAN_TRIG')!;
    assert.ok(old.checks.some(c => c.slideIndex === 1));
    const blocks = [{ type: 'heading', slide: 0, text: 'Pilih sisi' }, { type: 'math', slide: 0, name: 'tan θ', expression: 'depan / samping', highlight: true },
      { type: 'tip', slide: 1, text: 'Ingat **tan**.' }, { type: 'text', slide: 1, text: 'Contoh baru' }];
    f.store.change(0, 'edit', s => command(s, { kind: 'lesson-blocks', code: old.code, title: 'Perbandingan Trigonometri', concepts: old.concepts, estimatedMinutes: 7, blocks }));
    const saved = f.store.read().manifest.lessons.find(l => l.code === old.code)!;
    assert.deepEqual(saved.blocks, blocks); assert.deepEqual(saved.checks, old.checks); assert.equal(saved.practiceSet, old.practiceSet); assert.equal(saved.estimatedMinutes, 7);
    // menghapus slide yang memegang cek, slide bolong, jenis/field asing, dan teks kosong ditolak
    const bad = [
      [{ type: 'text', slide: 0, text: 'satu slide saja' }],
      [{ type: 'text', slide: 0, text: 'a' }, { type: 'text', slide: 2, text: 'b' }],
      [{ type: 'html', slide: 0, text: '<b>x</b>' }],
      [{ type: 'text', slide: 0, text: '' }],
      [{ type: 'figure', slide: 0, figureRef: '../x' }],
    ];
    for (const b of bad) assert.throws(() => f.store.change(1, 'bad', s => command(s, { kind: 'lesson-blocks', code: old.code, title: 'x', concepts: old.concepts, blocks: b })));
    // materi baru untuk inti tanpa materi; field tambahan pada blok tidak ikut tersimpan
    f.store.change(1, 'new', s => command(s, { kind: 'lesson-blocks', code: 'MAT.TRI.L.UJI_BARU', title: 'Materi uji', concepts: 'MAT.TRI.RADIAN',
      blocks: [{ type: 'text', slide: 0, text: 'Halo', html: '<script>' }, { type: 'text', slide: 1, text: 'Dua' }] }));
    const fresh = f.store.read().manifest.lessons.find(l => l.code === 'MAT.TRI.L.UJI_BARU')!;
    assert.deepEqual(fresh.blocks[0], { type: 'text', slide: 0, text: 'Halo' }); assert.deepEqual(fresh.checks, []); assert.equal(fresh.review?.status, 'PROPOSED');
  } finally { f.done(); }
});

test('backoffice: practice questions per core, key write-only in state, readable per question', async () => {
  const f = fixture(), app = buildBackoffice(f.store, 'a'.repeat(64));
  const headers = { host: 'localhost:8010', authorization: 'Bearer ' + 'a'.repeat(64), origin: 'http://localhost:8010' };
  try {
    const before = f.store.read().manifest.questions.length;
    const mc = { kind: 'question', concept: 'MAT.TRI.RADIAN', itemType: 'MULTIPLE_CHOICE', prompt: '180° sama dengan …', options: ['π rad', '2π rad', 'π/2 rad'], answerIndex: 0,
      feedbackCorrect: '180° = π rad.', feedbackIncorrect: 'Ingat 360° = 2π rad.', difficulty: 1, estimatedMinutes: 1 };
    const r = await app.inject({ method: 'POST', url: '/api/commands', headers, payload: { revision: 0, ...mc } });
    assert.equal(r.statusCode, 200, r.body); const code = r.json().code as string;
    assert.match(code, /^MAT\.TRI\.Q\.RADIAN_\d+$/);
    const q = f.store.read().manifest.questions.find(x => x.code === code)!;
    assert.equal(f.store.read().manifest.questions.length, before + 1);
    assert.equal(q.rubric.evaluator, 'option-v1'); assert.equal(q.rubric.answer.optionId, 'a'); assert.deepEqual(q.concepts, [{ concept: 'MAT.TRI.RADIAN', role: 'PRIMARY', assessable: true }]);
    assert.equal(q.body.options?.length, 3); assert.equal('answer' in q.body, false);
    // daftar di state tanpa kunci; kunci hanya di detail satu soal
    const state = (await app.inject({ url: '/api/state', headers })).json();
    const item = state.practice.find((x: { code: string }) => x.code === code);
    assert.ok(item); assert.equal(JSON.stringify(state.practice).includes('optionId'), false); assert.equal(item.rubric, undefined); assert.equal(item.answerIndex, undefined);
    assert.match(state.previewUrl, /\/pratinjau\/materi$/);
    const detail = (await app.inject({ url: '/api/questions/' + code, headers })).json();
    assert.equal(detail.answerIndex, 0); assert.equal(detail.feedbackCorrect, '180° = π rad.');
    // edit: kunci pindah ke pilihan kedua; tanpa kunci ditolak; jenis tidak boleh diganti
    f.store.change(1, 'edit', s => command(s, { ...mc, code, answerIndex: 1 }));
    assert.equal(f.store.read().manifest.questions.find(x => x.code === code)!.rubric.answer.optionId, 'b');
    assert.throws(() => f.store.change(2, 'bad', s => command(s, { ...mc, code, answerIndex: -1 })));
    assert.throws(() => f.store.change(2, 'bad', s => command(s, { ...mc, code, itemType: 'NUMERIC', answerValue: 3 })));
    assert.throws(() => f.store.change(2, 'bad', s => command(s, { ...mc, options: ['sama', 'sama'] })));
    // soal angka
    const n = f.store.change(2, 'num', s => command(s, { kind: 'question', concept: 'MAT.TRI.RADIAN', itemType: 'NUMERIC', prompt: 'π rad = … derajat', answerValue: '180', unit: '°' })) as string;
    const nq = f.store.read().manifest.questions.find(x => x.code === n)!;
    assert.equal(nq.rubric.evaluator, 'numeric-v1'); assert.equal(nq.rubric.answer.value, 180); assert.deepEqual(nq.rubric.answer.tolerance, { relative: 0.02, floor: 1 });
    // soal berpenilai khusus tidak bisa diedit dari studio
    const tower = f.store.read().manifest.questions.find(x => x.rubric.evaluator === 'tower-v1')!;
    assert.equal((await app.inject({ url: '/api/questions/' + tower.code, headers })).statusCode, 422);
    assert.equal(lintManifest(f.store.read().manifest).filter(x => x.severity === 'error').length, 0);
  } finally { await app.close(); f.done(); }
});

test('backoffice: preview frame allowed only for the configured app origin', async () => {
  const f = fixture();
  try {
    const local = buildBackoffice(f.store, 'a'.repeat(64));
    const r = await local.inject({ url: '/', headers: { host: 'localhost:8010' } });
    assert.match(String(r.headers['content-security-policy']), /frame-src http:\/\/localhost:5180;/);
    assert.match(String(r.headers['content-security-policy']), /frame-ancestors 'none'/);
    assert.throws(() => buildBackoffice(f.store, 'a'.repeat(64), 8010, undefined, 'http://evil.example'));
    assert.throws(() => buildBackoffice(f.store, 'a'.repeat(64), 8010, undefined, 'https://intibelajar.com/path'));
    await local.close();
  } finally { f.done(); }
});

test('backoffice: animation code block is stored as data with limits, and projected to the learner API shape', async () => {
  const f = fixture(); try {
    const old = f.store.read().manifest.lessons.find(l => l.code === 'MAT.TRI.L.PERBANDINGAN_TRIG')!;
    const anim = { type: 'code', slide: 0, label: 'Animasi tanda di kuadran', height: 380, html: '<svg id="s"></svg>', css: 'svg{width:100%}', js: 'document.getElementById("s")' };
    const blocks = [...old.blocks.filter(b => b.slide === 0), anim, ...old.blocks.filter(b => b.slide > 0)];
    f.store.change(0, 'anim', s => command(s, { kind: 'lesson-blocks', code: old.code, title: old.title, concepts: old.concepts, blocks }));
    const saved = f.store.read().manifest.lessons.find(l => l.code === old.code)!;
    assert.deepEqual(saved.blocks.find(b => b.type === 'code'), anim);
    assert.equal(lintManifest(f.store.read().manifest).filter(x => x.severity === 'error').length, 0);
    const bad = [
      { ...anim, html: '', js: '' },
      { ...anim, height: 2000 },
      { ...anim, label: '' },
      { ...anim, js: 'x'.repeat(24001) },
      { ...anim, html: 7 },
    ];
    for (const b of bad) assert.throws(() => f.store.change(1, 'bad', s => command(s, { kind: 'lesson-blocks', code: old.code, title: old.title, concepts: old.concepts, blocks: [...old.blocks, b] })));
    // API siswa: blok animasi diteruskan apa adanya dan lolos kontrak OpenAPI /v1/lessons/{id}
    const { lessonView } = await import('../src/catalog/projection.js');
    const { validateResponse } = await import('../src/platform/contract.js');
    const view = lessonView({ id: '00000000-0000-4000-8000-000000000001', code: saved.code, route_slug: null, practice_set: null, revision: 1, title: saved.title,
      estimated_minutes: saved.estimatedMinutes, blocks: saved.blocks, conceptIds: ['00000000-0000-4000-8000-000000000002'], checks: [] }, () => undefined);
    assert.deepEqual(view.blocks.find(b => b.type === 'code'), anim);
    assert.doesNotThrow(() => validateResponse('/v1/lessons/{lessonId}', 'get', 200, view));
  } finally { f.done(); }
});
