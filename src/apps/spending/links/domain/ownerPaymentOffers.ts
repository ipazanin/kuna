import type { OffersBook } from './instalmentOffers'
import { maybeCompanyPayment } from './linkTarget'
import type { LinkTarget, OwnerPaymentTarget } from './linkTarget'
import { filedAsTransfer, holdsLink, rowItemsOf, waitsOnReview } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Transaction } from '../../workbook/domain/transaction'
import { isNear, matchMoney } from '../../../../shared/app/moneyMatch'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/** A row that may be a payment between your company and you, which a person links with one tap. */
export interface OwnerPaymentOffer<Target extends OwnerPaymentTarget = OwnerPaymentTarget> {
  readonly row: Transaction
  readonly target: Target
  /** Whether Kuna suggests it: the row is exactly the payment from 3 days before to 7 days after its day. A row only near is offered. */
  readonly suggested: boolean
  /** The row's amount less the payment's, signed as the row is, zero when they are equal. */
  readonly difference: AccountMoney
}

/** The payment as money of a euro account: a credit for money to you, a debit for money from you. */
function paymentMoney(target: OwnerPaymentTarget): AccountMoney {
  const amount = accountMoneyOfEuros(target.amount)
  return target.direction === 'to-owner' ? amount : negateAccountMoney(amount)
}

/**
 * The rows that may be each payment between your company and you which no row is linked to yet. A row may be one when it is
 * on a euro account whose IBAN the payment names, the way the money went, with no link and no other leg, and not filed as a
 * transfer. Each payment in day order takes the nearest row of exactly its amount inside the window, and those left take the
 * nearest near row as `isNear` has it. Each row is one payment.
 */
export function ownerPaymentOffers<Target extends LinkTarget>(book: OffersBook, targets: readonly Target[]): readonly OwnerPaymentOffer<Target & OwnerPaymentTarget>[] {
  const itemsOf = rowItemsOf(book)
  const linked = new Set(book.items.flatMap((item) => (item.link === null ? [] : [rowLinkText(item.link)])))
  const accounts = new Map(book.accounts.map((account) => [account.id, account]))
  const isTransfer = filedAsTransfer(book.categories)
  const rows = book.transactions.filter((row) => row.pair === null && !holdsLink(itemsOf(row)) && !isTransfer(itemsOf(row)))
  const payments = targets
    .filter((target): target is Target & OwnerPaymentTarget => target.kind === 'owner-payment' && !linked.has(rowLinkText(target.link)))
    .sort((earlier, later) => earlier.day.localeCompare(later.day))
  const expected = payments.map((target) => ({ date: target.day, amount: paymentMoney(target), target }))
  const mayBe = (wanted: (typeof expected)[number], row: Transaction): boolean => {
    const account = accounts.get(row.account)
    return account !== undefined && maybeCompanyPayment(row, account, wanted.target)
  }
  return matchMoney(expected, rows, { mayBe, near: isNear }).map(({ expected: { target }, row, exact, difference }) => ({ row, target, suggested: exact, difference }))
}

/** The rows filed already that Kuna suggests are payments from or to your company, which To review offers to link at once. Oldest payment first. */
export function pastOwnerPayments<Target extends OwnerPaymentTarget>(
  book: Pick<SpendingBook, 'items'>,
  offers: readonly OwnerPaymentOffer<Target>[],
  putOff: CivilDate | null,
): readonly OwnerPaymentOffer<Target>[] {
  const itemsOf = rowItemsOf(book)
  return offers.filter((offer) => offer.suggested && !waitsOnReview(itemsOf(offer.row)) && (putOff === null || offer.target.day > putOff))
}
