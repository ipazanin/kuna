import { matchesAmong, splittableRows } from './receiptMatch'
import type { ReceiptMatches } from './receiptMatch'
import { rowFiledBy } from './receiptSplit'
import type { ReceiptPlace } from './receiptSplit'
import { differencePart } from '../../entries/domain/entrySplit'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import type { Account } from '../../workbook/domain/account'
import type { EntryPart } from '../../workbook/domain/entryPart'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { Transaction } from '../../workbook/domain/transaction'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { newRecordId } from '../../../../shared/storage/domain/recordId'

/** What the waiting reads of the book. */
type WaitingBook = Pick<SpendingBook, 'accounts' | 'categories' | 'transactions' | 'receipts' | 'lines'>

/** Whether the receipt has no entry yet, as it waits on an account the bank fills for the bank's row of its payment. */
export function waitsForBank(receipt: Pick<Receipt, 'transaction'>): boolean {
  return receipt.transaction === null
}

/** A receipt that waits for the bank's row, with the rows already on its account it may be, which only a person picks from. */
export interface WaitingReceipt {
  readonly receipt: Receipt
  readonly account: Account
  readonly lines: readonly EntryPart[]
  /** The payment it stands for, minus its total, on its euro account. */
  readonly amount: AccountMoney
  readonly matches: ReceiptMatches
}

/** Whether the waiting receipt asks the person which payment it is: rows on its account may be it, but none arrived clearly enough for it to go by itself. */
export function asksForPayment(waiting: Pick<WaitingReceipt, 'matches'>): boolean {
  return waiting.matches.kind !== 'none'
}

/** A waiting receipt once it goes on its row: the row filed by it, and the receipt and its lines naming the row. */
export interface PlacedReceipt {
  readonly before: Transaction
  readonly row: Transaction
  readonly receipt: { readonly before: Receipt; readonly after: Receipt }
  readonly lines: readonly { readonly before: EntryPart; readonly after: EntryPart }[]
  /** The parts of a split by hand that the lines replace. */
  readonly replaced: readonly EntryPart[]
  /** What keeps the lines adding up to the row when the bank booked another amount, as with a tip. */
  readonly difference: EntryPart | null
}

/** The receipts waiting for the bank's row, oldest first, each with the rows on its account it may be. */
export function waitingReceipts(book: WaitingBook): readonly WaitingReceipt[] {
  const waiting = book.receipts.filter(waitsForBank)
  if (waiting.length === 0) return []
  const rows = splittableRows(book)
  return waiting
    .sort((one, other) => one.issuedOn.localeCompare(other.issuedOn))
    .flatMap((receipt) => {
      const account = book.accounts.find((held) => held.id === receipt.account)
      if (account === undefined) return []
      return [
        {
          receipt,
          account,
          lines: book.lines.filter((line) => line.receipt === receipt.id),
          amount: negateAccountMoney(accountMoneyOfEuros(receipt.total)),
          matches: matchesAmong(
            receipt,
            rows.filter((row) => row.account === account.id),
          ),
        },
      ]
    })
}

/**
 * The waiting receipt on the row: the row files under the category most of the receipt's money is in, as `receiptSplit` files
 * one, its lines go in place of any parts it was split into by hand, and a line of `differenceText` makes up what the bank booked beyond the total.
 */
export function receiptOnRow(
  receipt: Receipt,
  lines: readonly EntryPart[],
  { row, handParts }: Extract<ReceiptPlace, { readonly row: Transaction }>,
  differenceText: string,
  newKey: () => string = newRecordId,
): PlacedReceipt {
  const category = mainCategoryOf(lines)
  const placed = lines.map((line) => ({ before: line, after: { ...line, transaction: row.id } }))
  return {
    before: row,
    row: rowFiledBy(row, receipt.merchant, category),
    receipt: { before: receipt, after: { ...receipt, transaction: row.id, account: null, merchant: receipt.merchant === '' ? row.payee : receipt.merchant } },
    lines: placed,
    replaced: handParts,
    difference: differencePart(
      row.amount,
      placed.map(({ after }) => after),
      { transaction: row.id, receipt: receipt.id, category },
      differenceText,
      newKey,
    ),
  }
}

/**
 * The waiting receipts that go on rows the bank brings now, by a file or the sync, matched as a receipt matches its payment:
 * oldest receipt first, among the rows on its account it may split, those already on the file as well. A receipt goes only
 * when one arriving row is clear. When more than one row could be it, or none clearly is, it keeps waiting and To review asks
 * the person. Each row takes one receipt.
 */
export function receiptsArriving(book: WaitingBook, arriving: readonly Transaction[], differenceText: string, newKey: () => string = newRecordId): readonly PlacedReceipt[] {
  const waiting = waitingReceipts(book)
  if (waiting.length === 0 || arriving.length === 0) return []
  const fresh = new Set(arriving)
  const rows = splittableRows({ ...book, transactions: [...book.transactions, ...arriving] })
  const taken = new Set<Transaction>()
  return waiting.flatMap(({ receipt, account, lines }) => {
    const matches = matchesAmong(
      receipt,
      rows.filter((row) => row.account === account.id && !taken.has(row)),
    )
    const row = matches.kind === 'ready' ? matches.candidates[0]?.row : undefined
    if (row === undefined || !fresh.has(row)) return []
    taken.add(row)
    return [receiptOnRow(receipt, lines, { row, handParts: [] }, differenceText, newKey)]
  })
}
