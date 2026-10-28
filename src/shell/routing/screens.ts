import { h } from 'vue'

import type { AppScreen } from '../../shared/app/appContribution'
import { installedApps } from './appRegistry'

/** The shell's screen, set apart at the end of the menu as the setup rather than the figures. Its code loads with every app's parts of it. */
export const SETTINGS_SCREEN: AppScreen = {
  path: '/settings',
  title: 'Settings',
  icon: 'i-lucide-settings',
  component: async () => {
    const [{ default: SettingsScreen }, parts] = await Promise.all([import('../settings/SettingsScreen.vue'), Promise.all(installedApps().map((app) => app.settings()))])
    return { render: () => h(SettingsScreen, { parts }) }
  },
}
