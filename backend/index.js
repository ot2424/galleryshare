// backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import initDb from "./database.js";
import uploadStreamRouter from "./uploadStreamRouter.js";
import fs from "fs";
import {
  deleteFromR2,
  getSignedR2Url,
  getR2UploadUrl,
  deleteAllFromR2
} from "./r2.js";

import {
  deleteAllZipsFromBunny,
  getBunnyZipUrl
} from "./bunny.js";

dotenv.config();
dotenv.config({ path: "/root/PhotoShare/backend/.env", override: false });

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


// ------------------------------------------------------
// DATEI REGISTRIEREN
// ------------------------------------------------------
app.post("/api/register-file", async (req, res) => {
  try {
    const { galleryId, key, originalname } = req.body;

    if (!galleryId || !key || !originalname) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await db.run(
      `INSERT INTO files (galleryId, filename, originalname)
       VALUES (?, ?, ?)`,
      [galleryId, key, originalname]
    );

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

      const filesWithUrls = await Promise.all(
        files.map(async (f) => ({
          ...f,
          url: await getSignedR2Url(f.filename),
	  thumbnailUrl: f.thumbnail ? await getSignedR2Url(f.thumbnail): null
        }))
      );

      res.json({ gallery, files: filesWithUrls });

    } catch (e) {
      console.error("❌ Fehler /api/gallery:", e);
      res.status(500).json({ error: "Internal server error" });
    }
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

      const { default: createZipInBackground } = await import(
        "./createZipInBackground.js"
      );

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
  app.get("/api/download-zip/:id", async (req, res) => {
    const { id } = req.params;

    const gallery = await db.get(
      `SELECT * FROM galleries WHERE id = ?`,
      [id]
    );

    if (!gallery)
      return res.status(404).json({ error: "Gallery not found" });

    if (!gallery.zipReady)
      return res.status(400).json({ error: "ZIP not ready" });

    res.json({ url: getBunnyZipUrl(id) });
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
  app.listen(PORT, () => console.log(`🚀 Backend läuft auf Port ${PORT}`));
};

start();
