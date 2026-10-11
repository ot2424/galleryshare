import express from "express";
import Busboy from "busboy";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import mime from "mime-types";
import initDb from "./database.js";
import { uploadFileStreamSafe } from "./r2.js";

const router = express.Router();
const THUMBNAIL_BLOCKLIST = new Set(["cr2", "cr3", "nef", "arw", "dng", "raf", "rw2"]);
const PROCESS_CONCURRENCY = Number(process.env.UPLOAD_PROCESS_CONCURRENCY || 3);

router.post("/:galleryId", async (req, res) => {
  const { galleryId } = req.params;
  console.log("Upload gestartet für Galerie:", galleryId);

  const localFolder = path.join(process.env.UPLOAD_TEMP_DIR || path.join(process.cwd(), "temp"), galleryId);

  try {
    fs.mkdirSync(localFolder, { recursive: true, mode: 0o755 });
  } catch (error) {
    console.error("Konnte lokalen Ordner nicht anlegen:", error);
    return res.status(500).json({ error: "Could not create local folder" });
  }

  const db = await initDb();
  const busboy = Busboy({ headers: req.headers });
  const savedFiles = [];
  const filePromises = [];
  let aborted = false;

  req.on("aborted", () => {
    aborted = true;
    console.log("Client hat Upload abgebrochen");
    try {
      fs.rmSync(localFolder, { recursive: true, force: true });
    } catch {}
  });

  busboy.on("file", (fieldname, fileStream, info) => {
    const originalname = info.filename;

    if (!originalname) {
      console.warn("Datei ohne Namen übersprungen");
      fileStream.resume();
      return;
    }

    const safeName = originalname.replace(/\s+/g, "_");
    const localPath = path.join(localFolder, safeName);
    const writeStream = fs.createWriteStream(localPath);

    console.log("Lokal speichern:", safeName);
    fileStream.pipe(writeStream);
    savedFiles.push({ originalname, safeName, localPath });

    filePromises.push(
      new Promise((resolve, reject) => {
        writeStream.on("close", resolve);
        writeStream.on("error", reject);
        fileStream.on("error", reject);
      })
    );
  });

  busboy.on("finish", async () => {
    if (aborted) {
      return;
    }

    try {
      await Promise.all(filePromises);
    } catch (error) {
      console.error("Fehler beim lokalen Speichern:", error);
      return res.status(500).json({ error: "Fehler beim Speichern" });
    }

    if (savedFiles.length === 0) {
      try {
        fs.rmSync(localFolder, { recursive: true, force: true });
      } catch {}
      return res.status(400).json({ error: "Keine Dateien gespeichert" });
    }

    console.log(`Alle Dateien lokal gespeichert (${savedFiles.length})`);

    try {
      await runWithConcurrency(savedFiles, PROCESS_CONCURRENCY, async (file) => {
        await processUploadedFile({ db, file, galleryId, localFolder });
      });

      await db.run(
        `UPDATE galleries SET uploadSuccess = 1 WHERE id = ?`,
        [galleryId]
      );

      console.log(`Dateien in DB registriert und nach R2 hochgeladen für Galerie ${galleryId}`);
      return res.json({
        success: true,
        files: savedFiles.map((file) => file.safeName)
      });
    } catch (error) {
      console.error("Fehler bei Verarbeitung oder Upload:", error);
      return res.status(500).json({ error: "Processing error" });
    }
  });

  req.pipe(busboy);
});

export default router;

async function processUploadedFile({ db, file, galleryId, localFolder }) {
  const thumbName = `thumb_${file.safeName}.jpg`;
  const thumbPath = path.join(localFolder, thumbName);
  const r2Key = `${galleryId}/${file.safeName}`;
  let thumbKey = null;

  if (canGenerateThumbnail(file.safeName)) {
    try {
      await sharp(file.localPath)
        .rotate()
        .resize({ width: 400, withoutEnlargement: true, fit: "inside" })
        .jpeg({ quality: 75, mozjpeg: true })
        .toFile(thumbPath);

      thumbKey = `${galleryId}/thumbs/${thumbName}`;
      console.log(`Thumbnail erstellt: ${thumbName}`);
    } catch (error) {
      console.warn(`Thumbnail konnte nicht erstellt werden für ${file.safeName}:`, error.message);
    }
  }

  await uploadFileStreamSafe(
    fs.createReadStream(file.localPath),
    r2Key,
    mimeFromName(file.safeName)
  );

  if (thumbKey && fs.existsSync(thumbPath)) {
    await uploadFileStreamSafe(fs.createReadStream(thumbPath), thumbKey, "image/jpeg");
  }

  await db.run(
    `INSERT INTO files (galleryId, filename, originalname, thumbnail, downloads, uploadedAt)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [galleryId, r2Key, file.originalname, thumbKey, Date.now()]
  );
}

function mimeFromName(name) {
  return mime.lookup(name) || "application/octet-stream";
}

function canGenerateThumbnail(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return !THUMBNAIL_BLOCKLIST.has(ext);
}

async function runWithConcurrency(items, concurrency, worker) {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  let currentIndex = 0;

  async function next() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => next()));
}
