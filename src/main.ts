import './shared/styles/app.css'

import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import { installPack } from './features/packs/packContribution'
import { autoSyncOn } from './features/sync/infrastructure/autoSyncSwitch'
import { installPackTabs } from './features/workbook/infrastructure/packTabs'
import { loadWorkbookChoice } from './features/workbook/infrastructure/workbookChoice'
import { askSilentlyOnOpen, takeGoogleRedirect } from './shared/google/googleAuth'
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
    const [{ seedFakeWorkbook }, { fakeStaffOf }] = await Promise.all([
      import('./features/workbook/infrastructure/fake/seedFakeWorkbook'),
      import('./packs/hr-doo/infrastructure/fake/fakeStaff'),
    ])
    await seedFakeWorkbook(new URLSearchParams(window.location.search).get('fake'), fakeStaffOf)
  }
  const googleReturn = takeGoogleRedirect()
  // Each open of the books on Drive online on a device that syncs as it opens fetches the page's one token first, with no screen at Google.
  if (googleReturn === null && navigator.onLine && loadWorkbookChoice()?.source === 'drive' && autoSyncOn.value && askSilentlyOnOpen()) {
    return
  }
  createApp(App, { googleReturn }).use(createAppRouter()).use(ui).mount('#app')
  // Inline, as above. Development and the fake build never cache the app.
  if (import.meta.env.PROD && import.meta.env.VITE_FAKE_WORKBOOK !== 'true') {
    startServiceWorker()
  }
}

void start()
