import archiver from "archiver";
import fs from "fs";
import path from "path";
import initDb from "./database.js";
import { uploadZipToBunny } from "./bunny.js";
import { getStreamFromR2 } from "./r2.js";

const ZIP_PROGRESS_STEPS = Number(process.env.ZIP_PROGRESS_STEPS || 12);

export default async function createZipInBackground(galleryId) {
  const db = await initDb();
  const tempZipPath = path.join("/tmp", `${galleryId}.zip`);

  const files = await db.all(
    `SELECT filename, originalname
     FROM files
     WHERE galleryId = ?
     ORDER BY originalname COLLATE NOCASE`,
    [galleryId]
  );

  if (!files.length) {
    await markZipError(db, galleryId);
    throw new Error(`Keine Dateien fuer ZIP in Galerie ${galleryId}`);
  }

  console.log(`ZIP-Erstellung aus R2 gestartet fuer Galerie ${galleryId}`);

  const output = fs.createWriteStream(tempZipPath);
  const archive = archiver("zip", { store: true });
  const total = files.length;
  let processed = 0;
  let lastProgressBucket = -1;

  archive.on("error", (error) => {
    throw error;
  });

  archive.pipe(output);

  for (const file of files) {
    const stream = await getStreamFromR2(file.filename);
    const entryName = getEntryName(file);

    archive.append(stream, { name: entryName });
    processed += 1;

    const bucket = Math.floor((processed / total) * ZIP_PROGRESS_STEPS);
    if (bucket !== lastProgressBucket || processed === total) {
      lastProgressBucket = bucket;
      const progress = Math.min(95, Math.round((processed / total) * 95));
      await db.run(
        `UPDATE galleries SET zipProgress = ? WHERE id = ?`,
        [progress, galleryId]
      );
    }
  }

  await archive.finalize();
  await waitForStreamClose(output);

  console.log("ZIP fertig geschrieben:", tempZipPath);

  const uploaded = await uploadZipToBunny(galleryId, tempZipPath);

  if (!uploaded) {
    await markZipError(db, galleryId);
    await cleanupTempZip(tempZipPath);
    return;
  }

  await db.run(
    `UPDATE galleries
     SET zipReady = 1, zipError = 0, zipProgress = 100
     WHERE id = ?`,
    [galleryId]
  );

  console.log("ZIP auf Bunny hochgeladen");
  await cleanupTempZip(tempZipPath);
}

function getEntryName(file) {
  const preferredName = (file.originalname || "").trim();
  if (preferredName) {
    return preferredName;
  }

  const key = file.filename || "";
  const fallbackName = key.split("/").pop();
  return fallbackName || "datei";
}

async function markZipError(db, galleryId) {
  await db.run(
    `UPDATE galleries
     SET zipError = 1, zipReady = 0
     WHERE id = ?`,
    [galleryId]
  );
}

function waitForStreamClose(stream) {
  return new Promise((resolve, reject) => {
    stream.on("close", resolve);
    stream.on("error", reject);
  });
}

async function cleanupTempZip(tempZipPath) {
  try {
    await fs.promises.rm(tempZipPath, { force: true });
    console.log(`Temp ZIP geloescht: ${tempZipPath}`);
  } catch (error) {
    console.error("Fehler beim Loeschen der ZIP:", error);
  }
}
