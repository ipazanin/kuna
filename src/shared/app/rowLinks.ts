import type { CivilDate } from '../calendar/civilDate'
import type { AccountMoney } from '../money/accountMoney'
import type { CurrencyCode } from '../money/currencyCode'

/** The record in another app a row names, as that app keeps it: its app, its kind and its key, and for an instalment its due date. */
export interface PublishedLinkTarget {
  readonly app: string
  readonly kind: string
  readonly key: string
  readonly due: CivilDate | null
}

/** A row's item linked to a record in another app, as the shell takes it: which row, item and account, its day, the item's amount, and what it names. */
export interface PublishedRowLink {
  /** The row's bare UUID. */
  readonly row: string
  /** The item's bare UUID. A row not split has one item, under the row's UUID. */
  readonly item: string
  /** The account's bare UUID. */
  readonly account: string
  readonly day: CivilDate
  /** The item's money in the account's own currency, credits above zero and debits below. */
  readonly amount: AccountMoney
  readonly currency: CurrencyCode
  readonly target: PublishedLinkTarget
}

/** An app's linked rows, a wait while its file opens, a failure, or null while the app is not set up. */
export type AppRowLinks = readonly PublishedRowLink[] | 'opening' | 'failed' | null

/** The rows one app has linked, under the app's id. */
export interface AppLinkedRows {
  readonly app: string
  readonly links: AppRowLinks
}
