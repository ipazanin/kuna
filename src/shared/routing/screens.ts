export interface Screen {
  readonly path: string
  readonly title: string
  readonly icon: string
  /** Set apart from the screens above it in the menu, as the setup rather than the figures. */
  readonly setApart?: true
}

export type ScreenPath = '/' | '/transactions' | '/review' | '/invoicing' | '/analysis' | '/settings'

/** The core screens in navigation order. Each one gets a route and a nav link. */
export const SCREENS: readonly (Screen & { readonly path: ScreenPath })[] = [
  { path: '/', title: 'Overview', icon: 'i-lucide-layout-dashboard' },
  { path: '/transactions', title: 'Transactions', icon: 'i-lucide-list' },
  { path: '/review', title: 'Review', icon: 'i-lucide-inbox' },
  { path: '/invoicing', title: 'Invoicing', icon: 'i-lucide-receipt-text' },
  { path: '/analysis', title: 'Analysis', icon: 'i-lucide-chart-bar' },
  { path: '/settings', title: 'Settings', icon: 'i-lucide-settings', setApart: true },
]

/** The core screens with a pack's screens after the figures and before the ones set apart. */
export function screensWith(packScreens: readonly Screen[]): Screen[] {
  return [...SCREENS.filter((screen) => screen.setApart !== true), ...packScreens, ...SCREENS.filter((screen) => screen.setApart === true)]
}
