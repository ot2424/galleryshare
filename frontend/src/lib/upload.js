const PART_SIZE = 64 * 1024 * 1024
const PARALLEL_PARTS = 3
let activeParts = 0
const waitingParts = []

// Shared by all files: one large video can use three connections, while
// several files share the same limit instead of multiplying connections.
function withPartSlot(signal, run) {
  return new Promise((resolve, reject) => {
    waitingParts.push({ signal, run, resolve, reject })
    drainParts()
  })
}
function drainParts() {
  while (activeParts < PARALLEL_PARTS && waitingParts.length) {
    const item = waitingParts.shift()
    if (item.signal.aborted) { item.reject(item.signal.reason); continue }
    activeParts++
    Promise.resolve().then(() => {
      item.signal.throwIfAborted()
      return item.run()
    }).then(item.resolve, item.reject).finally(() => { activeParts--; drainParts() })
  }
}

async function api(action, data, signal) {
  const response = await fetch(`/api/multipart/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data), signal
  })
  if (!response.ok) throw new Error(`Upload-Schritt fehlgeschlagen (${response.status})`)
  return response.json()
}

export async function uploadMultipart(file, galleryId, signal, onBytes) {
  const { key, uploadId } = await api('start', { galleryId, filename: file.name, contentType: file.type || 'application/octet-stream' }, signal)
  const data = { galleryId, key, uploadId }
  let completed = false
  const controller = new AbortController()
  const cancel = () => controller.abort(signal.reason)
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
  const requestSignal = controller.signal
  try {
    const count = Math.ceil(file.size / PART_SIZE)
    const parts = new Array(count)
    let nextPart = 0
    let failure
    async function worker() {
      while (!failure && nextPart < count) {
        const index = nextPart++
        const partNumber = index + 1
        const start = index * PART_SIZE
        const chunk = file.slice(start, Math.min(start + PART_SIZE, file.size))
        try {
          const etag = await withPartSlot(requestSignal, async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                requestSignal.throwIfAborted()
                const { url } = await api('part', { ...data, partNumber }, requestSignal)
                const response = await fetch(url, { method: 'PUT', body: chunk, signal: requestSignal })
                if (!response.ok) throw new Error(`Teil-Upload fehlgeschlagen (${response.status})`)
                const value = response.headers.get('ETag')
                if (!value) throw new Error('R2-CORS muss ETag freigeben (ExposeHeaders).')
                return value
              } catch (error) {
                if (requestSignal.aborted || attempt === 2) throw error
              }
            }
          })
          parts[index] = { PartNumber: partNumber, ETag: etag }
          onBytes(chunk.size)
        } catch (error) {
          if (!failure) { failure = error; controller.abort() }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, count) }, worker))
    if (failure) throw failure
    await api('complete', { ...data, parts }, requestSignal)
    completed = true
    return key
  } finally {
    signal.removeEventListener('abort', cancel)
    if (!completed) {
      // All part requests have settled before the remote upload is aborted.
      await api('abort', data, AbortSignal.timeout(10000)).catch(() => {})
    }
  }
}
