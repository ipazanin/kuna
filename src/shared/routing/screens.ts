export interface Screen {
  readonly path: string
  readonly title: string
}

/** The screens in navigation order. Each one gets a route and a nav link. */
export const SCREENS: readonly Screen[] = [
  { path: '/', title: 'Overview' },
  { path: '/transactions', title: 'Transactions' },
  { path: '/trends', title: 'Trends' },
  { path: '/spending', title: 'Spending' },
  { path: '/period-review', title: 'Period review' },
  { path: '/cash', title: 'Cash' },
  { path: '/obligations', title: 'Obligations' },
  { path: '/review', title: 'Review' },
  { path: '/settings', title: 'Settings' },
]
