<template>
  <div class="page-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
    <div class="mx-auto max-w-7xl">
      <section class="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-3xl">
            <span class="eyebrow">Admin Bereich</span>
            <h1 class="mt-5 text-4xl text-[var(--ink)] sm:text-5xl">Galerien verwalten, teilen und sicher wieder schließen.</h1>
            <p cla="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              Dieser Bereich ist auf schnelle Übergabe ausgelegt: neue Galerie anlegen, Upload überwachen,
              Link teilen und alte Inhalte bei Bedarf entfernen.
            </p>
          </div>

          <div cla="flex flex-col gap-3 sm:flex-row">
            <button class="brand-button" @click="showCreateModal = true">Neue Galerie erstellen</button>
            <button class="secondary-button border-red-200 text-red-700" @click="nukeEverything">
              Alles vollständig löschen
            </button>
          </div>
        </div>
      </section>

      <section class="mt-6 grid gap-4 sm:grid-cols-3">
        <div class="soft-card rounded-[1.5rem] p-5">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Galerien</p>
          <p class="mt-2 text-4xl font-semibold text-[var(--ink)]">{{ galleries.length }}</p>
          <p class="mt-1 text-sm text-[var(--muted)]">Aktive Übergaberäume im System</p>
        </div>
        <div class="soft-card rounded-[1.5rem] p-5">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Upload</p>
          <p class="mt-2 text-4xl font-semibold text-[var(--ink)]">{{ files.length }}</p>
          <p class="mt-1 text-sm text-[var(--muted)]">Dateien aktuell in Vorbereitung</p>
        </div>
        <div class="soft-card rounded-[1.5rem] p-5">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Status</p>
          <p class="mt-2 text-xl font-semibold text-[var(--ink)]">{{ uploading ? 'Upload läuft' : 'Bereit' }}</p>
          <p class="mt-1 text-sm text-[var(--muted)]">{{ uploading ? remainingTime || 'Dateien werden verarbeitet' : 'Neue Galerie kann jederzeit erstellt werden' }}</p>
        </div>
      </section>

      <section class="mt-8">
        <div class="mb-4 flex items-center justify-between">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">Galerieübersicht</p>
          <p v-if="loading" class="text-sm text-[var(--muted)]">Lade Galerien...</p>
        </div>

        <div v-if="loading" class="soft-card rounded-[2rem] p-10 text-center text-[var(--muted)]">
          Galerien werden geladen...
        </div>

        <div v-else-if="galleries.length" class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="g in galleries"
            :key="g.id"
            class="soft-card relative flex h-full flex-col rounded-[1.75rem] p-5 transition duration-200 hover:-translate-y-1"
            :class="{ 'pointer-events-none opacity-50 grayscale': deleting[g.id] }"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-strong)]">Galerie</p>
                <h2 class="mt-2 text-3xl text-[var(--ink)]">{{ g.name || 'Ohne Titel' }}</h2>
              </div>
              <span class="rounded-full bg-[rgba(185,122,69,0.12)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                {{ g.files.length }} Dateien
              </span>
            </div>

            <div class="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <p>Gültig bis: {{ formatDate(g.expiresAt) }}</p>
              <p>Link: /gallery/{{ g.id }}</p>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-3">
              <button class="secondary-button text-sm" @click="viewGallery(g.id)">Ansehen</button>
              <button class="secondary-button text-sm" @click="shareGallery(g.id)">Teilen</button>
              <button class="secondary-button border-red-200 text-sm text-red-700" @click="deleteGallery(g.id)">Löschen</button>
            </div>

            <div
              v-if="deleting[g.id]"
              class="absolute inset-0 flex flex-col items-center justify-center rounded-[1.75rem] bg-[rgba(255,250,245,0.82)] backdrop-blur-sm"
            >
              <p class="text-base font-semibold text-[var(--ink)]">Galerie wird entfernt...</p>
              <p class="mt-1 text-sm text-[var(--muted)]">Dateien werden aus der Cloud gelöscht</p>
            </div>
          </article>
        </div>

        <div v-else class="soft-card rounded-[2rem] p-10 text-center">
          <h2 class="text-3xl text-[var(--ink)]">Noch keine Galerien</h2>
          <p class="mt-3 text-sm leading-7 text-[var(--muted)]">
            Erstellen Sie die erste Galerie, um Medien hochzuladen und direkt zu teilen.
          </p>
        </div>
      </section>
    </div>

    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(21,13,8,0.64)] px-4 backdrop-blur-sm"
    >
      <div
        class="glass-panel w-full max-w-2xl rounded-[2rem] p-6 sm:p-8"
        @drop.prevent="handleDrop"
        @dragover.prevent
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <span class="eyebrow">Neue Galerie</span>
            <h2 class="mt-4 text-4xl text-[var(--ink)]">Upload vorbereiten</h2>
          </div>
          <button
            class="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(111,78,55,0.12)] bg-white/70 text-xl text-[var(--muted)]"
            @click="showCreateModal = false"
            aria-label="Modal schließen"
          >
            x
          </button>
        </div>

        <div class="mt-6 space-y-5">
          <input
            v-model="newGalleryName"
            placeholder="Galerietitel"
            class="field-input"
          />

          <button
            class="flex min-h-[12rem] w-full flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[rgba(111,78,55,0.26)] bg-[rgba(255,251,247,0.72)] px-6 text-center transition hover:border-[rgba(185,122,69,0.55)] hover:bg-white"
            @click="fileInput?.click()"
            type="button"
          >
            <span class="text-lg font-semibold text-[var(--ink)]">Dateien ziehen oder auswählen</span>
            <span class="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              Bilder und Videos können gemeinsam hochgeladen werden. Die Galerie wird danach automatisch vorbereitet.
            </span>
            <input
              ref="fileInput"
              type="file"
              class="hidden"
              multiple
              @change="handleFiles"
            />
          </button>

          <div v-if="files.length" class="soft-card rounded-[1.5rem] p-5">
            <p class="text-sm font-semibold text-[var(--ink)]">Ausgewählte Dateien: {{ files.length }}</p>
            <p class="mt-1 text-sm text-[var(--muted)]">Gesamtgröße: {{ totalSize }} MB</p>
          </div>

          <div v-if="uploading" class="space-y-3">
            <div class="h-3 overflow-hidden rounded-full bg-[rgba(111,78,55,0.12)]">
              <div
                class="h-full rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] transition-all duration-300"
                :style="{ width: uploadProgress + '%' }"
              ></div>
            </div>
            <p class="text-sm text-[var(--muted)]">{{ remainingTime }}</p>
          </div>
        </div>

        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            v-if="uploading"
            class="secondary-button text-red-700"
            @click="cancelUpload"
          >
            Upload abbrechen
          </button>
          <button
            v-if="!uploading"
            class="secondary-button"
            @click="showCreateModal = false"
          >
            Schließen
          </button>
          <button
            class="brand-button"
            @click="createGallery"
            :disabled="uploading || files.length === 0"
          >
            {{ uploading ? 'Upload läuft...' : 'Galerie hochladen' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showShareModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(21,13,8,0.64)] px-4 backdrop-blur-sm"
    >
      <div class="glass-panel w-full max-w-md rounded-[2rem] p-6 sm:p-8">
        <div class="text-center">
          <span class="eyebrow">Teilen</span>
          <h2 class="mt-4 text-4xl text-[var(--ink)]">Galerie-Link</h2>
          <p class="mt-4 break-all text-sm leading-7 text-[var(--muted)]">{{ shareUrl }}</p>
          <div class="soft-card mx-auto mt-6 flex w-fit items-center justify-center rounded-[1.5rem] p-4">
            <img :src="qrCodeUrl" alt="QR Code" class="h-44 w-44" />
          </div>
        </div>

        <div class="mt-8 flex justify-center">
          <button class="brand-button" @click="showShareModal = false">Schließen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { uploadMultipart } from '../lib/upload.js'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const galleries = ref([])
const loading = ref(false)
const showCreateModal = ref(false)
const showShareModal = ref(false)
const newGalleryName = ref('')
const files = ref([])
const uploadProgress = ref(0)
const uploading = ref(false)
const remainingTime = ref('')
const fileInput = ref(null)
const deleting = ref({})
const shareUrl = ref('')
const qrCodeUrl = ref('')
const router = useRouter()
const uploadAbortController = ref(null)
const DIRECT_UPLOAD_CONCURRENCY = 3

const fetchGalleries = async () => {
  loading.value = true
  try {
    const res = await fetch('/api/admin/galleries')
    galleries.value = await res.json()
  } finally {
    loading.value = false
  }
}

const formatDate = (timestamp) => {
  const d = new Date(timestamp)
  return d.toLocaleString()
}

const handleFiles = (e) => {
  files.value = Array.from(e.target.files)
}

const handleDrop = (e) => {
  if (e.dataTransfer?.files?.length) {
    files.value = Array.from(e.dataTransfer.files)
  }
}

const totalSize = computed(() => {
  const totalBytes = files.value.reduce((sum, f) => sum + f.size, 0)
  return (totalBytes / 1024 / 1024).toFixed(2)
})

const updateUploadProgress = (uploadedBytes, totalBytes, startTime) => {
  uploadProgress.value = totalBytes ? Math.round((uploadedBytes / totalBytes) * 100) : 0

  const elapsed = (Date.now() - startTime) / 1000
  if (elapsed > 0 && uploadedBytes > 0) {
    const bytesPerSecond = uploadedBytes / elapsed
    const remainingBytes = Math.max(0, totalBytes - uploadedBytes)
    const eta = remainingBytes / bytesPerSecond
    remainingTime.value = `Noch ${formatRemainingTime(eta)}`
  } else {
    remainingTime.value = 'Upload läuft...'
  }
}

const createGallery = async () => {
  if (!files.value.length) {
    alert('Bitte Dateien auswählen')
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  remainingTime.value = 'Startet...'

  const createRes = await fetch('/api/create-gallery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newGalleryName.value || 'Galerie' })
  })

  if (!createRes.ok) {
    uploading.value = false
    alert('Galerie konnte nicht erstellt werden')
    return
  }

  const { galleryId } = await createRes.json()
  const totalBytes = files.value.reduce((sum, file) => sum + file.size, 0)
  const startTime = Date.now()
  let uploadedBytes = 0
  uploadAbortController.value = new AbortController()

  try {
    await runWithConcurrency(files.value, DIRECT_UPLOAD_CONCURRENCY, async (file) => {
      const contentType = file.type || 'application/octet-stream'
      let key
      const reportBytes = bytes => {
        uploadedBytes += bytes
        updateUploadProgress(uploadedBytes, totalBytes, startTime)
      }
      if (file.size >= 64 * 1024 * 1024) {
        key = await uploadMultipart(file, galleryId, uploadAbortController.value.signal, reportBytes)
      } else {
        const uploadMetaRes = await fetch('/api/get-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: uploadAbortController.value.signal,
          body: JSON.stringify({
            galleryId,
            filename: file.name,
            contentType
          })
        })

        if (!uploadMetaRes.ok) {
          throw new Error('Upload-URL konnte nicht erzeugt werden')
        }

        const { key: directKey, uploadUrl } = await uploadMetaRes.json()

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType
          },
          body: file,
          signal: uploadAbortController.value.signal
        })

        if (!uploadRes.ok) {
          throw new Error(`Direkt-Upload fehlgeschlagen (${uploadRes.status})`)
        }

        key = directKey
        reportBytes(file.size)
      }

      const registerRes = await fetch('/api/register-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: uploadAbortController.value.signal,
        body: JSON.stringify({
          galleryId,
          key,
          originalname: file.name,
          sizeBytes: file.size,
          lastModified: file.lastModified
        })
      })

      if (!registerRes.ok) {
        throw new Error('Datei konnte nicht registriert werden')
      }

    }, () => uploadAbortController.value?.abort())

    const finalizeRes = await fetch('/api/finalize-gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ galleryId })
    })

    if (!finalizeRes.ok) {
      console.warn('finalize-gallery zurückgegeben:', await finalizeRes.text())
    }

    uploadProgress.value = 100
    remainingTime.value = 'Fertig'

    await fetchGalleries()
    showCreateModal.value = false
    newGalleryName.value = ''
    files.value = []
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  } catch (err) {
    uploadAbortController.value?.abort()
    console.error(err)
    alert(err.name === 'AbortError' ? 'Upload abgebrochen' : err.message || 'Upload fehlgeschlagen')
  } finally {
    uploading.value = false
    uploadAbortController.value = null
  }
}

const cancelUpload = () => {
  uploadAbortController.value?.abort()
}

const deleteGallery = async (id) => {
  deleting.value = { ...deleting.value, [id]: true }
  try {
    const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Fehler beim Löschen')
    galleries.value = galleries.value.filter((g) => g.id !== id)
  } catch (err) {
    alert('Fehler beim Löschen')
  } finally {
    deleting.value = { ...deleting.value, [id]: false }
  }
}

const viewGallery = (id) => {
  router.push(`/gallery/${id}`)
}

const shareGallery = (id) => {
  shareUrl.value = `${window.location.origin}/gallery/${id}`
  qrCodeUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    shareUrl.value
  )}`
  showShareModal.value = true
}

const nukeEverything = async () => {
  const typed = prompt('Tippe DELETE_EVERYTHING um ALLES zu löschen:')
  if (typed !== 'DELETE_EVERYTHING') return

  try {
    const res = await fetch('/api/admin/nuke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': 'Ruya24'
      },
      body: JSON.stringify({ confirm: 'DELETE_EVERYTHING' })
    })

    const json = await res.json()

    if (!res.ok) {
      alert(`Fehler: ${json.error || 'unknown'}`)
      return
    }

    alert(`Fertig. R2 gelöscht: ${json.r2Deleted}, Bunny ZIPs gelöscht: ${json.bunnyDeleted}, DB geleert.`)
    await fetchGalleries()
  } catch (e) {
    console.error(e)
    alert('Netzwerkfehler')
  }
}

onMounted(fetchGalleries)

async function runWithConcurrency(items, concurrency, worker, onError) {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1))
  let currentIndex = 0
  let failure
  async function next() {
    while (!failure && currentIndex < items.length) {
      const index = currentIndex++
      try { await worker(items[index], index) }
      catch (error) {
        if (!failure) { failure = error; onError?.() }
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => next()))
  if (failure) throw failure
}

function formatRemainingTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds))

  if (safeSeconds < 60) {
    return `${safeSeconds} Sekunden`
  }

  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  if (remainingSeconds === 0) {
    return `${minutes} Min`
  }

  return `${minutes} Min ${remainingSeconds} Sek`
}
</script>
