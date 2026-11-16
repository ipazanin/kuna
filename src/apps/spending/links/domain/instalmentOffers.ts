import { expectedOf } from './instalmentSplit'
import { loanLinkOf, paidLoansIn, sameRecord } from './linkTarget'
import type { InstalmentTarget, LinkTarget, PaidLoan } from './linkTarget'
import { inWindow, isNear, nearestTo } from '../../pairing/domain/sameMoney'
import type { DatedMoney } from '../../pairing/domain/sameMoney'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { filedAsTransfer, holdsLink, linksOfItems, rowItemsOf, waitsOnReview } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { InstalmentPutOff } from '../../workbook/domain/spendingSettings'
import { payeeCondition, sameCondition } from '../../workbook/domain/spendingRule'
import type { SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO_ACCOUNT_MONEY, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
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

/** The loan a link to one of its instalments names, as text to key a map by. */
function loanOf(link: RowLink): string {
  return rowLinkText(loanLinkOf(link))
}

/** A row linked to one of a loan's instalments: the loan its link names, what a rule for the row's payee tests, and the category its interest went under. */
export interface LearnedPayee {
  readonly loan: RowLink
  readonly row: Transaction
  /** Its IBAN, or its payee's name for a row with none. */
  readonly condition: SpendingRuleCondition
  /** Null when the link left no part of it outside Loan principal. */
  readonly interest: RecordId | null
}

/** The payees of the rows linked to loans' instalments, oldest row first, the one owner of "rows to this payee pay this loan". */
export function learnedPayees(book: Pick<SpendingBook, 'transactions' | 'items' | 'categories'>): readonly LearnedPayee[] {
  const itemsOf = rowItemsOf(book)
  const repayments = new Set(book.categories.filter((category) => category.kind === 'repayment').map((category) => category.id))
  return [...book.transactions]
    .sort((earlier, later) => earlier.date.localeCompare(later.date))
    .flatMap((row): LearnedPayee[] => {
      const paid = linksOfItems(itemsOf(row)).find(({ link }) => link.due !== null)
      const condition = payeeCondition(row)
      if (paid === undefined || condition === null) return []
      const interest = paid.items.find((item) => item.category !== null && !repayments.has(item.category))?.category ?? null
      return [{ loan: loanLinkOf(paid.link), row, condition, interest }]
    })
}

/** The IBANs the rows linked to each loan's instalments were paid to, by the loan as `loanOf` names it. */
function learnedIbans(book: OffersBook): ReadonlyMap<string, ReadonlySet<string>> {
  const ibans = new Map<string, Set<string>>()
  for (const { loan, condition } of learnedPayees(book)) {
    if (condition.column !== 'counterparty_iban') continue
    ibans.set(loanOf(loan), (ibans.get(loanOf(loan)) ?? new Set()).add(normaliseIban(condition.iban)))
  }
  return ibans
}

/** A rule Kuna offers on the Rules card: rows to the payee of the first row linked to a loan pay that loan, their interest under the category its interest went under. */
export interface LoanRuleOffer {
  readonly loan: PaidLoan
  readonly condition: SpendingRuleCondition
  readonly category: RecordId
}

/**
 * One rule per loan the targets name whose linked rows' payees no rule tests yet and that no rule names, for the payee of its
 * first linked row. A loan whose first row left no interest outside Loan principal is not offered, since the rule would have
 * no category.
 */
export function loanRuleOffers(book: Pick<SpendingBook, 'transactions' | 'items' | 'categories' | 'rules'>, targets: readonly LinkTarget[]): readonly LoanRuleOffer[] {
  const payees = learnedPayees(book)
  return paidLoansIn(targets).flatMap((loan): LoanRuleOffer[] => {
    const ofLoan = payees.filter((payee) => sameRecord(payee.loan, loan.link))
    const [first] = ofLoan
    if (first === undefined || first.interest === null) return []
    if (book.rules.some((rule) => rule.link !== null && sameRecord(rule.link, loan.link))) return []
    if (ofLoan.some((payee) => book.rules.some((rule) => sameCondition(rule.condition, payee.condition)))) return []
    return [{ loan, condition: first.condition, category: first.interest }]
  })
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
    (row) => row.amount < 0 && euroAccounts.has(row.account) && row.pair === null && !withReceipt.has(row.id) && !holdsLink(itemsOf(row)) && !isTransfer(itemsOf(row)),
  )
  const instalments = targets
    .filter((target): target is Target & InstalmentTarget => target.kind === 'instalment' && target.due <= day && !linked.has(rowLinkText(target.link)))
    .sort((earlier, later) => earlier.due.localeCompare(later.due))
  const ibans = learnedIbans(book)
  const knownPayee = (row: Transaction, target: InstalmentTarget): boolean => {
    const lender = fold(target.lender)
    const iban = normaliseIban(row.counterpartyIban)
    return (lender !== '' && fold(row.payee).includes(lender)) || (iban !== '' && (ibans.get(loanOf(target.link))?.has(iban) ?? false))
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

/** A row to record in Loans as principal paid back early on the loan its instalment is of. */
export interface ExtraPaymentOffer<Target extends InstalmentTarget = InstalmentTarget> {
  readonly row: Transaction
  /** The loan's instalment due nearest the row, which another row pays. */
  readonly instalment: Target
}

/**
 * The rows a rule whose rows pay a loan filed whole that To review offers to record as an extra payment: money out of a euro
 * account with no link, receipt or other leg, more than a tenth above the share of the loan's instalment due nearest its day,
 * which another row already pays, as a bank books a separate early repayment. `paidLoanOf` gives the loan the rule deciding a row names.
 */
export function extraPaymentOffers<Target extends LinkTarget>(
  book: OffersBook,
  targets: readonly Target[],
  paidLoanOf: (row: Transaction) => RowLink | null,
): readonly ExtraPaymentOffer<Target & InstalmentTarget>[] {
  const itemsOf = rowItemsOf(book)
  const linked = new Set(book.items.flatMap((item) => (item.link === null ? [] : [rowLinkText(item.link)])))
  const euroAccounts = new Set(book.accounts.filter((account) => account.currency === EURO).map((account) => account.id))
  const withReceipt = new Set(book.receipts.map((receipt) => receipt.transaction))
  const instalments = targets.filter((target): target is Target & InstalmentTarget => target.kind === 'instalment')
  return book.transactions.flatMap((row): ExtraPaymentOffer<Target & InstalmentTarget>[] => {
    if (row.categorisedBy !== 'rule' || row.amount >= 0 || row.pair !== null || !euroAccounts.has(row.account) || withReceipt.has(row.id) || holdsLink(itemsOf(row))) return []
    const loan = paidLoanOf(row)
    if (loan === null) return []
    const nearest = nearestTo(
      row.date,
      instalments.filter((target) => sameRecord(loanLinkOf(target.link), loan)).map((target) => ({ date: target.due, target })),
    )?.target
    if (nearest === undefined || !linked.has(rowLinkText(nearest.link))) return []
    const expected = expectedOf(nearest)
    return row.amount < expected.amount && !isNear(expected, { date: expected.date, amount: row.amount }) ? [{ row, instalment: nearest }] : []
  })
}
