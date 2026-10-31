import type { MovedScreen } from '../../shared/app/appContribution'
import { CATEGORY_RULES_TAB } from './rules/presentation/ruleLinks'
import { REVIEW_TAB } from './transactions/presentation/transactionsLinks'

/**
 * The old Review screen's address. Its rules opened with `?tab=rules` and now live on Settings, which
 * takes no filters. Its queue now lives on Transactions and keeps the filters the link came with.
 */
const REVIEW: MovedScreen = {
  path: '/company/review',
  to: ({ tab, rule, ...filters }) =>
    tab === 'rules'
      ? { path: '/company/settings', query: { tab: CATEGORY_RULES_TAB, ...(rule === undefined ? {} : { rule }) } }
      : { path: '/company/transactions', query: { ...filters, tab: REVIEW_TAB } },
}

export const COMPANY_MOVED_SCREENS: readonly MovedScreen[] = [REVIEW]
