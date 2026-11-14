import { decidingRule } from './spendingCategorisation'
import { cashAccountsFor, isWithdrawal } from '../../pairing/domain/cashWithdrawals'
import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { splittableRows } from '../../receipts/domain/receiptMatch'
import { asksForPayment, waitingReceipts } from '../../receipts/domain/waitingReceipts'
import { sameMoney, typedRowsOf } from '../../pairing/domain/sameMoney'
import type { NearMatch } from '../../pairing/domain/sameMoney'
import { isPairable, transferPairs } from '../../pairing/domain/transferPairs'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { filedAsTransfer, rowItemsOf, waitsOnReview } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'

/** How far back To review lists the transfers it can still undo. */
const PAIRS_SHOWN_DAYS = 30

/** A row waiting for a category, with what the file offers for it. */
export interface WaitingRow {
  readonly row: Transaction
  /** A typed row that may be this same money, which you can join with it. */
  readonly maybeTyped: NearMatch<Transaction, Transaction> | null
  /** A row on another account that may be this transfer's other leg, which you can pair it with. */
  readonly maybeTransfer: TransferPair | null
}

/** Cash taken out with no leg on a cash account yet, and the open cash accounts it may go to, of which one is proposed by itself. */
export interface WithdrawalWithoutCash {
  readonly row: Transaction
  readonly cashAccounts: readonly Account[]
}

/** What To review shows. */
export interface ReviewQueue {
  /** Newest first. */
  readonly waiting: readonly WaitingRow[]
  /** The transfers the pairing made in the last 30 days, newest first. */
  readonly pairs: readonly TransferPair[]
  /** The lone legs of the last 30 days that wait for a statement to bring the other side, newest first. */
  readonly loneLegs: readonly Transaction[]
  /** Every pocket move on the file that waits for a savings account, however old, since older ones are not listed. */
  readonly wantingSavings: number
  /** Every withdrawal on the file with no cash leg, however old, newest first. */
  readonly withdrawals: readonly WithdrawalWithoutCash[]
}

/**
 * How many things wait on To review for the person: rows for a category, the bank rows on hold, the withdrawals filed with no
 * cash leg, and the waiting receipts that ask which payment they are.
 */
export function reviewCount(book: SpendingBook): number {
  const itemsOf = rowItemsOf(book)
  const isWaiting = (row: Transaction): boolean => waitsOnReview(itemsOf(row))
  const filedWithoutCash = withdrawalsWithoutCash(book, filedAsTransfer(book.categories), itemsOf).filter(({ row }) => !isWaiting(row)).length
  const receiptsAsking = waitingReceipts(book).filter(asksForPayment).length
  return book.transactions.filter(isWaiting).length + book.held.length + filedWithoutCash + receiptsAsking
}

/**
 * The bank's rows that take cash out with no cash leg yet, as the bank's row type or the rule deciding them says, which the
 * person has not filed or called no cash, and the reader did not file elsewhere. A withdrawal filed before its rule was made is one of them.
 */
function withdrawalsWithoutCash(
  book: SpendingBook,
  isTransfer: (items: readonly TransactionItem[]) => boolean,
  itemsOf: (row: Transaction) => readonly TransactionItem[],
): readonly WithdrawalWithoutCash[] {
  const ruleOf = decidingRule(book.rules, book)
  const unfiled = (row: Transaction): boolean => row.categorisedBy === 'rule' || (row.categorisedBy === null && (waitsOnReview(itemsOf(row)) || isTransfer(itemsOf(row))))
  return book.transactions
    .filter((row) => row.source === 'statement' && unfiled(row) && isWithdrawal(row, ruleOf(row), book.accounts))
    .reverse()
    .map((row) => ({ row, cashAccounts: cashAccountsFor(row, ruleOf(row)?.withdrawal?.cashAccount ?? null, book.accounts) }))
}

/**
 * Works out To review from the file, so nothing about it is stored. A typed row equal to a waiting row is offered like a
 * near match, since a row typed after the import never met it in a dry run. A withdrawal waits for its cash leg apart from
 * the rows that wait for a category and the lone legs that wait for a statement.
 */
export function reviewQueue(book: SpendingBook, day: CivilDate): ReviewQueue {
  const since = addDays(day, -PAIRS_SHOWN_DAYS)
  const itemsOf = rowItemsOf(book)
  const isTransfer = filedAsTransfer(book.categories)
  const withdrawals = withdrawalsWithoutCash(book, isTransfer, itemsOf)
  const wantingCash = new Set(withdrawals.map(({ row }) => row))
  const waitingRows = book.transactions.filter((row) => waitsOnReview(itemsOf(row)) && !wantingCash.has(row))
  const { matches, near } = sameMoney(
    typedRowsOf(book),
    waitingRows.filter((row) => row.source === 'statement'),
  )
  const maybeTyped = new Map<Transaction, NearMatch<Transaction, Transaction>>([...matches.map((match) => ({ ...match, difference: ZERO_ACCOUNT_MONEY })), ...near].map((match) => [match.bank, match]))
  const { offered } = transferPairs(waitingRows.filter(isPairable), book.accounts, itemsOf)
  const maybeTransfer = new Map<Transaction, TransferPair>(offered.flatMap((pair) => [[pair.debit, pair] as const, [pair.credit, pair] as const]))

  const byId = new Map(book.transactions.map((row) => [row.id, row]))
  const recent = book.transactions.filter((row) => row.date >= since && row.source === 'statement').reverse()
  const pairs = recent.flatMap((row): TransferPair[] => {
    const other = row.pair === null ? undefined : byId.get(row.pair)
    return row.amount < 0 && other !== undefined ? [{ debit: row, credit: other }] : []
  })
  const loneLegs = recent.filter((row) => row.pair === null && isTransfer(itemsOf(row)) && !wantingCash.has(row))

  return {
    waiting: [...waitingRows].reverse().map((row) => ({ row, maybeTyped: maybeTyped.get(row) ?? null, maybeTransfer: maybeTransfer.get(row) ?? null })),
    pairs,
    loneLegs,
    wantingSavings: book.transactions.filter((row) => row.pair === null && wantsSavingsAccount(row, book.accounts)).length,
    withdrawals,
  }
}

/**
 * The rows that offer to take a receipt photo: those a receipt may split, but for a row To review still asks about as maybe a
 * transfer, which waits until that question is answered.
 */
export function rowsTakingReceipt(book: SpendingBook, day: CivilDate): ReadonlySet<Transaction['id']> {
  const maybeTransfer = new Set(reviewQueue(book, day).waiting.flatMap((waiting) => (waiting.maybeTransfer === null ? [] : [waiting.row.id])))
  return new Set(splittableRows(book).flatMap((row) => (maybeTransfer.has(row.id) ? [] : [row.id])))
}
