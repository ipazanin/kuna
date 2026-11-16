import { computed } from 'vue'

import { loanTargets } from './loanTargets'
import type { ShownTarget } from './loanTargets'
import { extraPaymentOffers, instalmentOffers, pastInstalments } from '../domain/instalmentOffers'
import type { ExtraPaymentOffer, InstalmentOffer, PastInstalments } from '../domain/instalmentOffers'
import { decidingRule } from '../../statements/domain/spendingCategorisation'
import type { AppTargets, InstalmentTarget } from '../domain/linkTarget'
import { reviewCount } from '../../statements/domain/reviewQueue'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { INSTALMENTS_PUT_OFF_KEY, instalmentsPutOffText } from '../../workbook/domain/spendingSettings'
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

/** How many things To review asks about Loans: each loan's card of past instalments as one, and each row to record as an extra payment. */
export function loanAsks(review: InstalmentReview): number {
  return review.past.length + review.extraPayments.length
}

/** How many things wait on To review. */
export function toReviewCount(book: SpendingBook, day: CivilDate): number {
  return reviewCount(book, loanAsks(instalmentReview(book, day)))
}

/** Stops the loan's card offering the instalments it offers now. A later instalment is still offered. */
export function putOffPastInstalments(unit: UnitOfWork, book: Pick<SpendingBook, 'readings' | 'settings'>, card: PastInstalments): void {
  const through = card.offers.reduce<CivilDate | null>((last, { target }) => (last === null || target.due > last ? target.due : last), null)
  if (through === null) return
  const others = book.settings.instalmentsPutOff.filter(({ loan }) => loan !== card.loan)
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, INSTALMENTS_PUT_OFF_KEY, instalmentsPutOffText([...others, { loan: card.loan, through }]))
}
