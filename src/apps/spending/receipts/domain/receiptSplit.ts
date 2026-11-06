import { words } from './words'
import type { Receipt } from '../../workbook/domain/receipt'
import type { ReceiptLine } from '../../workbook/domain/receiptLine'
import { LINE_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { addMoney, negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the owner confirmed of a receipt. */
export type ReceiptDraft = Pick<Receipt, 'merchant' | 'issuedOn' | 'issuedTime' | 'total' | 'jir' | 'zki' | 'photo'>

/** The row a receipt splits, or the account of the new row it makes. */
export type ReceiptPlace = { readonly row: Transaction } | { readonly account: RecordId }

/** Everything one confirmed receipt writes. */
export interface ReceiptSplit {
  /** The row as the file holds it, null for a new one. */
  readonly before: Transaction | null
  readonly row: Transaction
  readonly receipt: Receipt
  readonly lines: readonly ReceiptLine[]
}

function lineOf(row: RecordId, receipt: RecordId, text: string, amount: Money, category: RecordId, newKey: () => string): ReceiptLine {
  return { id: recordIdOf(LINE_RECORDS, newKey()), transaction: row, receipt, printed: '', text, amount, category }
}

/** The line that keeps a row's lines adding up when the row's amount is not the receipt's: a tip, or what the bank booked. */
export function differenceLine(firstLine: Pick<ReceiptLine, 'transaction' | 'receipt' | 'category'>, amount: Money, newKey: () => string = newRecordId): ReceiptLine {
  return lineOf(firstLine.transaction, firstLine.receipt, words.difference, amount, firstLine.category, newKey)
}

/**
 * A confirmed receipt with its one category: the row it splits, filed under that category by your word, or a new row of source
 * `receipt` a later statement fills, and the line of the whole total. A row whose amount differs gains one Difference line.
 */
export function receiptSplit(draft: ReceiptDraft, place: ReceiptPlace, category: RecordId, newKey: () => string = newRecordId): ReceiptSplit {
  const merchant = draft.merchant.trim()
  const spent = negateMoney(draft.total)
  const before = 'row' in place ? place.row : null
  const row: Transaction =
    'row' in place
      ? { ...place.row, payee: place.row.payee === '' ? merchant : place.row.payee, category, categorisedBy: 'person' }
      : {
          ...NO_BANK_FACTS,
          id: recordIdOf(TRANSACTION_RECORDS, newKey()),
          account: place.account,
          date: draft.issuedOn,
          amount: spent,
          payee: merchant,
          category,
          note: '',
          source: 'receipt',
          pair: null,
          categorisedBy: 'person',
        }
  const receipt: Receipt = { ...draft, id: recordIdOf(RECEIPT_RECORDS, newKey()), transaction: row.id, merchant: merchant === '' ? row.payee : merchant, merchantOib: '', buyerOib: '', readBy: '' }
  const whole = lineOf(row.id, receipt.id, '', spent, category, newKey)
  const difference = addMoney(row.amount, draft.total)
  return { before, row, receipt, lines: difference === 0 ? [whole] : [whole, differenceLine(whole, difference, newKey)] }
}
