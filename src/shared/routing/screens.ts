export type ScreenPath =
  | '/'
  | '/transactions'
  | '/trends'
  | '/spending'
  | '/period-review'
  | '/cash'
  | '/receivables'
  | '/taxes'
  | '/owner'
  | '/ruleset'
  | '/review'
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
  { path: '/trends', title: 'Trends', icon: 'i-lucide-trending-up' },
  { path: '/spending', title: 'Spending', icon: 'i-lucide-chart-bar' },
  { path: '/period-review', title: 'Period review', icon: 'i-lucide-calendar-range' },
  { path: '/cash', title: 'Cash', icon: 'i-lucide-wallet' },
  { path: '/receivables', title: 'Receivables', icon: 'i-lucide-receipt-text' },
  { path: '/taxes', title: 'Taxes', icon: 'i-lucide-landmark', ownerPayPack: true },
  { path: '/owner', title: 'Owner', icon: 'i-lucide-user-round', ownerPayPack: true },
  { path: '/ruleset', title: 'Ruleset', icon: 'i-lucide-scale' },
  { path: '/review', title: 'Review', icon: 'i-lucide-inbox' },
  { path: '/workbook', title: 'Workbook', icon: 'i-lucide-book-open' },
  { path: '/settings', title: 'Settings', icon: 'i-lucide-settings' },
]
