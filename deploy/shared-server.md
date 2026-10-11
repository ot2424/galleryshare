# Beide Projekte auf einem Server

Galleryshare-API: 127.0.0.1:3000, GuessTheTeam-API: 127.0.0.1:4000.
Die Projekte behalten getrennte Umgebungsdateien und Prozesse.

Voraussetzungen: Node.js 22, npm, PM2, Nginx und FFmpeg mit libx264/AAC.
Für Video-Vorschauen `apt install ffmpeg` ausführen; R2-CORS muss `ETag`
freigeben (siehe README). Für 20-GB-Galerien mindestens 40 GB freie Platte
als Ausgangsreserve für ZIP und Video-Aufbereitung vorsehen. Galleryshare liest
/root/galleryshare/.env; GuessTheTeam liest /root/guesstheteam/.env.
Galleryshare benötigt ADMIN_PASSWORD zusätzlich zu den Cloud-Zugangsdaten.
GuessTheTeam benötigt für production DATABASE_URL, SMTP_HOST, SMTP_FROM
und AUTH_FRONTEND_URL mit HTTPS sowie passende CORS_ORIGIN-Werte.
SMTP-Zugangsdaten und die PostgreSQL-Migration gemäß dessen docs/migration.md einrichten.

```bash
cd /root/galleryshare/backend
npm ci
cd /root/galleryshare/frontend
npm ci
npm run build
cd /root/guesstheteam
npm ci
npm run backend:build
pm2 start /root/galleryshare/backend/ecosystem.config.cjs
pm2 start /root/guesstheteam/deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

Den von pm2 startup ausgegebenen Befehl ausführen, damit beide Prozesse nach
Neustarts zurückkommen. Keinen zweiten systemd-Prozess für dieselbe API starten.

Galleryshare frontend/dist nach /var/www/galleryshare kopieren. In
nginx.conf.example die Domain ersetzen und die Site aktivieren. Die bestehende
GuessTheTeam-Konfiguration unter deploy/nginx-api.conf bzw.
nginx-api-https.conf im anderen Projekt leitet dessen API an Port 4000 weiter.
TLS-Zertifikate für beide Domains einrichten und vor Reload nginx -t ausführen.
Das GuessTheTeam-Frontend kann gemäß dessen README auf Vercel bleiben;
dort VITE_API_BASE_URL auf die öffentliche HTTPS-API setzen.

Galleryshare besitzt derzeit keine serverseitige Zugriffskontrolle für seine
Admin- und Schreibendpunkte (siehe README). Diese muss vor öffentlicher
Freigabe umgesetzt werden.

## HTTPS auf dem neuen Server

Am 11. Oktober 2026 wurden beide APIs auf `ubuntu-16gb-nbg1-1` mit PM2
gestartet. Die öffentliche GuessTheTeam-Bereitschaftsprüfung liefert
`{"ok":true}`; Galleryshare wurde über `https://galleryshare.de` erfolgreich
abgerufen. Die Frontend-Version von GuessTheTeam auf Vercel muss separat
gegen die neue API geprüft werden.

Galleryshare erneut bauen und HTTPS einrichten:

```bash
apt install -y nginx certbot python3-certbot-nginx
bash /root/galleryshare/deploy/install-https.sh
```

Das Skript baut das Frontend, kopiert es nach `/var/www/galleryshare`, richtet
die Nginx-Site für `galleryshare.de` und deren Zertifikat ein und prüft HTTPS.
Die Domain muss vorher auf den Server zeigen. Bestehende Site-Konfigurationen
bleiben bei erneutem Aufruf erhalten. Die automatische Zertifikatserneuerung
ist aktiviert. Codex-Werkzeuge können trotz SSH-Sitzung durch eine Sandbox
vom Netzwerk und den systemd-/PM2-Steuerungssockets getrennt sein.
