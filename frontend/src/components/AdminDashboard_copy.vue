<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 px-4 py-6 sm:p-6 overflow-hidden">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl sm:text-4xl font-extrabold text-gray-800 mb-6 text-center">
        Admin Dashboard
      </h1>

      <div class="flex justify-center sm:justify-end items-center mb-6 flex-wrap gap-3">
        <button
          @click="showCreateModal = true"
          class="bg-[#d1b584] text-white px-5 py-2 rounded-full hover:shadow-md hover:brightness-110 transition text-sm sm:text-base"
        >
          + Neue Galerie
        </button>
      </div>

      <div v-if="loading" class="text-center text-gray-500">Lade Galerien...</div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="g in galleries"
          :key="g.id"
          class="bg-white shadow-lg rounded-lg p-4 border border-gray-200 flex flex-col justify-between transition hover:scale-[1.02] hover:shadow-xl"
        >
          <div>
            <h2 class="text-lg font-bold text-gray-800 mb-1 truncate">
              {{ g.name || 'Ohne Titel' }}
            </h2>
            <p class="text-sm text-gray-600 mb-3">
              Bilder: {{ g.files.length }}<br />
              Gültig bis: {{ formatDate(g.expiresAt) }}
            </p>
          </div>

          <div class="mt-auto flex flex-col sm:flex-row flex-wrap gap-2">
            <button
              @click="viewGallery(g.id)"
              class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-sm w-full sm:w-auto text-center"
            >
              Ansehen
            </button>
            <button
              @click="shareGallery(g.id)"
              class="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 text-sm w-full sm:w-auto text-center"
            >
              Teilen
            </button>
            <button
              @click="deleteGallery(g.id)"
              class="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 text-sm w-full sm:w-auto text-center"
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Neue Galerie -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto"
    >
      <div class="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-[95%] sm:w-full max-w-md">
        <h2 class="text-xl font-semibold mb-4 text-center">Neue Galerie erstellen</h2>
        <input
          v-model="newGalleryName"
          placeholder="Galerietitel (optional)"
          class="w-full border p-3 mb-4 rounded"
        />
        <input
          type="file"
          multiple
          @change="handleFiles"
          class="mb-4 w-full"
        />
        <div class="flex justify-end gap-3">
          <button @click="showCreateModal = false" class="text-gray-600 hover:text-black">Abbrechen</button>
          <button @click="createGallery" class="bg-[#d1b584] text-white px-5 py-2 rounded hover:shadow-md">
            Hochladen
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Galerie teilen -->
    <div
      v-if="showShareModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto"
    >
      <div class="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-[95%] sm:w-full max-w-md">
        <h2 class="text-lg font-semibold mb-4 text-center">Teilen</h2>
        <p class="mb-3 text-center break-all text-gray-700">{{ shareUrl }}</p>
        <img :src="qrCodeUrl" alt="QR Code" class="mx-auto w-40 h-40 mb-4" />
        <div class="flex justify-center">
          <button
            @click="showShareModal = false"
            class="bg-gray-300 px-5 py-2 rounded hover:bg-gray-400"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const galleries = ref([])
const loading = ref(false)
const showCreateModal = ref(false)
const showShareModal = ref(false)
const newGalleryName = ref('')
const files = ref([])
const shareUrl = ref('')
const qrCodeUrl = ref('')
const router = useRouter()

const fetchGalleries = async () => {
  loading.value = true
  const res = await fetch('/api/admin/galleries')
  galleries.value = await res.json()
  loading.value = false
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const handleFiles = (e) => {
  files.value = Array.from(e.target.files)
}

const createGallery = async () => {
  const formData = new FormData()
  formData.append('galleryName', newGalleryName.value)
  files.value.forEach(f => formData.append('files', f))

  await fetch('/api/upload', {
    method: 'POST',
    body: formData
  })

  showCreateModal.value = false
  newGalleryName.value = ''
  files.value = []
  await fetchGalleries()
}

const deleteGallery = async (id) => {
  if (confirm('Diese Galerie wirklich löschen?')) {
    await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' })
    await fetchGalleries()
  }
}

const shareGallery = (id) => {
  shareUrl.value = `${window.location.origin}/gallery/${id}`
  qrCodeUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl.value)}`
  showShareModal.value = true
}

const viewGallery = (id) => {
  router.push(`/gallery/${id}`)
}

onMounted(fetchGalleries)
</script>

<style scoped>
button {
  transition: all 0.2s;
}
</style>
