import { nextTick, readonly, ref } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw, Router } from 'vue-router'

import type { AppContribution } from '../../shared/app/appContribution'
import { nameScreen } from '../../shared/routing/browserTitle'
import { homeApp, installedApps, ownsPath, screenName } from './appRegistry'
import { SETTINGS_SCREEN } from './screens'

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
 * static files and cannot answer a deep path with index.html. A new screen opens at its top, so its
 * heading is never under the top bar. A filter or tab change keeps the place, and a link to a part of the screen, such as a month in a list, scrolls it to just
 * below the bars that stay at the top, through its `scroll-margin-top`. The first load is already at
 * the top, and a scroll there could land after a screen scrolled itself to a linked row.
 */
export function createAppRouter(): Router {
  const apps = installedApps()
  apps.forEach(refuseScreensOutside)
  const named = [...apps.flatMap((app) => app.screens.map((screen) => ({ screen, name: screenName(app, screen) }))), { screen: SETTINGS_SCREEN, name: SETTINGS_SCREEN.title }]
  const routes: RouteRecordRaw[] = [
    { path: '/', redirect: homeApp().screens[0]?.path ?? SETTINGS_SCREEN.path },
    ...named.map(({ screen, name }) => ({ path: screen.path, component: screen.component, meta: { bare: screen.bare === true, title: name } })),
    // Written inline so the production build folds it to false and drops the gallery chunk entirely.
    // The fake build keeps it, because the visual check screenshots the gallery from that build.
    ...(import.meta.env.DEV || import.meta.env.VITE_FAKE_WORKBOOK === 'true'
      ? [{ path: '/gallery', component: () => import('../gallery/GalleryScreen.vue'), meta: { bare: false, title: 'Gallery' } }]
      : []),
    { path: '/:unknown(.*)*', redirect: '/' },
  ]

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
   * Each screen names the browser tab, with its app's name for an app other than the home app.
   * Moving to another screen puts focus on its heading, so a screen reader announces where it
   * landed. The first load and a filter change keep focus where it is.
   */
  router.afterEach((to, from, failure) => {
    if (failure) {
      return
    }
    nameScreen(to.meta.bare === true || typeof to.meta.title !== 'string' ? null : to.meta.title)
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

/** An app's routes stay under its id, so two apps never claim one address. */
function refuseScreensOutside(app: AppContribution): void {
  const outside = [...app.screens.map((screen) => screen.path), app.startPath].find((path) => !ownsPath(app, path))
  if (outside !== undefined) {
    throw new Error(`The ${app.id} app's route ${outside} is not under /${app.id}.`)
  }
}
