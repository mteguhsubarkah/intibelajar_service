import Fastify from 'fastify';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lintManifest } from '../../src/catalog/manifest.js';
import { Store, OfficeError, command, enqueue, EDITABLE_EVALUATORS } from './store.js';

export function buildBackoffice(store: Store, token: string, port = 8010, publicOrigin?: string, previewOrigin?: string) {
  let domain: URL | undefined;
  if (publicOrigin) {
    domain = new URL(publicOrigin);
    if (domain.protocol !== 'https:' || domain.origin !== publicOrigin || domain.username || domain.password)
      throw new Error('BACKOFFICE_PUBLIC_ORIGIN must be an exact HTTPS origin');
  }
  // Pratinjau materi memakai halaman aplikasi siswa sendiri (/pratinjau/materi) di dalam iframe.
  const preview = previewOrigin ?? domain?.origin ?? 'http://localhost:5180';
  { const u = new URL(preview); if (!['https:', 'http:'].includes(u.protocol) || u.origin !== preview || (u.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(u.hostname)))
    throw new Error('BACKOFFICE_PREVIEW_ORIGIN must be an exact HTTPS origin (or http://localhost)'); }
  // Materi dengan animasi kode bisa sampai batas katalog 64 KB per materi.
  const app = Fastify({ logger: false, bodyLimit: 131_072 });
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  const origins = domain ? [domain.origin] : hosts.map(h => `http://${h}`);
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer').header('X-Frame-Options', 'DENY')
      .header('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src ${preview}; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'`);
    if (domain) {
      // Forwarded headers are accepted only from the same-host TLS/authenticated reverse proxy.
      if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.ip) || req.headers.host !== domain.host
        || req.headers['x-forwarded-proto'] !== 'https' || typeof req.headers['x-backoffice-user'] !== 'string'
        || !req.headers['x-backoffice-user'].trim()) throw new OfficeError(403, 'Proxy HTTPS dan login admin diperlukan');
    } else if (!hosts.includes(req.headers.host ?? '')) throw new OfficeError(403, 'Host ditolak; gunakan SSH tunnel localhost');
    if (req.url.startsWith('/api/')) {
      // Separate header preserves the browser's HTTP Basic Authorization for Nginx.
      const custom = req.headers['x-backoffice-key'];
      const sent = Buffer.from(typeof custom === 'string' ? custom : req.headers.authorization ?? '');
      const expected = Buffer.from(typeof custom === 'string' ? token : `Bearer ${token}`);
      if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) throw new OfficeError(401, 'Access key salah');
      if (!['GET','HEAD'].includes(req.method) && !origins.includes(req.headers.origin ?? '')) throw new OfficeError(403, 'Origin ditolak');
    }
  });
  app.setErrorHandler((e, _req, reply) => {
    if (e instanceof OfficeError) return reply.code(e.status).send({ message: e.message, details: e.details });
    if ((e as {statusCode?:number}).statusCode === 400 || (e as {statusCode?:number}).statusCode === 413)
      return reply.code((e as {statusCode:number}).statusCode).send({message:'Body tidak valid / terlalu besar'});
    return reply.code(500).send({ message: 'Gagal menyimpan draf; tidak ada publikasi dilakukan' });
  });
  for (const [url, file, type] of [['/', 'index.html', 'text/html'], ['/app.js', 'app.js', 'text/javascript'], ['/catalog-view.js','catalog-view.js','text/javascript'], ['/lesson-editor.js','lesson-editor.js','text/javascript'], ['/practice-editor.js','practice-editor.js','text/javascript'], ['/animation-templates.js','animation-templates.js','text/javascript'], ['/report.css','report.css','text/css'], ['/style.css', 'style.css', 'text/css'], ['/openapi.yaml', 'openapi.yaml', 'application/yaml']])
    app.get(url!, async (_req, reply) => reply.type(type!).send(readFileSync(new URL(`../../backoffice/${file}`, import.meta.url), 'utf8')));
  app.get('/api/state', async () => {
    const s = store.read();
    // Question answer keys are never sent to this authoring UI.
    const { topics, lessons, topicRelations, subjects } = s.manifest;
    // Latihan inti: ringkasan tanpa kunci; kunci soal hanya dikirim saat satu soal dibuka untuk diedit.
    const practice = s.manifest.questions.filter(q => q.concepts.some(c => c.role === 'PRIMARY' && c.assessable)).map(q => ({
      code: q.code, concepts: q.concepts.filter(c => c.role === 'PRIMARY' && c.assessable).map(c => c.concept), only: q.concepts.length === 1,
      itemType: q.itemType, editable: EDITABLE_EVALUATORS.has(q.rubric.evaluator), prompt: q.body.prompt, options: (q.body.options ?? []).map(o => o.label),
      difficulty: q.difficulty, estimatedMinutes: q.estimatedMinutes, review: q.review?.status ?? null }));
    return { revision: s.revision, topics, lessons, topicRelations, subjects, practice, previewUrl: `${preview}/pratinjau/materi`, sources: s.sources, jobs: s.jobs,
      findings: lintManifest(s.manifest, { strict: true }), audit: s.audit.slice(-30) };
  });
  app.get('/api/questions/:code', async req => {
    const q = store.read().manifest.questions.find(x => x.code === (req.params as { code: string }).code);
    if (!q) throw new OfficeError(404, 'Soal tidak ditemukan');
    if (!EDITABLE_EVALUATORS.has(q.rubric.evaluator)) throw new OfficeError(422, 'Soal ini memakai penilai khusus; edit lewat manifest');
    const options = q.body.options ?? [], key = options.findIndex(o => o.id === q.rubric.answer.optionId);
    return { code: q.code, concept: q.concepts.find(c => c.role === 'PRIMARY')?.concept, itemType: q.itemType, prompt: q.body.prompt, options: options.map(o => o.label),
      answerIndex: key < 0 ? null : key, answerValue: q.rubric.answer.value ?? null, unit: q.rubric.answer.unit ?? '', answerExample: q.body.answerExample ?? '',
      feedbackCorrect: q.rubric.feedback?.correct ?? '', feedbackIncorrect: q.rubric.feedback?.incorrect ?? '', difficulty: q.difficulty, estimatedMinutes: q.estimatedMinutes,
      legacy: Boolean(q.legacyOptionOrder) };
  });
  const body = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new OfficeError(400, 'Body JSON object diperlukan');
    const b = value as Record<string, unknown>;
    if (!Number.isSafeInteger(b.revision) || Number(b.revision) < 0) throw new OfficeError(400, 'Revision wajib');
    return b;
  };
  app.post('/api/commands', async req => { const b = body(req.body); const code = store.change(Number(b.revision), `edit:${String(b.kind)}`, s => command(s, b)); return { saved: true, revision: store.read().revision, ...(typeof code === 'string' ? { code } : {}) }; });
  app.post('/api/imports', async (req, reply) => { const b = body(req.body); const j = store.change(Number(b.revision), 'enqueue:curriculum', enqueue); return reply.code(202).send(j); });
  app.post('/api/exports', async req => { const b = body(req.body); if (b.revision !== store.read().revision) throw new OfficeError(409, 'Muat ulang draf'); return store.export(); });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.BACKOFFICE_PORT ?? 8010);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid BACKOFFICE_PORT');
  const store = new Store(); store.init();
  const keyFile = join(store.dir, 'access-key');
  if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString('hex'), { mode: 0o600 });
  const key = readFileSync(keyFile, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid access-key file');
  const publicOrigin = process.env.BACKOFFICE_PUBLIC_ORIGIN || undefined;
  const app = buildBackoffice(store, key, port, publicOrigin, process.env.BACKOFFICE_PREVIEW_ORIGIN || undefined);
  process.once('SIGTERM', () => { void app.close(); }); process.once('SIGINT', () => { void app.close(); });
  await app.listen({ host: '127.0.0.1', port });
  console.log(publicOrigin ? `Backoffice protected proxy: ${publicOrigin}/backoffice/; access key: ${keyFile}`
    : `Backoffice privat: http://localhost:${port}; access key tersimpan di ${keyFile}. Jangan proxy ke publik tanpa konfigurasi mode HTTPS.`);
}
