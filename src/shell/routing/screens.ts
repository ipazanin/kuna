import type { AppScreen } from '../../shared/app/appContribution'
import { words as netWorthWords } from '../netWorth/words'
import { words as settingsWords } from '../settings/words'

/** Kuna's home at `#/`, a card per installed app. The browser tab says only Kuna. */
export const HOME_SCREEN = {
  path: '/',
  component: () => import('../home/HomeScreen.vue'),
} as const

/** Net worth, your money across the apps, at the top of the menu. */
export const NET_WORTH_SCREEN: AppScreen = {
  path: '/overview',
  title: netWorthWords.title,
  icon: 'i-lucide-scale',
  component: () => import('../netWorth/NetWorthScreen.vue'),
}

/** Kuna's own settings, for every app on this device, pinned at the foot of the menu. */
export const KUNA_SETTINGS_SCREEN: AppScreen = {
  path: '/settings',
  title: settingsWords.menu,
  icon: 'i-lucide-settings',
  component: () => import('../settings/SettingsScreen.vue'),
}
