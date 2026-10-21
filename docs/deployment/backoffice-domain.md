# Backoffice melalui https://intibelajar.com/backoffice/

Domain access is an explicitly enabled, password-protected **development authoring** mode, not approval for a production staff system. All drafts, publication gates and privacy restrictions remain. No learner data is exposed. Workforce IdP/MFA and authenticated per-person audit remain production gates. Local SSH mode stays the default when BACKOFFICE_PUBLIC_ORIGIN is absent.

## 1. Prasyarat dan update kode

Pastikan `https://intibelajar.com` sudah mempunyai sertifikat valid. Jika HTTPS belum bekerja, selesaikan Certbot lebih dulu; jangan menggunakan admin pada HTTP. Port 8010 tetap bind localhost dan firewall tidak dibuka. Kode perubahan harus sudah di-commit/push agar server bisa menariknya; sesi ini tidak melakukan push atau remote deployment.

Jika menjalankan npm ci pada checkout yang sama dengan API/worker siswa, hentikan proses-proses terkait terlebih dahulu sesuai runbook update sebelumnya; npm ci mengganti node_modules bersama. Tarik commit yang sudah ditinjau, install dependencies, jalankan `npm run backoffice:verify`, lalu hidupkan kembali layanan. Jangan hapus `.local/backoffice/`. Backup folder itu ke lokasi privat sebelum update.

## 2. Buat akun pintu masuk Nginx

```bash
sudo apt update
sudo apt install -y apache2-utils

# File baru: gunakan -c HANYA bila belum ada. Perintah meminta password secara interaktif.
sudo htpasswd -B -C 12 -c /etc/nginx/intibelajar-backoffice.htpasswd admin
sudo chown root:www-data /etc/nginx/intibelajar-backoffice.htpasswd
sudo chmod 640 /etc/nginx/intibelajar-backoffice.htpasswd
```

Gunakan password baru yang berbeda dari password DB. Untuk menambah/mengubah akun pada file yang sudah ada, **hilangkan -c** agar akun lain tidak terhapus. Password tidak ditulis ke shell command, Git, atau chat. Pada Ubuntu standar worker Nginx memakai www-data; periksa bila server memakai user lain.

## 3. Aktifkan mode domain hanya untuk backoffice

```bash
sudo nano /etc/intibelajar-backoffice.env
```

Isi:

```dotenv
BACKOFFICE_PUBLIC_ORIGIN=https://intibelajar.com
```

```bash
sudo chmod 600 /etc/intibelajar-backoffice.env
```

Unit service backoffice terbaru sudah memuat `EnvironmentFile=-/etc/intibelajar-backoffice.env`. Bila service sudah dibuat dengan versi lama, tambahkan baris itu pada bagian [Service], atau gunakan drop-in:

```bash
sudo systemctl edit intibelajar-backoffice
```

Isi:

```ini
[Service]
EnvironmentFile=/etc/intibelajar-backoffice.env
```

Jika belum ada service, pasang template `docs/deployment/templates/intibelajar-backoffice.service` dan template worker dari runbook backoffice, sesuaikan user/path Node. Mode domain tidak memerlukan perubahan `APP_ORIGIN` atau `src/config.ts` API siswa.

```bash
sudo systemctl daemon-reload
sudo systemctl restart intibelajar-backoffice
```

## 4. Pasang proxy pada server block HTTPS yang ada

```bash
sudo install -m 644 docs/deployment/templates/backoffice-nginx.conf /etc/nginx/snippets/intibelajar-backoffice.conf
sudo nano /etc/nginx/sites-available/intibelajar
```

Tambahkan **di dalam server block yang listen 443 ssl untuk intibelajar.com**, bukan server HTTP redirect:

```nginx
include /etc/nginx/snippets/intibelajar-backoffice.conf;
```

Tidak menimpa root Vue, /planner/, /v1/ atau /docs. Snippet memakai `^~` agar asset backoffice tidak tertangkap regex static FE, Basic Auth pada seluruh subtree, overwrite header identity dengan `$remote_user`, HTTPS check, body limit dan proxy loopback. `proxy_pass http://127.0.0.1:8010/` sengaja mempunyai trailing slash untuk menghapus prefix `/backoffice/`.

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://intibelajar.com/backoffice/
```

Tanpa login hasil yang benar adalah **401 Unauthorized**, bukan halaman admin 200. Cek dengan login (curl akan meminta password):

```bash
curl -u admin -I https://intibelajar.com/backoffice/
```

Hasil login yang benar 200. Di browser buka `https://intibelajar.com/backoffice/`, masukkan username/password Nginx, kemudian access key studio. Key dilihat sendiri melalui:

```bash
cd /var/www/intibelajar_service
cat .local/backoffice/access-key
```

Ada dua lapis login: Nginx dan access key. Browser mengirim key memakai X-Backoffice-Key agar tidak menimpa Authorization Basic yang diperlukan Nginx. Jangan proxy ulang subtree admin melalui jalur anonim. Jangan memakai wildcard domain/Origin atau mempercayai header identity dari pengunjung.

Logout studio menghapus key dalam aplikasi tetapi browser dapat menyimpan login HTTP Basic sampai sesi browser berakhir. Untuk komputer bersama, tutup jendela privat setelah selesai; ini bukan sistem SSO/MFA. Pada domain yang sama, keamanan JS Vue dan library FE juga penting karena backoffice masih satu origin; gunakan subdomain admin dengan SSO/MFA sebelum memperluas akses staff sungguhan.

## Tes dan batas verifikasi

Tes `test/backoffice.test.ts` menambahkan kasus HTTPS/domain, header proxy login, sumber request loopback, Basic Authorization bersamaan access key, asset relatif untuk prefix, dan Origin mutation. Nginx snippet mengacu [HTTP Basic resmi Nginx](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html) dan [proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass). Nginx/sertifikat/password di Ubuntu belum diubah atau diuji dari sesi lokal ini; lakukan nginx -t dan curl di atas pada server.

Hasil lokal: verifikasi `2026-10-21T00-35-39-420Z` pada Node 24.19.0 lulus typecheck, module boundaries, syntax browser, dan 8/8 kelompok tes (termasuk OpenAPI). Evidence disimpan di `docs/backend-implementation/evidence/backoffice-2026-10-21/2026-10-21T00-35-39-420Z/`. Tidak ada perubahan ke origin/kontrak API siswa, database learner, atau publikasi katalog.
