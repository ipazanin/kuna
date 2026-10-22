export type ScreenPath =
  | '/'
  | '/transactions'
  | '/review'
  | '/invoicing'
  | '/analysis'
  | '/taxes'
  | '/assets'
  | '/year-end'
  | '/forecast'
  | '/pay-scenarios'
  | '/owner'
  | '/ruleset'
  | '/workbook'
  | '/settings'

export interface Screen {
  readonly path: ScreenPath
  readonly title: string
  readonly icon: string
  /** A screen of the Croatian d.o.o. pack, shown only while the workbook's owner-pay module is on. */
  readonly ownerPayPack?: true
}

/** The screens in navigation order. Each one gets a route and a nav link. */
export const SCREENS: readonly Screen[] = [
  { path: '/', title: 'Overview', icon: 'i-lucide-layout-dashboard' },
  { path: '/transactions', title: 'Transactions', icon: 'i-lucide-list' },
  { path: '/review', title: 'Review', icon: 'i-lucide-inbox' },
  { path: '/invoicing', title: 'Invoicing', icon: 'i-lucide-receipt-text' },
  { path: '/analysis', title: 'Analysis', icon: 'i-lucide-chart-bar' },
  { path: '/taxes', title: 'Taxes', icon: 'i-lucide-landmark', ownerPayPack: true },
  { path: '/assets', title: 'Assets', icon: 'i-lucide-package', ownerPayPack: true },
  { path: '/year-end', title: 'Year end', icon: 'i-lucide-calendar-check', ownerPayPack: true },
  { path: '/forecast', title: 'Forecast', icon: 'i-lucide-telescope', ownerPayPack: true },
  { path: '/pay-scenarios', title: 'Pay scenarios', icon: 'i-lucide-split', ownerPayPack: true },
  { path: '/owner', title: 'Owner', icon: 'i-lucide-user-round', ownerPayPack: true },
  { path: '/ruleset', title: 'Ruleset', icon: 'i-lucide-scale' },
  { path: '/workbook', title: 'Workbook', icon: 'i-lucide-book-open' },
  { path: '/settings', title: 'Settings', icon: 'i-lucide-settings' },
]
