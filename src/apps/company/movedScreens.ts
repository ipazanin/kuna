import { withoutFilterKeys } from './filters/domain/filterQuery'
import { COMPANY_SORTING_ROUTE, SORTING_CARDS } from './sorting/presentation/sortingLinks'
import type { MovedScreen } from '../../shared/app/appContribution'

const SETTINGS_ROUTE = '/company/settings'

/** The Labels screen, whose labels are now a card of Sorting. Sorting reads no filters, so the old address's filter keys stay behind. */
const LABELS: MovedScreen = {
  path: '/company/labels',
  to: (query) => ({ path: COMPANY_SORTING_ROUTE, query: withoutFilterKeys(query), hash: `#${SORTING_CARDS.labels}` }),
}

/** Settings' Categories tab, whose categories are now a card of Sorting. Settings keeps its other tabs. */
const CATEGORIES_TAB: MovedScreen = {
  path: SETTINGS_ROUTE,
  tab: 'categories',
  to: ({ tab: _tab, ...query }) => ({ path: COMPANY_SORTING_ROUTE, query, hash: `#${SORTING_CARDS.categories}` }),
}

/** Settings' Category rules tab, whose rules are now a card of Sorting. A `?rule=` is kept and scrolls to its rule, so it takes no card anchor. */
const CATEGORY_RULES_TAB: MovedScreen = {
  path: SETTINGS_ROUTE,
  tab: 'category-rules',
  to: ({ tab: _tab, ...query }) => ({ path: COMPANY_SORTING_ROUTE, query, hash: query.rule === undefined ? `#${SORTING_CARDS.rules}` : '' }),
}

export const COMPANY_MOVED_SCREENS: readonly MovedScreen[] = [LABELS, CATEGORIES_TAB, CATEGORY_RULES_TAB]
