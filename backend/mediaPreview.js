import sharp from "sharp";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getStreamFromR2, uploadFileStreamSafe } from "./r2.js";

const jobs = new Map();
let queue = Promise.resolve();
export const isPreviewImage = name => /\.(jpe?g|png|webp|avif|heic|heif|tiff?)$/i.test(name || "");

// Existing direct uploads gain cached previews on demand, without re-uploading originals.
export function ensurePreview(db, file) {
  if (jobs.has(file.id)) return jobs.get(file.id);
  const job = queue.then(async () => {
    const current = await db.get("SELECT * FROM files WHERE id = ?", [file.id]);
    if (current.thumbnail && current.preview) return current;
    const image = sharp({ limitInputPixels: 80_000_000 })
      .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true });
    const data = image.toBuffer();
    data.catch(() => {});
    await pipeline(await getStreamFromR2(file.filename), image);
    const preview = await data;
    const thumbnail = await sharp(preview)
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 }).toBuffer();
    const previewKey = `${file.galleryId}/previews/${file.id}.jpg`;
    const thumbKey = `${file.galleryId}/thumbs/${file.id}.jpg`;
    await uploadFileStreamSafe(Readable.from([preview]), previewKey, "image/jpeg");
    await uploadFileStreamSafe(Readable.from([thumbnail]), thumbKey, "image/jpeg");
    await db.run("UPDATE files SET thumbnail = ?, preview = ? WHERE id = ?", [thumbKey, previewKey, file.id]);
    return { ...current, thumbnail: thumbKey, preview: previewKey };
  });
  queue = job.catch(() => {});
  jobs.set(file.id, job);
  job.finally(() => jobs.delete(file.id)).catch(() => {});
  return job;
}
