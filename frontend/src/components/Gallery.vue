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
        <h1 class="mt-5 text-4xl text-[var(--ink)] sm:text-5xl">Bevor die Galerie geoeffnet wird</h1>
        <p class="mt-5 text-sm leading-7 text-[var(--muted)] sm:text-base">
          Diese Galerie enthaelt private Medien und ist ausschliesslich fuer Personen gedacht, die den direkten Link
          erhalten haben. Die Inhalte werden nur voruebergehend bereitgestellt, nicht dauerhaft gespeichert und
          spaetestens nach 48 Stunden vollstaendig entfernt.
        </p>
        <p class="mt-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
          Mit Ihrer Zustimmung bestaetigen Sie, dass Sie diese Hinweise zur Verfuegbarkeit und zum Umgang mit den Daten
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
              Verfuegbar fuer: {{ timeDisplay }}
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
            <select id="gallery-sort" v-model="sortOrder" class="rounded-xl border border-[rgba(111,78,55,0.2)] bg-white px-3 py-2 text-[var(--ink)]">
              <option value="date-asc">Datum aufsteigend</option>
              <option value="date-desc">Datum absteigend</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </select>
          </label>
          <p class="text-sm text-[var(--muted)]">{{ sortedFiles.length }} Elemente</p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="file in sortedFiles"
            :key="file.filename"
            class="soft-card group overflow-hidden rounded-[1.75rem]"
          >
            <div class="relative">
              <div
                v-if="isVideo(file.originalname)"
                class="relative aspect-[4/3] overflow-hidden bg-[rgba(41,28,19,0.92)]"
              >
                <a
                  :data-fancybox="'gallery'"
                  :href="file.url"
                  :data-src="file.url"
                  data-type="video"
                  :data-html5video-format="videoType(file.originalname)"
                  class="absolute inset-0"
                >
                  <img v-if="file.thumbnailUrl" :src="file.thumbnailUrl" loading="lazy" decoding="async"
                    class="h-full w-full object-cover" :alt="file.originalname" />
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-2xl text-white backdrop-blur-sm">
                      Play
                    </div>
                  </div>
                </a>

              </div>

              <a v-else :href="file.url" :data-src="file.previewUrl || file.url" :data-download-src="file.url" data-type="image" data-fancybox="gallery" class="block aspect-[4/3] overflow-hidden">
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
      </section>

      <section v-else-if="!loading" class="soft-card mt-6 rounded-[2rem] p-10 text-center">
        <h2 class="text-3xl text-[var(--ink)]">Keine Medien verfuegbar</h2>
        <p class="mt-3 text-sm leading-7 text-[var(--muted)]">
          Die Galerie ist leer oder der Link ist bereits abgelaufen.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { Fancybox } from '@fancyapps/ui'
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

const isVideo = name => /\.(mp4|webm|ogg|mov|m4v)$/i.test(name || '')
const videoType = name => /\.webm$/i.test(name) ? 'video/webm' : /\.ogg$/i.test(name) ? 'video/ogg' : /\.mov$/i.test(name) ? 'video/quicktime' : 'video/mp4'

const sortOrder = ref('date-asc')
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
    await nextTick()
    Fancybox.unbind('[data-fancybox]')
    Fancybox.bind('[data-fancybox]', {
      Carousel: {
        Lazyload: { preload: 1 },
        Video: { autoplay: false },
        Toolbar: {
          display: {
            left: ['counter'],
            middle: [],
            right: ['autoplay', 'download', 'thumbs', 'close']
          }
        }
      }
    })
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
    if (!res.ok || !data.url) throw new Error('ZIP ist momentan nicht verfügbar. Bitte erneut versuchen.')
    const link = document.createElement('a')
    link.href = data.url
    link.download = `${galleryName.value || 'Galerie'}.zip`
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
  alert('Ohne Zustimmung ist kein Zugriff moeglich.')
}

onMounted(() => {
  if (consentGiven.value) {
    fetchGallery()
    startPolling()
  }
})
onBeforeUnmount(() => {
  clearInterval(pollingInterval)
  Fancybox.unbind('[data-fancybox]')
  Fancybox.close()
})
</script>

<style>
.fancybox__thumbs {
  display: none !important;
}
</style>
