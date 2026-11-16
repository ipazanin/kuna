import { words } from './words'
import { BY_DAYS } from '../../workbook/domain/event'
import { differenceItem, partCategoryRefusal } from '../../entries/domain/entrySplit'
import type { PartCategoryRefusal } from '../../entries/domain/entrySplit'
import type { Category } from '../../workbook/domain/category'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { takesRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import type { Receipt } from '../../workbook/domain/receipt'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { ITEM_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { linkOfItems, rowItemsOf } from '../../workbook/domain/rowItems'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { partsOfWhole } from '../../../../shared/money/partsOfWhole'
import type { PartsRefusal } from '../../../../shared/money/partsOfWhole'
import type { Money } from '../../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the owner confirmed of a receipt. */
export type ReceiptDraft = Omit<Receipt, 'id' | 'transaction' | 'account'>

/** A line the owner confirmed, its amount signed as the row is. */
export type ReceiptPart = Pick<TransactionItem, 'printed' | 'note' | 'amount'> & { readonly category: RecordId }

/** A line of a receipt as you type it: its amount above zero, or the rest of the total, its category and your words. */
export interface TypedLine {
  readonly amount: AccountMoney | 'rest'
  readonly category: RecordId
  readonly note: string
}

/**
 * The lines you typed for a receipt, each money out, the rest worked out so they add up to its total. A line takes a category
 * as a part of a split does, so never a group with children or Between my accounts.
 */
export function typedReceiptLines(
  categories: readonly Category[],
  total: Money,
  lines: readonly TypedLine[],
): { readonly parts: readonly ReceiptPart[] } | { readonly refused: PartsRefusal | PartCategoryRefusal } {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const wrongCategory = lines.map((line) => partCategoryRefusal(byId.get(line.category), categories)).find((refusal) => refusal !== null) ?? null
  if (wrongCategory !== null) return { refused: wrongCategory }
  const placed = partsOfWhole(
    negateAccountMoney(accountMoneyOfEuros(total)),
    lines.map((line) => (line.amount === 'rest' ? 'rest' : negateAccountMoney(line.amount))),
  )
  if ('refused' in placed) return placed
  return { parts: lines.map((line, place) => ({ printed: '', note: line.note.trim(), amount: placed.parts[place]!, category: line.category })) }
}

/**
 * The row a receipt splits with the items it holds, or the account of the new row it makes. On an account the bank fills it
 * makes no row and waits for the bank's.
 */
export type ReceiptPlace = { readonly row: Transaction; readonly held: readonly TransactionItem[] } | { readonly account: Pick<Account, 'id' | 'kind' | 'rowsFrom' | 'openedOn'> }

/** The row as a receipt's place, with the items the book holds of it, which the receipt's lines replace. */
export function rowPlace(row: Transaction, items: readonly TransactionItem[]): Extract<ReceiptPlace, { readonly row: Transaction }> {
  return { row, held: rowItemsOf({ items })(row) }
}

/** Everything one confirmed receipt writes. */
export interface ReceiptSplit {
  /** The row as the file holds it, null for a new one. */
  readonly before: Transaction | null
  /** Null for a receipt that waits for the bank's row. */
  readonly row: Transaction | null
  readonly receipt: Receipt
  readonly lines: readonly TransactionItem[]
  /** The row's items the lines replace. */
  readonly replaced: readonly TransactionItem[]
}

/** The row once a receipt split it: filed by your word, named after the merchant when it had no payee. */
export function rowFiledBy(row: Transaction, merchant: string): Transaction {
  return { ...row, payee: row.payee === '' ? merchant : row.payee, categorisedBy: 'person' }
}

/**
 * A confirmed receipt: the row it splits, a new row, of source `receipt` a later statement fills, or typed on a cash account,
 * which no statement fills, or on an account the bank fills no row at all, as it waits for the bank's. Its lines go in place of
 * any parts the row was split into by hand. When they do not add up to the row, or to minus the total of a receipt that
 * waits, as with a tip or a misread line, one Difference line in the main category shows what is left, and no line you confirmed changes.
 * Every line takes the row's link when its items named one record, and none when they named several or none.
 */
export function receiptSplit(draft: ReceiptDraft, place: ReceiptPlace, parts: readonly ReceiptPart[], newKey: () => string = newRecordId): ReceiptSplit {
  const merchant = draft.merchant.trim()
  const category = mainCategoryOf(parts)
  const before = 'row' in place ? place.row : null
  const amount = negateAccountMoney(accountMoneyOfEuros(draft.total))
  const waitsOn = 'account' in place && !takesRowsByHand(place.account) ? place.account.id : null
  const row: Transaction | null =
    'row' in place
      ? rowFiledBy(place.row, merchant)
      : waitsOn !== null
        ? null
        : {
            ...NO_BANK_FACTS,
            id: recordIdOf(TRANSACTION_RECORDS, newKey()),
            account: place.account.id,
            date: draft.issuedOn,
            amount,
            payee: merchant,
            source: place.account.kind === 'cash' ? 'typed' : 'receipt',
            pair: null,
            categorisedBy: 'person',
          }
  const transaction = row?.id ?? null
  const receipt: Receipt = { ...draft, id: recordIdOf(RECEIPT_RECORDS, newKey()), transaction, account: waitsOn, merchant: merchant === '' ? (row?.payee ?? '') : merchant }
  const replaced = 'row' in place ? place.held : []
  const link = linkOfItems(replaced)
  const lines = parts.map(({ printed, note, amount: lineAmount, category: lineCategory }): TransactionItem => ({
    id: recordIdOf(ITEM_RECORDS, newKey()),
    transaction,
    receipt: receipt.id,
    printed,
    note,
    amount: lineAmount,
    category: lineCategory,
    link,
    labels: [],
    event: BY_DAYS,
    splitByLink: false,
  }))
  const difference = differenceItem(row?.amount ?? amount, lines, { transaction, receipt: receipt.id, category, link }, words.difference, newKey)
  return { before, row, receipt, lines: difference === null ? lines : [...lines, difference], replaced }
}
