<template>
  <div class="page-shell relative overflow-hidden">
    <header class="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <div class="glass-panel mx-auto flex max-w-7xl items-center justify-between rounded-full px-4 py-3 sm:px-6">
        <a href="#home" class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(185,122,69,0.14)] text-lg font-bold text-[var(--accent-strong)]">
            GS
          </div>
          <div>
            <p class="text-sm font-extrabold uppercase tracking-[0.35em] text-[var(--accent-strong)]">GalleryShare</p>
            <p class="text-xs text-[var(--muted)]">Private galleries for modern events</p>
          </div>
        </a>

        <nav class="hidden items-center gap-8 text-sm font-semibold text-[var(--muted)] md:flex">
          <a href="#home" class="transition hover:text-[var(--ink)]">Start</a>
          <a href="#features" class="transition hover:text-[var(--ink)]">Vorteile</a>
          <a href="#workflow" class="transition hover:text-[var(--ink)]">Ablauf</a>
          <router-link to="/datenschutz" class="transition hover:text-[var(--ink)]">Datenschutz</router-link>
        </nav>

        <div class="flex items-center gap-3">
          <button class="brand-button hidden md:inline-flex" @click="openLogin">Admin Login</button>
          <button
            class="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-[rgba(111,78,55,0.14)] bg-white/70 px-4 text-sm font-semibold text-[var(--accent-strong)] md:hidden"
            @click="toggleMobileMenu"
            aria-label="Navigation öffnen"
          >
            {{ mobileMenuOpen ? 'Schließen' : 'Menü' }}
          </button>
        </div>
      </div>

      <transition name="slide-fade">
        <div v-if="mobileMenuOpen" class="glass-panel mx-auto mt-3 max-w-7xl rounded-3xl px-5 py-4 md:hidden">
          <div class="flex flex-col gap-4 text-sm font-semibold text-[var(--muted)]">
            <a href="#home" @click="mobileMenuOpen = false">Start</a>
            <a href="#features" @click="mobileMenuOpen = false">Vorteile</a>
            <a href="#workflow" @click="mobileMenuOpen = false">Ablauf</a>
            <router-link to="/datenschutz" @click="mobileMenuOpen = false">Datenschutz</router-link>
            <button class="brand-button w-full" @click="openLogin">Admin Login</button>
          </div>
        </div>
      </transition>
    </header>

    <main>
      <section id="home" class="relative min-h-screen px-4 pb-16 pt-28 sm:px-6">
        <div class="absolute inset-0">
          <div
            v-for="(image, index) in images"
            :key="image"
            class="absolute inset-0 bg-cover bg-center transition-opacity duration-[1600ms]"
            :style="{
              backgroundImage: `linear-gradient(rgba(20, 13, 8, 0.48), rgba(20, 13, 8, 0.58)), url(${image})`,
              opacity: currentSlide === index ? 1 : 0
            }"
          ></div>
        </div>

        <div class="relative mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div class="max-w-3xl text-white">
            <span class="eyebrow border-white/20 bg-white/10 text-white">Editorial sharing experience</span>
            <h1 class="mt-6 max-w-3xl text-5xl font-semibold leading-none sm:text-6xl lg:text-7xl">
              Fotos und Videos teilen, als hätte die Galerie ihr eigenes Magazin.
            </h1>
            <p class="mt-6 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">
              GalleryShare macht aus einem simplen Link eine hochwertige Präsentation: schnell erstellt,
              elegant dargestellt und nach 48 Stunden automatisch wieder entfernt.
            </p>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <button class="brand-button" @click="openLogin">Zum Admin-Bereich</button>
              <a href="#features" class="secondary-button border-white/25 bg-white/10 text-white backdrop-blur-md">
                Mehr erfahren
              </a>
            </div>

            <div class="mt-10 grid gap-4 sm:grid-cols-3">
              <div class="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                <p class="text-3xl font-semibold">48h</p>
                <p class="mt-1 text-sm text-white/72">Automatische Verfügbarkeit mit klarer Ablaufzeit</p>
              </div>
              <div class="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                <p class="text-3xl font-semibold">ZIP</p>
                <p class="mt-1 text-sm text-white/72">Kompletter Download für Gäste oder Kunden</p>
              </div>
              <div class="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                <p class="text-3xl font-semibold">QR</p>
                <p class="mt-1 text-sm text-white/72">Sofort teilen auf Events, Shootings und Hochzeiten</p>
              </div>
            </div>
          </div>

          <div class="glass-panel ml-auto max-w-xl rounded-[2rem] p-6 text-[var(--ink)] sm:p-8">
            <p class="eyebrow">Warum es wirkt</p>
            <div class="mt-6 space-y-5">
              <div class="rounded-[1.5rem] bg-white/80 p-5">
                <p class="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Für Kreative</p>
                <p class="mt-2 text-2xl font-semibold">Ein Auftritt, der zu professionellen Bildstrecken passt.</p>
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="rounded-[1.5rem] bg-[rgba(255,255,255,0.78)] p-5">
                  <p class="text-sm font-semibold text-[var(--accent-strong)]">Sicher geteilt</p>
                  <p class="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Links bleiben privat und Gäste sehen nur das, was für sie freigegeben wurde.
                  </p>
                </div>
                <div class="rounded-[1.5rem] bg-[rgba(255,255,255,0.78)] p-5">
                  <p class="text-sm font-semibold text-[var(--accent-strong)]">Schnell verständlich</p>
                  <p class="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Upload, teilen, fertig. Die Oberfläche bleibt für alle Beteiligten unkompliziert.
                  </p>
                </div>
              </div>
              <div class="rounded-[1.5rem] border border-[rgba(111,78,55,0.12)] bg-[rgba(255,248,242,0.82)] p-5">
                <p class="text-sm leading-6 text-[var(--muted)]">
                  Ideal für Hochzeiten, Events, Brand-Shootings und kleine Teams, die eine private Medienübergabe
                  hochwertig und ohne Friktion lösen möchten.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" class="px-4 py-20 sm:px-6">
        <div class="mx-auto max-w-7xl">
          <div class="flex max-w-2xl flex-col gap-4">
            <span class="eyebrow">Vorteile</span>
            <h2 class="text-4xl text-[var(--ink)] sm:text-5xl">Eine ruhige, hochwertige Oberfläche statt Standard-Dateifreigabe.</h2>
            <p class="text-base leading-7 text-[var(--muted)] sm:text-lg">
              Die Plattform soll nicht wie ein Tool wirken, sondern wie ein sauber kuratierter Übergaberaum für Bilder und Videos.
            </p>
          </div>

          <div class="mt-10 grid gap-6 lg:grid-cols-3">
            <article v-for="feature in featureCards" :key="feature.title" class="soft-card rounded-[2rem] p-7">
              <p class="text-sm font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">{{ feature.label }}</p>
              <h3 class="mt-4 text-3xl text-[var(--ink)]">{{ feature.title }}</h3>
              <p class="mt-4 text-sm leading-7 text-[var(--muted)]">{{ feature.text }}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="workflow" class="px-4 py-20 sm:px-6">
        <div class="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div class="soft-card rounded-[2rem] p-8">
            <span class="eyebrow">Ablauf</span>
            <h2 class="mt-5 text-4xl text-[var(--ink)] sm:text-5xl">Vom Upload bis zum Download in drei klaren Schritten.</h2>
            <p class="mt-5 text-base leading-7 text-[var(--muted)]">
              Die Struktur bleibt absichtlich einfach: Medien hochladen, Link teilen, Galerie nach Ablauf automatisch schließen.
            </p>
          </div>

          <div class="grid gap-5">
            <div v-for="step in workflowSteps" :key="step.number" class="glass-panel rounded-[2rem] p-6 sm:p-8">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[rgba(185,122,69,0.14)] text-xl font-extrabold text-[var(--accent-strong)]">
                  {{ step.number }}
                </div>
                <div>
                  <h3 class="text-2xl text-[var(--ink)]">{{ step.title }}</h3>
                  <p class="mt-3 text-sm leading-7 text-[var(--muted)]">{{ step.text }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="legal" class="px-4 pb-24 pt-8 sm:px-6">
        <div class="soft-card mx-auto max-w-7xl rounded-[2rem] p-8 sm:p-10">
          <div class="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <span class="eyebrow">Datenschutz & Hinweise</span>
              <h2 class="mt-5 text-4xl text-[var(--ink)] sm:text-5xl">Klare Kommunikation statt versteckter Bedingungen.</h2>
              <p class="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
                Medien werden nur vorübergehend bereitgestellt. Die ausführlichen Datenschutzhinweise beschreiben transparent,
                welche Daten für Upload, Bereitstellung, Download und technischen Betrieb verarbeitet werden können.
              </p>
            </div>

            <div class="rounded-[1.75rem] bg-[rgba(245,233,218,0.7)] p-6">
              <p class="text-sm leading-7 text-[var(--muted)]">
                Die vollständige Datenschutz-Seite enthält Hinweise zu Verantwortlichkeit, Rechtsgrundlagen, Speicherdauer,
                eingesetzten technischen Dienstleistern und den Rechten betroffener Personen.
              </p>
              <router-link class="secondary-button mt-5 inline-flex" to="/datenschutz">Zur Datenschutz-Seite</router-link>
            </div>
          </div>
        </div>
      </section>
    </main>

    <transition name="fade">
      <div
        v-if="showLogin"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(21,13,8,0.64)] px-4 backdrop-blur-sm"
        @click.self="closeLogin"
      >
        <div class="glass-panel relative w-full max-w-md rounded-[2rem] p-4 sm:p-5">
          <button
            class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(111,78,55,0.12)] bg-white/70 text-xl text-[var(--muted)] transition hover:text-[var(--ink)]"
            @click="closeLogin"
            aria-label="Login schließen"
          >
            x
          </button>
          <Login @loginSuccess="handleLoginSuccess" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Login from './Login.vue'

const router = useRouter()
const showLogin = ref(false)
const mobileMenuOpen = ref(false)

const images = [
  'https://images.pexels.com/photos/307008/pexels-photo-307008.jpeg',
  'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg',
  'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg',
  'https://images.pexels.com/photos/325185/pexels-photo-325185.jpeg'
]

const featureCards = [
  {
    label: '01',
    title: 'Private Präsentation',
    text: 'Gäste landen nicht in einer generischen Cloud-Ansicht, sondern in einer aufgeräumten Galerie mit Fokus auf die Medien.'
  },
  {
    label: '02',
    title: 'Temporäre Bereitstellung',
    text: 'Die Inhalte bleiben nur für einen klar definierten Zeitraum verfügbar und verschwinden danach automatisch wieder.'
  },
  {
    label: '03',
    title: 'Schneller Übergabemoment',
    text: 'QR-Code, Galerie-Link und ZIP-Download ergänzen sich sinnvoll, ohne zusätzliche Erklärungen notwendig zu machen.'
  }
]

const workflowSteps = [
  {
    number: '01',
    title: 'Galerie anlegen',
    text: 'Im Admin-Bereich wird eine neue Galerie erstellt und mit Fotos oder Videos gefüllt. Die Oberfläche hält diesen Schritt bewusst leicht.'
  },
  {
    number: '02',
    title: 'Link weitergeben',
    text: 'Nach dem Upload kann die Galerie direkt geteilt werden. Der Empfänger sieht eine klare Einwilligung und anschliessend die kuratierte Übersicht.'
  },
  {
    number: '03',
    title: 'Komfortabel abrufen',
    text: 'Bilder können einzeln betrachtet werden, Videos öffnen sauber im Overlay und die komplette Galerie lässt sich gesammelt herunterladen.'
  }
]

const currentSlide = ref(0)
let slideInterval

onMounted(() => {
  slideInterval = setInterval(() => {
    currentSlide.value = (currentSlide.value + 1) % images.length
  }, 4800)
})

onUnmounted(() => {
  clearInterval(slideInterval)
})

const closeLogin = () => {
  showLogin.value = false
}

const openLogin = () => {
  showLogin.value = true
  mobileMenuOpen.value = false
}

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

const handleLoginSuccess = () => {
  closeLogin()
  router.push('/admin')
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
