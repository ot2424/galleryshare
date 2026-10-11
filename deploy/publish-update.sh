#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
web_dir=/var/www/galleryshare
for dependency in node npm pm2 curl; do
  command -v "$dependency" >/dev/null || { echo "$dependency fehlt." >&2; exit 1; }
done
ffmpeg_binary="${FFMPEG_PATH:-ffmpeg}"
command -v "$ffmpeg_binary" >/dev/null || { echo 'FFmpeg fehlt: apt install ffmpeg (oder FFMPEG_PATH setzen).' >&2; exit 1; }
"$ffmpeg_binary" -hide_banner -encoders 2>/dev/null | grep 'libx264' >/dev/null || { echo 'FFmpeg benötigt libx264.' >&2; exit 1; }
# Fail before restarting the API if this session cannot publish the frontend.
test -d "$web_dir"
deploy_probe="$(mktemp "$web_dir/.deploy-check.XXXXXX")"
rm -f -- "$deploy_probe"

npm --prefix "$project_dir/backend" test
node --check "$project_dir/backend/index.js"
node --check "$project_dir/backend/mediaPreview.js"
node --check "$project_dir/backend/videoPreview.js"
node --check "$project_dir/backend/zipDownload.js"
npm --prefix "$project_dir/frontend" run build

backup_dir="$project_dir/deploy/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
cp -a "$web_dir/index.html" "$backup_dir/index.html"
# Publish new hashed assets first; preserve old assets for already-open browsers.
cp -a "$project_dir/frontend/dist/assets/." "$web_dir/assets/"
chmod -R a+rX "$web_dir/assets"
pm2 restart galleryshare-api

# Confirm the API starts before switching the public HTML to the new bundle.
api_ready=0
for attempt in {1..15}; do
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:3000/api/gallery/deploy-check-nonexistent || true)"
  if [ "$status" = 404 ]; then api_ready=1; break; fi
  sleep 1
done
if [ "$api_ready" != 1 ]; then
  echo 'API nicht bereit; bisheriges Frontend bleibt aktiv. PM2-Logs prüfen.' >&2
  exit 1
fi
install -m 0644 "$project_dir/frontend/dist/index.html" "$web_dir/.index.next.html"
mv -f "$web_dir/.index.next.html" "$web_dir/index.html"
curl --fail --silent --show-error --max-time 15 https://galleryshare.de/ -o /dev/null
echo "Update veröffentlicht: https://galleryshare.de (vorheriges HTML: $backup_dir/index.html)"
