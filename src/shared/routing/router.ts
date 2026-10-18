import { nextTick, readonly, ref } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteComponent, RouteRecordRaw } from 'vue-router'

import { SCREENS } from './screens'
import type { ScreenPath } from './screens'

/** Each screen is its own chunk, so ECharts and the table load only with the screens that draw them. */
const SCREEN_COMPONENTS: Readonly<Record<ScreenPath, () => Promise<RouteComponent>>> = {
  '/': () => import('../../features/overview/presentation/OverviewScreen.vue'),
  '/transactions': () => import('../../features/transactions/presentation/TransactionsScreen.vue'),
  '/trends': () => import('../../features/trends/presentation/TrendsScreen.vue'),
  '/spending': () => import('../../features/spending/presentation/SpendingScreen.vue'),
  '/period-review': () => import('../../features/period-review/presentation/PeriodReviewScreen.vue'),
  '/cash': () => import('../../features/cash/presentation/CashScreen.vue'),
  '/receivables': () => import('../../features/receivables/presentation/ReceivablesScreen.vue'),
  '/taxes': () => import('../../packs/hr-doo/presentation/TaxesScreen.vue'),
  '/owner': () => import('../../packs/hr-doo/presentation/OwnerScreen.vue'),
  '/ruleset': () => import('../../packs/hr-doo/ruleset/presentation/RulesetScreen.vue'),
  '/review': () => import('../../features/review/presentation/ReviewScreen.vue'),
  '/workbook': () => import('../../features/settings/presentation/WorkbookScreen.vue'),
  '/settings': () => import('../../features/settings/presentation/SettingsScreen.vue'),
}

const routes: RouteRecordRaw[] = SCREENS.map((screen) => ({ path: screen.path, component: SCREEN_COMPONENTS[screen.path] }))

// Written inline so the production build folds it to false and drops the gallery chunk entirely.
// The fake build keeps it, because the visual check screenshots the gallery from that build.
if (import.meta.env.DEV || import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
  routes.push({ path: '/gallery', component: () => import('../ui/gallery/GalleryScreen.vue') })
}

routes.push({ path: '/:unknown(.*)*', redirect: '/' })

/** Hash history, because GitHub Pages serves static files and cannot answer a deep path with index.html. */
/** A new screen opens at its top, so its heading is never under the top bar. A filter change keeps the place. */
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: (to, from, savedPosition) => savedPosition ?? (to.path === from.path ? false : { top: 0 }),
})

const APP_NAME = 'Ledgerboard'

/**
 * Each screen names the browser tab. Moving to another screen puts focus on its heading, so a
 * screen reader announces where it landed. The first load and a filter change keep focus where it is.
 */
router.afterEach((to, from, failure) => {
  if (failure) {
    return
  }
  const screen = SCREENS.find((candidate) => candidate.path === to.path)
  document.title = screen === undefined ? APP_NAME : `${screen.title} – ${APP_NAME}`
  if (from.matched.length > 0 && to.path !== from.path) {
    void nextTick(() => document.querySelector<HTMLElement>('[data-testid="screen-title"]')?.focus({ preventScroll: true }))
  }
})

const loading = ref(false)

/** True while a screen's code is on its way. A short wait keeps a cached screen from flashing a placeholder. */
export const screenLoading = readonly(loading)

let showPlaceholder: ReturnType<typeof setTimeout> | undefined
router.beforeEach((to, from) => {
  if (to.path !== from.path) {
    clearTimeout(showPlaceholder)
    showPlaceholder = setTimeout(() => {
      loading.value = true
    }, 120)
  }
})
const stopLoading = (): void => {
  clearTimeout(showPlaceholder)
  loading.value = false
}
router.afterEach(stopLoading)
router.onError(stopLoading)
