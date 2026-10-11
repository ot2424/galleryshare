import JSZip from 'jszip'

export async function downloadGalleryAsZip(files, zipName, onProgress) {
  const zip = new JSZip()
  const total = files.length
  let completed = 0
  const startTime = Date.now()

  // Phase 1: Vorbereitung (Dateien sammeln)
  for (const file of files) {
    const response = await fetch(file.url)
    const blob = await response.blob()
    zip.file(file.originalname, blob)

    completed++
    if (onProgress) {
      const remaining = Math.ceil(((Date.now() - startTime) / completed) * (total - completed) / 1000)
      onProgress({
        phase: 'preparing',
        remaining
      })
    }
  }

  // Phase 2: ZIP wird generiert und heruntergeladen
  const zipStart = Date.now()
  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      const elapsed = (Date.now() - zipStart) / 1000
      const percent = Math.round(metadata.percent)
      const speed = metadata.percent > 0 ? Math.round((metadata.percent / elapsed) * 10) / 10 : 0
      const remaining = Math.round((elapsed / metadata.percent) * (100 - metadata.percent))

      onProgress({
        phase: 'downloading',
        percent,
        speed,
        remaining
      })
    }
  })

  // Download auslösen
  const a = document.createElement('a')
  a.href = URL.createObjectURL(zipBlob)
  a.download = zipName
  a.click()
}
