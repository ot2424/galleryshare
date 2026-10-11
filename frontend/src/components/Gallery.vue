<template>
  <div class="page-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
    <div
      v-if="!consentGiven"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(21,13,8,0.72)] px-4 backdrop-blur-sm"
    >
      <div class="glass-panel relative w-full max-w-2xl rounded-[2rem] p-6 sm:p-8">
        <button
          class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(111,78,55,0.12)] bg-white/70 text-xl text-[var(--muted)] transition hover:text-[var(--ink)]"
          @click="declinePrivacy"
          aria-label="Schliessen"
        >
          x
        </button>

        <span class="eyebrow">Einwilligung</span>
        <h1 class="mt-5 text-4xl text-[var(--ink)] sm:text-5xl">Bevor die Galerie geöffnet wird</h1>
        <p class="mt-5 text-sm leading-7 text-[var(--muted)] sm:text-base">
          Diese Galerie enthält private Medien und ist ausschliesslich für Personen gedacht, die den direkten Link
          erhalten haben. Die Inhalte werden nur vorübergehend bereitgestellt, nicht dauerhaft gespeichert und
          spätestens nach 48 Stunden vollständig entfernt.
        </p>
        <p class="mt-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
          Mit Ihrer Zustimmung bestätigen Sie, dass Sie diese Hinweise zur Verfügbarkeit und zum Umgang mit den Daten
          gelesen haben.
        </p>

        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <button class="brand-button sm:flex-1" @click="acceptPrivacy">Ich stimme zu</button>
          <button class="secondary-button sm:flex-1" @click="declinePrivacy">Abbrechen</button>
        </div>
      </div>
    </div>

    <div v-if="consentGiven" class="mx-auto max-w-7xl">
      <section class="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-3xl">
            <span class="eyebrow">Private Galerie</span>
            <h1 v-if="!loading && galleryName" class="mt-5 text-4xl text-[var(--ink)] sm:text-5xl">
              {{ galleryName }}
            </h1>
            <p v-else class="mt-5 text-4xl text-[var(--ink)] sm:text-5xl">Galerie wird geladen</p>
            <p v-if="!loading" class="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              Verfügbar für: {{ timeDisplay }}
            </p>
          </div>

          <div v-if="files.length" class="soft-card rounded-[1.5rem] p-5 lg:min-w-[22rem]">
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent-strong)]">Download</p>
            <p class="mt-2 text-sm leading-6 text-[var(--muted)]">
              Die komplette Galerie kann als ZIP-Datei geladen werden, sobald die Aufbereitung abgeschlossen ist.
            </p>
            <button
              class="brand-button mt-5 w-full"
              @click="startDownload"
              :disabled="(!zipReady && !zipError) || downloading"
            >
              <span v-if="zipError">ZIP erneut erstellen</span>
              <span v-else-if="downloading">Download wird gestartet…</span>
              <span v-else-if="!zipReady">ZIP wird erstellt ({{ zipProgress }}%)</span>
              <span v-else>Gesamte Galerie herunterladen</span>
            </button>
            <p v-if="downloadError" role="alert" class="mt-3 text-sm text-red-700">{{ downloadError }}</p>
          </div>
        </div>
      </section>

      <section v-if="loading" class="soft-card mt-6 rounded-[2rem] p-10 text-center text-[var(--muted)]">
        Inhalte werden geladen...
      </section>

      <section v-else-if="sortedFiles.length" class="mt-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <label class="flex items-center gap-2 text-sm text-[var(--muted)]" for="gallery-sort">
            Sortieren nach
            <select id="gallery-sort" v-model="sortOrder" class="rounded-xl border border-[rgba(111,78,55,0.2)] bg-white px-3 py-2 text-[var(--ink)]" @change="visibleCount = 90">
              <option value="upload">Upload-Reihenfolge</option>
              <option value="date-asc">Datum aufsteigend</option>
              <option value="date-desc">Datum absteigend</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </select>
          </label>
          <p class="text-sm text-[var(--muted)]">{{ sortedFiles.length }} Elemente</p>
        </div>
        <p v-if="sortOrder.startsWith('date-')" class="mb-4 text-xs text-[var(--muted)]">
          Datum im Dateinamen, ersatzweise Datei- oder Upload-Datum. Bilder ohne Datum folgen am Ende nach Dateiname.
        </p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="file in visibleFiles"
            :key="file.filename"
            class="soft-card group overflow-hidden rounded-[1.75rem]"
          >
            <div class="relative">
              <div
                v-if="isVideo(file.originalname)"
                class="relative aspect-[4/3] overflow-hidden bg-[rgba(41,28,19,0.92)]"
              >
                <a
                  :href="file.url"
                  @click.prevent="openMedia(file)"
                  class="absolute inset-0"
                >
                  <img v-if="file.thumbnailUrl && !posterErrors[file.id]" :src="file.thumbnailUrl" loading="lazy" decoding="async" @error="posterErrors[file.id] = true"
                    class="h-full w-full object-cover" :alt="file.originalname" />
                  <div class="absolute inset-0 flex items-center justify-center">
                    <span v-if="posterErrors[file.id]" class="absolute bottom-4 text-sm text-white">Vorschau wird vorbereitet</span>
                    <div class="flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-2xl text-white backdrop-blur-sm">
                      Play
                    </div>
                  </div>
                </a>

              </div>

              <a v-else @click.prevent="openMedia(file)" :href="file.url" :data-src="file.previewUrl || file.url" :data-download-src="file.url" data-type="image" data-fancybox="gallery" class="block aspect-[4/3] overflow-hidden">
                <img
                  :src="file.thumbnailUrl || file.url"
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  :alt="file.originalname || file.filename"
                />
              </a>
              <div
                v-if="isVideo(file.originalname)"
                class="absolute left-4 top-4 rounded-full bg-[rgba(255,248,242,0.88)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]"
              >
                Video
              </div>
            </div>
          </article>
        </div>
        <button v-if="visibleFiles.length < sortedFiles.length" class="secondary-button mt-6" @click="visibleCount += 90">Weitere Medien anzeigen</button>
      </section>

      <section v-else-if="!loading" class="soft-card mt-6 rounded-[2rem] p-10 text-center">
        <h2 class="text-3xl text-[var(--ink)]">Keine Medien verfügbar</h2>
        <p class="mt-3 text-sm leading-7 text-[var(--muted)]">
          Die Galerie ist leer oder der Link ist bereits abgelaufen.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { Fancybox } from '@fancyapps/ui'
import { isGalleryVideo as isVideo, gallerySlides, createGalleryVideoLoader } from '../lib/galleryViewer.js'
import { sortGalleryFiles } from '../lib/gallerySort.js'
import '@fancyapps/ui/dist/fancybox/fancybox.css'
import { useRouter } from 'vue-router'

const props = defineProps(['galleryId'])
const router = useRouter()

const galleryName = ref('')
const files = ref([])
const loading = ref(true)
const zipReady = ref(false)
const zipError = ref(false)
const downloadError = ref('')
const zipProgress = ref(0)
const downloading = ref(false)
const timeLeftMs = ref(0)
const timeDisplay = ref('')
const consentGiven = ref(localStorage.getItem('galleryConsent') === '1')

const visibleCount = ref(90)
const visibleFiles = computed(() => sortedFiles.value.slice(0, visibleCount.value))
const posterErrors = ref({})
const videoLoader = createGalleryVideoLoader(props.galleryId)
let posterRetry = null

function openMedia(file) {
  Fancybox.close()
  videoLoader.stop()
  Fancybox.show(gallerySlides(sortedFiles.value), {
    startIndex: sortedFiles.value.findIndex(item => item.id === file.id),
    Carousel: {
      Lazyload: { preload: 1 },
      Video: {
        autoplay: false,
        html5videoTpl: '<video class="f-html5video" playsinline controls preload="metadata" poster="{{poster}}"></video>'
      },
      Toolbar: {
        display: { left: ['counter'], middle: [], right: ['autoplay', 'download', 'thumbs', 'close'] }
      }
    },
    on: {
      'Carousel.ready': viewer => videoLoader.sync(viewer),
      'Carousel.change': viewer => videoLoader.sync(viewer),
      'Carousel.contentReady': viewer => videoLoader.sync(viewer),
      close: () => videoLoader.stop()
    }
  })
}

const sortOrder = ref('upload')
const sortedFiles = computed(() => sortGalleryFiles(files.value, sortOrder.value))

const updateTimeDisplay = (ms) => {
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  timeDisplay.value =
    minutes < 1
      ? 'unter 1 Minute'
      : minutes < 60
        ? `${minutes} Min`
        : `${hours} Std ${remainingMinutes} Min`
}

let pollingInterval = null

const startPolling = () => {
  if (pollingInterval) clearInterval(pollingInterval)

  pollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/zip-progress/${props.galleryId}`)
      if (!res.ok) return
      const data = await res.json()
      zipProgress.value = data.zipProgress || 0
      zipReady.value = !!data.zipReady
      zipError.value = !!data.zipError
      if (zipReady.value || zipError.value) clearInterval(pollingInterval)
    } catch { /* The next poll retries temporary network errors. */ }
  }, 2000)
}

const fetchGallery = async () => {
  try {
    const res = await fetch(`/api/gallery/${props.galleryId}`)
    if (!res.ok) return router.push('/notfound')

    const data = await res.json()
    galleryName.value = data.gallery?.name
    files.value = data.files
    zipReady.value = !!data.gallery?.zipReady
    zipError.value = !!data.gallery?.zipError
    zipProgress.value = data.gallery?.zipProgress ?? 0

    timeLeftMs.value = data.gallery.expiresAt - Date.now()
    updateTimeDisplay(timeLeftMs.value)

    loading.value = false

  } finally {
    loading.value = false
  }
}

async function startDownload() {
  if (downloading.value) return
  downloading.value = true
  downloadError.value = ''
  try {
    if (zipError.value) {
      const retry = await fetch(`/api/retry-zip/${props.galleryId}`, { method: 'POST' })
      if (!retry.ok) throw new Error('ZIP konnte nicht neu gestartet werden. Bitte erneut versuchen.')
      zipError.value = false
      zipProgress.value = 0
      startPolling()
      return
    }
    if (!zipReady.value) return
    const res = await fetch(`/api/download-zip/${props.galleryId}`)
    const data = await res.json()
    if (!res.ok || !data.url) {
      if (data.zipError) { zipError.value = true; zipReady.value = false }
      throw new Error(data.error || 'ZIP ist momentan nicht verfügbar. Bitte erneut versuchen.')
    }
    const link = document.createElement('a')
    link.href = data.url
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    downloadError.value = error.message || 'Download fehlgeschlagen.'
  } finally {
    downloading.value = false
  }
}

const acceptPrivacy = () => {
  consentGiven.value = true
  localStorage.setItem('galleryConsent', '1')
  fetchGallery()
  startPolling()
}

const declinePrivacy = () => {
  alert('Ohne Zustimmung ist kein Zugriff möglich.')
}

onMounted(() => {
  posterRetry = setInterval(() => { posterErrors.value = {} }, 30000)
  if (consentGiven.value) {
    fetchGallery()
    startPolling()
  }
})
onBeforeUnmount(() => {
  clearInterval(pollingInterval)
  clearInterval(posterRetry)
  videoLoader.stop()
  Fancybox.unbind('[data-fancybox]')
  Fancybox.close()
})
</script>

<style>
.fancybox__thumbs {
  display: none !important;
}
</style>

<style>
.gallery-video-status {
  position: absolute;
  bottom: 3rem;
  left: 0;
  right: 0;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  text-align: center;
  pointer-events: none;
}
.gallery-video-status:empty { display: none; }
</style>
