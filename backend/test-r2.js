import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  }
});

async function testR2() {
  console.log("🔍 TESTE R2 VERBINDUNG...\n");

  try {
    // 1️⃣ LISTE BEREITS VORHANDENE OBJEKTE
    const list = await client.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET
    }));

    console.log("📦 Objekte im Bucket:");
    console.log(list.Contents || "Keine Objekte vorhanden.");
  } catch (err) {
    console.error("❌ Fehler beim Listing:", err.message);
    return;
  }

  // 2️⃣ TESTUPLOAD
  try {
    const body = "Hello from test script!";
    const key = "test-upload.txt";

    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "text/plain"
    }));

    console.log("✅ Upload erfolgreich:", key);
  } catch (err) {
    console.error("❌ Fehler beim Upload:", err.message);
    return;
  }

  // 3️⃣ DOWNLOAD TEST
  try {
    const result = await client.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: "test-upload.txt"
    }));

    const text = await result.Body.transformToString();
    console.log("📥 Download erfolgreich, Inhalt:", text);
  } catch (err) {
    console.error("❌ Fehler beim Download:", err.message);
    return;
  }

  console.log("\n🎉 ALLES OK — R2 Credentials funktionieren!");
}

testR2();
