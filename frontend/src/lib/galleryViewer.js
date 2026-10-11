export const isGalleryVideo = name => /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i.test(name || '')

export function gallerySlides(files) {
  return files.map(file => ({
    src: isGalleryVideo(file.originalname) ? (file.previewUrl || 'pending-video.mp4') : (file.previewUrl || file.url),
    type: isGalleryVideo(file.originalname) ? 'html5video' : 'image',
    html5videoFormat: 'video/mp4',
    poster: file.thumbnailUrl || '',
    thumbSrc: file.thumbnailUrl || '',
    downloadSrc: file.url,
    downloadFilename: file.originalname || 'Datei',
    alt: file.originalname || '',
    media: file
  }))
}

// Video slides use Fancybox's Video plugin. Only the active slide gets a source,
// after its cached MP4 is ready; adjacent slides never fetch original videos.
export function createGalleryVideoLoader(galleryId) {
  let active = null
  function stop() {
    if (!active) return
    const previous = active
    active = null
    previous.controller.abort()
    clearTimeout(previous.timer)
    previous.video.pause()
    previous.video.removeAttribute('src')
    previous.video.load()
    previous.status.remove()
  }
  function sync(viewer) {
    const slide = viewer.getSlide()
    const video = slide?.el?.querySelector('video')
    if (active && active.slide === slide && active.video === video) return
    stop()
    if (slide?.type !== 'html5video' || !video) return
    const status = document.createElement('p')
    status.className = 'gallery-video-status'
    status.setAttribute('role', 'status')
    video.parentElement.append(status)
    const state = { slide, video, status, controller: new AbortController(), timer: null }
    active = state
    video.onerror = () => {
      if (active === state) status.textContent = 'Video konnte nicht abgespielt werden. Das Original ist über den Download-Button verfügbar.'
    }
    function ready(url) {
      if (active !== state) return
      status.textContent = ''
      video.src = url
      video.load()
    }
    if (slide.media.previewUrl) { ready(slide.media.previewUrl); return }
    status.textContent = 'Video wird für die Wiedergabe vorbereitet …'
    async function check() {
      try {
        const response = await fetch(`/api/video-status/${galleryId}/${slide.media.id}`, { signal: state.controller.signal })
        if (!response.ok) throw new Error('Video momentan nicht verfügbar. Das Original ist über den Download-Button verfügbar.')
        const data = await response.json()
        if (active !== state) return
        if (data.status === 'ready' && data.url) {
          slide.media.previewUrl = data.url
          ready(data.url)
        } else if (data.status === 'error') {
          status.textContent = 'Video-Verarbeitung fehlgeschlagen. Erneuter Versuch in einer Minute. Das Original ist über den Download-Button verfügbar.'
          state.timer = setTimeout(check, 60000)
        } else state.timer = setTimeout(check, 3000)
      } catch (error) {
        if (active === state && error.name !== 'AbortError') {
          status.textContent = error.message
          state.timer = setTimeout(check, 10000)
        }
      }
    }
    check()
  }
  return { sync, stop }
}
