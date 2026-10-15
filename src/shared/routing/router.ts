import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import OverviewScreen from '../../features/overview/presentation/OverviewScreen.vue'
import PendingScreen from './PendingScreen.vue'
import { SCREENS } from './screens'

const routes: RouteRecordRaw[] = SCREENS.map((screen) => {
  if (screen.path === '/') {
    return { path: screen.path, component: OverviewScreen }
  }
  return { path: screen.path, component: PendingScreen, props: { title: screen.title } }
})

// Written inline so the production build folds it to false and drops the spike chunk entirely.
if (import.meta.env.DEV) {
  routes.push({ path: '/spike', component: () => import('../../features/workbook/presentation/SpikeScreen.vue') })
}

routes.push({ path: '/:unknown(.*)*', redirect: '/' })

/** Hash history, because GitHub Pages serves static files and cannot answer a deep path with index.html. */
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
