import type { AppScreen } from '../../shared/app/appContribution'
import { words as overviewWords } from '../overview/words'
import { words as settingsWords } from '../settings/words'

/** Kuna's home at `#/`, a card per installed app. The browser tab says only Kuna. */
export const HOME_SCREEN = {
  path: '/',
  component: () => import('../home/HomeScreen.vue'),
} as const

/** Kuna's Overview, your money across the apps, set apart in the home's menu. */
export const OVERVIEW_SCREEN: AppScreen = {
  path: '/overview',
  title: overviewWords.title,
  icon: 'i-lucide-layout-grid',
  component: () => import('../overview/OverviewScreen.vue'),
}

/** Kuna's own settings, for every app on this device, set apart in the home's menu. */
export const KUNA_SETTINGS_SCREEN: AppScreen = {
  path: '/settings',
  title: settingsWords.menu,
  icon: 'i-lucide-settings',
  component: () => import('../settings/SettingsScreen.vue'),
}
