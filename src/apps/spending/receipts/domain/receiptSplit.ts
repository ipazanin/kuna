import { words } from './words'
import { differenceItem, newPartChoices, partCategoryRefusal } from '../../entries/domain/entrySplit'
import type { PartCategoryRefusal, PartChoices } from '../../entries/domain/entrySplit'
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
import { ruleLabelsOf } from '../../workbook/domain/carriedChoices'
import { heldRuleLabels } from '../../workbook/domain/transactionItemReading'
import { accountMoneyOfEuros, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { partsOfWhole } from '../../../../shared/money/partsOfWhole'
import type { PartsRefusal } from '../../../../shared/money/partsOfWhole'
import type { Money } from '../../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the owner confirmed of a receipt. */
export type ReceiptDraft = Omit<Receipt, 'id' | 'transaction' | 'account'>

/** A line the owner confirmed, its amount signed as the row is, with the labels and event choice they set on it, or none to start it with those of `openingLineChoices`. */
export type ReceiptPart = Pick<TransactionItem, 'printed' | 'note' | 'amount'> & { readonly category: RecordId; readonly choices?: PartChoices }

/** A line of a receipt as you type it: its amount above zero, or the rest of the total, its category, your words and, when you set them, its labels and event choice. */
export interface TypedLine {
  readonly amount: AccountMoney | 'rest'
  readonly category: RecordId
  readonly note: string
  readonly choices?: PartChoices
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
  return { parts: lines.map(({ note, category, choices }, place) => ({ printed: '', note: note.trim(), amount: placed.parts[place]!, category, ...(choices === undefined ? {} : { choices }) })) }
}

/**
 * The row a receipt splits with the items it holds, or the account of the new row it makes. On an account the bank fills it
 * makes no row and waits for the bank's.
 */
export type ReceiptPlace = { readonly row: Transaction; readonly held: readonly TransactionItem[] } | { readonly account: Pick<Account, 'id' | 'kind' | 'sources' | 'openedOn'> }

/** The row as a receipt's place, with the items the book holds of it, which the receipt's lines replace. */
export function rowPlace(row: Transaction, items: readonly TransactionItem[]): Extract<ReceiptPlace, { readonly row: Transaction }> {
  return { row, held: rowItemsOf({ items })(row) }
}

/**
 * The labels and event choice a receipt's line starts with: those a part added to a split of the row starts with, so the labels
 * every item it replaces carries and the event choice of the largest. On a new entry, or one that waits, it replaces nothing.
 */
export function openingLineChoices(replaced: readonly Pick<TransactionItem, 'amount' | 'labels' | 'event'>[]): PartChoices {
  return newPartChoices(replaced)
}

/**
 * Of the labels a receipt's line carries, those a rule put on every item it replaces that carries them, so a later rule change
 * moves them on the line as on any other row. A label the line has by hand stays one.
 */
export function lineRuleLabels(labels: readonly RecordId[], replaced: readonly Pick<TransactionItem, 'labels' | 'ruleLabels'>[], byHand: readonly RecordId[] = []): readonly RecordId[] {
  return heldRuleLabels({ labels: labels.filter((label) => !byHand.includes(label)), ruleLabels: ruleLabelsOf(replaced) })
}

/**
 * A line's labels and event choice once another payment is picked: a line still on what the payment picked before opened it
 * with moves to what the new one opens with, and a line you changed keeps yours.
 */
export function repickedLineChoices(line: PartChoices, before: PartChoices, after: PartChoices): PartChoices {
  const untouched = line.event === before.event && line.labels.length === before.labels.length && line.labels.every((label) => before.labels.includes(label))
  return untouched ? after : line
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
 * which no statement fills, or on a day the bank or its statement file fills no row at all, as it waits for the bank's. Its lines go in place of
 * any parts the row was split into by hand. When they do not add up to the row, or to minus the total of a receipt that
 * waits, as with a tip or a misread line, one Difference line in the main category shows what is left, and no line you confirmed changes.
 * Every line takes the row's link when its items named one record, and none when they named several or none. A line takes the
 * labels and event choice you set on it, or else those of `openingLineChoices`, as the Difference line does, with `lineRuleLabels` still a rule's.
 */
export function receiptSplit(draft: ReceiptDraft, place: ReceiptPlace, parts: readonly ReceiptPart[], newKey: () => string = newRecordId): ReceiptSplit {
  const merchant = draft.merchant.trim()
  const category = mainCategoryOf(parts)
  const before = 'row' in place ? place.row : null
  const amount = negateAccountMoney(accountMoneyOfEuros(draft.total))
  const waitsOn = 'account' in place && !takesRowsByHand(place.account, draft.issuedOn) ? place.account.id : null
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
  const opening = openingLineChoices(replaced)
  const lines = parts.map(({ printed, note, amount: lineAmount, category: lineCategory, choices }): TransactionItem => {
    const { labels, event } = choices ?? opening
    return {
      id: recordIdOf(ITEM_RECORDS, newKey()),
      transaction,
      receipt: receipt.id,
      printed,
      note,
      amount: lineAmount,
      category: lineCategory,
      link,
      labels,
      ruleLabels: lineRuleLabels(labels, replaced),
      event,
      splitByLink: false,
    }
  })
  const difference = differenceItem(row?.amount ?? amount, lines, { transaction, receipt: receipt.id, category, link }, words.difference, newKey)
  const openingDifference = { ...opening, ruleLabels: lineRuleLabels(opening.labels, replaced) }
  return { before, row, receipt, lines: difference === null ? lines : [...lines, { ...difference, ...openingDifference }], replaced }
}
