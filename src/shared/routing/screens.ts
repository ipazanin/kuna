export type ScreenPath =
  | '/'
  | '/transactions'
  | '/review'
  | '/invoicing'
  | '/analysis'
  | '/owner'
  | '/year'
  | '/settings'

export interface Screen {
  readonly path: ScreenPath
  readonly title: string
  readonly icon: string
  /** A screen of the Croatian d.o.o. pack, shown only while the workbook's owner-pay module is on. */
  readonly ownerPayPack?: true
  /** Set apart from the screens above it in the menu, as the setup rather than the figures. */
  readonly setApart?: true
}

/** The screens in navigation order. Each one gets a route and a nav link. */
export const SCREENS: readonly Screen[] = [
  { path: '/', title: 'Overview', icon: 'i-lucide-layout-dashboard' },
  { path: '/transactions', title: 'Transactions', icon: 'i-lucide-list' },
  { path: '/review', title: 'Review', icon: 'i-lucide-inbox' },
  { path: '/invoicing', title: 'Invoicing', icon: 'i-lucide-receipt-text' },
  { path: '/analysis', title: 'Analysis', icon: 'i-lucide-chart-bar' },
  { path: '/owner', title: 'Owner', icon: 'i-lucide-user-round', ownerPayPack: true },
  { path: '/year', title: 'Year', icon: 'i-lucide-calendar-check', ownerPayPack: true },
  { path: '/settings', title: 'Settings', icon: 'i-lucide-settings', setApart: true },
]
