import Fastify from 'fastify';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lintManifest } from '../../src/catalog/manifest.js';
import { Store, OfficeError, command, enqueue, EDITABLE_EVALUATORS } from './store.js';
import { readConfig, type Config } from '../../src/config.js';
import { connect, type DB } from '../../src/db.js';
import { ApiError, messages } from '../../src/platform/errors.js';
import { staffAccounts, type StaffAccount } from '../../src/identity/staff.js';
import { staffDeletion, staffLearners, staffViewedAccounts, type StaffLearner } from '../../src/privacy/staff.js';

/* Halaman akun (BACKOFFICE_ACCOUNTS=true): daftar akun dan hapus akun untuk uji coba QA. Tanpa flag, backoffice tetap
   tidak tersambung ke database siswa. Lihat docs/deployment/backoffice-domain.md bagian "Halaman akun". */
export interface AccountsAccess { db: DB; config: Config }
const PROVIDER_LABEL = { GOOGLE: 'Google', EMAIL: 'Email' } as const;
/** Teks yang harus diketik ulang admin sebelum menghapus: email, lalu nama, lalu potongan id. */
export function accountLabel(a: StaffAccount, l?: StaffLearner) {
  return a.identities.find(i => i.email)?.email ?? l?.displayName ?? 'akun-' + a.userId.slice(0, 8);
}
function accountView(a: StaffAccount, l?: StaffLearner) {
  const email = a.identities.find(i => i.email)?.email ?? null;
  const lastLoginAt = a.identities.map(i => i.lastLoginAt).filter((x): x is string => !!x).sort().at(-1) ?? null;
  return { userId: a.userId, role: a.role, label: accountLabel(a, l), displayName: l?.displayName ?? null, grade: l?.grade ?? null,
    methods: a.identities.map(i => PROVIDER_LABEL[i.provider]), email,
    emailNote: email ? null : a.identities.some(i => i.provider === 'GOOGLE') ? 'Akun Google: email tidak disimpan' : a.trial ? 'Akun percobaan tamu' : null,
    status: l?.status ?? a.status, createdAt: a.createdAt, lastLoginAt, deletable: a.role === 'STUDENT' && l?.status !== 'DELETION_PENDING' };
}

export function buildBackoffice(store: Store, token: string, port = 8010, publicOrigin?: string, previewOrigin?: string, accounts?: AccountsAccess) {
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
    if (e instanceof ApiError) return reply.code(e.status).send({ message: messages[e.code] ?? e.code });
    if ((e as {statusCode?:number}).statusCode === 400 || (e as {statusCode?:number}).statusCode === 413)
      return reply.code((e as {statusCode:number}).statusCode).send({message:'Body tidak valid / terlalu besar'});
    return reply.code(500).send({ message: 'Gagal menyimpan draf; tidak ada publikasi dilakukan' });
  });
  for (const [url, file, type] of [['/', 'index.html', 'text/html'], ['/app.js', 'app.js', 'text/javascript'], ['/catalog-view.js','catalog-view.js','text/javascript'], ['/lesson-editor.js','lesson-editor.js','text/javascript'], ['/practice-editor.js','practice-editor.js','text/javascript'], ['/animation-templates.js','animation-templates.js','text/javascript'], ['/accounts-view.js','accounts-view.js','text/javascript'], ['/report.css','report.css','text/css'], ['/style.css', 'style.css', 'text/css'], ['/openapi.yaml', 'openapi.yaml', 'application/yaml']])
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
  // Siapa admin yang bertindak: user Basic Auth dari Nginx (mode domain) atau sesi SSH lokal.
  const staffName = (req: { headers: Record<string, string | string[] | undefined> }) =>
    domain ? String(req.headers['x-backoffice-user']).trim().slice(0, 64) : 'ssh-lokal';
  app.get('/api/accounts', async req => {
    if (!accounts) return { enabled: false };
    const list = await staffAccounts(accounts.db, accounts.config.key);
    const learners = await staffLearners(accounts.db, list.flatMap(a => a.learnerId ? [a.learnerId] : []));
    await staffViewedAccounts(accounts.db, accounts.config, staffName(req), list.length);
    return { enabled: true, staff: staffName(req), accounts: list.map(a => accountView(a, a.learnerId ? learners.get(a.learnerId) : undefined)) };
  });
  app.post('/api/accounts/deletions', async (req, reply) => {
    if (!accounts) throw new OfficeError(404, 'Halaman akun belum dinyalakan di server (BACKOFFICE_ACCOUNTS).');
    const b = req.body as { userId?: unknown; confirm?: unknown } | null;
    if (!b || typeof b.userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.userId) || typeof b.confirm !== 'string' || b.confirm.length > 300)
      throw new OfficeError(400, 'userId dan teks konfirmasi wajib');
    const [account] = await staffAccounts(accounts.db, accounts.config.key, { userId: b.userId });
    if (!account) throw new OfficeError(404, 'Akun tidak ditemukan (mungkin sudah terhapus)');
    if (account.role !== 'STUDENT' || !account.learnerId) throw new OfficeError(422, 'Hanya akun siswa yang bisa dihapus dari sini');
    const learner = (await staffLearners(accounts.db, [account.learnerId])).get(account.learnerId);
    const label = accountLabel(account, learner);
    if (b.confirm.trim() !== label) throw new OfficeError(400, `Konfirmasi tidak cocok. Ketik persis: ${label}`);
    if (learner?.status === 'DELETION_PENDING') throw new OfficeError(409, 'Akun ini sudah dalam antrean hapus');
    const result = await accounts.db.transaction().execute(tx => staffDeletion(tx, accounts.config, account.learnerId!, staffName(req)));
    return reply.code(202).send({ ...result, label });
  });
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
  // Halaman akun hanya bila diminta eksplisit; konfigurasinya sama dengan API (DATABASE_URL, APP_KEY, dst.).
  let accounts: AccountsAccess | undefined;
  if (process.env.BACKOFFICE_ACCOUNTS === 'true') { const config = readConfig(process.env); accounts = { db: connect(config.databaseUrl), config }; }
  const app = buildBackoffice(store, key, port, publicOrigin, process.env.BACKOFFICE_PREVIEW_ORIGIN || undefined, accounts);
  const stop = () => { void app.close().then(() => accounts?.db.destroy()); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  await app.listen({ host: '127.0.0.1', port });
  console.log(publicOrigin ? `Backoffice protected proxy: ${publicOrigin}/backoffice/; access key: ${keyFile}`
    : `Backoffice privat: http://localhost:${port}; access key tersimpan di ${keyFile}. Jangan proxy ke publik tanpa konfigurasi mode HTTPS.`);
  if (accounts) console.log('Halaman akun aktif (BACKOFFICE_ACCOUNTS=true): daftar dan hapus akun siswa; setiap akses tercatat di audit_event.');
}
