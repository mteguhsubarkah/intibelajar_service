import {readFileSync,writeFileSync} from 'node:fs';
const file='scripts/local/vite.mjs';let s=readFileSync(file,'utf8');
s=s.replace("const buttons = [[", "const buttons = [['ai', 'Masuk sebagai Uji AI Sintetis', 'Consent AI simulasi. Provider hanya menerima tiga teks buatan yang tercantum di panduan.'], [");
s=s.replace('Jalur materi → quick check → retry lengkap masih menunggu D3; hint tutor menunggu D6. AI tetap mati.', 'Materi → cek pemahaman → retry sudah terhubung ke server. IntiBot memakai petunjuk bernaskah yang dibatasi pada soal aktif. DeepSeek hanya aktif jika dikonfigurasi secara eksplisit; lihat panduan lokal.');
s=s.replace('<p><a href="/">Beranda</a>', '<p>Contoh khusus DeepSeek (salin persis, hanya akun Uji AI Sintetis): <code>Saya memilih sinus karena saya mengira jarak mendatar adalah sisi miring.</code></p><p><a href="/">Beranda</a>');
writeFileSync(file,s);
const launcher='scripts/local-dev.mjs';let l=readFileSync(launcher,'utf8');
l=l.replace('D3/D6/OD-11 and B-01/B-02 remain open. Test fixtures are not content/consent approval. No AI or deployment.', 'D3/D6 local flow available. B-01/B-02 remain backlog. Synthetic identities/consents only. DeepSeek requires explicit configuration; no deployment.');writeFileSync(launcher,l);
const prepare='scripts/local/prepare.ts';writeFileSync(prepare,readFileSync(prepare,'utf8').replace('3 fixture accounts ready','4 fixture accounts ready'));
