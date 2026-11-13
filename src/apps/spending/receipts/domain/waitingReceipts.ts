import { matchesAmong, splittableRows } from './receiptMatch'
import type { ReceiptMatches } from './receiptMatch'
import { rowFiledBy } from './receiptSplit'
import type { ReceiptPlace } from './receiptSplit'
import { differenceItem } from '../../entries/domain/entrySplit'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import type { Account } from '../../workbook/domain/account'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { Transaction } from '../../workbook/domain/transaction'
import { linkOfItems } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { newRecordId } from '../../../../shared/storage/domain/recordId'

/** What the waiting reads of the book. */
type WaitingBook = Pick<SpendingBook, 'accounts' | 'categories' | 'transactions' | 'receipts' | 'items'>

/** Whether the receipt has no entry yet, as it waits on an account the bank fills for the bank's row of its payment. */
export function waitsForBank(receipt: Pick<Receipt, 'transaction'>): boolean {
  return receipt.transaction === null
}

/** A receipt that waits for the bank's row, with the rows already on its account it may be, which only a person picks from. */
export interface WaitingReceipt {
  readonly receipt: Receipt
  readonly account: Account
  readonly lines: readonly TransactionItem[]
  /** The payment it stands for, minus its total, on its euro account. */
  readonly amount: AccountMoney
  readonly matches: ReceiptMatches
}

/** Whether the waiting receipt asks the person which payment it is: rows on its account may be it, but none arrived clearly enough for it to go by itself. */
export function asksForPayment(waiting: Pick<WaitingReceipt, 'matches'>): boolean {
  return waiting.matches.kind !== 'none'
}

/** A waiting receipt once it goes on its row: the row filed by it, the receipt naming the row, and the row's items. */
export interface PlacedReceipt {
  readonly before: Transaction
  readonly row: Transaction
  readonly receipt: { readonly before: Receipt; readonly after: Receipt }
  /** The receipt's lines naming the row, and a Difference line when the bank booked another amount, as with a tip. */
  readonly items: readonly TransactionItem[]
  /** The row's items the lines replace. */
  readonly replaced: readonly TransactionItem[]
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
          lines: book.items.filter((line) => line.receipt === receipt.id),
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
 * The waiting receipt on the row, which it files as `receiptSplit` files one: its lines go in place of the row's items and take
 * their link, and a line of `differenceText` under the category most of the receipt's money is in makes up what the bank booked
 * beyond the total.
 */
export function receiptOnRow(
  receipt: Receipt,
  lines: readonly TransactionItem[],
  { row, held }: Extract<ReceiptPlace, { readonly row: Transaction }>,
  differenceText: string,
  newKey: () => string = newRecordId,
): PlacedReceipt {
  const link = linkOfItems(held)
  const placed = lines.map((line) => ({ ...line, transaction: row.id, link }))
  const difference = differenceItem(row.amount, placed, { transaction: row.id, receipt: receipt.id, category: mainCategoryOf(lines), link }, differenceText, newKey)
  return {
    before: row,
    row: rowFiledBy(row, receipt.merchant),
    receipt: { before: receipt, after: { ...receipt, transaction: row.id, account: null, merchant: receipt.merchant === '' ? row.payee : receipt.merchant } },
    items: difference === null ? placed : [...placed, difference],
    replaced: held,
  }
}

/**
 * The waiting receipts that go on rows the bank brings now, by a file or the sync, matched as a receipt matches its payment:
 * oldest receipt first, among the rows on its account it may split, those already on the file as well. A receipt goes only
 * when one arriving row is clear. When more than one row could be it, or none clearly is, it keeps waiting and To review asks
 * the person. Each row takes one receipt.
 */
export function receiptsArriving(book: WaitingBook, arriving: readonly ItemizedRow[], differenceText: string, newKey: () => string = newRecordId): readonly PlacedReceipt[] {
  const waiting = waitingReceipts(book)
  if (waiting.length === 0 || arriving.length === 0) return []
  const fresh = new Map(arriving.map((itemized) => [itemized.row, itemized.items]))
  const rows = splittableRows({ ...book, transactions: [...book.transactions, ...fresh.keys()], items: [...book.items, ...arriving.flatMap((itemized) => itemized.items)] })
  const taken = new Set<Transaction>()
  return waiting.flatMap(({ receipt, account, lines }) => {
    const matches = matchesAmong(
      receipt,
      rows.filter((row) => row.account === account.id && !taken.has(row)),
    )
    const row = matches.kind === 'ready' ? matches.candidates[0]?.row : undefined
    const held = row === undefined ? undefined : fresh.get(row)
    if (row === undefined || held === undefined) return []
    taken.add(row)
    return [receiptOnRow(receipt, lines, { row, held }, differenceText, newKey)]
  })
}
