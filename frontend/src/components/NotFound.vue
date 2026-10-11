<template>
  <div class="page-shell flex min-h-screen items-center justify-center px-4 py-8">
    <div class="glass-panel max-w-2xl rounded-[2rem] p-8 text-center sm:p-10">
      <span class="eyebrow">404</span>
      <h1 class="mt-5 text-5xl text-[var(--ink)] sm:text-6xl">Galerie nicht gefunden</h1>
      <p class="mt-5 text-sm leading-7 text-[var(--muted)] sm:text-base">
        Dieser Link ist entweder abgelaufen, unvollständig oder die Galerie wurde bereits entfernt.
      </p>
      <router-link to="/" class="brand-button mt-8">
        Zur Startseite
      </router-link>
    </div>
  </div>
</template>
