// backend/uploadStreamRouter.js
import express from "express";
import Busboy from "busboy";
import { uploadFileStreamSafe, deleteFromR2 } from "./r2.js";

export default function createUploadRouter(db) {
  const router = express.Router();

  router.post("/upload-stream", (req, res) => {
    console.log("📩 Neue Upload-Anfrage…");

    const galleryId = Date.now().toString();
    let galleryName = "Galerie";

    const createdAt = Date.now();
    const expiresAt = createdAt + 48 * 60 * 60 * 1000; // 48 Stunden

    const busboy = Busboy({ headers: req.headers });

    const fileTasks = [];
    const uploadedKeys = [];

    // -------------------------------        
    // Felder (Name der Galerie)
    // -------------------------------
    busboy.on("field", (name, value) => {
      if (name === "galleryName" && value.trim()) {
        galleryName = value.trim();
        console.log(`📝 Galerie-Name: ${galleryName}`);
      }
    });

    // -------------------------------
    // Dateien
    // -------------------------------
    busboy.on("file", (fieldname, file, info) => {
      const originalname = info.filename;
      const mimeType = info.mimeType || "application/octet-stream";
      const key = `${galleryId}/${originalname}`;

      uploadedKeys.push(key);

      console.log(`📥 Datei empfangen: ${originalname}`);
      console.log(`📤 Upload zu R2: ${key}`);

      const task = (async () => {
        try {
          await uploadFileStreamSafe(file, key, mimeType);

          await db.run(
            `INSERT INTO files (galleryId, filename, originalname, downloads)
             VALUES (?, ?, ?, 0)`,
            [galleryId, key, originalname]
          );

          console.log(`✅ Upload abgeschlossen: ${originalname}`);
        } catch (err) {
          console.error(`❌ Fehler bei Datei ${originalname}:`, err);
          throw err;
        }
      })();

      fileTasks.push(task);
    });

    // -------------------------------
    // Upload abgeschlossen
    // -------------------------------
    busboy.on("finish", async () => {
      console.log("📦 Upload beendet — warte auf R2-Uploads…");

      if (fileTasks.length === 0) {
        console.warn("⚠️ Keine Dateien vorhanden.");
        return res.status(400).json({ error: "No files uploaded" });
      }

      try {
        await Promise.all(fileTasks);
        console.log("🎉 Alle R2-Uploads wurden erfolgreich abgeschlossen!");

        // -------------------------------
        // Galerie anlegen + uploadSuccess = 1
        // -------------------------------
        await db.run(
          `INSERT INTO galleries
            (id, name, createdAt, expiresAt, zipReady, zipError, zipProgress, uploadSuccess)
           VALUES (?, ?, ?, ?, 0, 0, 0, 1)`,
          [galleryId, galleryName, createdAt, expiresAt]
        );

        console.log(`🗂️ Galerie gespeichert: ${galleryId}`);

        // -------------------------------
        // ZIP-Generierung starten
        // -------------------------------
        console.log(`📦 Starte ZIP-Erstellung: ${galleryId}`);
        const { default: createZipInBackground } = await import(
          "./createZipInBackground.js"
        );

        createZipInBackground(galleryId).catch((err) =>
          console.error(`❌ ZIP Fehler bei Galerie ${galleryId}:`, err)
        );

        // Sofortige Antwort ans Frontend
        res.json({ success: true, galleryId });

      } catch (err) {
        console.error("❌ Upload fehlgeschlagen. Bereinige…", err);

        for (const key of uploadedKeys) {
          try {
            await deleteFromR2(key);
            console.log(`🗑️ R2 gelöscht: ${key}`);
          } catch (_) {}
        }

        await db.run(`DELETE FROM files WHERE galleryId = ?`, [galleryId]);
        await db.run(`DELETE FROM galleries WHERE id = ?`, [galleryId]);

        res.status(500).json({ error: "Upload failed" });
      }
    });

    req.pipe(busboy);
  });

  return router;
}
