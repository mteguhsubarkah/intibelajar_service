#!/usr/bin/env bash
# Only the private synthetic environment described in ../ubuntu-private-dev.md.
set -Eeuo pipefail
umask 022
export PATH=/usr/local/bin:/usr/bin:/bin
base=/srv/intibelajar
backend_sha=${1:?Usage: deploy-private-dev.sh BACKEND_SHA FRONTEND_SHA}
frontend_sha=${2:?Usage: deploy-private-dev.sh BACKEND_SHA FRONTEND_SHA}
[[ $backend_sha =~ ^[a-f0-9]{40}$ && $frontend_sha =~ ^[a-f0-9]{40}$ ]] || { echo 'Use full commit SHAs' >&2; exit 2; }
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 2; }
trap 'echo "Deployment failed. Check journalctl and the backup; no automatic database rollback was attempted." >&2' ERR
[[ $(node --version) == v24.19.0 ]] || { echo 'Expected Node v24.19.0' >&2; exit 2; }
for repo in backend frontend; do
  test -z "$(git -C "$base/$repo" status --porcelain)" || { echo "Dirty $repo checkout; refusing update" >&2; exit 2; }
  git -C "$base/$repo" fetch origin main
done
git -C "$base/backend" merge-base --is-ancestor "$backend_sha" origin/main
git -C "$base/frontend" merge-base --is-ancestor "$frontend_sha" origin/main
# No tests run on this database. CI uses a different ephemeral *_test database.
install -d -m 700 "$base/backups"
backup="$base/backups/$(date -u +%Y%m%dT%H%M%S)-$$.dump"
(umask 077; pg_dump -h 127.0.0.1 -p 5432 -U intibelajar --no-password -Fc intibelajar_dev > "$backup")
echo "Backup saved: $backup"
git -C "$base/frontend" checkout --detach "$frontend_sha"
cd "$base/frontend"
npm ci
VITE_LEARNING_MODE=demo VITE_API_BASE_URL= VITE_BACKEND_FALLBACK=true VITE_SLICE0=false VITE_CANONICAL_LEARNING=false VITE_TRACK_URL= npm run build
release="$base/web-releases/$(date -u +%Y%m%dT%H%M%S)-${frontend_sha:0:12}-$$"
mkdir -p "$release"
cp -a dist/. "$release/"
# Stop both processes before changing backend dependencies or applying migrations.
sudo /usr/bin/systemctl stop intibelajar-api.service intibelajar-worker.service
git -C "$base/backend" checkout --detach "$backend_sha"
cd "$base/backend"
npm ci
node --env-file=.env --import tsx src/migrate.ts up
sudo /usr/bin/systemctl start intibelajar-api.service intibelajar-worker.service
curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:8000/health/ready
ln -s "$release" "$base/web-next"
mv -Tf "$base/web-next" "$base/web-current"
curl --fail --silent --show-error http://127.0.0.1:5173/ >/dev/null
curl --fail --silent --show-error http://127.0.0.1:5173/health/ready
echo "Private dev updated: backend=$backend_sha frontend=$frontend_sha"
