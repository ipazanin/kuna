import { words } from './words'
import { differencePart, mainCategoryOf } from '../../entries/domain/entrySplit'
import type { Receipt } from '../../workbook/domain/receipt'
import type { EntryPart } from '../../workbook/domain/entryPart'
import { PART_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { Money } from '../../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the owner confirmed of a receipt. */
export type ReceiptDraft = Omit<Receipt, 'id' | 'transaction'>

/** A line the owner confirmed, its amount signed as the row is. */
export type ReceiptPart = Pick<EntryPart, 'printed' | 'text' | 'amount' | 'category'>

/** The one line of a receipt filed whole under one category. */
export function wholeReceipt(total: Money, category: RecordId): readonly ReceiptPart[] {
  return [{ printed: '', text: '', amount: negateAccountMoney(accountMoneyOfEuros(total)), category }]
}

/** The row a receipt splits, or the account of the new row it makes. */
export type ReceiptPlace = { readonly row: Transaction } | { readonly account: RecordId }

/** Everything one confirmed receipt writes. */
export interface ReceiptSplit {
  /** The row as the file holds it, null for a new one. */
  readonly before: Transaction | null
  readonly row: Transaction
  readonly receipt: Receipt
  readonly lines: readonly EntryPart[]
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
          amount: negateAccountMoney(accountMoneyOfEuros(draft.total)),
          payee: merchant,
          category,
          note: '',
          source: 'receipt',
          pair: null,
          categorisedBy: 'person',
        }
  const receipt: Receipt = { ...draft, id: recordIdOf(RECEIPT_RECORDS, newKey()), transaction: row.id, merchant: merchant === '' ? row.payee : merchant }
  const lines = parts.map((part): EntryPart => ({ ...part, id: recordIdOf(PART_RECORDS, newKey()), transaction: row.id, receipt: receipt.id }))
  const difference = differencePart(row.amount, lines, { transaction: row.id, receipt: receipt.id, category }, words.difference, newKey)
  return { before, row, receipt, lines: difference === null ? lines : [...lines, difference] }
}
