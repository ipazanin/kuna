import type { RouteLocationRaw } from 'vue-router'

import type { Account } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

export const SPENDING_OVERVIEW_ROUTE = '/spending'
/** The Spending first run, with its step in the query. */
export const SPENDING_START_ROUTE = '/spending/start'
export const SPENDING_TRANSACTIONS_ROUTE = '/spending/transactions'
/** The To review tab's value in `?tab=`. */
export const SPENDING_REVIEW_TAB = 'review'
/** The rows that wait for you, on the To review tab of Entries. */
export const SPENDING_REVIEW_LINK = `${SPENDING_TRANSACTIONS_ROUTE}?tab=${SPENDING_REVIEW_TAB}`
export const SPENDING_BUDGETS_ROUTE = '/spending/budgets'
export const SPENDING_ACCOUNTS_ROUTE = '/spending/accounts'
export const SPENDING_ACCOUNT_ROUTE = '/spending/account'
export const SPENDING_SETTINGS_ROUTE = '/spending/settings'
/** Settings' Bank sync tab. */
export const SPENDING_BANK_SYNC_LINK = `${SPENDING_SETTINGS_ROUTE}?tab=bank-sync`

/** An account's page, which names the account by its bare UUID in `?account=`. */
export function accountLink(account: Account): RouteLocationRaw {
  return { path: SPENDING_ACCOUNT_ROUTE, query: { account: keyOfRecordId(ACCOUNT_RECORDS, account.id) } }
}

/** The account the page's `?account=` names, or null when the file has none by that id. */
export function accountNamed(accounts: readonly Account[], key: unknown): Account | null {
  return typeof key === 'string' ? (accounts.find((account) => account.id === recordIdOf(ACCOUNT_RECORDS, key)) ?? null) : null
}

/** Transactions filtered to a month and, when given, a category and its children. */
export function transactionsLink(month: MonthKey, category: Category | null = null): RouteLocationRaw {
  return { path: SPENDING_TRANSACTIONS_ROUTE, query: { month, ...(category === null ? {} : { category: keyOfRecordId(CATEGORY_RECORDS, category.id) }) } }
}

/** The Overview with its spending ring opened on a group's children, named by the group's bare UUID in `?group=`. */
export function overviewGroupLink(group: Category): RouteLocationRaw {
  return { path: SPENDING_OVERVIEW_ROUTE, query: { group: keyOfRecordId(CATEGORY_RECORDS, group.id) } }
}

/** The category a page's `?category=` names by its bare UUID, or null. */
export function categoryIdNamed(key: unknown): RecordId | null {
  return typeof key === 'string' && key !== '' ? recordIdOf(CATEGORY_RECORDS, key) : null
}
