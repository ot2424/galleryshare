import archiver from "archiver";
import fs from "fs";
import path from "path";
import { once } from "node:events";
import initDb from "./database.js";
import { uploadZipToBunny } from "./bunny.js";
import { getStreamFromR2 } from "./r2.js";


export default createZipBuilder({ initDb, getStreamFromR2, uploadZipToBunny });

export function createZipBuilder({ initDb, getStreamFromR2, uploadZipToBunny }) {
  const jobs = new Map();
  let queue = Promise.resolve();

  function createZipInBackground(galleryId) {
    if (jobs.has(galleryId)) return jobs.get(galleryId);
    const job = queue.then(() => buildZip(galleryId)).finally(() => jobs.delete(galleryId));
    queue = job.catch(() => {});
    jobs.set(galleryId, job);
    return job;
  }

  async function buildZip(galleryId) {
    const db = await initDb();
    const tempZipPath = path.join(process.env.ZIP_TEMP_DIR || "/tmp", `gallery-${galleryId}.zip`);
    let archive;
    let output;
    const sources = new Set();
    try {
      await db.run("UPDATE galleries SET zipReady = 0, zipError = 0, zipProgress = 0 WHERE id = ?", [galleryId]);
      const files = await db.all(
        "SELECT filename, originalname, sizeBytes FROM files WHERE galleryId = ? ORDER BY originalname COLLATE NOCASE",
        [galleryId]
      );
      if (!files.length) throw new Error("Keine Dateien für ZIP");
      const space = await fs.promises.statfs(path.dirname(tempZipPath));
      const estimatedSize = files.reduce((sum, file) => sum + (file.sizeBytes || 0), 0);
      if (space.bavail * space.bsize < estimatedSize + 1024 ** 3) {
        throw new Error("Nicht genügend freier Speicher für ZIP");
      }

      output = fs.createWriteStream(tempZipPath);
      archive = archiver("zip", { store: true, forceZip64: true });
      // Register completion before finalize: close may happen before finalize resolves.
      const completed = new Promise((resolve, reject) => {
        output.once("close", resolve);
        output.once("error", reject);
        archive.once("error", reject);
        archive.on("warning", reject);
      });
      // Handle rejection immediately, including while awaiting R2 requests.
      completed.catch(() => {});
      archive.pipe(output);
      archive.on("entry", () => {
        processed += 1;
        const progress = Math.min(95, Math.round(processed / files.length * 95));
        updates = updates.then(() => db.run(
          "UPDATE galleries SET zipProgress = ? WHERE id = ?", [progress, galleryId]
        ));
        updates.catch(() => {});
      });
      let processed = 0;
      let updates = Promise.resolve();
      for (const file of files) {
        const stream = await getStreamFromR2(file.filename);
        sources.add(stream);
        stream.once("error", error => archive.destroy(error));
        const entryWritten = once(archive, "entry");
        archive.append(stream, { name: getEntryName(file) });
        await Promise.race([entryWritten, completed.then(() => { throw new Error("ZIP stream closed prematurely"); })]);
        sources.delete(stream);
      }
      await Promise.all([archive.finalize(), completed]);
      await updates;
      if (!await uploadZipToBunny(galleryId, tempZipPath)) {
        throw new Error("ZIP-Upload zu Bunny fehlgeschlagen");
      }
      await db.run(
        "UPDATE galleries SET zipReady = 1, zipError = 0, zipProgress = 100 WHERE id = ?",
        [galleryId]
      );
    } catch (error) {
      archive?.abort();
      for (const source of sources) source.destroy();
      if (output && !output.closed) {
        await new Promise(resolve => {
          output.once("close", resolve);
          output.destroy();
        });
      }
      await markZipError(db, galleryId);
      throw error;
    } finally {
      await cleanupTempZip(tempZipPath);
    }
  }

  return createZipInBackground;
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

async function cleanupTempZip(tempZipPath) {
  try {
    await fs.promises.rm(tempZipPath, { force: true });
    console.log(`Temp ZIP gelöscht: ${tempZipPath}`);
  } catch (error) {
    console.error("Fehler beim Löschen der ZIP:", error);
  }
}
