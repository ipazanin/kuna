import type { CivilDate } from '../calendar/civilDate'
import type { AccountMoney } from '../money/accountMoney'
import type { CurrencyCode } from '../money/currencyCode'
import type { Money } from '../money/money'

/** The record in another app a row names, as that app keeps it: its app, its kind and its key, and for an instalment its due date. */
export interface PublishedLinkTarget {
  readonly app: string
  readonly kind: string
  readonly key: string
  readonly due: CivilDate | null
}

/** How the app that keeps a linked item counts it: as spending, as income, as saved, as an asset bought, or in no figure. */
export type LinkedItemCounts = 'spending' | 'income' | 'saved' | 'bought' | 'nowhere'

/** A row's item linked to a record in another app, as the shell takes it: which row, item and account, its day, the item's amount in its currency and in euros, how it counts, and what it names. */
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
  /** The item's money in euros at the rate of its row's day, signed as `amount`, or null while the rates do not reach that day. */
  readonly euros: Money | null
  readonly counts: LinkedItemCounts
  readonly target: PublishedLinkTarget
}

/** An app's linked rows, a wait while its file opens, a failure, or null while the app is not set up. */
export type AppRowLinks = readonly PublishedRowLink[] | 'opening' | 'failed' | null

/** The rows one app has linked, under the app's id. */
export interface AppLinkedRows {
  readonly app: string
  readonly links: AppRowLinks
}

/**
 * Every installed app's linked rows that name a record of the given app, so the reader never spells which apps link. An app
 * still opening or not set up gives none, and an app that failed to open makes the whole read `unchecked`, since its links are unknown.
 */
export function linksNaming(linked: readonly AppLinkedRows[], app: string): readonly PublishedRowLink[] | 'unchecked' {
  if (linked.some(({ links }) => links === 'failed')) return 'unchecked'
  return linked.flatMap(({ links }) => (links === null || typeof links === 'string' ? [] : links.filter(({ target }) => target.app === app)))
}
