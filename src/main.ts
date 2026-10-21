import './shared/styles/app.css'

import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import { takeGoogleRedirect } from './features/workbook/infrastructure/googleAuth'
import { startServiceWorker } from './shared/pwa/appUpdate'
import { createAppRouter } from './shared/routing/router'
import { applyInitialTheme } from './shared/theme/theme'

applyInitialTheme()

async function start(): Promise<void> {
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
