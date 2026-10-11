import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './index.css' // Tailwind oder andere globale Styles

createApp(App)
  .use(router)       // Router aktivieren
  .mount('#app')     // App in <div id="app"> einhängen


// ---------------------------------------------------------------
// 📦 Service Worker Registrierung (für stabile ZIP-Downloads)
// ---------------------------------------------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/download-sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Download Service Worker registriert:', reg.scope)
      })
      .catch((err) => {
        console.error('[SW] Fehler bei Registrierung:', err)
      })
  })
}
