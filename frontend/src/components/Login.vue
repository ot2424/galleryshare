<template>
  <div class="rounded-[1.6rem] bg-[rgba(255,251,247,0.86)] p-6 sm:p-7">
    <span class="eyebrow">Admin Login</span>
    <h1 class="mt-5 text-4xl text-[var(--ink)]">Willkommen zurück</h1>
    <p class="mt-3 text-sm leading-7 text-[var(--muted)]">
      Melden Sie sich an, um neue Galerien hochzuladen, Links zu teilen und bestehende Inhalte zu verwalten.
    </p>

    <div class="mt-6 space-y-4">
      <input
        v-model="username"
        placeholder="Benutzername"
        class="field-input"
      />
      <input
        v-model="password"
        type="password"
        placeholder="Passwort"
        class="field-input"
      />
    </div>

    <button
      class="brand-button mt-6 w-full"
      @click="login"
      :disabled="loading"
    >
      {{ loading ? 'Einloggen...' : 'Login öffnen' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const username = ref('')
const password = ref('')
const loading = ref(false)
const router = useRouter()

const emit = defineEmits(['loginSuccess'])

const login = async () => {
  loading.value = true
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    })

    if (res.ok) {
      const data = await res.json()
      localStorage.setItem('auth', data.token || 'true')
      emit('loginSuccess')
      router.push('/admin')
    } else {
      alert('Login fehlgeschlagen. Bitte überprüfen Sie Ihre Daten.')
    }
  } catch (err) {
    alert('Serverfehler beim Login.')
  } finally {
    loading.value = false
  }
}
</script>
