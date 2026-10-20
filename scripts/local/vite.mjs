import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Development harness only: not imported by the application, not built into dist.
const frontend = resolve(process.env.FRONTEND_DIR ?? '../mockup/intibelajar');
const directory = resolve('.local/local-dev');
const origin = 'http://localhost:5180';
if (process.env.NODE_ENV !== 'development' || process.env.SYNTHETIC_FIXTURES !== 'true' || process.env.APP_ORIGIN !== origin || new URL(process.env.DATABASE_URL).pathname !== '/intibelajar_local_dev') throw new Error('The fixture launcher is local synthetic development only');
Object.assign(process.env, { VITE_SLICE0: 'true', VITE_CANONICAL_LEARNING: 'true', VITE_LEARNING_MODE: 'demo',
  VITE_API_BASE_URL: '', VITE_BACKEND_FALLBACK: 'true', VITE_TRACK_URL: '' });
mkdirSync(join(directory, 'empty-env'), { recursive: true });
const { createServer } = await import(pathToFileURL(join(frontend, 'node_modules/vite/dist/node/index.js')).href);
const { default: vue } = await import(pathToFileURL(join(frontend, 'node_modules/@vitejs/plugin-vue/dist/index.mjs')).href);
const { personas, syntheticOnly } = JSON.parse(readFileSync(join(directory, 'personas.json'), 'utf8'));
if (!syntheticOnly) throw new Error('Not a synthetic fixture');
const nonce = randomBytes(24).toString('hex');
const csrfValid = value => typeof value === 'string' && /^[a-f0-9]{48}$/.test(value) && timingSafeEqual(Buffer.from(value), Buffer.from(nonce));
const buttons = [['ocr', 'Masuk sebagai Uji OCR Sintetis', 'Izin belajar/AI/gambar simulasi; hanya gunakan gambar buatan.'], ['ai', 'Masuk sebagai Uji AI Sintetis', 'Consent AI simulasi. Provider hanya menerima tiga teks buatan yang tercantum di panduan.'], ['student', 'Masuk sebagai Uji Lokal A', 'Akun dengan izin sintetis awal; status selanjutnya mengikuti database.'], ['studentB', 'Masuk sebagai Uji Lokal B', 'Akun lain untuk uji pemisahan data.'], ['pending', 'Masuk akun tanpa izin', 'Untuk membuktikan endpoint belajar menolak consent yang belum ada.'], ['guest', 'Coba sebagai tamu', 'Tanpa akun; alur demo tetap di perangkat.']];
const page = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Uji lokal IntiBelajar</title><style>body{font:16px/1.6 system-ui;max-width:760px;padding:32px 22px;margin:auto;color:#193b32;background:#f7faf7}h1{line-height:1.2}small,p{color:#526a5d}.notice{padding:16px;background:#fff0d0;border-radius:8px}form{padding:15px 0;border-bottom:1px solid #d8e2d8}button{border:0;border-radius:6px;background:#25664b;color:white;padding:12px 16px;font:600 14px system-ui;cursor:pointer}small{display:block;margin-top:8px}a{color:#25664b}</style><h1>FE + BE lokal</h1><p class="notice"><strong>Hanya data uji.</strong> Identitas, persetujuan, dan tanda review katalog di sini adalah fixture sintetis, bukan verifikasi atau approval produksi.</p><p>Pilih akun, lalu tes <strong>/coba</strong>, <strong>/challenge</strong>, atau <strong>/latihan/soal?set=gabungan</strong>. Akun A/B memakai API; tamu tetap memakai demo perangkat. Buka halaman ini lagi untuk mengganti akun.</p>${buttons.map(([id,label,note])=>`<form action="/__local/session" method="post"><input type="hidden" name="csrf" value="${nonce}"><input type="hidden" name="persona" value="${id}"><button>${label}</button><small>${note}</small></form>`).join('')}<p>Refresh sesi dan diagnosis sudah tersedia. Materi → cek pemahaman → retry sudah terhubung ke server. IntiBot memakai petunjuk bernaskah yang dibatasi pada soal aktif. DeepSeek hanya aktif jika dikonfigurasi secara eksplisit; lihat panduan lokal. B-01/B-02 belum ditutup.</p><p>Untuk menguji alur lengkap yang sudah tersedia, coba latihan gabungan atau diagnosis soal menara. Jawaban contoh menara: <code>sin 30 = 20/x</code>.</p><p>Contoh khusus DeepSeek (salin persis, hanya akun Uji AI Sintetis): <code>Saya memilih sinus karena saya mengira jarak mendatar adalah sisi miring.</code></p><p><a href="/__local/ocr-fixture.png" download>Unduh gambar OCR sintetis</a> (buat dengan make-ocr-fixture.mjs).</p><p><a href="/">Beranda</a> · <a href="/v1/auth/session">Cek sesi API</a></p></html>`;
const server = await createServer({
  configFile: false, root: frontend, envDir: join(directory, 'empty-env'),
  cacheDir: join(directory, 'vite-cache'),
  plugins: [vue(), { name: 'local-synthetic-fixtures-only', configureServer(dev) {
    dev.middlewares.use(async (req, res, next) => {
      const path = new URL(req.url ?? '/', origin).pathname;
      if(req.method==='GET' && path === '/__local/ocr-fixture.png' && existsSync(join(directory,'ocr-synthetic.png'))){res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.end(readFileSync(join(directory,'ocr-synthetic.png')));return;}
      if (path !== '/__local' && path !== '/__local/session') return next();
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
      if (req.headers.host !== 'localhost:5180') { res.statusCode = 403; res.end('Use http://localhost:5180/__local'); return; }
      if (req.method === 'GET' && path === '/__local') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page); return; }
      if (req.method !== 'POST' || path !== '/__local/session') { res.statusCode = 405; res.end('Method not allowed'); return; }
      if (req.headers.origin !== origin || !String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded')) { res.statusCode = 403; res.end('Same-origin form required'); return; }
      try {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 2048) { res.statusCode = 413; res.end('Request too large'); return; } }
        const fields = new URLSearchParams(body), persona = fields.get('persona');
        if (!csrfValid(fields.get('csrf')) || !(persona === 'guest' || Object.hasOwn(personas, persona ?? ''))) { res.statusCode = 403; res.end('Invalid fixture selection'); return; }
        const value = persona === 'guest' ? '' : personas[persona].value;
        if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid fixture cookie');
        res.setHeader('Set-Cookie', `__Host-ib_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${persona === 'guest' ? '0' : '86400'}`);
        // Redirect through a clean document, so cached CSRF and per-screen state from the old account are discarded.
        res.statusCode = 303; res.setHeader('Location', '/coba'); res.end();
      } catch { res.statusCode = 400; res.end('Invalid local form'); }
    });
  }}],
  resolve: { alias: { '@': join(frontend, 'src') } },
  optimizeDeps: { entries: ['index.html'] },
  server: { host: '127.0.0.1', port: 5180, strictPort: true, proxy: {
    '/v1': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    '/docs': { target: 'http://127.0.0.1:8000', changeOrigin: false },
  } },
});
await server.listen();
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await server.close(); process.exit(); });
