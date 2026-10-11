import fetch from 'node-fetch'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import mime from 'mime-types'
import dotenv from 'dotenv'
import initDb from './database.js'
import { uploadToR2, deleteFromR2, getSignedR2Url, r2 } from './r2.js'
import uploadStreamRouter from './uploadStreamRouter.js'
import downloadZipRoute from './downloadZipRoute.js'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'


dotenv.config()

const app = express()
const PORT = 3000

app.use('/api', downloadZipRoute)
app.use('/api', uploadStreamRouter)
app.use(cors())
app.use(express.json())

let db

const start = async () => {
  db = await initDb()

  // 🔒 Login
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body
    if (username === (process.env.ADMIN_USERNAME || "admin") && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
      res.json({ success: true })
    } else {
      res.status(401).json({ error: 'Ungültige Zugangsdaten' })
    }
  })

  // 📂 Galerie anzeigen
  app.get('/api/gallery/:id', async (req, res) => {
    const { id } = req.params
    const gallery = await db.get(`SELECT * FROM galleries WHERE id = ?`, [id])
    if (!gallery) return res.status(404).json({ error: 'Gallery not found' })
    if (Date.now() > gallery.expiresAt) return res.status(410).json({ error: 'Link expired' })

    const files = await db.all(`SELECT * FROM files WHERE galleryId = ?`, [id])
    const filesWithUrls = await Promise.all(
      (files || []).map(async (file) => ({
        ...file,
        url: `/api/proxy/${id}/${encodeURIComponent(file.originalname)}`
      }))
    )

    res.json({ gallery, files: filesWithUrls })
  })

  // 🔧 Admin: Galerien anzeigen
  app.get('/api/admin/galleries', async (req, res) => {
    const galleries = await db.all(`SELECT * FROM galleries`)
    const withFiles = await Promise.all(
      galleries.map(async (g) => {
        const files = await db.all(`SELECT * FROM files WHERE galleryId = ?`, [g.id])
        return { ...g, files: files || [] }
      })
    )
    res.json(withFiles)
  })

  // 🗑️ Admin: Galerie löschen
app.delete('/api/admin/gallery/:id', async (req, res) => {
  const { id } = req.params
  const db = await initDb()

  try {
    // 1️⃣ Alle Dateien aus DB abrufen
    const files = await db.all(`SELECT * FROM files WHERE galleryId = ?`, [id])

    // 2️⃣ Alle Medien-Dateien aus R2 löschen
    for (const file of files) {
      if (file.filename) {
        try {
          await deleteFromR2(file.filename)
        } catch (err) {
          console.warn(`⚠️ Fehler beim Löschen von ${file.filename}:`, err.message)
        }
      }
    }

    // 3️⃣ ZIP-Datei mitlöschen (falls vorhanden)
    const zipKey = `gallery-zips/${id}.zip`
    try {
      await deleteFromR2(zipKey)
      console.log(`🗑️ ZIP ${zipKey} gelöscht`)
    } catch (err) {
      console.warn(`⚠️ ZIP ${zipKey} konnte nicht gelöscht werden (evtl. nicht vorhanden).`)
    }

    // 4️⃣ DB-Einträge löschen
    await db.run(`DELETE FROM files WHERE galleryId = ?`, [id])
    await db.run(`DELETE FROM galleries WHERE id = ?`, [id])

    console.log(`✅ Galerie ${id} erfolgreich gelöscht`)
    res.json({ success: true })
  } catch (err) {
    console.error(`❌ Fehler beim Löschen der Galerie ${id}:`, err)
    res.status(500).json({ success: false, error: 'Interner Serverfehler beim Löschen' })
  }
})





  // Zip NEW
  app.get('/api/proxy/zip/:galleryId', async (req, res) => {
  try {
    const { galleryId } = req.params
    const key = `gallery-zips/${galleryId}.zip`
    const signedUrl = await getSignedR2Url(key)

    const response = await fetch(signedUrl)
    if (!response.ok) return res.status(500).send('ZIP konnte nicht geladen werden')

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${galleryId}.zip"`)

    response.body.pipe(res)
  } catch (err) {
    console.error('❌ ZIP-Proxy Fehler:', err)
    res.status(500).send('Proxy-Fehler')
  }
})

app.get('/api/zip-url/:galleryId', async (req, res) => {
  const { galleryId } = req.params
  const key = `gallery-zips/${galleryId}.zip`

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key
    })

    const signedUrl = await getSignedUrl(r2, command, {
      expiresIn: 60 * 60 // 1 Stunde gültig
    })

    res.json({ signedUrl })
  } catch (err) {
    console.error('Fehler beim Erzeugen der ZIP-URL:', err)
    res.status(404).json({ error: 'Nicht gefunden' })
  }
})



  // Zip Download OLD
  app.get('/api/download-zip/:galleryId', async (req, res) => {
  const { galleryId } = req.params
  const galleryFiles = await db.all(`SELECT * FROM files WHERE galleryId = ?`, [galleryId])
  if (!galleryFiles.length) return res.status(404).json({ error: 'No files found' })

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="gallery-${galleryId}.zip"`)
  res.flushHeaders()  // WICHTIG: Antwort-Header sofort senden!

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.pipe(res)

  for (const file of galleryFiles) {
    try {
      const signedUrl = await getSignedR2Url(file.filename)
      const response = await fetch(signedUrl)

      if (!response.ok || !response.body) {
        console.warn(`⚠️ Fehler beim Abrufen: ${file.originalname}`)
        continue
      }

      archive.append(response.body, { name: file.originalname })
    } catch (err) {
      console.error(`❌ Fehler bei Datei ${file.originalname}:`, err)
    }
  }

  archive.finalize()
})


  // 🧰 PROXY für R2 (CORS umgehen)
  app.get('/api/proxy/:galleryId/:filename', async (req, res) => {
  try {
    const { galleryId, filename } = req.params
    const key = `${galleryId}/${filename}`
    const signedUrl = await getSignedR2Url(key)

    console.log('🔁 Proxy für:', key)
    console.log('🔗 Signed URL:', signedUrl)

    const response = await fetch(signedUrl)

    if (!response.ok) {
      console.error(`❌ Fehler beim Abrufen: ${response.statusText}`)
      return res.status(500).send('Fehler beim Abrufen der Datei')
    }

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
    response.body.pipe(res)
  } catch (err) {
    console.error('❌ Proxy-Fehler:', err)
    res.status(500).json({ error: 'Proxy-Fehler' })
  }
})


  // 🧹 Automatisches Löschen abgelaufener Galerien
  setInterval(async () => {
    const now = Date.now()
    const expired = await db.all(`SELECT * FROM galleries WHERE expiresAt < ?`, [now])

    for (const gallery of expired) {
      const files = await db.all(`SELECT * FROM files WHERE galleryId = ?`, [gallery.id])
      for (const file of files) {
        if (file.filename) await deleteFromR2(file.filename)
      }
      await db.run(`DELETE FROM files WHERE galleryId = ?`, [gallery.id])
      await db.run(`DELETE FROM galleries WHERE id = ?`, [gallery.id])
      console.log(`🧹 Galerie ${gallery.id} automatisch gelöscht`)
    }
  }, 60 * 60 * 1000)

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf http://localhost:${PORT}`)
  })

  server.timeout = 0
}

start()

