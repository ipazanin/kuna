import './shared/styles/app.css'

import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'

import App from './shell/App.vue'
import { askSilentlyOnOpen, takeGoogleRedirect } from './shared/google/googleAuth'
import { startServiceWorker } from './shell/pwa/appUpdate'
import { installApp, installedApps } from './shell/routing/appRegistry'
import { createAppRouter } from './shell/routing/router'
import { applyLanguage } from './shared/text/language'
import { applyInitialTheme } from './shared/theme/theme'

applyInitialTheme()
applyLanguage()

async function start(): Promise<void> {
  // Each app loads apart from the entry chunk, and is installed before the router lists its screens.
  const [{ companyApp }, { loansApp }, { investmentsApp }] = await Promise.all([import('./apps/company/app'), import('./apps/loans/app'), import('./apps/investments/app')])
  await installApp(companyApp)
  await installApp(loansApp)
  await installApp(investmentsApp)
  const googleReturn = takeGoogleRedirect()
  if (googleReturn === null && navigator.onLine && installedApps().some((app) => app.asksGoogleOnOpen()) && askSilentlyOnOpen()) {
    return
  }
  createApp(App, { googleReturn }).use(createAppRouter()).use(ui).mount('#app')
  // Inline, not hoisted into a constant, so a production build folds it away. Development and the fake build never cache the app.
  if (import.meta.env.PROD && import.meta.env.VITE_FAKE_WORKBOOK !== 'true') {
    startServiceWorker()
  }
}

void start()
