import Fastify from 'fastify';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lintManifest } from '../../src/catalog/manifest.js';
import { Store, OfficeError, command, enqueue } from './store.js';

export function buildBackoffice(store: Store, token: string, port = 8010, publicOrigin?: string) {
  let domain: URL | undefined;
  if (publicOrigin) {
    domain = new URL(publicOrigin);
    if (domain.protocol !== 'https:' || domain.origin !== publicOrigin || domain.username || domain.password)
      throw new Error('BACKOFFICE_PUBLIC_ORIGIN must be an exact HTTPS origin');
  }
  const app = Fastify({ logger: false, bodyLimit: 32_768 });
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  const origins = domain ? [domain.origin] : hosts.map(h => `http://${h}`);
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer').header('X-Frame-Options', 'DENY')
      .header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
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
  for (const [url, file, type] of [['/', 'index.html', 'text/html'], ['/app.js', 'app.js', 'text/javascript'], ['/catalog-view.js','catalog-view.js','text/javascript'], ['/report.css','report.css','text/css'], ['/style.css', 'style.css', 'text/css'], ['/openapi.yaml', 'openapi.yaml', 'application/yaml']])
    app.get(url!, async (_req, reply) => reply.type(type!).send(readFileSync(new URL(`../../backoffice/${file}`, import.meta.url), 'utf8')));
  app.get('/api/state', async () => {
    const s = store.read();
    // Question answer keys are never sent to this authoring UI.
    const { topics, lessons, topicRelations, subjects } = s.manifest;
    return { revision: s.revision, topics, lessons, topicRelations, subjects, sources: s.sources, jobs: s.jobs,
      findings: lintManifest(s.manifest, { strict: true }), audit: s.audit.slice(-30) };
  });
  const body = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new OfficeError(400, 'Body JSON object diperlukan');
    const b = value as Record<string, unknown>;
    if (!Number.isSafeInteger(b.revision) || Number(b.revision) < 0) throw new OfficeError(400, 'Revision wajib');
    return b;
  };
  app.post('/api/commands', async req => { const b = body(req.body); store.change(Number(b.revision), `edit:${String(b.kind)}`, s => command(s, b)); return { saved: true, revision: store.read().revision }; });
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
  const app = buildBackoffice(store, key, port, publicOrigin);
  process.once('SIGTERM', () => { void app.close(); }); process.once('SIGINT', () => { void app.close(); });
  await app.listen({ host: '127.0.0.1', port });
  console.log(publicOrigin ? `Backoffice protected proxy: ${publicOrigin}/backoffice/; access key: ${keyFile}`
    : `Backoffice privat: http://localhost:${port}; access key tersimpan di ${keyFile}. Jangan proxy ke publik tanpa konfigurasi mode HTTPS.`);
}
