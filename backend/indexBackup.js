// backend/index.js
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import initDb from './database.js'
import uploadStreamRouter from './uploadStreamRouter.js'
import { deleteFromR2, getSignedR2Url } from './r2.js'

dotenv.config()

const app = express()
const PORT = 3000
let db

app.use(cors())
app.use(express.json())
app.use('/api', uploadStreamRouter)

const start = async () => {
  db = await initDb()

  // 🔒 Login
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body
    if (username === (process.env.ADMIN_USERNAME || "admin") && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
      return res.json({ success: true })
    }
    res.status(401).json({ error: 'Ungültige Zugangsdaten' })
  })

  // 📂 Galerie + ZIP-Status
  app.get('/api/gallery/:id', async (req, res) => {
    const { id } = req.params

    try {
      const gallery = await db.get(`SELECT * FROM galleries WHERE id = ?`, [id])
      if (!gallery) return res.status(404).json({ error: 'Gallery not found' })
      if (gallery.expiresAt && Date.now() > gallery.expiresAt)
        return res.status(410).json({ error: 'Link expired' })

      const files = await db.all(`SELECT * FROM files WHERE galleryId = ?`, [id])
      files.sort((a, b) => a.originalname.localeCompare(b.originalname, 'de', { numeric: true }))

      // 📦 ZIP-Status prüfen (R2 oder Public Domain)
      let zipReady = false
      const zipKey = `gallery-zips/${id}.zip`
      const publicDomain = process.env.R2_PUBLIC_DOMAIN?.trim()
      const checkUrl = publicDomain
        ? `https://${publicDomain}/${zipKey}`
        : `${process.env.R2_ENDPOINT.replace(/^https?:\/\//, '')}/${process.env.R2_BUCKET}/${zipKey}`

      try {
        const head = await fetch(checkUrl, { method: 'HEAD' })
        if (head.ok) {
          zipReady = true
          console.log(`✅ [ZIP] Bereit: ${zipKey}`)
        } else {
          console.log(`⏳ [ZIP] Noch nicht bereit (Status ${head.status}): ${zipKey}`)
        }
      } catch (err) {
        console.warn(`⚠️ [ZIP] HEAD-Check fehlgeschlagen:`, err.message)
      }

      const filesWithUrls = files.map(f => ({
        ...f,
        url: await getSignedR2Url(f.filename)}
      }))

      res.json({
        gallery: {
          id: gallery.id,
          name: gallery.name,
          createdAt: gallery.createdAt,
          expiresAt: gallery.expiresAt,
          zipReady,
          zipProgress: gallery.zipProgress || 0
        },
        files: filesWithUrls
      })
    } catch (err) {
      console.error(`❌ [API] Fehler beim Laden der Galerie ${id}:`, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // 📦 Download-Route → liefert signierte URL direkt zurück
 // in index.js
app.get("/api/download-zip/:galleryId", async (req, res) => {
  const { galleryId } = req.params;
  const key = `gallery-zips/${galleryId}.zip`;

  try {
    const signedUrl = await getSignedR2Url(key);

    return res.json({
      url: signedUrl
    });
  } catch (err) {
    console.error("❌ Fehler beim Erstellen der signierten URL:", err);
    return res.status(500).json({ error: "ZIP nicht bereit" });
  }
});


  // 🧰 Proxy für Medien
  //app.get('/api/proxy/:galleryId/:filename', async (req, res) => {
    //try {
      //const { galleryId, filename } = req.params
     // const key = `${galleryId}/${filename}`
    //  const signedUrl = await getSignedR2Url(key)
  //    const response = await fetch(signedUrl)
//      if (!response.ok) return res.status(500).send('Fehler beim Abrufen der Datei')

      //fehlt was
   // } catch (err) {
   //   console.error('❌ Proxy-Fehler:', err)
   //   res.status(500).json({ error: 'Proxy-Fehler' })
   // }
  //})

  // 🗑️ Galerie löschen
  app.delete('/api/admin/gallery/:id', async (req, res) => {
    const { id } = req.params
    try {
      const files = await db.all(`SELECT * FROM files WHERE galleryId = ?`, [id])
      for (const f of files) {
        if (f.filename) try { await deleteFromR2(f.filename) } catch {}
      }
      try { await deleteFromR2(`gallery-zips/${id}.zip`) } catch {}

      await db.run(`DELETE FROM files WHERE galleryId = ?`, [id])
      await db.run(`DELETE FROM galleries WHERE id = ?`, [id])
      console.log(`🗑️ Galerie ${id} gelöscht`)
      res.json({ success: true })
    } catch (err) {
      console.error('❌ Fehler beim Löschen:', err)
      res.status(500).json({ error: 'Fehler beim Löschen' })
    }
  })

// 🔧 Admin: Alle Galerien abrufen
app.get('/api/admin/galleries', async (req, res) => {
  try {
    const galleries = await db.all(`SELECT * FROM galleries`)
    const withFiles = await Promise.all(
      galleries.map(async g => ({
        ...g,
        files: await db.all(`SELECT * FROM files WHERE galleryId = ?`, [g.id])
      }))
    )
    res.json(withFiles)
  } catch (err) {
    console.error('❌ Fehler bei /api/admin/galleries:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// Liefert signierte R2-URL für ZIP-Download
app.get('/api/download-zip/:id', async (req, res) => {
  const { id } = req.params
  const key = `gallery-zips/${id}.zip`
  try {
    const signedUrl = await getSignedR2Url(key)
    res.json({ url: signedUrl })
  } catch (err) {
    console.error('❌ Fehler beim Generieren der Download-URL:', err)
    res.status(500).json({ error: 'Fehler beim Download-Link' })
  }
})

// 📊 ZIP-Progress API – wird vom Frontend alle 2s abgefragt
app.get('/api/zip-progress/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const row = await db.get(
      `SELECT zipProgress, zipReady, zipError FROM galleries WHERE id = ?`,
      [id]
    );

    if (!row) {
      console.warn(`⚠️ [ZIP-PROGRESS] Galerie ${id} nicht gefunden`);
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({
      zipProgress: row.zipProgress ?? 0,
      zipReady: row.zipReady ?? 0,
      zipError: row.zipError ?? 0
    });

  } catch (err) {
    console.error('❌ Fehler bei /api/zip-progress:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});


  app.listen(PORT, () => console.log(`🚀 Backend läuft auf Port ${PORT}`))
}

start()
