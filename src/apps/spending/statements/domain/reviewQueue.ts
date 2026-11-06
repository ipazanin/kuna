import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { sameMoney, typedRowsOf } from '../../pairing/domain/sameMoney'
import type { NearMatch } from '../../pairing/domain/sameMoney'
import { isPairable, transferPairs } from '../../pairing/domain/transferPairs'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Transaction } from '../../workbook/domain/transaction'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO } from '../../../../shared/money/money'

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
}

/** How many rows wait for a category. */
export function reviewCount(book: Pick<SpendingBook, 'transactions'>): number {
  return book.transactions.filter((row) => row.category === null).length
}

/**
 * Works out To review from the file, so nothing about it is stored. A typed row equal to a waiting row is offered like a
 * near match, since a row typed after the import never met it in a dry run.
 */
export function reviewQueue(book: SpendingBook, day: CivilDate): ReviewQueue {
  const since = addDays(day, -PAIRS_SHOWN_DAYS)
  const waitingRows = book.transactions.filter((row) => row.category === null)
  const { matches, near } = sameMoney(
    typedRowsOf(book),
    waitingRows.filter((row) => row.source === 'statement'),
  )
  const maybeTyped = new Map<Transaction, NearMatch<Transaction, Transaction>>([...matches.map((match) => ({ ...match, difference: ZERO })), ...near].map((match) => [match.bank, match]))
  const { offered } = transferPairs(waitingRows.filter(isPairable), book.accounts)
  const maybeTransfer = new Map<Transaction, TransferPair>(offered.flatMap((pair) => [[pair.debit, pair] as const, [pair.credit, pair] as const]))

  const byId = new Map(book.transactions.map((row) => [row.id, row]))
  const recent = book.transactions.filter((row) => row.date >= since && row.source === 'statement').reverse()
  const pairs = recent.flatMap((row): TransferPair[] => {
    const other = row.pair === null ? undefined : byId.get(row.pair)
    return row.amount < 0 && other !== undefined ? [{ debit: row, credit: other }] : []
  })
  const transfer = book.categories.find((category) => category.kind === 'transfer')?.id
  const loneLegs = recent.filter((row) => row.pair === null && row.category === transfer)

  return {
    waiting: [...waitingRows].reverse().map((row) => ({ row, maybeTyped: maybeTyped.get(row) ?? null, maybeTransfer: maybeTransfer.get(row) ?? null })),
    pairs,
    loneLegs,
    wantingSavings: book.transactions.filter((row) => row.pair === null && wantsSavingsAccount(row, book.accounts)).length,
  }
}
