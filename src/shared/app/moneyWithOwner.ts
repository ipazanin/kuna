import type { RouteLocationRaw } from 'vue-router'

import type { CivilDate } from '../calendar/civilDate'
import type { Money } from '../money/money'
import type { PublishedLinkTarget } from './rowLinks'

/**
 * What a part of a payment between a company and its owner is, as another app files it: salary, rent, a profit payout, an owner
 * loan either way, a cost paid back either way, a trip's per diems and kilometres, other tax-free pay such as a results bonus, or other money.
 */
export type PublishedOwnerMoney = 'salary' | 'rent' | 'profit-payout' | 'owner-loan' | 'cost-refund' | 'travel-allowance' | 'tax-free-pay' | 'other'

/** One kind of money in a payment between a company and its owner. Above zero. */
export interface PublishedOwnerMoneyPart {
  readonly kind: PublishedOwnerMoney
  readonly amount: Money
}

/** A bank row between a company and its owner, with the link a row in another app names it by and the page that shows it. */
export interface PublishedOwnerPayment {
  readonly link: PublishedLinkTarget
  readonly day: CivilDate
  /** Above zero, whichever way the money went. */
  readonly amount: Money
  readonly direction: 'to-owner' | 'from-owner'
  /** The company account's own IBAN. */
  readonly companyIban: string
  /** The owner's IBAN the row was paid to or from, normalised. */
  readonly ownerIban: string
  /** One part per kind, larger first, which add up to the amount. */
  readonly parts: readonly PublishedOwnerMoneyPart[]
  readonly to: RouteLocationRaw
}

/** A cost the owner paid privately for the company, which a row of the owner's own account can be, with the link that names it and the page that shows it. */
export interface PublishedOwnerAdvance {
  readonly link: PublishedLinkTarget
  readonly day: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  /** The name of the company's category it counts in. */
  readonly categoryName: string
  readonly to: RouteLocationRaw
}

/** The money between a company and its owner: the bank rows between them and the costs the owner paid privately. */
export interface PublishedMoneyWithOwner {
  readonly payments: readonly PublishedOwnerPayment[]
  readonly advances: readonly PublishedOwnerAdvance[]
}

/** An app's money with its owner, a wait while its file opens, a failure, or null while the app is not set up or keeps no owner pay. */
export type AppMoneyWithOwner = PublishedMoneyWithOwner | 'opening' | 'failed' | null

/** The money with its owner one app publishes, under the app's id. */
export interface MoneyWithOwnerOfApp {
  readonly app: string
  readonly money: AppMoneyWithOwner
}
