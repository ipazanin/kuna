import { paidOut } from './instalmentSplit'
import { LOANS_APP } from './linkTarget'
import type { InstalmentTarget, LinkTarget } from './linkTarget'
import { inWindow, isNear, nearestTo } from '../../pairing/domain/sameMoney'
import type { DatedMoney } from '../../pairing/domain/sameMoney'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { filedAsTransfer, linkOfItems, rowItemsOf, waitsOnReview } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { InstalmentPutOff } from '../../workbook/domain/spendingSettings'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO_ACCOUNT_MONEY, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import { fold, normaliseIban } from '../../../../shared/text/fold'

/** A row that may pay an instalment, which a person links with one tap. */
export interface InstalmentOffer<Target extends InstalmentTarget = InstalmentTarget> {
  readonly row: Transaction
  readonly target: Target
  /**
   * Whether Kuna suggests it: the row pays the plan's share from 3 days before to 7 days after the due date, or a near amount
   * to a payee that names the lender or to an IBAN a row already linked to the loan was paid to. A row only near is offered.
   */
  readonly suggested: boolean
  /** The row's amount less the plan's share, signed as the row is, zero when they are equal. */
  readonly difference: AccountMoney
}

/** What the offers read of the file. */
export type OffersBook = Pick<SpendingBook, 'transactions' | 'items' | 'accounts' | 'categories' | 'receipts'>

/** The instalment's share as the money out of a euro account that pays it, on its due date. */
function expectedOf(target: InstalmentTarget): DatedMoney {
  return { date: target.due, amount: paidOut(target.yourShare) }
}

/** The IBANs the rows linked to each loan were paid to, by the loan's key. */
function learnedIbans(book: OffersBook): ReadonlyMap<string, ReadonlySet<string>> {
  const itemsOf = rowItemsOf(book)
  const ibans = new Map<string, Set<string>>()
  for (const row of book.transactions) {
    const link = linkOfItems(itemsOf(row))
    if (link === null || link.app !== LOANS_APP || link.kind !== 'bank-loan' || row.counterpartyIban === '') continue
    ibans.set(link.key, (ibans.get(link.key) ?? new Set()).add(normaliseIban(row.counterpartyIban)))
  }
  return ibans
}

/**
 * The rows that may pay each instalment due by the day which no row is linked to yet. A row may pay one when it is money out
 * of a euro account, as the plan is, with no link, no receipt and no other leg, and not filed as a transfer. Each instalment
 * in due order takes the nearest row paying exactly its share inside the window, and those left take the nearest near row
 * as `isNear` has it. Each row pays one instalment.
 */
export function instalmentOffers<Target extends LinkTarget>(book: OffersBook, targets: readonly Target[], day: CivilDate): readonly InstalmentOffer<Target & InstalmentTarget>[] {
  const itemsOf = rowItemsOf(book)
  const linked = new Set(book.items.flatMap((item) => (item.link === null ? [] : [rowLinkText(item.link)])))
  const euroAccounts = new Set(book.accounts.filter((account) => account.currency === EURO).map((account) => account.id))
  const withReceipt = new Set(book.receipts.map((receipt) => receipt.transaction))
  const isTransfer = filedAsTransfer(book.categories)
  const rows = book.transactions.filter(
    (row) => row.amount < 0 && euroAccounts.has(row.account) && row.pair === null && !withReceipt.has(row.id) && linkOfItems(itemsOf(row)) === null && !isTransfer(itemsOf(row)),
  )
  const instalments = targets
    .filter((target): target is Target & InstalmentTarget => target.kind === 'instalment' && target.due <= day && !linked.has(rowLinkText(target.link)))
    .sort((earlier, later) => earlier.due.localeCompare(later.due))
  const ibans = learnedIbans(book)
  const knownPayee = (row: Transaction, target: InstalmentTarget): boolean => {
    const lender = fold(target.lender)
    const iban = normaliseIban(row.counterpartyIban)
    return (lender !== '' && fold(row.payee).includes(lender)) || (iban !== '' && (ibans.get(target.link.key)?.has(iban) ?? false))
  }

  const taken = new Set<Transaction>()
  const take = (target: InstalmentTarget, fits: (expected: DatedMoney, row: Transaction) => boolean): Transaction | undefined => {
    const row = nearestTo(
      target.due,
      rows.filter((candidate) => !taken.has(candidate) && fits(expectedOf(target), candidate)),
    )
    if (row !== undefined) taken.add(row)
    return row
  }
  const exact = instalments.map((target) => ({ target, row: take(target, (expected, row) => row.amount === expected.amount && inWindow(expected, row)) }))
  return exact.flatMap(({ target, row: paying }): InstalmentOffer<Target & InstalmentTarget>[] => {
    if (paying !== undefined) return [{ row: paying, target, suggested: true, difference: ZERO_ACCOUNT_MONEY }]
    const near = take(target, isNear)
    return near === undefined ? [] : [{ row: near, target, suggested: knownPayee(near, target), difference: subtractAccountMoney(near.amount, expectedOf(target).amount) }]
  })
}

/** The rows filed already that Kuna suggests pay a loan's instalments, which To review offers to link at once. */
export interface PastInstalments<Target extends InstalmentTarget = InstalmentTarget> {
  /** The loan's key, as its links name it. */
  readonly loan: string
  readonly loanName: string
  /** Oldest due date first. */
  readonly offers: readonly InstalmentOffer<Target>[]
}

/**
 * The suggested offers on rows already filed, one card per loan in the order of their first due date, leaving out the
 * instalments a loan's card offered up to the day you said Not now. Rows that wait for a category are offered one by one.
 */
export function pastInstalments<Target extends InstalmentTarget>(
  book: Pick<SpendingBook, 'items'>,
  offers: readonly InstalmentOffer<Target>[],
  putOff: readonly InstalmentPutOff[],
): readonly PastInstalments<Target>[] {
  const itemsOf = rowItemsOf(book)
  const through = new Map(putOff.map(({ loan, through: day }) => [loan, day]))
  const cards = new Map<string, PastInstalments<Target>>()
  for (const offer of offers) {
    const loan = offer.target.link.key
    if (!offer.suggested || waitsOnReview(itemsOf(offer.row)) || offer.target.due <= (through.get(loan) ?? '')) continue
    const card = cards.get(loan) ?? { loan, loanName: offer.target.loanName, offers: [] }
    cards.set(loan, { ...card, offers: [...card.offers, offer] })
  }
  return [...cards.values()]
}
