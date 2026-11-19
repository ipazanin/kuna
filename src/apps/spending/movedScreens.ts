import { SORTING_CARDS, SPENDING_SETTINGS_ROUTE, SPENDING_SORTING_ROUTE } from './overview/presentation/spendingLinks'
import type { MovedScreen } from '../../shared/app/appContribution'

/** The Labels screen, whose labels are now a card of Sorting. */
const LABELS: MovedScreen = { path: '/spending/labels', to: (query) => ({ path: SPENDING_SORTING_ROUTE, query, hash: `#${SORTING_CARDS.labels}` }) }

/** Settings' Rules tab, whose rules are now a card of Sorting. Settings keeps its other tabs. */
const RULES_TAB: MovedScreen = {
  path: SPENDING_SETTINGS_ROUTE,
  tab: 'rules',
  to: ({ tab: _tab, ...query }) => ({ path: SPENDING_SORTING_ROUTE, query, hash: `#${SORTING_CARDS.rules}` }),
}

export const SPENDING_MOVED_SCREENS: readonly MovedScreen[] = [LABELS, RULES_TAB]
