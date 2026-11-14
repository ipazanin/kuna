import { isTransferCategory } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ITEM_RECORDS } from '../../workbook/domain/spendingKinds'
import { filedAsTransfer, isSplit, linkOfItems, rowItemsOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { partsOfWhole, restOfWhole } from '../../../../shared/money/partsOfWhole'
import type { PartsRefusal } from '../../../../shared/money/partsOfWhole'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A part of an entry as you give it: an amount signed as the entry is, or the rest, with its category and optional words. */
export interface ItemDraft {
  /** The entry's part it was opened from, which keeps its id, or null for a new part. */
  readonly id: RecordId | null
  readonly amount: AccountMoney | 'rest'
  readonly category: RecordId
  readonly note: string
}

/**
 * Why an entry cannot be split as given, beside why its parts cannot be placed: it is a transfer's leg, a receipt split it,
 * it has fewer than two parts, or a part names a category that is not in the file, a group with children, or Between my accounts.
 */
export type SplitRefusal = PartsRefusal | 'transfer-leg' | 'receipt' | 'too-few' | 'unknown-category' | 'group-with-children' | 'between-accounts'

/** An entry split by hand: the row with its items as the file holds them, the row filed by you, and its parts. */
export interface EntrySplit {
  readonly before: ItemizedRow
  readonly row: Transaction
  readonly parts: readonly TransactionItem[]
}

function categoryRefusal(category: Category | undefined, categories: readonly Category[]): SplitRefusal | null {
  if (category === undefined) return 'unknown-category'
  if (isTransferCategory(category)) return 'between-accounts'
  return categories.some((child) => child.parent === category.id) ? 'group-with-children' : null
}

/**
 * The entry in the parts you gave, one of them the rest, each signed as the entry is so they add up to it, filed by your word.
 * Any part may go under a category a row can take, For the company too, but never under a group with children or Between my
 * accounts. A part opened from one of the entry's parts keeps its id, the first part of an entry not yet split keeps the id of
 * its one item, and every part keeps the entry's link.
 */
export function entrySplit(
  book: Pick<SpendingBook, 'categories' | 'receipts' | 'items'>,
  row: Transaction,
  drafts: readonly ItemDraft[],
  newKey: () => string = newRecordId,
): EntrySplit | { readonly refused: SplitRefusal } {
  const categories = new Map(book.categories.map((category) => [category.id, category]))
  const held = rowItemsOf(book)(row)
  if (row.pair !== null || filedAsTransfer(book.categories)(held)) return { refused: 'transfer-leg' }
  if (book.receipts.some((receipt) => receipt.transaction === row.id)) return { refused: 'receipt' }
  if (drafts.length < 2) return { refused: 'too-few' }
  const wrongCategory = drafts.map((draft) => categoryRefusal(categories.get(draft.category), book.categories)).find((refusal) => refusal !== null) ?? null
  if (wrongCategory !== null) return { refused: wrongCategory }
  const placed = partsOfWhole(
    row.amount,
    drafts.map((draft) => draft.amount),
  )
  if ('refused' in placed) return placed
  const whole = isSplit(held) || drafts.some((draft) => draft.id === held[0]?.id) ? null : (held[0] ?? null)
  const link = linkOfItems(held)
  const parts = drafts.map((draft, place): TransactionItem => ({
    id: draft.id ?? (whole !== null && place === 0 ? whole.id : recordIdOf(ITEM_RECORDS, newKey())),
    transaction: row.id,
    receipt: null,
    printed: '',
    note: draft.note.trim(),
    amount: placed.parts[place]!,
    category: draft.category,
    link,
  }))
  return { before: { row, items: held }, row: { ...row, categorisedBy: 'person' }, parts }
}

/**
 * The part that keeps an entry's parts adding up once its amount moved past them, as a tip or what the bank booked does, or
 * null when they still add up. It takes the entry, the receipt, the category and the link of `like`, and the words you give it.
 */
export function differenceItem(
  whole: AccountMoney,
  parts: readonly Pick<TransactionItem, 'amount'>[],
  like: Pick<TransactionItem, 'transaction' | 'receipt' | 'category' | 'link'>,
  note: string,
  newKey: () => string = newRecordId,
): TransactionItem | null {
  const rest = restOfWhole(
    whole,
    parts.map((part) => part.amount),
  )
  return rest === 0 ? null : { id: recordIdOf(ITEM_RECORDS, newKey()), transaction: like.transaction, receipt: like.receipt, printed: '', note, amount: rest, category: like.category, link: like.link }
}
