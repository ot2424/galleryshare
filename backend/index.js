// backend/index.js
import express from "express";
import cors from "cors";
import "./env.js";
import initDb from "./database.js";
import uploadStreamRouter from "./uploadStreamRouter.js";
import fs from "fs";
import { randomUUID } from "node:crypto";
import { beginMultipart, signMultipartPart, finishMultipart, cancelMultipart } from "./r2.js";
import { openZipDownload } from "./zipDownload.js";
import { pipeline } from "node:stream/promises";
import createZipInBackground from "./createZipInBackground.js";
import { ensurePreview, isPreviewImage } from "./mediaPreview.js";
import { isVideo, videoPreviews } from "./videoPreview.js";
import {
  deleteFromR2,
  getSignedR2Url,
  getR2UploadUrl,
  deleteAllFromR2
} from "./r2.js";

import {
  deleteAllZipsFromBunny,
  deleteZipFromBunny
} from "./bunny.js";


const app = express();
const PORT = process.env.PORT || 3000;
let db;

app.use(cors());
// Wichtig: JSON Parser
app.use(express.json());

// Danach: Upload-Route (multipart)
app.use("/api/upload", uploadStreamRouter);
//app.use(express.json());

const start = async () => {
  db = await initDb();

  // ------------------------------------------------------
  // LOGIN
  // ------------------------------------------------------
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (username === (process.env.ADMIN_USERNAME || "admin") && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
      return res.json({ success: true });
    }

    res.status(401).json({ error: "Ungültige Zugangsdaten" });
  });

  // ------------------------------------------------------
  // GALERIE ERSTELLEN
  // ------------------------------------------------------
  app.post("/api/create-gallery", async (req, res) => {
    try {
      const { name } = req.body;

      // immer sichere ID mit 13 Stellen erzeugen
      const id = Date.now().toString().slice(0, 13);

      const now = Date.now();
      const expiresAt = now + 48 * 60 * 60 * 1000;

      await db.run(
        `INSERT INTO galleries
          (id, name, createdAt, expiresAt, zipReady, zipError, zipProgress, uploadSuccess)
         VALUES (?, ?, ?, ?, 0, 0, 0, 0)`,
        [id, name || "Galerie", now, expiresAt]
      );

      console.log(`📁 Neue Galerie erstellt: ${id}`);
      res.json({ galleryId: id });

    } catch (err) {
      console.error("❌ Fehler bei /api/create-gallery:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });


// ------------------------------------------------------
// PRESIGNED R2 UPLOAD URL
// ------------------------------------------------------
app.post("/api/get-upload-url", async (req, res) => {
  try {
    const { galleryId, filename, contentType } = req.body;

    if (!galleryId || !filename) {
      return res.status(400).json({ error: "Missing galleryId or filename" });
    }

    const key = `${galleryId}/${filename}`;
    const uploadUrl = await getR2UploadUrl(
      key,
      contentType || "application/octet-stream"
    );

    console.log(`🔐 Presigned URL erzeugt: ${key}`);

    res.json({ key, uploadUrl });

  } catch (err) {
    console.error("❌ Fehler bei /api/get-upload-url:", err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});


// Original bytes go straight to R2; the API only handles upload metadata.
app.post("/api/multipart/:action", async (req, res) => {
  try {
    const { galleryId, filename, contentType, key, uploadId, partNumber, parts } = req.body;
    const gallery = await db.get("SELECT * FROM galleries WHERE id = ?", [galleryId]);
    if (!gallery) return res.sendStatus(404);
    if (gallery.expiresAt < Date.now() && req.params.action !== "abort") return res.sendStatus(410);
    if (req.params.action === "start") {
      if (typeof filename !== "string" || !filename) return res.sendStatus(400);
      const objectKey = `${galleryId}/originals/${randomUUID()}/${filename.split(/[\\/]/).pop()}`;
      const result = await beginMultipart(objectKey, contentType || "application/octet-stream");
      return res.json({ key: objectKey, uploadId: result.UploadId });
    }
    if (typeof key !== "string" || !key.startsWith(`${galleryId}/originals/`) || typeof uploadId !== "string" || !uploadId) return res.sendStatus(400);
    if (req.params.action === "part") {
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) return res.sendStatus(400);
      return res.json({ url: await signMultipartPart(key, uploadId, partNumber) });
    }
    if (req.params.action === "complete") {
      if (!Array.isArray(parts) || !parts.length || parts.length > 10000 || parts.some((part, i) => part.PartNumber !== i + 1 || typeof part.ETag !== "string" || !part.ETag)) return res.sendStatus(400);
      await finishMultipart(key, uploadId, parts);
    } else if (req.params.action === "abort") await cancelMultipart(key, uploadId);
    else return res.sendStatus(404);
    res.json({ success: true });
  } catch (error) { res.status(502).json({ error: "Upload-Schritt fehlgeschlagen" }); }
});

// ------------------------------------------------------
// DATEI REGISTRIEREN
// ------------------------------------------------------
app.post("/api/register-file", async (req, res) => {
  try {
    const { galleryId, key, originalname, sizeBytes, lastModified } = req.body;

    if (!galleryId || !key || !originalname) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const inserted = await db.run(
      `INSERT INTO files (galleryId, filename, originalname, sizeBytes, uploadedAt, lastModified)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [galleryId, key, originalname, Number.isSafeInteger(sizeBytes) && sizeBytes >= 0 ? sizeBytes : 0, Date.now(),
        Number.isSafeInteger(lastModified) && lastModified > 0 ? lastModified : null]
    );

    if (isVideo(originalname)) {
      const file = await db.get("SELECT * FROM files WHERE id = ?", [inserted.lastID]);
      videoPreviews.ensure(db, file, "thumbnail").catch(error => console.warn("Video-Vorschaubild:", file.id, error.message));
      videoPreviews.ensure(db, file).catch(error => console.warn("Video-Vorschau:", file.id, error.message));
    }
    console.log(`📝 Datei registriert → ${originalname}`);
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Fehler /api/register-file:", err);
    res.status(500).json({ error: "Internal error" });
  }
});




  // ------------------------------------------------------
  // GALERIE LADEN
  // ------------------------------------------------------
  app.get("/api/gallery/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const gallery = await db.get(
        `SELECT * FROM galleries WHERE id = ?`,
        [id]
      );

      if (!gallery) return res.status(404).json({ error: "Gallery not found" });
      if (gallery.expiresAt < Date.now()) {
        return res.status(410).json({ error: "Link expired" });
      }

      const files = await db.all(
        `SELECT * FROM files
         WHERE galleryId = ?
         ORDER BY originalname COLLATE NOCASE`,
        [id]
      );

      const mediaTtl = Math.max(1, Math.ceil((gallery.expiresAt - Date.now()) / 1000));
      const filesWithUrls = await Promise.all(
        files.map(async (f) => ({
          ...f,
          url: await getSignedR2Url(f.filename, mediaTtl),
	  thumbnailUrl: f.thumbnail ? await getSignedR2Url(f.thumbnail, mediaTtl) :
            (isPreviewImage(f.originalname) || isVideo(f.originalname)) ? `/api/media/${id}/${f.id}/thumbnail` : null,
          previewUrl: f.preview ? await getSignedR2Url(f.preview, mediaTtl) :
            isPreviewImage(f.originalname) ? `/api/media/${id}/${f.id}/preview` : null
        }))
      );

      res.setHeader("Cache-Control", "private, no-store");
      res.json({ gallery, files: filesWithUrls });

    } catch (e) {
      console.error("❌ Fehler /api/gallery:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/media/:galleryId/:fileId/:variant", async (req, res) => {
    try {
      const { galleryId, fileId, variant } = req.params;
      if (!["thumbnail", "preview"].includes(variant)) return res.sendStatus(404);
      const gallery = await db.get("SELECT * FROM galleries WHERE id = ?", [galleryId]);
      if (!gallery) return res.sendStatus(404);
      if (gallery.expiresAt < Date.now()) return res.sendStatus(410);
      const file = await db.get("SELECT * FROM files WHERE id = ? AND galleryId = ?", [fileId, galleryId]);
      if (!file || (!isPreviewImage(file.originalname) && !isVideo(file.originalname))) return res.sendStatus(404);
      if (isVideo(file.originalname) && variant === "preview" && !file.preview) return res.sendStatus(409);
      let key = file[variant];
      if (!key) {
        try { key = (await (isVideo(file.originalname) ? videoPreviews.ensure(db, file, variant) : ensurePreview(db, file)))[variant]; }
        catch (error) {
          console.warn("Vorschau fehlgeschlagen:", file.id, error.message);
          if (isVideo(file.originalname)) return res.sendStatus(503);
          key = file.filename;
        }
      }
      res.setHeader("Cache-Control", "private, no-store");
      res.redirect(await getSignedR2Url(key, Math.max(1, Math.ceil((gallery.expiresAt - Date.now()) / 1000))));
    } catch (error) {
      res.status(500).json({ error: "Vorschau konnte nicht geladen werden" });
    }
  });

  app.get("/api/video-status/:galleryId/:fileId", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const { galleryId, fileId } = req.params;
      const gallery = await db.get("SELECT * FROM galleries WHERE id = ?", [galleryId]);
      if (!gallery) return res.sendStatus(404);
      if (gallery.expiresAt < Date.now()) return res.sendStatus(410);
      const file = await db.get("SELECT * FROM files WHERE id = ? AND galleryId = ?", [fileId, galleryId]);
      if (!file || !isVideo(file.originalname)) return res.sendStatus(404);
      let status = videoPreviews.state(file);
      if (status === "pending") {
        videoPreviews.ensure(db, file).catch(error => console.warn("Video-Vorschau:", file.id, error.message));
        status = "processing";
      }
      res.json({ status, url: file.preview ? await getSignedR2Url(file.preview,
        Math.max(1, Math.ceil((gallery.expiresAt - Date.now()) / 1000))) : null });
    } catch (error) { res.status(500).json({ error: "Video-Status nicht verfügbar" }); }
  });

  // ------------------------------------------------------
  // FINALIZE → ZIP ERSTELLEN STARTEN
  // ------------------------------------------------------
  app.post("/api/finalize-gallery", async (req, res) => {
    try {
      const { galleryId } = req.body;

      if (!galleryId) {
        return res.status(400).json({ error: "galleryId missing" });
      }

      const gallery = await db.get(
        `SELECT * FROM galleries WHERE id = ?`,
        [galleryId]
      );

      if (!gallery) {
        return res.status(404).json({ error: "Gallery not found" });
      }

      const fileCount = await db.get(
        `SELECT COUNT(*) AS cnt FROM files WHERE galleryId = ?`,
        [galleryId]
      );

      if (!fileCount || fileCount.cnt === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      await db.run(
        `UPDATE galleries
         SET uploadSuccess = 1,
             zipProgress = 0,
             zipReady = 0,
             zipError = 0
         WHERE id = ?`,
        [galleryId]
      );

      console.log(`📦 ZIP Erstellung gestartet für Galerie ${galleryId}`);

      createZipInBackground(galleryId).catch((err) => {
        console.error(`❌ ZIP Fehler bei Galerie ${galleryId}:`, err);
      });

      res.json({ success: true });

    } catch (err) {
      console.error("❌ Fehler /api/finalize-gallery:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ------------------------------------------------------
  // ZIP PROGRESS
  // ------------------------------------------------------
  app.get("/api/zip-progress/:id", async (req, res) => {
    const row = await db.get(
      `SELECT zipProgress, zipReady, zipError
       FROM galleries
       WHERE id = ?`,
      [req.params.id]
    );

    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  // ------------------------------------------------------
  // ZIP DOWNLOAD URL
  // ------------------------------------------------------
  async function reportZipDownloadError(res, galleryId, error) {
    if (error.rebuild) {
      await db.run("UPDATE galleries SET zipReady = 0, zipError = 1 WHERE id = ?", [galleryId]);
    }
    res.setHeader("Cache-Control", "private, no-store");
    if (error.contentRange) res.setHeader("Content-Range", error.contentRange);
    res.status(error.status || 502).json({
      error: error.message || "ZIP-Download fehlgeschlagen",
      zipError: !!error.rebuild
    });
  }

  app.get("/api/download-zip/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const gallery = await db.get("SELECT * FROM galleries WHERE id = ?", [id]);
      if (!gallery) return res.status(404).json({ error: "Gallery not found" });
      if (gallery.expiresAt < Date.now()) return res.sendStatus(410);
      if (!gallery.zipReady) return res.status(409).json({ error: "ZIP nicht bereit", zipError: !!gallery.zipError });
      // Check a few bytes before returning a download URL, so the gallery can
      // show errors rather than saving a tiny JSON/HTML response as a ZIP.
      const checked = await openZipDownload(id, { signal: AbortSignal.timeout(15000), range: "bytes=0-3" });
      checked.body.destroy();
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ url: `/api/download-zip/${encodeURIComponent(id)}/file` });
    } catch (error) { await reportZipDownloadError(res, id, error); }
  });

  app.post("/api/retry-zip/:id", async (req, res) => {
    try {
      const gallery = await db.get("SELECT * FROM galleries WHERE id = ?", [req.params.id]);
      if (!gallery) return res.sendStatus(404);
      if (gallery.expiresAt < Date.now()) return res.sendStatus(410);
      if (!gallery.uploadSuccess || !gallery.zipError) {
        return res.status(409).json({ error: "ZIP kann derzeit nicht neu gestartet werden" });
      }
      createZipInBackground(gallery.id).catch(error => console.error("ZIP retry:", error));
      res.status(202).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "ZIP-Neustart fehlgeschlagen" });
    }
  });

  app.get("/api/download-zip/:id/file", async (req, res) => {
    const controller = new AbortController();
    res.once("close", () => controller.abort());
    try {
      const gallery = await db.get("SELECT * FROM galleries WHERE id = ?", [req.params.id]);
      if (!gallery) return res.sendStatus(404);
      if (gallery.expiresAt < Date.now()) return res.sendStatus(410);
      if (!gallery.zipReady) return res.status(409).json({ error: "ZIP nicht bereit" });
      const upstream = await openZipDownload(gallery.id, { signal: controller.signal, range: req.headers.range });
      res.status(upstream.status);
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="gallery-${gallery.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip"`);
      res.setHeader("Cache-Control", "private, no-store");
      for (const header of ["content-length", "content-range", "accept-ranges"]) {
        if (upstream.headers.has(header)) res.setHeader(header, upstream.headers.get(header));
      }
      await pipeline(upstream.body, res);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) await reportZipDownloadError(res, req.params.id, error);
      else res.destroy();
    }
  });

  // ------------------------------------------------------
  // ADMIN – ALLE GALERIEN
  // ------------------------------------------------------
  app.get("/api/admin/galleries", async (req, res) => {
    try {
      const list = await db.all(`SELECT * FROM galleries`);

      const enriched = await Promise.all(
        list.map(async (g) => ({
          ...g,
          files: await db.all(
            `SELECT * FROM files WHERE galleryId = ?`,
            [g.id]
          )
        }))
      );

      res.json(enriched);

    } catch (e) {
      console.error("❌ Error /api/admin/galleries:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  //-------------------------------------------------
  // NUKE - Alles Löschen
  // -------------------------------------------------
  app.delete("/api/admin/gallery/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const files = await db.all(`SELECT * FROM files WHERE galleryId = ?`, [id]);

    // R2 löschen
    for (const f of files) {
      try { await deleteFromR2(f.filename); } catch (_) {}
      if (f.preview) {
        try { await deleteFromR2(f.preview); } catch (_) {}
      }
      // wenn du thumbnails speicherst:
      if (f.thumbnail) {
        try { await deleteFromR2(f.thumbnail); } catch (_) {}
      }
    }

    // Bunny ZIP löschen
    try { await deleteZipFromBunny(id); } catch (_) {}

    // lokale temp löschen (optional aber sinnvoll)
    try {
      const p = `/root/PhotoShare/backend/temp/${id}`;
      fs.rmSync(p, { recursive: true, force: true });
    } catch (_) {}

    // DB löschen
    await db.run(`DELETE FROM files WHERE galleryId = ?`, [id]);
    await db.run(`DELETE FROM galleries WHERE id = ?`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Löschen:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

  // ------------------------------------------------------
  // ADMIN – GALERIE LÖSCHEN
  // ------------------------------------------------------
  app.post("/api/admin/nuke", async (req, res) => {
  try {
    const secret = req.headers["x-admin-secret"];
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { confirm } = req.body || {};
    if (confirm !== "DELETE_EVERYTHING") {
      return res.status(400).json({
        error: "Missing confirmation",
        required: 'body.confirm = "DELETE_EVERYTHING"'
      });
    }

    // 1) R2 komplett löschen
    const r2Deleted = await deleteAllFromR2("");

    // 2) Bunny ZIPs löschen (nur gallery-zips)
    const bunnyDeleted = await deleteAllZipsFromBunny();

    // 3) DB leeren
    await db.run("DELETE FROM files");
    await db.run("DELETE FROM galleries");

    res.json({
      success: true,
      r2Deleted,
      bunnyDeleted,
      dbCleared: true
    });
  } catch (err) {
    console.error("❌ /api/admin/nuke:", err);
    res.status(500).json({ error: "Internal error" });
  }
});


  // ------------------------------------------------------
  // START SERVER
  // ------------------------------------------------------
  app.listen(PORT, process.env.HOST || "127.0.0.1", () => console.log(`🚀 Backend läuft auf Port ${PORT}`));
};

start();
