# Galleryshare

Galleryshare ist eine Webanwendung zum Teilen von Foto- und Mediengalerien, beispielsweise nach Hochzeiten. Ein Administrator erstellt Galerien und lädt Dateien hoch. Gäste öffnen einen geteilten Link, betrachten die Medien und laden ein vorbereitetes ZIP herunter. Galerien erhalten beim Anlegen eine Laufzeit von 48 Stunden.

Diese README ist der Einstieg für Menschen und Codex ohne bisherigen Chat-Kontext. Sie beschreibt den vorhandenen Code, nicht einen vollständig abgesicherten oder verifizierten Produktionsbetrieb.

## Herkunft und Arbeitsstand

- Ziel-Repository: https://github.com/ot2424/galleryshare, Hauptbranch `main`.
- Am 11.10.2026 als eigenständiger Snapshot des lokalen Projekts importiert, einschließlich damals nicht committeter Änderungen. Die alte Git-Historie wurde nicht übernommen.
- Ursprung: `ot242424/Photoshare24`. Dessen GitHub-Stand war weiter als der lokal ausgecheckte Commit; die lokalen Dateien enthielten zusätzlich Änderungen. Dieser Import ist daher ausdrücklich der lokale Arbeitsstand, kein vollständiger Import des neuesten alten Hauptbranches.
- Auf den ehemaligen Server besteht kein Zugriff. Welcher Stand dort zuletzt lief, ist unbekannt.
- Zugangsdaten, lokale SQLite-Datenbanken und Upload-Verzeichnisse sind nicht enthalten. Das zuvor fest eingebaute Admin-Passwort wurde durch `ADMIN_PASSWORD` ersetzt.
- Linux-Pfade sind bewusst erhalten geblieben. Eine Umstellung auf Windows ist keine Voraussetzung des Projekts.

## Architektur und Einstiegspunkte

| Teil | Technik / Aufgabe | Einstieg |
| --- | --- | --- |
| Frontend | Vue 3, Vue Router, Vite, Tailwind; Oberfläche und Browser-Uploads | `frontend/src/main.js`, `frontend/src/App.vue` |
| Navigation | Startseite, Login, Verwaltung, Galerie, Datenschutz | `frontend/src/router.js` |
| Backend | Node.js mit ES-Modulen, Express 4, REST-API | `backend/index.js` |
| Metadaten | SQLite, Tabellenanlage und kleine Schemaanpassung beim Start | `backend/database.js` |
| Originale und Vorschaubilder | Cloudflare R2 über S3-SDK; signierte URLs | `backend/r2.js` |
| ZIP-Erstellung | Hintergrundaufgabe im selben Node-Prozess, Archiver, lokale ZIP-Datei | `backend/createZipInBackground.js` |
| ZIP-Speicher und Auslieferung | Bunny Storage und Bunny CDN | `backend/bunny.js` |
| Alternativer Backend-Upload | Multipart mit Busboy, lokale Zwischenablage, Sharp-Thumbnails | `backend/uploadStreamRouter.js` |
| Separater ZIP-Worker | Alternative ZIP-Erstellung in Cloudflare mit Ablage in R2 | `R2/zip-worker/src/index.js` |

Es gibt kein gemeinsames Root-Startskript und keinen npm-Workspace. `backend`, `frontend` und `R2/zip-worker` haben eigene `package.json`- und Lockdateien. Die Root-`package.json` enthält nur Wrangler als Entwicklungsabhängigkeit.

### Welche Dateien sind maßgeblich?

Für die Anwendung gelten `backend/index.js` und die vom Frontend-Router importierten Vue-Komponenten. Insbesondere:

- `Home.vue`: öffentliche Startseite.
- `Login.vue`: Login-Aufruf und lokaler Anmeldestatus.
- `AdminDashboard.vue`: Galerien anlegen, direkte R2-Uploads, Teilen und Löschen.
- `Gallery.vue`: Galerie laden, Medien anzeigen, ZIP-Status abfragen und Download öffnen.
- `PrivacyPolicy.vue`: Datenschutzseite.

Dateien mit Namen wie `Backup`, `copy`, `.save`, `index2.js`, `Gallery.vue22` sowie `frontend/public/design-*.html` sind erhaltene ältere Varianten oder Entwürfe. Sie sind keine gleichberechtigten Anwendungseinstiegspunkte. `backend/indexBackup.js` enthält einen bekannten Syntaxfehler und wird nicht gestartet. Vor Änderungen immer die tatsächlichen Imports prüfen; nicht alle Varianten parallel ändern.

## Aktueller Datenfluss

### Galerie erstellen und Dateien hochladen

1. `AdminDashboard.vue` erstellt über `POST /api/create-gallery` einen SQLite-Eintrag. Die ID wird aus `Date.now()` gebildet; `expiresAt` liegt 48 Stunden nach Erstellung.
2. Für jede Datei fordert der Browser über `POST /api/get-upload-url` eine signierte R2-PUT-URL an.
3. Der Browser lädt die Datei direkt mit `PUT` nach R2. Der aktuelle Client verarbeitet bis zu drei Dateien parallel.
4. `POST /api/register-file` speichert den R2-Schlüssel und Originalnamen in SQLite.
5. Nach den Uploads startet `POST /api/finalize-gallery` die ZIP-Erstellung im Hintergrund.

**Der aktuelle Admin-Upload verwendet nicht `/api/upload/:galleryId`.** Diese zusätzliche Multipart-Route speichert Dateien zuerst unter `/root/PhotoShare/backend/temp/<galleryId>`, erzeugt nach Möglichkeit 400 Pixel breite JPEG-Vorschaubilder und lädt beides nach R2. Der direkte Browser-Upload erzeugt über die aktuelle Register-Route keine Thumbnails.

### ZIP erstellen und Galerie öffnen

1. `createZipInBackground.js` liest die registrierten Originaldateien als Streams aus R2.
2. Archiver schreibt `/tmp/<galleryId>.zip` ohne Kompression (`store: true`).
3. Das ZIP wird in Bunny Storage unter `gallery-zips/<galleryId>.zip` hochgeladen.
4. Die Datenbank erhält `zipReady = 1` und `zipProgress = 100`; das lokale ZIP wird entfernt.
5. Gäste öffnen `/gallery/<galleryId>`. Die API liefert Metadaten und zeitlich begrenzte R2-GET-URLs; deren Standardlaufzeit beträgt eine Stunde.
6. Die Galerie fragt `/api/zip-progress/:id` ab. `/api/download-zip/:id` liefert bei fertigem ZIP eine Bunny-CDN-URL, die der Browser öffnet.

Der Cloudflare-Worker unter `R2/zip-worker` ist eine separate Alternative: Er nimmt `?id=...` an und erzeugt/speichert ZIPs in R2. Er ist nicht in den oben beschriebenen Backend-/Bunny-Ablauf eingebunden und wird für den normalen Start nicht benötigt. Nicht ohne Prüfung deployen: Die Wrangler-Konfiguration enthält bereits Bucket-Namen; der Worker puffert Daten im Speicher und berücksichtigt keine weitere List-Paginierung.

## Von null starten

### Voraussetzungen

- Node.js mit Unterstützung für `--env-file` (mindestens 20.6; lokal wurde 20.20.2 verwendet) und npm.
- Linux für den vollständigen Ablauf mit den vorhandenen festen Dateipfaden.
- Für echte Uploads und Downloads: R2-Bucket mit passenden Zugangsdaten sowie Bunny Storage/CDN.
- Schreibrechte für das Backend-Arbeitsverzeichnis, `/root/PhotoShare/backend/temp` und `/tmp`; ausreichend Platz für Upload-Zwischendateien und ZIPs.

```bash
git clone https://github.com/ot2424/galleryshare.git
cd galleryshare/backend
npm ci
cp .env.example .env
# .env mit den eigenen Werten ausfüllen
node --env-file=.env index.js
```

Zweites Terminal, aus dem geklonten Repository:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Frontend: http://127.0.0.1:5173. Backend: Port 3000. Vite leitet `/api` an `http://localhost:3000` weiter. Bei einem anderen Backend-Port muss auch `frontend/vite.config.js` angepasst werden. Die Vite-Konfiguration bindet ohne den obigen Host-Parameter an `0.0.0.0`.

**Backend aus `backend/` starten und `--env-file=.env` verwenden.** SQLite öffnet `./db.sqlite` relativ zum Arbeitsverzeichnis. Außerdem lesen die R2-/Bunny-Module ihre Variablen bereits beim Import. Ein bloßes `node index.js` lädt die lokale `.env` im Einstiegspunkt dafür zu spät; zusätzlich existiert ein fest eingebauter dotenv-Pfad `/root/PhotoShare/backend/.env`.

Ohne funktionierende Cloud-Zugangsdaten lassen sich Oberfläche und einfache Metadaten-Endpunkte prüfen, aber nicht der gesamte Medienablauf. Ein frischer Start legt eine leere SQLite-Datenbank an; alte Galerien werden nicht automatisch aus R2 rekonstruiert.

### Umgebungsvariablen

Vorlage: `backend/.env.example`. Keine realen Werte in Git speichern oder in Logs ausgeben.

| Variable | Bedeutung |
| --- | --- |
| `PORT` | Backend-Port, Standard `3000` |
| `ADMIN_USERNAME` | Loginname, Standard `admin` |
| `ADMIN_PASSWORD` | Erforderliches Loginpasswort; kein voreingestelltes Passwort |
| `ADMIN_SECRET` | Separates Geheimnis für den vollständigen Lösch-Endpunkt |
| `R2_ENDPOINT` | S3-API-Endpunkt des eigenen R2-Accounts |
| `R2_BUCKET` | Bucketname |
| `R2_ACCESS_KEY_ID` | R2-Zugriffsschlüssel |
| `R2_SECRET_ACCESS_KEY` | Zugehöriges R2-Geheimnis |
| `BUNNY_STORAGE_ZONE` | Bunny-Storage-Zone |
| `BUNNY_API_KEY` | Zugangsschlüssel für diese Storage-Zone |
| `BUNNY_STORAGE_HOST` | Storage-Basis-URL inklusive Protokoll |
| `BUNNY_CDN_HOST` | Öffentliche CDN-Basis-URL inklusive Protokoll |
| `UPLOAD_PROCESS_CONCURRENCY` | Optional, Standard `3`; nur für die Multipart-Backend-Route |
| `ZIP_PROGRESS_STEPS` | Optional, Standard `12`; Abstufung der ZIP-Fortschrittsmeldungen |

Die beiden optionalen Variablen sind nicht in der Vorlage enthalten. Für direkte Browser-Uploads muss die R2-CORS-Konfiguration den verwendeten Frontend-Origin, `PUT` und den `Content-Type`-Header zulassen; Medienzugriffe entsprechend berücksichtigen. Express-CORS ersetzt die Bucket-CORS-Konfiguration nicht.

### Build und Betrieb

```bash
cd frontend
npm run build
```

Die Ausgabe liegt in `frontend/dist`. Das Express-Backend liefert diese Dateien nicht selbst aus. Für einen Linux-Produktionsbetrieb muss ein Webserver das Frontend bereitstellen, bei Vue-Routen auf `index.html` zurückfallen und `/api` an das Backend weiterleiten. Die konkrete Konfiguration des ehemaligen Servers ist nicht enthalten.

`backend/ecosystem.config.cjs` ist eine vorhandene PM2-Konfiguration mit `--env-file=.env`. Falls PM2 installiert ist, aus `backend/` starten:

```bash
pm2 start ecosystem.config.cjs
```

Datenbank und Cloud-Speicher müssen unabhängig vom Quellcode gesichert werden. Bei laufendem SQLite im WAL-Modus nicht blind nur `db.sqlite` kopieren; eine konsistente SQLite-Sicherung verwenden.

## API-Übersicht

Alle Pfade beginnen mit `/api`. Maßgeblich ist `backend/index.js`; Request-Felder stehen dort und im aufrufenden Frontend.

| Methode / Pfad | Eingabe / Aufgabe |
| --- | --- |
| `POST /login` | `{ username, password }`; liefert Erfolg oder 401 |
| `POST /create-gallery` | `{ name }`; liefert `galleryId` |
| `POST /get-upload-url` | `{ galleryId, filename, contentType }`; liefert `key`, `uploadUrl` |
| `POST /register-file` | `{ galleryId, key, originalname }`; registriert Metadaten |
| `POST /upload/:galleryId` | Alternativer Multipart-Upload über den Server |
| `POST /finalize-gallery` | `{ galleryId }`; startet ZIP-Erstellung |
| `GET /gallery/:id` | Galerie und Dateien mit signierten URLs; 404 bei unbekannter, 410 bei abgelaufener Galerie |
| `GET /zip-progress/:id` | `zipProgress`, `zipReady`, `zipError` |
| `GET /download-zip/:id` | Liefert bei fertigem ZIP `{ url }` |
| `GET /admin/galleries` | Alle Galerien einschließlich Dateimetadaten |
| `DELETE /admin/gallery/:id` | Löscht eine Galerie, zugehörige R2-Objekte und lokale Daten; Bunny-Fehler siehe unten |
| `POST /admin/nuke` | Löscht alle R2-Objekte, Bunny-ZIPs und Datenbankeinträge; verlangt `x-admin-secret` und `{ confirm: "DELETE_EVERYTHING" }` |

Der letzte Endpunkt ist destruktiv und kein Test- oder Health-Endpunkt.

## Datenmodell

`backend/database.js` öffnet eine gemeinsam verwendete SQLite-Verbindung, aktiviert WAL und legt Tabellen/Indizes beim Start an.

- `galleries`: `id`, `name`, `createdAt`, `expiresAt`, `zipReady`, `zipError`, `zipProgress`, `uploadSuccess`.
- `files`: `id`, `galleryId`, `filename` (R2-Schlüssel), `originalname`, `downloads`, `thumbnail` (optionaler R2-Schlüssel).
- Zeitwerte sind Unix-Zeit in Millisekunden. Statusfelder sind numerische Flags.
- Indizes beschleunigen die Suche nach Galerie und Sortierung nach Originalname.
- Für ältere Datenbanken wird eine fehlende `thumbnail`-Spalte ergänzt. Es gibt kein allgemeines Migrationstool.
- Obwohl `foreign_keys` aktiviert wird, definiert das aktuelle Schema keine Foreign-Key-Beziehung für `galleryId`.

## Bekannte Einschränkungen und offene Arbeit

Diese Punkte beschreiben den importierten Stand; sie sind durch diese README nicht behoben:

1. **Authentifizierung:** Login erzeugt keine serverseitige Sitzung und kein Token. Der Router prüft nur `localStorage.auth`. Die meisten schreibenden und administrativen Backend-Endpunkte haben keine Authentifizierungs-Middleware. Vor öffentlichem produktivem Betrieb ist eine serverseitige Zugriffskontrolle erforderlich.
2. **Ablaufzeit:** `/gallery/:id` prüft `expiresAt`; ZIP-URL und ZIP-Fortschritt erzwingen diese Prüfung nicht. Es gibt keinen implementierten automatischen Aufräumjob für abgelaufene Medien. 48 Stunden bedeuten daher keine garantierte Löschung oder vollständige Zugriffssperre.
3. **Galerie löschen:** `index.js` ruft `deleteZipFromBunny` auf, importiert diese Funktion aber nicht. Der Fehler wird abgefangen; ein Bunny-ZIP kann trotz erfolgreicher Antwort erhalten bleiben.
4. **Upload-Konsistenz:** R2-Upload und SQLite-Registrierung sind separate Schritte. Abbrüche/Fehler können verwaiste Objekte oder unvollständige Galerien hinterlassen. Dateinamen, Schlüssel und Galeriezugehörigkeit benötigen zusätzliche Validierung; wiederholte Namen können dieselben R2-Schlüssel adressieren.
5. **ZIP-Jobs:** Hintergrundarbeit läuft im API-Prozess ohne dauerhafte Queue oder Wiederaufnahme nach Neustart. Manche Fehlerpfade setzen `zipError` nicht zuverlässig; Stream-Fehlerbehandlung und Bereinigung sind zu prüfen. Fortschritt basiert auf eingereihten Dateien, nicht auf übertragenen Bytes.
6. **Lokale Zwischenablage:** Die Multipart-Upload-Route räumt erfolgreich gespeicherte lokale Dateien nicht generell nach Abschluss auf. Speicherbedarf und Bereinigung müssen eingeplant werden.
7. **Externe Dienste:** QR-Codes werden über `api.qrserver.com` erzeugt; dabei wird der Galerielink an diesen Dienst übergeben. Die Startseite lädt Bilder von Pexels. Bei Datenschutz-/Offline-Anforderungen berücksichtigen.
8. **Alte Varianten:** Backup-Dateien und der separate Worker sind nicht als vollständiger unterstützter Funktionsumfang getestet.

## Prüfung und Tests

Beim lokalen Check am 11.10.2026 wurden bestätigt:

- Frontend-Produktionsbuild erfolgreich.
- Backend auf Port 3000 gestartet.
- `GET /api/admin/galleries` liefert 200; die geprüfte lokale Datenbank war leer.
- Eine unbekannte Galerie liefert 404.
- Vite liefert die Start-/Loginseite aus und leitet API-Anfragen weiter.

Nicht bestätigt: vollständiger R2-Upload, Bunny-ZIP-Download oder Übereinstimmung mit dem alten Server. Diese Prüfungen bezogen sich auf den lokalen Ausgangsstand, nicht auf einen frisch provisionierten Linux-Server.

Das Backend hat nur ein absichtlich fehlschlagendes Platzhalter-`npm test`; im Frontend ist kein Testskript definiert. Der separate Worker hat ein eigenes Vitest-Skript, das nicht mit einer Testsuite der Hauptanwendung gleichzusetzen ist.

Für kleine Änderungen mindestens die betroffene Syntax und bei Frontend-Änderungen den Build prüfen:

```bash
# Aus dem Repository-Stamm
node --check backend/index.js
node --check backend/database.js
npm --prefix frontend run build
```

Lesende Smoke-Checks bei laufendem Backend:

```bash
curl -i http://127.0.0.1:3000/api/admin/galleries
curl -i http://127.0.0.1:3000/api/gallery/nonexistent-smoke-check
```

Für einen vollständigen Funktionstest separate Test-Buckets/Storage-Zonen konfigurieren, eine neue Testgalerie mit einer kleinen Datei anlegen, Upload/Registrierung, Vorschau, ZIP-Status und Download prüfen. Destruktive Endpunkte nicht gegen produktive Daten als Smoke-Test ausführen.

## Arbeitskontext für Codex

1. Diese README lesen, danach `git status`, aktuelle Branch-/Remote-Zuordnung und vorhandene lokale Änderungen prüfen. Ein anderer Checkout kann weiterhin auf das alte Repository zeigen.
2. Einstiegspunkte lesen: `backend/index.js`, `backend/database.js`, `frontend/src/router.js`; anschließend nur die für die Aufgabe relevanten Module und Komponenten.
3. Für Upload-Aufgaben zuerst den direkten Browser-R2-Ablauf verstehen; Multipart-Upload und Worker nicht versehentlich als aktiven Standard behandeln.
4. Linux-Pfade und bestehende Architektur sind beabsichtigter Ausgangspunkt. Keine stillschweigende Migration, keinen Austausch der Datenbank und keinen Worker-Deploy als Nebenwirkung einer kleinen Änderung durchführen.
5. `.env`, echte Zugangsdaten, SQLite-Dateien samt `-wal`/`-shm`, `backend/db.json`, Uploads und Build-Ausgaben bleiben außerhalb von Git. Konfiguration über `.env.example` dokumentieren.
6. Vorhandene Nutzeränderungen erhalten. Historische Varianten nur ändern, wenn die Aufgabe sie betrifft. Keine Annahme treffen, dass der Stand des alten GitHub-Repositories oder Servers automatisch die neue Quelle der Wahrheit ist.
7. Änderungen mit passenden Prüfungen abschließen und konkret nennen, was getestet wurde und was mangels Cloud-Zugang oder Testumgebung offenbleibt.
