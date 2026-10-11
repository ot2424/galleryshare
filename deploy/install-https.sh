#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte als root auf dem Server ausfuehren." >&2
  exit 1
fi
for dependency in nginx certbot npm; do
  command -v "$dependency" >/dev/null || { echo "$dependency fehlt." >&2; exit 1; }
done

cd /root/galleryshare/frontend
npm ci
npm run build
test -f dist/index.html
install -d -m 0755 /var/www/galleryshare /var/www/letsencrypt
cp -a dist/. /var/www/galleryshare/
chmod -R a+rX /var/www/galleryshare

# Bestehende Site mit Zertifikat bei erneutem Aufruf erhalten.
if [ ! -f /etc/nginx/sites-available/galleryshare ]; then
  cat > /etc/nginx/sites-available/galleryshare <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name galleryshare.de;
    root /var/www/galleryshare;
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }
    location /api/ {
        client_max_body_size 100m;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
fi
ln -sfn /etc/nginx/sites-available/galleryshare /etc/nginx/sites-enabled/galleryshare
nginx -t
systemctl reload nginx
certbot --nginx -d galleryshare.de --redirect --non-interactive --agree-tos --email onur.t@aol.com
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
curl --fail --silent --show-error --max-time 15 https://galleryshare.de/ -o /dev/null
echo "GalleryShare ist ueber https://galleryshare.de erreichbar."
