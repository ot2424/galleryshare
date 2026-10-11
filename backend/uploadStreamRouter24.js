import express from 'express'
import Busboy from 'busboy'
import fs from 'fs'
import path from 'path'
import initDb from './database.js'
import { uploadToR2, deleteFromR2 } from './r2.js'
import createZipInBackground from './createZipInBackground.js'

const router = express.Router()

// POST /api/upload-stream
router.post('/upload-stream', async (req, res) => {
  const db = await initDb()

  const createdAt = Date.now()
  const expiresAt = createdAt + 48 * 60 * 60 * 1000 // 48h
  const galleryId = createdAt.toString()
  let galleryName = 'Untitled Gallery'

  const localDir = `/tmp/${galleryId}`
  fs.mkdirSync(localDir, { recursive: true })

  const uploadPromises = []
  const localFiles = []

  const busboy = Busboy({ headers: req.headers })

  // Felder (z.B. galleryName)
  busboy.on('field', (name, value) => {
    if (name === 'galleryName' && value?.trim()) {
      galleryName = value.trim()
    }
  })

  // Dateien
  busboy.on('file', (fieldname, file, info) => {
    const { filename, mimeType } = info
    if (!filename) return

    const safeName = filename.replace(/\s+/g, '_')
    const filePath = path.join(localDir, safeName)
    const writeStream = fs.createWriteStream(filePath)
    file.pipe(writeStream)

    writeStream.on('finish', () => {
      const key = `${galleryId}/${safeName}`
      const readStream = fs.createReadStream(filePath)

      const p = uploadToR2(readStream, key, mimeType || 'application/octet-stream')
        .then(() =>
          db.run(
            `INSERT INTO files (galleryId, filename, originalname) VALUES (?, ?, ?)`,
            [galleryId, key, safeName]
          )
        )
        .catch(err => {
          console.error(`❌ Fehler beim Upload von ${safeName}:`, err)
          throw err
        })

      uploadPromises.push(p)
      localFiles.push({ localPath: filePath })
    })
  })

  busboy.on('error', async (err) => {
    console.error('❌ Fehler während Upload-Stream:', err)
    await cleanupPartialUpload(galleryId, localFiles, localDir)
    res.status(500).json({ error: 'Upload-Stream abgebrochen' })
  })

  busboy.on('finish', async () => {
    try {
      // Warten bis alle Uploads fertig sind
      await Promise.all(uploadPromises)

      // Lokale Dateien entfernen
      for (const f of localFiles) {
        try { fs.unlinkSync(f.localPath) } catch {}
      }
      try { fs.rmSync(localDir, { recursive: true, force: true }) } catch {}

      // Galerie anlegen
      await db.run(
        `INSERT INTO galleries (id, name, createdAt, expiresAt, zipReady, zipError, zipProgress)
         VALUES (?, ?, ?, ?, 0, 0, 0)`,
        [galleryId, galleryName, createdAt, expiresAt]
      )

      // ZIP-Erstellung im Hintergrund starten (nicht blockierend)
      createZipInBackground(galleryId).catch(err =>
        console.error(`❌ ZIP-Hintergrundfehler für Galerie ${galleryId}:`, err)
      )

      res.status(200).json({ success: true, id: galleryId })
    } catch (err) {
      console.error('❌ Fehler beim Abschluss des Uploads:', err)
      await cleanupPartialUpload(galleryId, localFiles, localDir)
      res.status(500).json({ error: 'Upload fehlgeschlagen' })
    }
  })

  req.pipe(busboy)
})

// Cleanup bei Fehler
async function cleanupPartialUpload(galleryId, localFiles, localDir) {
  console.log(`🧹 Partial Cleanup für Galerie ${galleryId}`)

  // Dateien aus R2 löschen
  for (const f of localFiles) {
    const key = `${galleryId}/${path.basename(f.localPath)}`
    try {
      await deleteFromR2(key)
    } catch (err) {
      console.warn(`⚠️ Fehler beim Löschen aus R2 (${key}):`, err.message)
    }
  }

  // Lokale Dateien löschen
  for (const f of localFiles) {
    try { fs.unlinkSync(f.localPath) } catch {}
  }
  try { fs.rmSync(localDir, { recursive: true, force: true }) } catch {}
}

export default router
