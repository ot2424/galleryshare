import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  }
});

export async function getPresignedUploadUrl(filename, galleryId, mimeType) {
  const key = `${galleryId}/${filename}`;

  // 1 Stunde gültig
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  const url = await r2.config.credentials().then(() =>
    r2.middlewareStack
      .clone()
      .resolve((args) => args.request, { input: command }) // request
  );

  return {
    uploadUrl: `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET}/${key}`,
    key,
  };
}
