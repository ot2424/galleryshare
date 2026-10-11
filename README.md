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
3. Der Browser lädt die Datei direkt mit `PUT` nach R2. Der aktuelle Client verarbeitet bis zu drei Dateien parallel. Dateien ab 64 MiB werden in 64-MiB-Teilen mit bis zu drei gleichzeitigen Teilübertragungen über alle großen Dateien hochgeladen; fehlgeschlagene Teile werden bis zu dreimal versucht. Abbruch räumt Multipart-Uploads nach Möglichkeit auf. Ein Neuladen der Seite setzt den Upload nicht fort.
4. `POST /api/register-file` speichert den R2-Schlüssel und Originalnamen in SQLite.
5. Nach den Uploads startet `POST /api/finalize-gallery` die ZIP-Erstellung im Hintergrund.

**Der aktuelle Admin-Upload verwendet nicht `/api/upload/:galleryId`.** Diese zusätzliche Multipart-Route speichert Dateien zuerst unter `backend/temp/<galleryId>`, erzeugt nach Möglichkeit 400 Pixel breite JPEG-Vorschaubilder und lädt beides nach R2. Für direkt hochgeladene Bilder erzeugt `mediaPreview.js` beim ersten Vorschauzugriff ein JPEG mit maximal 480 Pixeln und eine Ansicht mit maximal 1600 Pixeln. Beide Varianten werden in R2 gespeichert und in SQLite registriert; bestehende Galerien benötigen keinen erneuten Upload. Die erste Erzeugung benötigt einen Abruf des Originals. Nicht unterstützte Bildformate fallen auf das Original zurück.

### ZIP erstellen und Galerie öffnen

1. `createZipInBackground.js` verarbeitet jeweils einen Galerie-Job und liest die registrierten Originaldateien als Streams aus R2.
2. Archiver schreibt `/tmp/gallery-<galleryId>.zip` ohne Kompression (`store: true`) mit explizitem ZIP64, auch für Archive über 4 GiB.
3. Das ZIP wird in Bunny Storage unter `gallery-zips/<galleryId>.zip` hochgeladen.
4. Die Datenbank erhält `zipReady = 1` und `zipProgress = 100`; das lokale ZIP wird entfernt.
5. Gäste öffnen `/gallery/<galleryId>`. Die API liefert Metadaten und zeitlich begrenzte R2-GET-URLs; deren Laufzeit bis zum Galerieablauf reicht. Die API liefert Vorschau-URLs; die Originaldatei bleibt für Downloads erhalten. Video-Vorschaubilder und browserkompatible MP4-Ansichten werden nach Registrierung im Hintergrund erzeugt und in R2 gecacht. Der Browser lädt Videodaten erst beim Öffnen der aktiven Video-Folie im gemeinsamen Fancybox-Viewer, ohne Autoplay. Für bestehende Galerien werden fehlende Varianten bei Bedarf erzeugt.
6. Die Galerie fragt `/api/zip-progress/:id` ab. `/api/download-zip/:id` liefert bei fertigem ZIP die eigene Route `/api/download-zip/:id/file`. Diese prüft die ZIP-Signatur und streamt das Bunny-ZIP mit Download-Headern zum Browser, einschließlich Range-Anfragen. Bei einer fehlerhaften CDN-Antwort wird der authentifizierte Bunny-Storage-Abruf versucht. Schon die URL-Abfrage prüft die ersten Bytes, damit Fehlermeldungen in der Galerie erscheinen und nicht als ZIP gespeichert werden. Bei `zipError` bietet die Galerie über `POST /api/retry-zip/:id` einen neuen Versuch an.

Der Cloudflare-Worker unter `R2/zip-worker` ist eine separate Alternative: Er nimmt `?id=...` an und erzeugt/speichert ZIPs in R2. Er ist nicht in den oben beschriebenen Backend-/Bunny-Ablauf eingebunden und wird für den normalen Start nicht benötigt. Nicht ohne Prüfung deployen: Die Wrangler-Konfiguration enthält bereits Bucket-Namen; der Worker puffert Daten im Speicher und berücksichtigt keine weitere List-Paginierung.

## Von null starten

### Voraussetzungen

- Node.js mit Unterstützung für `--env-file` (mindestens 20.6; lokal wurde 20.20.2 verwendet) und npm.
- Linux für den vollständigen Ablauf mit den vorhandenen festen Dateipfaden.
- FFmpeg mit `libx264` und AAC, beispielsweise `apt install ffmpeg` unter Ubuntu. Ohne FFmpeg sind Video-Vorschauen nicht verfügbar.
- Für echte Uploads und Downloads: R2-Bucket mit passenden Zugangsdaten sowie Bunny Storage/CDN.
- Schreibrechte für das Backend-Arbeitsverzeichnis, `backend/temp` und `/tmp`; ausreichend Platz für Upload-Zwischendateien und ZIPs.

```bash
git clone https://github.com/ot2424/galleryshare.git
cd galleryshare/backend
npm ci
cp .env.example ../.env
# .env mit den eigenen Werten ausfüllen
node index.js
```

Zweites Terminal, aus dem geklonten Repository:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Frontend: http://127.0.0.1:5173. Backend: Port 3000. Vite leitet `/api` an `http://localhost:3000` weiter. Bei einem anderen Backend-Port muss auch `frontend/vite.config.js` angepasst werden. Die Vite-Konfiguration bindet ohne den obigen Host-Parameter an `0.0.0.0`.

**Backend aus `backend/` starten.** SQLite öffnet `./db.sqlite` relativ zum Arbeitsverzeichnis. `backend/env.js` lädt die zentrale `.env` im Repository-Stamm vor den R2-/Bunny-Modulen. Bereits gesetzte Prozessvariablen haben Vorrang. Der Server bindet standardmäßig an `127.0.0.1`; `HOST` kann dies ändern.

Ohne funktionierende Cloud-Zugangsdaten lassen sich Oberfläche und einfache Metadaten-Endpunkte prüfen, aber nicht der gesamte Medienablauf. Ein frischer Start legt eine leere SQLite-Datenbank an; alte Galerien werden nicht automatisch aus R2 rekonstruiert.

### Umgebungsvariablen

Vorlage: `backend/.env.example`. Keine realen Werte in Git speichern oder in Logs ausgeben.

| Variable | Bedeutung |
| --- | --- |
| `PORT` | Backend-Port, Standard `3000` |
| `HOST` | Bind-Adresse, Standard `127.0.0.1` |
| `UPLOAD_TEMP_DIR` | Optionaler absoluter Pfad für Multipart-Zwischendateien, Standard `backend/temp` |
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
| `FFMPEG_PATH` | FFmpeg-Binary, Standard `ffmpeg` |
| `MEDIA_TEMP_DIR` | Vorhandenes Verzeichnis für temporäre MP4s, Standard System-Temp |
| `ZIP_TEMP_DIR` | Vorhandenes Verzeichnis für temporäre ZIPs, Standard `/tmp` |
| `ZIP_PROGRESS_STEPS` | Optional, Standard `12`; Abstufung der ZIP-Fortschrittsmeldungen |

Die beiden optionalen Variablen sind nicht in der Vorlage enthalten. Für direkte Browser-Uploads muss die R2-CORS-Konfiguration den verwendeten Frontend-Origin, `PUT` und den `Content-Type`-Header zulassen und `ETag` über `ExposeHeaders` freigeben; Medienzugriffe entsprechend berücksichtigen. Express-CORS ersetzt die Bucket-CORS-Konfiguration nicht.

### Build und Betrieb

```bash
cd frontend
npm run build
```

Die Ausgabe liegt in `frontend/dist`. Das Express-Backend liefert diese Dateien nicht selbst aus. Für einen Linux-Produktionsbetrieb muss ein Webserver das Frontend bereitstellen, bei Vue-Routen auf `index.html` zurückfallen und `/api` an das Backend weiterleiten. Die konkrete Konfiguration des ehemaligen Servers ist nicht enthalten.

`backend/ecosystem.config.cjs` startet `galleryshare-api` mit festem Arbeitsverzeichnis, Port 3000 und der zentralen Root-`.env`. Falls PM2 installiert ist, aus `backend/` starten:

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
| `POST /multipart/:action` | Aktionen `start`, `part`, `complete`, `abort`; direkte R2-Teilstück-Uploads |
| `GET /video-status/:galleryId/:fileId` | Startet fehlende MP4-Aufbereitung, liefert `processing`, `ready` mit URL oder `error` |
| `POST /register-file` | `{ galleryId, key, originalname, sizeBytes }`; registriert Metadaten |
| `POST /upload/:galleryId` | Alternativer Multipart-Upload über den Server |
| `POST /finalize-gallery` | `{ galleryId }`; startet ZIP-Erstellung |
| `GET /gallery/:id` | Galerie und Dateien mit signierten URLs; 404 bei unbekannter, 410 bei abgelaufener Galerie |
| `GET /zip-progress/:id` | `zipProgress`, `zipReady`, `zipError` |
| `GET /download-zip/:id` | Liefert bei fertigem ZIP `{ url }` zur eigenen Downloadroute |
| `GET /download-zip/:id/file` | Streamt das ZIP von Bunny mit Download-Headern |
| `POST /retry-zip/:id` | Startet einen fehlgeschlagenen ZIP-Job erneut |
| `GET /media/:galleryId/:fileId/:variant` | Erzeugt/cachet Bildvarianten und Video-Poster (`thumbnail`, `preview`) und leitet auf R2 um |
| `GET /admin/galleries` | Alle Galerien einschließlich Dateimetadaten |
| `DELETE /admin/gallery/:id` | Löscht eine Galerie, zugehörige R2-Objekte und lokale Daten; Bunny-Fehler siehe unten |
| `POST /admin/nuke` | Löscht alle R2-Objekte, Bunny-ZIPs und Datenbankeinträge; verlangt `x-admin-secret` und `{ confirm: "DELETE_EVERYTHING" }` |

Der letzte Endpunkt ist destruktiv und kein Test- oder Health-Endpunkt.

## Datenmodell

`backend/database.js` öffnet eine gemeinsam verwendete SQLite-Verbindung, aktiviert WAL und legt Tabellen/Indizes beim Start an.

- `galleries`: `id`, `name`, `createdAt`, `expiresAt`, `zipReady`, `zipError`, `zipProgress`, `uploadSuccess`.
- `files`: `id`, `galleryId`, `filename` (R2-Schlüssel), `originalname`, `downloads`, `sizeBytes`, `thumbnail` und `preview` (optionale R2-Schlüssel).
- Zeitwerte sind Unix-Zeit in Millisekunden. Statusfelder sind numerische Flags.
- Indizes beschleunigen die Suche nach Galerie und Sortierung nach Originalname.
- Für ältere Datenbanken wird eine fehlende `thumbnail`-Spalte ergänzt. Es gibt kein allgemeines Migrationstool.
- Obwohl `foreign_keys` aktiviert wird, definiert das aktuelle Schema keine Foreign-Key-Beziehung für `galleryId`.

## Bekannte Einschränkungen und offene Arbeit

Diese Punkte beschreiben den importierten Stand; sie sind durch diese README nicht behoben:

1. **Authentifizierung:** Login erzeugt keine serverseitige Sitzung und kein Token. Der Router prüft nur `localStorage.auth`. Die meisten schreibenden und administrativen Backend-Endpunkte haben keine Authentifizierungs-Middleware. Vor öffentlichem produktivem Betrieb ist eine serverseitige Zugriffskontrolle erforderlich.
2. **Ablaufzeit:** `/gallery/:id` prüft `expiresAt`; ZIP-Downloads und Vorschauzugriffe prüfen ebenfalls den Ablauf; der ZIP-Fortschritt prüft ihn nicht. Es gibt keinen implementierten automatischen Aufräumjob für abgelaufene Medien. 48 Stunden bedeuten daher keine garantierte Löschung oder vollständige Zugriffssperre.
3. **Galerie löschen:** Fehler beim Löschen von Cloud-Objekten werden teilweise abgefangen; Cloud-Dateien können bei Dienstausfällen erhalten bleiben.
4. **Upload-Konsistenz:** R2-Upload und SQLite-Registrierung sind separate Schritte. Abbrüche/Fehler können verwaiste Objekte oder unvollständige Galerien hinterlassen. Dateinamen, Schlüssel und Galeriezugehörigkeit benötigen zusätzliche Validierung; wiederholte Namen können dieselben R2-Schlüssel adressieren.
5. **ZIP-Jobs:** Hintergrundarbeit läuft im API-Prozess ohne dauerhafte Queue oder Wiederaufnahme nach Neustart. Stream-Fehler setzen `zipError`; temporäre ZIPs werden auch bei Fehlern bereinigt. Gleichzeitige Jobs derselben Galerie werden zusammengefasst. Fortschritt basiert auf fertig geschriebenen Dateien, nicht auf übertragenen Bytes.
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

`npm --prefix backend test` prüft Multipart-Chunks, Wiederholungen, Upload-Abbruch, Video-Cache/Fehler/Bereinigung, getrennte begrenzte Video-Queues, ZIP-Signatur, CDN-/Storage-Fallback, Range-Downloads, ZIP-Abschluss, parallele Jobaufrufe, R2-Lese-/Streamfehler, fehlgeschlagene ZIP-Uploads mit Wiederholung und gecachte Bildvarianten. Die Speicherdienste werden dabei simuliert; im Frontend ist kein Testskript definiert. Der separate Worker hat ein eigenes Vitest-Skript, das nicht mit einer Testsuite der Hauptanwendung gleichzusetzen ist.

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

## Große Galerien und Video-Vorschauen

Ziel sind 10–20 GB Originaldaten pro Galerie. Große Einzeldateien nutzen Multipart,
kleine Dateien weiterhin direkte PUTs. Originaldateien werden für ZIP/Downloads
beibehalten. FFmpeg liest Videos über signierte R2-URLs (HTTP-Range), schreibt nur
Vorschau-Ausgaben lokal und lädt diese als Streams hoch. MP4-Ansichten enthalten
H.264/AAC, maximal 1280×720 Pixel, eine Ziel-Obergrenze von 2,5 Mbit/s für Video
und `faststart` für frühen Wiedergabebeginn. Poster haben maximal 480 Pixel.
Erste Aufbereitung großer Videos kann dauern; fertige Varianten werden wiederverwendet.

Es laufen höchstens ein Transcode, eine Poster-Erzeugung und ein ZIP-Job gleichzeitig.
Bildvorschauen haben ihre eigene Queue. Die Galerie rendert zuerst 90 Karten;
weitere Karten werden über „Weitere Medien anzeigen“ hinzugefügt. Die Metadaten-API
liefert weiterhin die gesamte Dateiliste und ist nicht für Millionen von Dateien ausgelegt.

Für eine 20-GB-Galerie mindestens 40 GB freie lokale Platte als Ausgangsreserve
vorsehen; bei sehr langen Videos oder zusätzlichem Multipart-Backend-Upload mehr.
ZIP-Erstellung prüft den freien Platz anhand registrierter `sizeBytes` plus 1 GiB
Reserve. Alte Dateien ohne Größenangabe werden dabei nicht vollständig erfasst.
R2 benötigt Platz für Originale, Poster und MP4s; Bunny zusätzlich für das ZIP.
ZIP-Jobs bleiben im API-Prozess ohne dauerhafte Queue; nach einem Neustart muss
die Aufbereitung bei Bedarf erneut angestoßen werden. Ein echter Lasttest mit
20 GB und Produktionsdiensten ist noch erforderlich; die lokalen Tests simulieren
die Speicherdienste und den FFmpeg-Prozess.

R2-CORS muss für die verwendeten Origins GET/HEAD/PUT und Content-Type zulassen
sowie ETag freigeben. Beispiel für den Produktions-Origin (bestehende weitere
Origins und Regeln erhalten):

```json
[
  {
    "AllowedOrigins": ["https://galleryshare.de"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag", "Accept-Ranges", "Content-Range"],
    "MaxAgeSeconds": 3600
  }
]
```

Siehe [Cloudflare Multipart-Uploads](https://developers.cloudflare.com/r2/objects/upload-objects/),
[Cloudflare CORS](https://developers.cloudflare.com/r2/buckets/cors/) und
[FFmpeg MOV/MP4-Optionen](https://ffmpeg.org/ffmpeg-formats.html#mov_002fmp4_002fismv).
Unvollständige Multipart-Uploads durch Browser-Abstürze sollten zusätzlich über
R2-Lifecycle-Regeln bereinigt werden. Die clientseitige Bereinigung ist best effort.

Bilder und Videos öffnen denselben Fancybox-Viewer, einschließlich Swipe,
Diashow und Download der Originaldatei. Der Viewer enthält die vollständige
sortierte Dateiliste, auch wenn in der Übersicht erst 90 Karten sichtbar sind.
Video-Statusabfragen und Wiedergabe werden beim Folienwechsel beendet; nur die
aktive Video-Folie bekommt eine MP4-Quelle. Videos starten ohne Autoplay.

Die Galerie zeigt Medien standardmäßig nach Datum aufsteigend. Datumsangaben in
Kamera-/Handy-Dateinamen (zum Beispiel `IMG_20261011_143000.jpg` oder
`IMG-20261011-WA0001.jpg`) haben Vorrang vor Dateiänderungs- und Upload-Datum.
Damit lassen sich auch ältere Uploads mit solchen Namen ohne erneuten Upload
sortieren. Fehlen alle Datumsangaben, folgen die Dateien am Ende in natürlicher
Namensreihenfolge. Das EXIF-Aufnahmedatum wird derzeit nicht ausgelesen.

ZIP-Downloadfehler werden vor dem Setzen der Download-Header geprüft.
Liefert auch Bunny Storage ein fehlendes oder offensichtlich ungültiges ZIP,
wird `zipError` gesetzt; die Galerie bietet „ZIP erneut erstellen“ an.
Vorübergehende Verbindungsfehler setzen diesen Status nicht. Die Prüfung
kontrolliert die Signatur und Antwort-Header, nicht die CRC aller ZIP-Einträge.
Die Download-Route liest nur einen kleinen Anfang des Streams und puffert
kein vollständiges Archiv. CDN und Storage werden in den Tests simuliert;
eine Produktionsprüfung benötigt Netzwerkzugriff auf beide Dienste.
