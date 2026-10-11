import "./env.js";
// backend/bunny.js
import fs from "fs";
import fetch from "node-fetch";

const {
  BUNNY_STORAGE_ZONE,
  BUNNY_API_KEY,
  BUNNY_STORAGE_HOST,
  BUNNY_CDN_HOST
} = process.env;

if (!BUNNY_STORAGE_ZONE || !BUNNY_API_KEY || !BUNNY_STORAGE_HOST || !BUNNY_CDN_HOST) {
  console.error("❌ Bunny ENV Variablen fehlen!");
}

export async function uploadZipToBunny(galleryId, zipFilePath) {
  try {
    // ✔ STREAM statt Buffer → unterstützt > 2GB
    const stream = fs.createReadStream(zipFilePath);

    const url = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/gallery-zips/${galleryId}.zip`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        AccessKey: BUNNY_API_KEY,
        "Content-Type": "application/zip",
        "Content-Length": String((await fs.promises.stat(zipFilePath)).size)
      },
      body: stream
    });

    if (!res.ok) {
      console.error(`❌ Bunny Upload fehlgeschlagen: ${res.status}`);
      return false;
    }

    console.log(`📤 [Bunny] ZIP hochgeladen → ${galleryId}`);
    return true;

  } catch (err) {
    console.error(`❌ Fehler bei Bunny Upload für ${galleryId}:`, err);
    return false;
  }
}

export async function deleteZipFromBunny(galleryId) {
  try {
    const url = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/gallery-zips/${galleryId}.zip`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { AccessKey: BUNNY_API_KEY }
    });

    if (res.ok) {
      console.log(`🗑️ [Bunny] ZIP gelöscht: ${galleryId}`);
    } else {
      console.warn(`⚠️ Bunny Delete fehlgeschlagen: ${res.status}`);
    }

  } catch (err) {
    console.error(`❌ Bunny Delete Error für ${galleryId}:`, err);
  }
}

export async function deleteAllZipsFromBunny() {
  // Löscht ALLE Dateien im Ordner /gallery-zips
  // Bunny list endpoint: GET /{zone}/{path}/  → liefert JSON Array
  let deleted = 0;

  try {
    const listUrl = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/gallery-zips/`;

    const listRes = await fetch(listUrl, {
      method: "GET",
      headers: { AccessKey: BUNNY_API_KEY }
    });

    if (!listRes.ok) {
      console.error(`❌ Bunny LIST fehlgeschlagen: ${listRes.status}`);
      return 0;
    }

    const items = await listRes.json(); // Array
    // Erwartete Struktur meistens: [{ ObjectName, IsDirectory, Length, ... }, ...]

    for (const it of items) {
      const name = it.ObjectName;          // z.B. "123.zip"
      const isDir = it.IsDirectory === true;

      if (!name) continue;
      if (isDir) continue; // wir erwarten hier nur .zip files

      const delUrl = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/gallery-zips/${name}`;

      const delRes = await fetch(delUrl, {
        method: "DELETE",
        headers: { AccessKey: BUNNY_API_KEY }
      });

      if (delRes.ok) {
        deleted++;
        console.log(`🗑️ [Bunny] gelöscht: gallery-zips/${name}`);
      } else {
        console.warn(`⚠️ [Bunny] Delete fehlgeschlagen (${name}): ${delRes.status}`);
      }
    }

    console.log(`🧹 [Bunny] Alle ZIPs gelöscht → ${deleted} Dateien`);
    return deleted;

  } catch (err) {
    console.error("❌ deleteAllZipsFromBunny error:", err);
    return deleted;
  }
}


export function getBunnyZipUrl(galleryId) {
  return `${BUNNY_CDN_HOST}/gallery-zips/${galleryId}.zip`;
}
