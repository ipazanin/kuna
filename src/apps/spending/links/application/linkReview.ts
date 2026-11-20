import { computed } from 'vue'

import { companyTargets } from './companyTargets'
import { loanTargets } from './loanRecords'
import { investmentTargets } from './investmentTargets'
import type { ShownTarget } from './linkTargets'
import { companyRolesAsk } from '../domain/companyRoles'
import type { CompanyRolesAsk } from '../domain/companyRoles'
import { cashMovementOffers } from '../domain/cashMovementOffers'
import type { CashMovementOffer } from '../domain/cashMovementOffers'
import { ownerPaymentOffers, pastOwnerPayments } from '../domain/ownerPaymentOffers'
import type { OwnerPaymentOffer } from '../domain/ownerPaymentOffers'
import { extraPaymentOffers, instalmentOffers, pastInstalments } from '../domain/instalmentOffers'
import type { ExtraPaymentOffer, InstalmentOffer, PastInstalments } from '../domain/instalmentOffers'
import { decidingRule } from '../../statements/domain/spendingCategorisation'
import type { AppTargets, CashMovementTarget, InstalmentTarget, OwnerPaymentTarget } from '../domain/linkTarget'
import { reviewCount } from '../../statements/domain/reviewQueue'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { COMPANY_PAYMENTS_PUT_OFF_KEY, INSTALMENTS_PUT_OFF_KEY, instalmentsPutOffText } from '../../workbook/domain/spendingSettings'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** An instalment in Loans as To review shows it, with its page in Loans. */
export type ShownInstalment = ShownTarget & InstalmentTarget

/**
 * What To review offers to link to Loans' instalments: a row at a time for the rows waiting for a category, a card per loan for
 * rows filed already, and the rows a loan's rule filed whole to record as an extra payment.
 */
export interface InstalmentReview {
  readonly offers: readonly InstalmentOffer<ShownInstalment>[]
  readonly past: readonly PastInstalments<ShownInstalment>[]
  readonly extraPayments: readonly ExtraPaymentOffer<ShownInstalment>[]
}

/** The Loans file's targets, read again only when Loans changes. */
const shownTargets = computed(() => loanTargets())

/** The review last worked out, which the menu, the tab, the home card and To review share while the file, Loans and the day stay the same. */
let latest: { readonly book: SpendingBook; readonly targets: AppTargets<ShownTarget>; readonly day: CivilDate; readonly review: InstalmentReview } | null = null

/** The offers against the Loans file on screen. While Loans opens, failed or is not set up, nothing is offered. */
export function instalmentReview(book: SpendingBook, day: CivilDate): InstalmentReview {
  const targets = shownTargets.value
  if (latest !== null && latest.book === book && latest.targets === targets && latest.day === day) return latest.review
  const shown = targets === null || typeof targets === 'string' ? [] : targets
  const offers = instalmentOffers(book, shown, day)
  const ruleOf = decidingRule(book.rules, book)
  const review = { offers, past: pastInstalments(book, offers, book.settings.instalmentsPutOff), extraPayments: extraPaymentOffers(book, shown, (row) => ruleOf(row)?.link ?? null) }
  latest = { book, targets, day, review }
  return review
}

/** A payment between your company and you as To review shows it, with its page in Company. */
export type ShownOwnerPayment = ShownTarget & OwnerPaymentTarget

/**
 * What To review offers to link to Company's payments with you: a row at a time for the rows waiting for a category, one card
 * of rows filed already, and the card asking where Kuna files them while a payment needs a category no category takes.
 */
export interface CompanyPaymentReview {
  readonly offers: readonly OwnerPaymentOffer<ShownOwnerPayment>[]
  readonly past: readonly OwnerPaymentOffer<ShownOwnerPayment>[]
  readonly roles: CompanyRolesAsk | null
}

/** Every company app's payments with you, read again only when one of them changes. Those of an app that opens, failed or is not set up are none. */
const shownPayments = computed(() =>
  companyTargets().flatMap(({ targets }) => (targets === null || typeof targets === 'string' ? [] : targets.filter((target): target is ShownOwnerPayment => target.kind === 'owner-payment'))),
)

let latestCompany: { readonly book: SpendingBook; readonly payments: readonly ShownOwnerPayment[]; readonly review: CompanyPaymentReview } | null = null

/** The offers against the payments of the company apps on screen. */
export function companyPaymentReview(book: SpendingBook): CompanyPaymentReview {
  const payments = shownPayments.value
  if (latestCompany !== null && latestCompany.book === book && latestCompany.payments === payments) return latestCompany.review
  const offers = ownerPaymentOffers(book, payments)
  const review = { offers, past: pastOwnerPayments(book, offers, book.settings.companyPaymentsPutOff), roles: companyRolesAsk(book, payments) }
  latestCompany = { book, payments, review }
  return review
}

/** A deposit or a withdrawal in Investments as To review shows it, with its page in Investments. */
export type ShownCashMovement = ShownTarget & CashMovementTarget

/** Every app's deposits and withdrawals, read again only when one of them changes. Those of an app that opens, failed or is not set up are none. */
const shownCashMovements = computed(() =>
  investmentTargets().flatMap(({ targets }) => (targets === null || typeof targets === 'string' ? [] : targets.filter((target): target is ShownCashMovement => target.kind === 'cash-movement'))),
)

let latestCash: { readonly book: SpendingBook; readonly movements: readonly ShownCashMovement[]; readonly offers: readonly CashMovementOffer<ShownCashMovement>[] } | null = null

/** The rows To review offers to link to a deposit or a withdrawal of the apps with brokers' accounts on screen. */
export function cashMovementReview(book: SpendingBook): readonly CashMovementOffer<ShownCashMovement>[] {
  const movements = shownCashMovements.value
  if (latestCash !== null && latestCash.book === book && latestCash.movements === movements) return latestCash.offers
  const offers = cashMovementOffers(book, movements)
  latestCash = { book, movements, offers }
  return offers
}

/**
 * How many things To review asks about records in other apps: each loan's card of past instalments as one, each row to
 * record as an extra payment, the card of payments from Company filed already as one, and the card asking where they file as one.
 */
export function linkAsks(book: SpendingBook, day: CivilDate): number {
  const loans = instalmentReview(book, day)
  const company = companyPaymentReview(book)
  return loans.past.length + loans.extraPayments.length + (company.past.length > 0 ? 1 : 0) + (company.roles === null ? 0 : 1)
}

/** How many things wait on To review. */
export function toReviewCount(book: SpendingBook, day: CivilDate): number {
  return reviewCount(book, linkAsks(book, day))
}

/** Stops the card of payments from Company filed already offering the ones it offers now. A later payment is still offered. */
export function putOffPastOwnerPayments(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>, past: readonly OwnerPaymentOffer[]): void {
  const through = past.reduce<CivilDate | null>((last, { target }) => (last === null || target.day > last ? target.day : last), null)
  if (through !== null) setSetting(unit, SETTING_WRITES, book.readings.settings.facts, COMPANY_PAYMENTS_PUT_OFF_KEY, through)
}

/** Stops the loan's card offering the instalments it offers now. A later instalment is still offered. */
export function putOffPastInstalments(unit: UnitOfWork, book: Pick<SpendingBook, 'readings' | 'settings'>, card: PastInstalments): void {
  const through = card.offers.reduce<CivilDate | null>((last, { target }) => (last === null || target.due > last ? target.due : last), null)
  if (through === null) return
  const others = book.settings.instalmentsPutOff.filter(({ loan }) => loan !== card.loan)
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, INSTALMENTS_PUT_OFF_KEY, instalmentsPutOffText([...others, { loan: card.loan, through }]))
}
