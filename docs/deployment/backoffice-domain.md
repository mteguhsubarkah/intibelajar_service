# Backoffice melalui https://intibelajar.com/backoffice/

Domain access is an explicitly enabled, password-protected **development authoring** mode, not approval for a production staff system. All drafts, publication gates and privacy restrictions remain. No learner data is exposed, except on the opt-in **Akun (QA)** page described at the end of this document (`BACKOFFICE_ACCOUNTS=true`). Workforce IdP/MFA and authenticated per-person audit remain production gates. Local SSH mode stays the default when BACKOFFICE_PUBLIC_ORIGIN is absent.

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

## Halaman akun (QA): daftar dan hapus akun

Untuk uji coba dengan akun email yang terbatas, backoffice bisa menampilkan daftar akun terdaftar dan menghapus akun siswa.
Halaman ini **mati secara bawaan**. Selama `BACKOFFICE_ACCOUNTS` tidak diisi `true`, backoffice tidak tersambung ke
database siswa sama sekali dan tab "Akun (QA)" hanya menampilkan petunjuk ini.

Yang tampil per akun: nama, metode masuk (Google/Email), email, kelas, status, waktu daftar, dan terakhir masuk.

- **Email hanya ada untuk akun tautan email** (tersimpan terenkripsi, didekripsi dengan `APP_KEY`). Akun Google sengaja
  hanya menyimpan ID Google, tanpa email, jadi kenali dari nama, kelas, dan waktunya.
- **Hapus akun** memakai jalur yang sama dengan "Hapus akun" milik siswa (`DELETE /v1/me`): akun ditandai
  `DELETION_PENDING`, semua sesinya dicabut, lalu **`intibelajar-worker`** menghapus progres, riwayat, dan identitas
  masuknya serta membuat `erasure_receipt`. Tidak ada `DELETE` langsung ke tabel. Admin wajib mengetik ulang email
  (atau nama) akun sebelum tombol hapus aktif. Hanya akun siswa yang bisa dihapus dari sini.
- **Audit:** setiap kali halaman dibuka (`STAFF_VIEWED_ACCOUNTS`) dan setiap penghapusan (`STAFF_DELETION_REQUESTED`)
  dicatat di `audit_event` sebagai aktor `STAFF`, dengan nama user Basic Auth Nginx yang disimpan sebagai HMAC.

### Menyalakan

Backoffice memakai konfigurasi yang sama dengan API (`DATABASE_URL`, `APP_KEY`, dan lainnya). Tambahkan file `.env` API ke
service backoffice. systemd membaca `EnvironmentFile` sebagai root, jadi `.env` tetap `chmod 600`:

```bash
sudo systemctl edit intibelajar-backoffice
```

```ini
[Service]
EnvironmentFile=/var/www/intibelajar_service/.env
EnvironmentFile=/etc/intibelajar-backoffice.env
```

Lalu tambahkan satu baris di `/etc/intibelajar-backoffice.env`:

```dotenv
BACKOFFICE_ACCOUNTS=true
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart intibelajar-backoffice
journalctl -u intibelajar-backoffice -n 20 --no-pager   # harus ada: "Halaman akun aktif (BACKOFFICE_ACCOUNTS=true)"
systemctl is-active intibelajar-worker                  # harus active; worker yang menyelesaikan penghapusan
```

### Mematikan

Hapus baris `BACKOFFICE_ACCOUNTS=true`, lalu `sudo systemctl restart intibelajar-backoffice`. Matikan halaman ini setelah
masa uji coba: ini bukan pengganti sistem staf produksi (IdP, MFA, peran, dan audit per orang tetap gerbang produksi).
