import { createRouter, createWebHashHistory } from 'vue-router'
import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

import CashScreen from '../../features/cash/presentation/CashScreen.vue'
import OverviewScreen from '../../features/overview/presentation/OverviewScreen.vue'
import PeriodReviewScreen from '../../features/period-review/presentation/PeriodReviewScreen.vue'
import ReviewScreen from '../../features/review/presentation/ReviewScreen.vue'
import SettingsScreen from '../../features/settings/presentation/SettingsScreen.vue'
import SpendingScreen from '../../features/spending/presentation/SpendingScreen.vue'
import TransactionsScreen from '../../features/transactions/presentation/TransactionsScreen.vue'
import TrendsScreen from '../../features/trends/presentation/TrendsScreen.vue'
import { SCREENS } from './screens'
import type { ScreenPath } from './screens'

const SCREEN_COMPONENTS: Readonly<Record<ScreenPath, Component>> = {
  '/': OverviewScreen,
  '/transactions': TransactionsScreen,
  '/trends': TrendsScreen,
  '/spending': SpendingScreen,
  '/period-review': PeriodReviewScreen,
  '/cash': CashScreen,
  '/review': ReviewScreen,
  '/settings': SettingsScreen,
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
