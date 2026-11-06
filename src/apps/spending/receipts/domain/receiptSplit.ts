import { words } from './words'
import type { Receipt } from '../../workbook/domain/receipt'
import type { ReceiptLine } from '../../workbook/domain/receiptLine'
import { LINE_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the owner confirmed of a receipt. */
export type ReceiptDraft = Omit<Receipt, 'id' | 'transaction'>

/** A line the owner confirmed, its amount signed as the row is. */
export type ReceiptPart = Pick<ReceiptLine, 'printed' | 'text' | 'amount' | 'category'>

/** The one line of a receipt filed whole under one category. */
export function wholeReceipt(total: Money, category: RecordId): readonly ReceiptPart[] {
  return [{ printed: '', text: '', amount: negateMoney(total), category }]
}

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

/** The line that keeps a row's lines adding up when the row's amount is not the receipt's: a tip, or what the bank booked. */
export function differenceLine(firstLine: Pick<ReceiptLine, 'transaction' | 'receipt' | 'category'>, amount: Money, newKey: () => string = newRecordId): ReceiptLine {
  return { id: recordIdOf(LINE_RECORDS, newKey()), transaction: firstLine.transaction, receipt: firstLine.receipt, printed: '', text: words.difference, amount, category: firstLine.category }
}

/** The category most of the money is under, the first on a tie, which the row is filed under and a Difference line takes. */
function mainCategoryOf(parts: readonly ReceiptPart[]): RecordId {
  const sums = new Map<RecordId, number>()
  for (const part of parts) sums.set(part.category, (sums.get(part.category) ?? 0) + Math.abs(part.amount))
  return [...sums].reduce((main, entry) => (entry[1] > main[1] ? entry : main))[0]
}

/**
 * A confirmed receipt: the row it splits, filed under its main category by your word, or a new row of source `receipt` a
 * later statement fills, and the lines you confirmed. When they do not add up to the row, as with a tip or a misread
 * line, one Difference line in the main category shows what is left, and no line you confirmed changes.
 */
export function receiptSplit(draft: ReceiptDraft, place: ReceiptPlace, parts: readonly ReceiptPart[], newKey: () => string = newRecordId): ReceiptSplit {
  const merchant = draft.merchant.trim()
  const category = mainCategoryOf(parts)
  const before = 'row' in place ? place.row : null
  const row: Transaction =
    'row' in place
      ? { ...place.row, payee: place.row.payee === '' ? merchant : place.row.payee, category, categorisedBy: 'person' }
      : {
          ...NO_BANK_FACTS,
          id: recordIdOf(TRANSACTION_RECORDS, newKey()),
          account: place.account,
          date: draft.issuedOn,
          amount: negateMoney(draft.total),
          payee: merchant,
          category,
          note: '',
          source: 'receipt',
          pair: null,
          categorisedBy: 'person',
        }
  const receipt: Receipt = { ...draft, id: recordIdOf(RECEIPT_RECORDS, newKey()), transaction: row.id, merchant: merchant === '' ? row.payee : merchant }
  const lines = parts.map((part): ReceiptLine => ({ ...part, id: recordIdOf(LINE_RECORDS, newKey()), transaction: row.id, receipt: receipt.id }))
  const difference = subtractMoney(row.amount, sumMoney(parts.map((part) => part.amount)))
  return { before, row, receipt, lines: difference === 0 ? lines : [...lines, differenceLine({ transaction: row.id, receipt: receipt.id, category }, difference, newKey)] }
}
