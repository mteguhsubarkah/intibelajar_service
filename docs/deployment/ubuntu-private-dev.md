# Ubuntu 24.04 + PuTTY: lingkungan uji privat

Target: frontend demo + proses backend/worker di Ubuntu, diakses hanya lewat SSH tunnel. Bukan deploy produksi. Mode `production`, origin domain publik, dan binding publik masih ditolak `src/config.ts`. Panduan ini mempertahankan pembatasan tersebut. Tidak memublikasikan katalog PROPOSED atau mengaktifkan integrasi yang belum tersedia.

Belum ada perintah yang dijalankan pada server Anda. Contoh mengasumsikan **server Ubuntu 24.04 baru**, login awal punya sudo, SSH port 22, dua repository memakai branch `main`, dan semua data buatan untuk tes. Kalau server sudah menjalankan aplikasi lain, sesuaikan konfigurasi Nginx/firewall terlebih dahulu.

## 1. Persiapan dan instalasi (di terminal PuTTY)

Siapkan IP server, akun SSH, akses dua repository, dan SSH key untuk GitHub. Domain belum diperlukan. Jangan kirim password/private key melalui chat.

```bash
cat /etc/os-release
uname -m
sudo apt update
sudo apt install -y git curl ca-certificates xz-utils openssl nginx postgresql postgresql-client ufw
sudo systemctl enable --now postgresql nginx
sudo -u postgres psql -c 'SHOW server_version;'
```

PostgreSQL harus 16+. Ubuntu 24.04 menyediakan versi yang sesuai melalui paket distro. Tidak perlu PM2 karena memakai systemd. Tidak perlu Docker, Redis, atau Kubernetes di server.

Pada **server baru** dengan SSH port 22, izinkan SSH sebelum mengaktifkan firewall. Jika memakai port lain, ganti aturan SSH sesuai port itu. Cloud firewall juga cukup membuka port SSH; 5173/8000/5432 tidak dibuka ke internet.

```bash
sudo ufw allow 22/tcp
sudo ufw enable
sudo ufw status
```

Pasang Node versi yang sama dengan evidence proyek: 24.19.0. Ini pin untuk reproduksi; pembaruan keamanan berikutnya harus diuji, bukan diganti diam-diam.

```bash
set -euo pipefail
NODE_VERSION=v24.19.0
case "$(uname -m)" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64) NODE_ARCH=arm64 ;;
  *) echo 'Arsitektur belum didukung panduan ini'; exit 1 ;;
esac
NODE_PACKAGE="node-${NODE_VERSION}-linux-${NODE_ARCH}"
NODE_TMP=$(mktemp -d)
cd "$NODE_TMP"
curl -fsSLO "https://nodejs.org/dist/${NODE_VERSION}/${NODE_PACKAGE}.tar.xz"
curl -fsSLO "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt"
grep " ${NODE_PACKAGE}.tar.xz$" SHASUMS256.txt | sha256sum --check --strict
sudo tar -xJf "${NODE_PACKAGE}.tar.xz" -C /opt
sudo ln -sfn "/opt/${NODE_PACKAGE}/bin/node" /usr/local/bin/node
sudo ln -sfn "/opt/${NODE_PACKAGE}/bin/npm" /usr/local/bin/npm
sudo ln -sfn "/opt/${NODE_PACKAGE}/bin/npx" /usr/local/bin/npx
node -v
npm -v
```

Download berasal dari HTTPS resmi dan checksum harus cocok. Untuk verifikasi provenance tambahan, Node menyediakan signed SHASUMS. Hentikan jika download/checksum gagal.

## 2. Akun aplikasi dan tarik Git

Masih sebagai akun admin Ubuntu:

```bash
sudo adduser --disabled-password --gecos '' deploy
sudo install -d -o deploy -g deploy -m 755 /srv/intibelajar
sudo -iu deploy
cd /srv/intibelajar
install -d -m 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/backend_repo -N '' -C intibelajar-backend-readonly
ssh-keygen -t ed25519 -f ~/.ssh/frontend_repo -N '' -C intibelajar-frontend-readonly
cat ~/.ssh/backend_repo.pub
cat ~/.ssh/frontend_repo.pub
```

Tambahkan masing-masing **public key** ke repository terkait: Settings → Deploy keys, read-only. Dua repository memakai dua key berbeda. Buat `nano ~/.ssh/config`:

```sshconfig
Host github-backend
  HostName github.com
  User git
  IdentityFile ~/.ssh/backend_repo
  IdentitiesOnly yes
Host github-frontend
  HostName github.com
  User git
  IdentityFile ~/.ssh/frontend_repo
  IdentitiesOnly yes
```

```bash
chmod 600 ~/.ssh/config
git clone git@github-backend:mteguhsubarkah/intibelajar_service.git backend
# Ganti OWNER/REPO_FRONTEND dengan repository frontend sebenarnya.
git clone git@github-frontend:OWNER/REPO_FRONTEND.git frontend
```

Saat koneksi GitHub pertama, cocokkan fingerprint dengan [fingerprint SSH resmi GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints), baru terima host key. Commit lokal yang belum di-push tidak akan ikut clone. Push hanya commit yang memang sudah Anda pilih/review.

## 3. Database dan environment

Ketik `exit` untuk kembali dari akun deploy ke admin. Buat database **khusus lingkungan privat ini**:

```bash
sudo -u postgres createuser --pwprompt intibelajar
sudo -u postgres createdb --owner=intibelajar intibelajar_dev
sudo -iu deploy
cd /srv/intibelajar/backend
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
nano .env
```

Isi `.env` (password DB pilih karakter URL-safe seperti huruf/angka/hex; key hasil openssl tetap rahasia):

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://intibelajar:GANTI_PASSWORD_DB@127.0.0.1:5432/intibelajar_dev
APP_ORIGIN=http://localhost:5173
APP_KEY=GANTI_DENGAN_64_KARAKTER_HEX_HASIL_OPENSSL
SYNTHETIC_FIXTURES=false
HOST=127.0.0.1
PORT=8000
FEATURE_LEGACY_FACADE=false
```

Biarkan flag false untuk demo awal. Login/email/guardian provider akan mengembalikan integration blocker; ini memang belum terkonfigurasi. Untuk uji akun buatan secara privat, `SYNTHETIC_FIXTURES=true` mengaktifkan simulator `.invalid` saja, bukan verifikasi identitas/consent sungguhan. Frontend awal di bawah tetap guest demo lokal; bukan bukti alur canonical sudah selesai.

Untuk backup otomatis, buat `nano ~/.pgpass`, isi satu baris dengan password DB yang sama:

```text
127.0.0.1:5432:intibelajar_dev:intibelajar:GANTI_PASSWORD_DB
```

```bash
chmod 600 ~/.pgpass
```

## 4. Menjaga proses hidup dan menyajikan frontend

Kembali ke admin dengan `exit`. Buat `sudo nano /etc/systemd/system/intibelajar-api.service`:

```ini
[Unit]
Description=IntiBelajar private development API
After=network.target postgresql.service
Requires=postgresql.service
[Service]
User=deploy
Group=deploy
WorkingDirectory=/srv/intibelajar/backend
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/node --env-file=.env --import tsx src/main.ts
Restart=on-failure
RestartSec=5
UMask=0077
[Install]
WantedBy=multi-user.target
```

Salin untuk worker, lalu ubah Description dan `src/main.ts` menjadi `src/worker.ts`:

```bash
sudo cp /etc/systemd/system/intibelajar-api.service /etc/systemd/system/intibelajar-worker.service
sudo nano /etc/systemd/system/intibelajar-worker.service
sudo systemctl daemon-reload
sudo systemctl enable intibelajar-api.service intibelajar-worker.service
```

Buat `sudo nano /etc/nginx/sites-available/intibelajar-private`:

```nginx
server {
    listen 127.0.0.1:5173;
    server_name localhost;
    root /srv/intibelajar/web-current;
    index index.html;
    access_log off;
    client_max_body_size 1m;
    location /v1/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /health/ {
        proxy_pass http://127.0.0.1:8000;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Pada server baru, hapus hanya symlink site default Nginx agar halaman bawaan tidak listen publik:

```bash
if [ -L /etc/nginx/sites-enabled/default ]; then sudo unlink /etc/nginx/sites-enabled/default; fi
sudo ln -s /etc/nginx/sites-available/intibelajar-private /etc/nginx/sites-enabled/intibelajar-private
sudo nginx -t
sudo systemctl reload nginx
```

Izinkan user deploy mengendalikan **hanya dua service ini**, bukan sudo tanpa batas. Buka `sudo visudo -f /etc/sudoers.d/intibelajar-deploy`, isi:

```sudoers
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl stop intibelajar-api.service intibelajar-worker.service, /usr/bin/systemctl start intibelajar-api.service intibelajar-worker.service
```

## 5. Update pertama dan buka lewat PuTTY

Sebagai deploy, salin script dari repository:

```bash
sudo -iu deploy
cp /srv/intibelajar/backend/docs/deployment/templates/deploy-private-dev.sh /srv/intibelajar/deploy-private-dev.sh
chmod 700 /srv/intibelajar/deploy-private-dev.sh
BACKEND_SHA=$(git -C /srv/intibelajar/backend rev-parse HEAD)
FRONTEND_SHA=$(git -C /srv/intibelajar/frontend rev-parse HEAD)
/srv/intibelajar/deploy-private-dev.sh "$BACKEND_SHA" "$FRONTEND_SHA"
```

Script menarik Git, memilih commit tepat, membuat backup DB, build frontend, menghentikan API/worker, memasang dependensi backend termasuk tsx, menjalankan migrasi **up saja**, menyalakan service, lalu memeriksa readiness. Ada downtime singkat. Jangan `npm ci --omit=dev`: backend ini masih menjalankan TypeScript lewat tsx.

Jika gagal, exit code nonzero dan jangan lanjut menganggap deploy sukses. API/worker mungkin sengaja tertinggal berhenti jika migrasi gagal. Periksa `journalctl`; pulihkan lewat forward fix atau restore yang ditinjau. Tidak ada rollback database otomatis. Backup lokal belum menggantikan backup off-server dan restore drill untuk lingkungan sungguhan.

PuTTY → Connection → SSH → Tunnels:

- Source port: **5173**.
- Destination: **127.0.0.1:5173**.
- Pilih **Local**, klik **Add**; jangan centang akses port dari host lain.
- Kembali ke Session, simpan, lalu Open/login. Buka **http://localhost:5173** di browser PC; gunakan `localhost` persis agar sama dengan APP_ORIGIN. Jika Vite lokal Anda memakai 5173, hentikan dulu.

Alternatif dari Windows CMD/OpenSSH:

```bat
ssh -N -L 127.0.0.1:5173:127.0.0.1:5173 USER_SSH@IP_SERVER
```

Frontend berada di server Ubuntu; guest demo masih menyimpan data lokal browser. `/health/ready` menunjukkan backend hidup, bukan semua fitur/gate sudah selesai.

Perintah pemeriksaan di Ubuntu:

```bash
curl -f http://127.0.0.1:8000/health/ready
sudo systemctl status intibelajar-api.service intibelajar-worker.service
sudo journalctl -u intibelajar-api.service -n 60 --no-pager
sudo journalctl -u intibelajar-worker.service -n 60 --no-pager
```

## 6. CI/CD sederhana: klik → tes → update server

CI = tes otomatis. CD = update server jika tes berhasil. Awalnya memakai tombol **Run workflow**, agar sambil mencicil Anda memilih kapan server diubah. Workflow push/PR backend yang sudah ada tetap dipertahankan.

Template ada di [templates/private-dev.yml](templates/private-dev.yml). Setelah direview, salin ke `.github/workflows/private-dev.yml`, commit, dan push dengan keputusan Anda. Template sengaja belum aktif di repo. Tidak ada push/deploy yang dilakukan dari sesi ini.

Di GitHub repository backend:

1. Settings → Secrets and variables → Actions → **Variables**: `FRONTEND_REPOSITORY=OWNER/REPO_FRONTEND`.
2. Bila frontend privat: secret `FRONTEND_READ_TOKEN`, fine-grained token read-only Contents untuk frontend itu saja. Repository token backend biasanya tidak bisa membaca repository privat lainnya.
3. Buat Environment **private-dev**. Tambahkan environment secrets: `DEV_SSH_HOST`, `DEV_SSH_PORT` (22), `DEV_SSH_KEY`, `DEV_SSH_KNOWN_HOSTS`.

Untuk key CD yang **berbeda** dari key pembaca GitHub, di PC buat pasangan SSH:

```bat
ssh-keygen -t ed25519 -f intibelajar_ci -C intibelajar-private-ci
```

Gunakan passphrase kosong khusus key otomasi ini. Simpan private key sebagai `DEV_SSH_KEY` di GitHub; public key (`intibelajar_ci.pub`) ditambahkan ke `/home/deploy/.ssh/authorized_keys` di Ubuntu, prefix `restrict ` sebelum `ssh-ed25519 ...` untuk melarang forwarding/PTY pada key CI. Permission direktori 700, authorized_keys 600, owner deploy. Jangan memakai key CI untuk tunnel PuTTY.

`DEV_SSH_KNOWN_HOSTS` harus berisi host key server yang sudah dicocokkan dengan console/provider. Anda bisa mengambil kandidat memakai `ssh-keyscan`, tetapi **jangan percaya hasil scan tanpa membandingkan fingerprint** dengan `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` di console server. Untuk port khusus, format known_hosts memakai `[IP]:PORT`. Jangan menonaktifkan StrictHostKeyChecking.

GitHub-hosted runner harus dapat mencapai port SSH server. Jika cloud firewall membatasi SSH hanya dari IP PC Anda, job CD tidak bisa masuk; tetap gunakan update manual sampai tersedia jalur runner yang diizinkan. Jangan membuka port DB/API untuk mengatasi masalah SSH.

Cara menjalankan:

1. Pastikan commit backend dan frontend yang dipilih sudah di-push ke `main` masing-masing.
2. Ambil SHA frontend lengkap: `git rev-parse HEAD` pada checkout frontend yang dipilih.
3. GitHub → Actions → **Private Ubuntu dev** → Run workflow → branch main → isi SHA frontend.
4. Job `checks`: backend tests dengan PostgreSQL terpisah `_test`, frontend suite, 29 consumer checks/golden, dan build frontend.
5. Hanya jika berhasil, job `deploy` mengirim dua SHA yang diuji lewat SSH ke script server.

CI ini baseline, **bukan sertifikat M9**: belum mencakup seluruh pasangan run, E2E/model/mutation/arsitektur yang diwajibkan exit plan. B-01/B-02 tetap mungkin membuat suite gagal; jangan melewati tes agar deploy hijau. Perubahan template deploy script di Git tidak otomatis mengganti salinan di `/srv/intibelajar/`; review lalu salin ulang jika perlu.

## 7. Yang belum termasuk

- Domain publik, HTTPS publik, dan staging origin non-loopback: perlu perubahan konfigurasi yang diuji tersendiri, bukan menonaktifkan guard.
- Login/email/guardian sungguhan, publikasi katalog asli, serta penyelesaian M5–M9.
- Data murid asli dan production readiness.

Rujukan resmi: [Ubuntu PostgreSQL](https://ubuntu.com/server/docs/how-to/databases/install-postgresql/), [Ubuntu Nginx](https://ubuntu.com/server/docs/how-to/web-services/install-nginx/), [Ubuntu UFW](https://ubuntu.com/server/docs/how-to/security/firewalls/), [Node 24.19.0](https://nodejs.org/id/blog/release/v24.19.0), [PuTTY forwarding](https://the.earth.li/~sgtatham/putty/0.85/htmldoc/Chapter3.html#using-port-forwarding), [GitHub deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys), [Actions PostgreSQL](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers), [deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).
