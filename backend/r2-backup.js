import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

// ==========================================================
// ✅ R2 CLIENT INITIALISIERUNG
// ==========================================================
export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY
  },
  forcePathStyle: true,
  defaultsMode: 'legacy'
})

// ==========================================================
// ✅ Multipart-Upload (für große ZIPs > 100 MB)
// ==========================================================
export async function uploadZipMultipart(filePath, key) {
  if (!key) throw new Error("❌ uploadZipMultipart() ohne gültigen Key aufgerufen!")

  const fileSize = fs.statSync(filePath).size
  const partSize = 5 * 1024 * 1024 // 5 MB (Cloudflare Mindestgröße)
  const totalParts = Math.ceil(fileSize / partSize)

  console.log(`📤 [Multipart] Starte Upload: ${key} (${(fileSize / 1024 / 1024).toFixed(2)} MB, ${totalParts} Teile)`)

  const create = await r2.send(new CreateMultipartUploadCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: 'application/zip'
  }))

  const uploadId = create.UploadId
  const parts = []
  const fd = fs.openSync(filePath, 'r')
  const buffer = Buffer.alloc(partSize)

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize
      const end = Math.min(start + partSize, fileSize)
      const length = end - start

      fs.readSync(fd, buffer, 0, length, start)

      console.log(`📦 [Multipart] Lade Teil ${partNumber}/${totalParts} (${(length / 1024 / 1024).toFixed(2)} MB)`)

      const upload = await r2.send(new UploadPartCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: buffer.slice(0, length)
      }))

      parts.push({ ETag: upload.ETag, PartNumber: partNumber })

      // Fortschritt anzeigen
      const percent = ((partNumber / totalParts) * 100).toFixed(1)
      console.log(`📈 [Multipart] Fortschritt: ${percent}%`)
    }

    // Upload abschließen
    await r2.send(new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    }))

    console.log(`✅ [Multipart] Upload abgeschlossen → ${key}`)
  } catch (err) {
    console.error(`❌ [Multipart] Fehler:`, err)
    throw err
  } finally {
    fs.closeSync(fd)
  }
}

// ==========================================================
// ✅ Normaler Upload (für kleine Dateien < 100 MB)
// ==========================================================
export const uploadToR2 = async (body, key, mimeType, contentLength, maxRetries = 3) => {
  if (!key) throw new Error("❌ uploadToR2() ohne gültigen Key aufgerufen!")

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: mimeType,
    ContentLength: contentLength
  })

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`⬆️ [R2] Upload (Versuch ${attempt}) → ${key}, ${contentLength || '?'} Bytes`)
      await r2.send(command)
      console.log(`✅ [R2] Upload erfolgreich → ${key}`)
      return key
    } catch (err) {
      const code = err?.Code || err?.name || 'UnknownError'
      const statusCode = err?.$metadata?.httpStatusCode || '?'
      const retryable = (code?.includes('Internal') || [500, 502].includes(statusCode))

      console.warn(`❌ [R2] Fehler (Versuch ${attempt}):`, code, `(Status ${statusCode})`)
      if (attempt === maxRetries || !retryable) throw err

      const delay = 1000 * attempt
      console.log(`⏳ [R2] Warte ${delay}ms und versuche erneut...`)
      await new Promise(res => setTimeout(res, delay))
    }
  }
}

// ==========================================================
// ✅ Stream abrufen (für Proxy / ZIP-Download)
// ==========================================================
export const getStreamFromR2 = async (key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key
  })
  try {
    const response = await r2.send(command)
    return response.Body
  } catch (err) {
    console.error(`❌ [R2] Fehler beim Stream-Laden von ${key}:`, err)
    throw err
  }
}

// ==========================================================
// ✅ Hilfsfunktionen: Löschen & signierte URLs
// ==========================================================
export const deleteFromR2 = async (key) => {
  if (!key) return
  await r2.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key
  }))
  console.log(`🗑️ [R2] Datei gelöscht → ${key}`)
}

export const getSignedR2Url = async (key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key
  })
  return await getSignedUrl(r2, command, { expiresIn: 48 * 60 * 60 }) // 48h
}
