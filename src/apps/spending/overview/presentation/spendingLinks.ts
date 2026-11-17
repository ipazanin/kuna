import type { RouteLocationRaw } from 'vue-router'
import type { Label } from '../../../../shared/categorising/domain/labels'

import type { Account } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import type { SpendingEvent } from '../../workbook/domain/event'
import { payeeKey } from '../../payees/domain/payeeKey'
import { OPENING_PERIOD } from '../../payees/domain/payeePeriod'
import type { PayeePeriod } from '../../payees/domain/payeePeriod'
import type { Transaction } from '../../workbook/domain/transaction'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, EVENT_RECORDS, LABEL_RECORDS } from '../../workbook/domain/spendingKinds'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
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
export const SPENDING_LABELS_ROUTE = '/spending/labels'
export const SPENDING_EVENTS_ROUTE = '/spending/events'
export const SPENDING_PAYEES_ROUTE = '/spending/payees'
/** The value of `?month=` that shows every month at once, as a label's and an event's entries do. */
export const ALL_MONTHS = 'all'
/** The value of `?month=` that shows the twelve whole months up to this one, as the Payees tab counts them. */
export const LAST_12_MONTHS = 'last-12-months'
/** The months Entries shows: one month, every month, or the last twelve. */
export type EntriesMonths = MonthKey | typeof ALL_MONTHS | typeof LAST_12_MONTHS
export const SPENDING_ACCOUNTS_ROUTE = '/spending/accounts'
export const SPENDING_ACCOUNT_ROUTE = '/spending/account'
export const SPENDING_SETTINGS_ROUTE = '/spending/settings'
/** Settings' Bank sync tab. */
export const SPENDING_BANK_SYNC_LINK = `${SPENDING_SETTINGS_ROUTE}?tab=bank-sync`
/** The Assistant tab of Settings, which the chat can link to. */
export const SPENDING_ASSISTANT_LINK = `${SPENDING_SETTINGS_ROUTE}?tab=assistant`
/** Settings' Quick add tab. */
export const SPENDING_QUICK_ADD_LINK = `${SPENDING_SETTINGS_ROUTE}?tab=quick-add`

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

/** Entries of every month that carry the label, named by its bare UUID in `?label=`. */
export function labelLink(label: Label): RouteLocationRaw {
  return { path: SPENDING_TRANSACTIONS_ROUTE, query: { month: ALL_MONTHS, label: keyOfRecordId(LABEL_RECORDS, label.id) } }
}

/** The label the page's `?label=` names, or null when the file has none by that id. */
export function labelNamed(labels: readonly Label[], key: unknown): Label | null {
  return typeof key === 'string' && key !== '' ? (labels.find((label) => label.id === recordIdOf(LABEL_RECORDS, key)) ?? null) : null
}

/** Entries of every month with a part in the event, named by its bare UUID in `?event=`, since a flight bought months before can be put in a trip. */
export function eventLink(event: SpendingEvent): RouteLocationRaw {
  return { path: SPENDING_TRANSACTIONS_ROUTE, query: { month: ALL_MONTHS, event: keyOfRecordId(EVENT_RECORDS, event.id) } }
}

/** The event the page's `?event=` names, or null when the file has none by that id. */
export function eventNamed(events: readonly SpendingEvent[], key: unknown): SpendingEvent | null {
  return typeof key === 'string' && key !== '' ? (events.find((event) => event.id === recordIdOf(EVENT_RECORDS, key)) ?? null) : null
}

/** The Payees tab over a period, which leaves the opening one out of `?period=`. */
export function payeesLink(period: PayeePeriod): RouteLocationRaw {
  return { path: SPENDING_PAYEES_ROUTE, query: period === OPENING_PERIOD ? {} : { period } }
}

/** The months Entries shows for each period of the Payees tab, so a payee's entries add up to the figure tapped. This month stays out of the address. */
const ENTRIES_MONTHS_OF_PERIOD: Readonly<Record<PayeePeriod, typeof ALL_MONTHS | typeof LAST_12_MONTHS | null>> = { month: null, year: LAST_12_MONTHS, all: ALL_MONTHS }

/** Entries of one payee over the period the Payees tab shows, named by their key in `?payee=`. */
export function payeeLink(key: string, period: PayeePeriod): RouteLocationRaw {
  const months = ENTRIES_MONTHS_OF_PERIOD[period]
  return { path: SPENDING_TRANSACTIONS_ROUTE, query: { ...(months === null ? {} : { month: months }), payee: key } }
}

/** The months a page's `?month=` names, or null when it names none, which Entries reads as this month. */
export function entriesMonthsNamed(key: unknown): EntriesMonths | null {
  if (key === ALL_MONTHS || key === LAST_12_MONTHS) return key
  return typeof key === 'string' ? parseMonthKey(key) : null
}

/** The payee a page's `?payee=` names, spelt as their newest row spells it, or null when no row names them. */
export function payeeNamed(rows: readonly Pick<Transaction, 'date' | 'payee'>[], key: unknown): { readonly key: string; readonly name: string } | null {
  if (typeof key !== 'string' || key === '') return null
  const named = rows.filter((row) => payeeKey(row.payee) === key).reduce<Pick<Transaction, 'date' | 'payee'> | null>((newest, row) => (newest === null || row.date >= newest.date ? row : newest), null)
  return named === null ? null : { key, name: named.payee.trim() }
}
