
export async function downloadGalleryAsZip(files, zipName) {
  const galleryId = extractGalleryIdFromFilename(files[0].filename)

  // 1. Signierte URL vom Server holen
  const res = await fetch(`/api/zip-url/${galleryId}`)
  if (!res.ok) throw new Error('Fehler beim Abrufen der ZIP-URL')
  const data = await res.json()
  const signedUrl = data.signedUrl

  // 2. ZIP direkt über Browser herunterladen (Browser zeigt Fortschritt)
  const link = document.createElement('a')
  link.href = signedUrl
  link.download = zipName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}


function extractGalleryIdFromFilename(filename) {
  return filename.split('/')[0] // oder `split('-')[0]` je nach Struktur
}

