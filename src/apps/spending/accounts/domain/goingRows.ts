import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { HeldBankRow } from '../../workbook/domain/heldBankRow'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { Transaction } from '../../workbook/domain/transaction'
import { isSplit, rowItemsOf } from '../../workbook/domain/rowItems'

/**
 * What goes with an account's rows: their receipts and split parts, the bank rows on hold that go, and the other legs of the
 * transfers among them, as they are now. Those legs are on accounts that keep their history, so each stays as a lone leg.
 */
export interface GoingRows {
  readonly rows: readonly Transaction[]
  readonly receipts: readonly Receipt[]
  /** The parts of the split rows that go, a receipt's lines and parts split by hand alike. */
  readonly parts: readonly TransactionItem[]
  readonly held: readonly HeldBankRow[]
  readonly loneLegs: readonly Transaction[]
}

/** The rows `goes` picks with what goes with them, and the bank rows on hold `heldGoes` picks. */
export function goingRows(book: Pick<SpendingBook, 'transactions' | 'receipts' | 'items' | 'held'>, goes: (row: Transaction) => boolean, heldGoes: (held: HeldBankRow) => boolean): GoingRows {
  const rows = book.transactions.filter(goes)
  const ids = new Set(rows.map((row) => row.id))
  const itemsOf = rowItemsOf(book)
  const pairs = new Set(rows.flatMap((row) => (row.pair === null ? [] : [row.pair])))
  return {
    rows,
    receipts: book.receipts.filter((receipt) => receipt.transaction !== null && ids.has(receipt.transaction)),
    parts: rows.flatMap((row) => (isSplit(itemsOf(row)) ? itemsOf(row) : [])),
    held: book.held.filter(heldGoes),
    loneLegs: book.transactions.filter((row) => pairs.has(row.id) && !ids.has(row.id)),
  }
}

/** A transfer's other leg once its leg on the account is gone: the same row with no pair, still under its category. */
export function loneLeg(leg: Transaction): Transaction {
  return { ...leg, pair: null }
}
