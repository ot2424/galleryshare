// backend/r2.js
import dotenv from "dotenv";
dotenv.config({ path: "/root/PhotoShare/backend/.env" });


import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} from "@aws-sdk/client-s3";

import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn("⚠️ R2-Umgebungsvariablen unvollständig.");
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

// -----------------------------
// GET: signierte URL für Download
// -----------------------------
export async function getSignedR2Url(key, expiresInSeconds = 3600) {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key
  });

  return getSignedUrl(r2, cmd, { expiresIn: expiresInSeconds });
}

// -----------------------------
// Stream aus R2 holen (für ZIP)
// -----------------------------
export async function getStreamFromR2(key) {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key
  });

  const res = await r2.send(cmd);
  return res.Body; // Readable-Stream
}

// -----------------------------
// Delete aus R2
// -----------------------------
export async function deleteFromR2(key) {
  const cmd = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key
  });

  await r2.send(cmd);
  console.log(`🗑️ [R2] Objekt gelöscht: ${key}`);
}

// -----------------------------
// (Optional) klassischer Upload-Stream, falls noch wo genutzt wird
// -----------------------------
export async function uploadFileStreamSafe(stream, key, contentType = "application/octet-stream") {
  const uploader = new Upload({
    client: r2,
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType
    }
  });

  uploader.on("httpUploadProgress", (p) => {
    if (p.PartNumber) {
      console.log(`📤 [R2] Part ${p.PartNumber} hochgeladen`);
    }
  });

  await uploader.done();
  console.log(`✅ [R2] Upload vollständig → ${key}`);
}

// -----------------------------
// NEU: Presigned PUT-URL für Direkt-Upload vom Browser
// -----------------------------
export async function getR2UploadUrl(key, contentType = "application/octet-stream", expiresInSeconds = 3600) {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType
  });

  const url = await getSignedUrl(r2, cmd, { expiresIn: expiresInSeconds });
  return url;
}

// -------------------------------------
// Lösche alles aus R2
// -------------------------------------
export async function deleteAllFromR2(prefix = "") {
  let ContinuationToken = undefined;
  let deleted = 0;

  do {
    const listRes = await r2.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix || undefined,
        ContinuationToken
      })
    );

    const objects = (listRes.Contents || []).map((o) => ({ Key: o.Key }));
    if (objects.length) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: { Objects: objects, Quiet: true }
        })
      );
      deleted += objects.length;
    }

    ContinuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (ContinuationToken);

  console.log(`🧹 [R2] Alles gelöscht (prefix="${prefix}") → ${deleted} Objekte`);
  return deleted;
}

