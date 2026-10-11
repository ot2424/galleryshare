import { ZipWriter, BlobWriter, Uint8ArrayReader } from "@zip.js/zip.js";

export default {
  async fetch(request, env) {
    const { searchParams } = new URL(request.url);
    const galleryId = searchParams.get("id");
    if (!galleryId) {
      return new Response("❌ Missing ?id=", { status: 400 });
    }

    try {
      // Prüfen, ob ZIP schon existiert
      const zipKey = `gallery-zips/${galleryId}.zip`;
      const existing = await env.R2_BUCKET.head(zipKey);
      if (existing) {
        console.log("✅ ZIP bereits vorhanden, direkt bereitstellen:", zipKey);
        const zip = await env.R2_BUCKET.get(zipKey);
        return new Response(zip.body, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${galleryId}.zip"`,
          },
        });
      }

      // Dateien aus Galerie laden
      const list = await env.R2_BUCKET.list({ prefix: `${galleryId}/` });
      if (!list.objects.length)
        return new Response("⚠️ Keine Dateien gefunden", { status: 404 });

      console.log(`🧩 Erstelle ZIP für Galerie ${galleryId} (${list.objects.length} Dateien)`);

      // ZIP im Speicher erstellen
      const blobWriter = new BlobWriter("application/zip");
      const zipWriter = new ZipWriter(blobWriter);

      for (const obj of list.objects) {
        const file = await env.R2_BUCKET.get(obj.key);
        if (!file || !file.body) continue;

        const filename = obj.key.split("/").pop();
        const arrayBuffer = await file.arrayBuffer();
        await zipWriter.add(filename, new Uint8ArrayReader(new Uint8Array(arrayBuffer)));

        console.log(`📦 Hinzugefügt: ${filename}`);
      }

      await zipWriter.close();
      const zipBlob = await blobWriter.getData();

      // ZIP in R2 hochladen
      await env.R2_BUCKET.put(zipKey, zipBlob, {
        httpMetadata: { contentType: "application/zip" },
      });

      console.log(`✅ ZIP erfolgreich erstellt & in R2 gespeichert: ${zipKey}`);

      return new Response(zipBlob.stream(), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${galleryId}.zip"`,
        },
      });
    } catch (err) {
      console.error("❌ Worker Fehler:", err);
      return new Response("Worker Error: " + err.message, { status: 500 });
    }
  },
};
