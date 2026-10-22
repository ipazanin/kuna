import './shared/styles/app.css'

import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import { installPack } from './features/packs/packContribution'
import { takeGoogleRedirect } from './shared/google/googleAuth'
import { startServiceWorker } from './shared/pwa/appUpdate'
import { createAppRouter } from './shared/routing/router'
import { applyInitialTheme } from './shared/theme/theme'

applyInitialTheme()

async function start(): Promise<void> {
  // Loaded apart from the entry chunk, and installed before the router lists its screens.
  const { hrDooPack } = await import('./packs/hr-doo/hrDooPack')
  installPack(hrDooPack)
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { seedFakeWorkbook } = await import('./features/workbook/infrastructure/fake/seedFakeWorkbook')
    await seedFakeWorkbook(new URLSearchParams(window.location.search).get('fake'))
  }
  const googleReturn = takeGoogleRedirect()
  createApp(App, { googleReturn }).use(createAppRouter()).use(ui).mount('#app')
  // Inline, as above. Development and the fake build never cache the app.
  if (import.meta.env.PROD && import.meta.env.VITE_FAKE_WORKBOOK !== 'true') {
    startServiceWorker()
  }
}

void start()
