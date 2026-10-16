import './shared/styles/app.css'
import './shared/charts/echarts'

import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import { router } from './shared/routing/router'
import { applyInitialTheme } from './shared/theme/theme'

applyInitialTheme()

async function start(): Promise<void> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { seedFakeWorkbook } = await import('./features/workbook/infrastructure/fake/seedFakeWorkbook')
    await seedFakeWorkbook()
  }
  createApp(App).use(router).use(ui).mount('#app')
}

void start()
