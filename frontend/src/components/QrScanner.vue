<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-beige text-center">
    <h1 class="text-4xl font-serif mb-4 text-gray-800">Zugang zur Galerie</h1>
    <input
        v-model="galleryId"
        type="text"
        placeholder="QR-Code oder Link eingeben"
        class="border border-gray-300 rounded p-3 mb-4 w-72 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold transition"
    />
    <button
        @click="goToGallery"
        class="bg-[#d1b584] text-white py-2 px-6 rounded hover:shadow-lg transition"
    >
      Galerie öffnen
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const galleryId = ref('')
const emit = defineEmits(['goToGallery'])
const goToGallery = () => {
  if (!galleryId.value) return
  emit('goToGallery', galleryId.value)
}
</script>
