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
  '/review': () => import('../../features/review/presentation/ReviewScreen.vue'),
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
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
