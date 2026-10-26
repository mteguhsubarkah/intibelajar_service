# intibelajar.com: kondisi server dan cara update

Disusun 26 Oktober 2026 dari `history` server (Ubuntu, `ubuntu@VM-26-204-ubuntu`, IP 43.173.28.8). Semua perintah di
bawah dijalankan **di server lewat SSH**, kecuali bagian 2 (di PC). Panduan ini tidak menjalankan apa pun untuk Anda.

## 1. Kondisi server sekarang

| Bagian | Lokasi / cara jalan |
|---|---|
| Frontend | `/var/www/intibelajar`, branch `master-pre-test-1`, `npm run build` → `dist/`, disajikan Nginx |
| Backend API | `/var/www/intibelajar_service`, `.env` (chmod 600), systemd `intibelajar-api` (`src/main.ts`) |
| Worker | systemd `intibelajar-worker` (`src/worker.ts`): erasure, antrean diagnosis, **pengiriman email outbox** |
| Database | PostgreSQL paket Ubuntu, port 5432, database `intibelajar_dev`, user `intibelajar` |
| Nginx | `/etc/nginx/sites-available/intibelajar` (backup `.bak`): `/` → FE, `/v1` dan `/docs` → `127.0.0.1:8000`, `/planner/` |
| HTTPS | certbot (`--nginx --redirect`), sertifikat Let's Encrypt diperbarui otomatis |
| Backoffice | systemd `intibelajar-backoffice`, snippet `/etc/nginx/snippets/intibelajar-backoffice.conf`, Basic Auth `/etc/nginx/intibelajar-backoffice.htpasswd`, env `/etc/intibelajar-backoffice.env` |
| Katalog | draf `r7-20261025` dipublikasikan lewat `scripts/catalog/publish.ts` (backup sebelumnya di `~/backups/intibelajar/`) |
| Planner | `/var/www/intiverse-planner/index.html`, juga dijalankan `nohup python3 -m http.server 8085 --bind 0.0.0.0` |

## 2. Domain publik: mode runtime pilot

**Masalahnya.** Mode development (`NODE_ENV=development`) hanya menerima `APP_ORIGIN` loopback (`http://localhost:…`).
Setiap request yang mengubah data dicek: header `Origin` harus **persis** `APP_ORIGIN`. Browser di
`https://intibelajar.com` mengirim `Origin: https://intibelajar.com`, jadi di mode development semua aksi (login, cek
jawaban, simpan profil) dijawab `403 CSRF_FAILED`. GET tetap jalan, sehingga situs terlihat "hidup".

Cek apakah server sekarang kena:

```
curl -s -i -X POST https://intibelajar.com/v1/auth/guest -H 'Origin: https://intibelajar.com' -H 'Content-Type: application/json' -d '{}' | head -20
```

`403` + `CSRF_FAILED` berarti kena. Jangan menulis ulang header Origin di Nginx atau mematikan guard: itu membuka CSRF.

**Solusinya: mode pilot** (sejak 26 Oktober 2026, `RUNTIME_MODE=pilot`). Server menolak start kecuali semua syarat ini
terpenuhi:

| Syarat | Kenapa |
|---|---|
| `NODE_ENV=production` + `RUNTIME_MODE=pilot` | pasangan eksplisit; semua integrasi khusus dev (Google uji, DeepSeek, OCR, mailbox sintetis, log penilaian) otomatis mati |
| `APP_ORIGIN=https://intibelajar.com` persis | satu origin https publik; bukan http, IP, path, atau garis miring di akhir |
| `TRUST_PROXY=127.0.0.1` | hanya Nginx lokal yang dipercaya untuk `X-Forwarded-For` / `X-Forwarded-Proto` |
| `SYNTHETIC_FIXTURES` tidak `true` | tidak ada identitas sintetis |
| `SELF_ONBOARDING_CONSENT` dan `FEATURE_GUEST_TRIAL` tidak `true` | keduanya memberi izin otomatis; ditolak untuk pengguna nyata |

Yang berlaku di mode pilot:
- Pengecekan Origin tetap persis (`https://intibelajar.com`).
- Setiap aksi tulis harus tiba lewat https di Nginx.
- Rate limit dihitung per IP asli pengunjung, bukan semuanya `127.0.0.1`. `X-Forwarded-For` palsu dari luar diabaikan.
- Cookie tetap `__Host-`, `Secure`, `HttpOnly`, dan `SameSite=Lax`.

**`.env` untuk pilot.** Sebaiknya pakai database baru `intibelajar_pilot`, terpisah dari data uji `intibelajar_dev`:

```
NODE_ENV=production
RUNTIME_MODE=pilot
APP_ORIGIN=https://intibelajar.com
TRUST_PROXY=127.0.0.1
DATABASE_URL=postgresql://intibelajar:PASSWORD@127.0.0.1:5432/intibelajar_pilot
APP_KEY=HASIL_openssl_rand_-hex_32
HOST=127.0.0.1
PORT=8000
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=IntiBelajar <masuk@domain-terverifikasi>
```

**Nginx** di blok `server` HTTPS (yang dibuat certbot), untuk `/v1/` dan `/health/`:

```
location /v1/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`X-Forwarded-For $remote_addr` (bukan `$proxy_add_x_forwarded_for`) mengganti isi dari pengunjung, sehingga tidak ada
yang bisa dipalsukan. Setelah itu: `sudo nginx -t && sudo systemctl reload nginx`, lalu
`sudo systemctl restart intibelajar-api intibelajar-worker`.

**Cek:**
- `curl -s http://127.0.0.1:8000/health/ready` harus berisi `"environment":"pilot"` dan `"syntheticOnly":false`.
- Perintah `curl` POST di atas sekarang harus menjawab `FEATURE_DISABLED`, bukan `CSRF_FAILED`, karena akun percobaan
  tamu memang mati di pilot.
- `npm run pilot:check` menandai `PRODUCTION_RUNTIME` siap. Gate lain (consent, enrollment, privasi, AI) tetap belum siap.

**Batas yang jujur.** Mode pilot membuat runtime aman di domain publik; ia **bukan** izin memproses data murid. Yang
berjalan: login lewat email (Resend), sesi, dan profil. Login Google sekarang hanya untuk lokal. Yang belum:
- tidak ada jalur persetujuan yang aktif untuk pengguna nyata, jadi fitur belajar menjawab `403 CONSENT_REQUIRED`
  sampai consent dewasa (OD-02/OD-03) diimplementasikan;
- tamu tidak mendapat akun percobaan, jadi `/coba` untuk tamu tidak dinilai server;
- DeepSeek mati.

Ini disengaja: lebih baik ditolak daripada menyimpan data tanpa izin. Lihat `private-adult-pilot.md`.

## 3. Sebelum update: di PC

1. Commit dan push perubahan yang memang mau dinaikkan, di **kedua** repo:
   - frontend ke branch yang dipakai server (`master-pre-test-1`, atau ganti branch di server);
   - backend ke `main`.

   Saat ini banyak perubahan belum di-commit, dari beberapa sesi (Claude dan Codex). Review dulu, jangan `git add -A`
   tanpa melihat isinya.
2. Jalankan tes. Saat dokumen ini ditulis, suite backend penuh punya 13 kegagalan lama (lihat
   `docs/backend-implementation/evidence/guest-trial-2026-10-26/README.md`). Putuskan dulu sebelum naik; jangan
   mematikan tes supaya hijau.

## 4. Update rutin di server

Satu kali update = backup → backend → frontend → cek. Ada downtime singkat saat API berhenti.

**a. Backup database**

```
mkdir -p ~/backups/intibelajar && chmod 700 ~/backups/intibelajar
sudo -u postgres pg_dump -Fc -d intibelajar_dev > ~/backups/intibelajar/before-deploy-$(date +%Y%m%d-%H%M%S).dump
ls -lh ~/backups/intibelajar | tail -3
```

**b. Backend**

```
cd /var/www/intibelajar_service
git status                      # harus bersih; kalau ada perubahan lokal di server, selidiki dulu
sudo systemctl stop intibelajar-api intibelajar-worker
git pull --ff-only
npm ci                          # bukan --omit=dev: backend jalan lewat tsx
unset DATABASE_URL              # supaya .env yang dipakai, bukan variabel lama di shell
node --env-file=.env --import tsx src/migrate.ts up
sudo systemctl start intibelajar-api intibelajar-worker
sleep 3
curl -i http://127.0.0.1:8000/health/ready
```

`/health/ready` harus 200. Kalau 503 atau gagal:

```
sudo journalctl -u intibelajar-api -n 60 --no-pager
sudo journalctl -u intibelajar-worker -n 60 --no-pager
```

Update ini membawa migrasi baru: `0009` (self-onboarding), `0010` (email outbox), dan `0011` (akun percobaan tamu).
`migrate.ts up` memasangnya berurutan. Rollback migrasi menghapus data, jadi untuk kembali, restore backup langkah a.

**c. Variabel `.env` baru (opsional, pertimbangkan baik-baik)**

| Variabel | Fungsi | Catatan |
|---|---|---|
| `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` | email login sungguhan lewat outbox; worker yang mengirim | domain pengirim harus terverifikasi di Resend |
| `SELF_ONBOARDING_CONSENT=true` | username + kelas langsung mengaktifkan akun | memberi izin data, AI, dan gambar **otomatis**: **ditolak di mode pilot** (server tidak mau start) |
| `FEATURE_GUEST_TRIAL=true` | tamu `/coba` mendapat akun percobaan 24 jam | izin juga otomatis: **ditolak di mode pilot** |
| `GRADING_LOG` | **jangan diisi di server**: mencetak potongan jawaban ke journal | |

DeepSeek tidak akan aktif di server: kode hanya mengizinkannya pada database lokal sintetis `intibelajar_local_dev`.
Setelah mengubah `.env`: `sudo systemctl restart intibelajar-api intibelajar-worker`.

**d. Frontend**

```
cd /var/www/intibelajar
git status
git pull --ff-only
npm ci
npm run build
```

Build default memakai mode tamu. Untuk fitur akun dan kanonik, flag harus ada **saat build** (bukan secret):
`VITE_SLICE0=true VITE_CANONICAL_LEARNING=true VITE_API_BASE_URL= npm run build`. Pakai build berflag ini hanya
setelah API berjalan di mode pilot (bagian 2). Di mode development, aksi akun di domain publik gagal 403 `CSRF_FAILED`.
Ingat juga: di pilot, fitur belajar menjawab `CONSENT_REQUIRED` sampai consent dewasa ada.

**e. Cek akhir**

```
sudo nginx -t
curl -I https://intibelajar.com
curl -s https://intibelajar.com/v1/auth/session
sudo systemctl status intibelajar-api intibelajar-worker intibelajar-backoffice --no-pager
```

## 5. Rapikan yang rapuh

- **Planner di port 8085:** `nohup python3 -m http.server 8085 --bind 0.0.0.0` mati saat reboot, dan terbuka ke internet
  kalau port 8085 tidak ditutup firewall. Nginx sudah punya lokasi `/planner/`, jadi server python itu tidak
  diperlukan. Hentikan dengan `pkill -f 'http.server 8085'`, lalu cek `sudo ss -lntp | grep 8085` kosong.
- **Firewall:** `sudo ufw status`. Cukup 22, 80, 443 yang terbuka. 5432, 8000, dan 8085 jangan.
- **Backup off-server:** salin `~/backups/intibelajar/*.dump` ke tempat lain secara berkala, dan coba restore sesekali.

## 6. Kalau gagal

1. API tidak hidup setelah update: lihat `journalctl` (bagian 4b). Kesalahan `.env` biasanya muncul di baris pertama.
2. Migrasi gagal: service sengaja tetap berhenti. Perbaiki penyebabnya, jalankan ulang `migrate.ts up`, lalu start.
3. Perlu kembali ke data sebelum update (menghapus perubahan sesudah backup):

   ```
   sudo systemctl stop intibelajar-api intibelajar-worker
   sudo -u postgres pg_restore --clean --if-exists -d intibelajar_dev ~/backups/intibelajar/before-deploy-YYYYMMDD-HHMMSS.dump
   ```

   Lalu kembalikan kode ke commit sebelumnya (`git checkout <sha>`), `npm ci`, dan start ulang.
