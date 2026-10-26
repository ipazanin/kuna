import { nextTick, readonly, ref } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteComponent, RouteRecordRaw, Router } from 'vue-router'

import { installedPack } from '../../features/packs/packContribution'
import { nameScreen } from './browserTitle'
import { SCREENS, screensWith } from './screens'
import type { ScreenPath } from './screens'

/** Each screen is its own chunk, so ECharts and the table load only with the screens that draw them. */
const SCREEN_COMPONENTS: Readonly<Record<ScreenPath, () => Promise<RouteComponent>>> = {
  '/': () => import('../../features/overview/presentation/OverviewScreen.vue'),
  '/transactions': () => import('../../features/transactions/presentation/TransactionsScreen.vue'),
  '/review': () => import('../../features/review/presentation/ReviewScreen.vue'),
  '/invoicing': () => import('../../features/invoicing/presentation/InvoicingScreen.vue'),
  '/analysis': () => import('../../features/analysis/presentation/AnalysisScreen.vue'),
  '/settings': () => import('../../features/settings/presentation/SettingsScreen.vue'),
}

const loading = ref(false)

/** True while a screen's code is on its way. A short wait keeps a cached screen from flashing a placeholder. */
export const screenLoading = readonly(loading)

let showPlaceholder: ReturnType<typeof setTimeout> | undefined
const stopLoading = (): void => {
  clearTimeout(showPlaceholder)
  loading.value = false
}

/**
 * The app's router, made only once Google's answer to a redirect sign-in is out of the address,
 * since hash history reads the address as it is made. Hash history, because GitHub Pages serves
 * static files and cannot answer a deep path with index.html. A new screen opens at its top, so its heading is never under the top bar. A filter or tab change
 * keeps the place, and a link to a part of the screen, such as a month in a list, scrolls it to just
 * below the bars that stay at the top, through its `scroll-margin-top`. The first load is already at
 * the top, and a scroll there could land after a screen scrolled itself to a linked row.
 */
export function createAppRouter(): Router {
  const pack = installedPack()
  const screens = screensWith(pack.screens)
  const routes: RouteRecordRaw[] = [
    ...SCREENS.map((screen) => ({ path: screen.path, component: SCREEN_COMPONENTS[screen.path] })),
    ...pack.screens.map((screen) => ({ path: screen.path, component: screen.component })),
    { path: '/start', component: () => import('../../features/onboarding/presentation/OnboardingScreen.vue') },
  ]
  // Written inline so the production build folds it to false and drops the gallery chunk entirely.
  // The fake build keeps it, because the visual check screenshots the gallery from that build.
  if (import.meta.env.DEV || import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    routes.push({ path: '/gallery', component: () => import('../ui/gallery/GalleryScreen.vue') })
  }
  routes.push({ path: '/:unknown(.*)*', redirect: '/' })

  const router = createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior: (to, from, savedPosition) => {
      if (savedPosition) {
        return savedPosition
      }
      if (to.hash !== '') {
        document.getElementById(decodeURIComponent(to.hash.slice(1)))?.scrollIntoView({ block: 'start' })
        return false
      }
      return to.path === from.path || from.matched.length === 0 ? false : { top: 0 }
    },
  })

  /**
   * Each screen names the browser tab. Moving to another screen puts focus on its heading, so a
   * screen reader announces where it landed. The first load and a filter change keep focus where it is.
   */
  router.afterEach((to, from, failure) => {
    if (failure) {
      return
    }
    nameScreen(screens.find((candidate) => candidate.path === to.path)?.title ?? null)
    if (from.matched.length > 0 && to.path !== from.path) {
      void nextTick(() => document.querySelector<HTMLElement>('[data-testid="screen-title"]')?.focus({ preventScroll: true }))
    }
  })

  router.beforeEach((to, from) => {
    if (to.path !== from.path) {
      clearTimeout(showPlaceholder)
      showPlaceholder = setTimeout(() => {
        loading.value = true
      }, 120)
    }
  })
  router.afterEach(stopLoading)
  router.onError(stopLoading)
  return router
}
