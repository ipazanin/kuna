import { words } from './words'
import { differenceItem } from '../../entries/domain/entrySplit'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { takesRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import type { Receipt } from '../../workbook/domain/receipt'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { ITEM_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { Money } from '../../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the owner confirmed of a receipt. */
export type ReceiptDraft = Omit<Receipt, 'id' | 'transaction' | 'account'>

/** A line the owner confirmed, its amount signed as the row is. */
export type ReceiptPart = Pick<TransactionItem, 'printed' | 'text' | 'amount'> & { readonly category: RecordId }

/** The one line of a receipt filed whole under one category. */
export function wholeReceipt(total: Money, category: RecordId): readonly ReceiptPart[] {
  return [{ printed: '', text: '', amount: negateAccountMoney(accountMoneyOfEuros(total)), category }]
}

/**
 * The row a receipt splits with the parts it was split into by hand, or the account of the new row it makes. On an account the
 * bank fills it makes no row and waits for the bank's.
 */
export type ReceiptPlace = { readonly row: Transaction; readonly handParts: readonly TransactionItem[] } | { readonly account: Pick<Account, 'id' | 'kind' | 'rowsFrom' | 'openedOn'> }

/** The row as a receipt's place, with the parts it was split into by hand, which the receipt's lines replace. */
export function rowPlace(row: Transaction, lines: readonly TransactionItem[]): Extract<ReceiptPlace, { readonly row: Transaction }> {
  return { row, handParts: lines.filter((part) => part.transaction === row.id) }
}

/** Everything one confirmed receipt writes. */
export interface ReceiptSplit {
  /** The row as the file holds it, null for a new one. */
  readonly before: Transaction | null
  /** Null for a receipt that waits for the bank's row. */
  readonly row: Transaction | null
  readonly receipt: Receipt
  readonly lines: readonly TransactionItem[]
  /** The parts of a split by hand that the lines replace. */
  readonly replaced: readonly TransactionItem[]
}

/** The row once a receipt split it: under the category most of the receipt's money is in, by your word, named after the merchant when it had no payee. */
export function rowFiledBy(row: Transaction, merchant: string, category: RecordId | null): Transaction {
  return { ...row, payee: row.payee === '' ? merchant : row.payee, category, categorisedBy: 'person' }
}

/**
 * A confirmed receipt: the row it splits, a new row, of source `receipt` a later statement fills, or typed on a cash account,
 * which no statement fills, or on an account the bank fills no row at all, as it waits for the bank's. Its lines go in place of
 * any parts the row was split into by hand. When they do not add up to the row, or to minus the total of a receipt that
 * waits, as with a tip or a misread line, one Difference line in the main category shows what is left, and no line you confirmed changes.
 */
export function receiptSplit(draft: ReceiptDraft, place: ReceiptPlace, parts: readonly ReceiptPart[], newKey: () => string = newRecordId): ReceiptSplit {
  const merchant = draft.merchant.trim()
  const category = mainCategoryOf(parts)
  const before = 'row' in place ? place.row : null
  const amount = negateAccountMoney(accountMoneyOfEuros(draft.total))
  const waitsOn = 'account' in place && !takesRowsByHand(place.account) ? place.account.id : null
  const row: Transaction | null =
    'row' in place
      ? rowFiledBy(place.row, merchant, category)
      : waitsOn !== null
        ? null
        : {
            ...NO_BANK_FACTS,
            id: recordIdOf(TRANSACTION_RECORDS, newKey()),
            account: place.account.id,
            date: draft.issuedOn,
            amount,
            payee: merchant,
            category,
            note: '',
            source: place.account.kind === 'cash' ? 'typed' : 'receipt',
            pair: null,
            link: null,
            categorisedBy: 'person',
          }
  const transaction = row?.id ?? null
  const receipt: Receipt = { ...draft, id: recordIdOf(RECEIPT_RECORDS, newKey()), transaction, account: waitsOn, merchant: merchant === '' ? (row?.payee ?? '') : merchant }
  const lines = parts.map((part): TransactionItem => ({ ...part, id: recordIdOf(ITEM_RECORDS, newKey()), transaction, receipt: receipt.id }))
  const difference = differenceItem(row?.amount ?? amount, lines, { transaction, receipt: receipt.id, category }, words.difference, newKey)
  return { before, row, receipt, lines: difference === null ? lines : [...lines, difference], replaced: 'row' in place ? place.handParts : [] }
}
