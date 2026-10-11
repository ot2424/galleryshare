// public/download-sw.js

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  if (url.pathname.startsWith('/sw-download/')) {
    const id = url.pathname.split('/').pop()
    const cdnUrl = `https://cdn.galleryshare.de/gallery-zips/${id}.zip`

    event.respondWith(
      fetch(cdnUrl, {
        cache: "no-store",
        mode: "no-cors"
      })
    )
  }
})

