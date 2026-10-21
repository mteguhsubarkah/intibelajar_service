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
