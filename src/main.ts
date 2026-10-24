import './shared/styles/app.css'

import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import { installPack } from './features/packs/packContribution'
import { installPackTabs } from './features/workbook/infrastructure/packTabs'
import { loadWorkbookChoice } from './features/workbook/infrastructure/workbookChoice'
import { askForDriveReadSilently, takeGoogleRedirect } from './shared/google/googleAuth'
import { startServiceWorker } from './shared/pwa/appUpdate'
import { createAppRouter } from './shared/routing/router'
import { applyInitialTheme } from './shared/theme/theme'

applyInitialTheme()

async function start(): Promise<void> {
  // Loaded apart from the entry chunk, and installed before the router lists its screens and before a workbook is read.
  const [{ hrDooPack }, { HR_DOO_TABS }] = await Promise.all([import('./packs/hr-doo/hrDooPack'), import('./packs/hr-doo/infrastructure/hrDooTabs')])
  installPack(hrDooPack)
  installPackTabs(HR_DOO_TABS)
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { seedFakeWorkbook } = await import('./features/workbook/infrastructure/fake/seedFakeWorkbook')
    await seedFakeWorkbook(new URLSearchParams(window.location.search).get('fake'))
  }
  const googleReturn = await takeGoogleRedirect()
  // Each open of a Google Sheet online, and each return from a sign-in, fetches the Drive read token first, with no screen at Google.
  if (
    import.meta.env.VITE_FAKE_WORKBOOK !== 'true' &&
    navigator.onLine &&
    loadWorkbookChoice()?.source === 'google' &&
    askForDriveReadSilently(googleReturn)
  ) {
    return
  }
  createApp(App, { googleReturn }).use(createAppRouter()).use(ui).mount('#app')
  // Inline, as above. Development and the fake build never cache the app.
  if (import.meta.env.PROD && import.meta.env.VITE_FAKE_WORKBOOK !== 'true') {
    startServiceWorker()
  }
}

void start()
