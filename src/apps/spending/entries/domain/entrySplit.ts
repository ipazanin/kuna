import { eventOfLargest } from '../../workbook/domain/carriedChoices'
import { isTransferCategory } from '../../workbook/domain/category'
import { BY_DAYS } from '../../workbook/domain/event'
import type { Category } from '../../workbook/domain/category'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ITEM_RECORDS } from '../../workbook/domain/spendingKinds'
import { filedAsTransfer, isSplit, linkOfItems, rowItemsOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import { heldRuleLabels } from '../../workbook/domain/transactionItemReading'
import { partPayeeOf } from '../../payees/domain/payeeKey'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import { accountMoneyParts } from '../../../../shared/money/decimal'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { partsOfWhole, restOfWhole } from '../../../../shared/money/partsOfWhole'
import type { PartsRefusal } from '../../../../shared/money/partsOfWhole'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The labels and event choice of a part. */
export type PartChoices = Pick<TransactionItem, 'labels' | 'event'>

/** A part of an entry as you give it: an amount signed as the entry is, or the rest, with its category, optional words and, when you set them, its labels, event choice and payee. */
export interface ItemDraft {
  /** The entry's part it was opened from, which keeps its id, or null for a new part. */
  readonly id: RecordId | null
  readonly amount: AccountMoney | 'rest'
  readonly category: RecordId
  readonly note: string
  /** The labels and event choice you set on the part, which the write keeps as they are. Left out, the part keeps its own and the write carries those of the parts it took money from. */
  readonly choices?: PartChoices
  /** Who the part counts under, blank for the entry's payee. Left out, the part keeps its own, and a new part counts under the entry's payee. */
  readonly payee?: string
  /** The shared cost the part joins, its category then In a shared cost. Null takes it out. Left out, a part that keeps its id and its category stays in its shared cost, and any other is in none. */
  readonly sharedCost?: RecordId | null
}

/** The labels and event choice a part added to a split starts with: the labels every part of the entry carries and the event choice of the largest. */
export function newPartChoices(held: readonly Pick<TransactionItem, 'amount' | 'labels' | 'event'>[]): PartChoices {
  const shared = labelsOf(held).filter((label) => held.every((part) => part.labels.includes(label)))
  return { labels: shared, event: eventOfLargest(held) }
}

/**
 * Why an entry cannot be split as given, beside why its parts cannot be placed: it is a transfer's leg, a receipt split it,
 * it has fewer than two parts, a part linked to a record in another app would join a shared cost, or a part names a category that
 * is not in the file, a group with children, or Between my accounts.
 */
export type SplitRefusal = PartsRefusal | 'transfer-leg' | 'receipt' | 'too-few' | 'linked-member' | PartCategoryRefusal

/** An entry split by hand: the row with its items as the file holds them, the row filed by you, and its parts. */
export interface EntrySplit {
  readonly before: ItemizedRow
  readonly row: Transaction
  readonly parts: readonly TransactionItem[]
  /** The parts whose labels and event choice you set, which the write keeps as they are. */
  readonly chosen: ReadonlySet<RecordId>
}

/** Why a part cannot go under a category: it is not in the file, it is Between my accounts, or it is a group with children. */
export type PartCategoryRefusal = 'unknown-category' | 'between-accounts' | 'group-with-children'

export function partCategoryRefusal(category: Category | undefined, categories: readonly Category[]): PartCategoryRefusal | null {
  if (category === undefined) return 'unknown-category'
  if (isTransferCategory(category)) return 'between-accounts'
  return categories.some((child) => child.parent === category.id) ? 'group-with-children' : null
}

/**
 * The entry in the parts you gave, one of them the rest, each signed as the entry is so they add up to it, filed by your word.
 * Any part may go under a category a row can take, For the company too, but never under a group with children or Between my
 * accounts. A part opened from one of the entry's parts keeps its id, the first part of an entry not yet split keeps the id of
 * its one item. A part the entry holds keeps its own link, and a new part takes the entry's link when it has one. A part takes
 * the labels and event choice you set on it, or else keeps its own, and keeps only those of its rule labels it still carries. A
 * part counts under the payee you give it, or else keeps its own, and one that names the entry's payee keeps none.
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
  const wrongCategory = drafts.map((draft) => partCategoryRefusal(categories.get(draft.category), book.categories)).find((refusal) => refusal !== null) ?? null
  if (wrongCategory !== null) return { refused: wrongCategory }
  const placed = partsOfWhole(
    row.amount,
    drafts.map((draft) => draft.amount),
  )
  if ('refused' in placed) return placed
  const whole = isSplit(held) || drafts.some((draft) => draft.id === held[0]?.id) ? null : (held[0] ?? null)
  const link = linkOfItems(held)
  const heldById = new Map(held.map((item) => [item.id, item]))
  const parts = drafts.map((draft, place): TransactionItem => {
    const id = draft.id ?? (whole !== null && place === 0 ? whole.id : recordIdOf(ITEM_RECORDS, newKey()))
    const kept = heldById.get(id)
    const labels = draft.choices?.labels ?? kept?.labels ?? []
    return {
      id,
      transaction: row.id,
      receipt: null,
      printed: '',
      note: draft.note.trim(),
      amount: placed.parts[place]!,
      category: draft.category,
      payee: partPayeeOf(draft.payee ?? kept?.payee ?? '', row.payee),
      link: kept === undefined ? link : kept.link,
      labels,
      ruleLabels: heldRuleLabels({ labels, ruleLabels: kept?.ruleLabels ?? [] }),
      event: draft.choices?.event ?? kept?.event ?? BY_DAYS,
      sharedCost: draft.sharedCost !== undefined ? draft.sharedCost : kept !== undefined && kept.category === draft.category ? kept.sharedCost : null,
      splitByLink: false,
    }
  })
  if (parts.some((part) => part.sharedCost !== null && part.link !== null)) return { refused: 'linked-member' }
  const chosen = new Set(drafts.flatMap((draft, place) => (draft.choices === undefined ? [] : [parts[place]!.id])))
  return { before: { row, items: held }, row: { ...row, categorisedBy: 'person' }, parts, chosen }
}

/** The entry's amount in two halves for Half and half, the first taking the odd cent, so 84.01 is 42.01 and 42.00. */
export function halfAndHalf(whole: AccountMoney): readonly [AccountMoney, AccountMoney] {
  const [first, second] = accountMoneyParts(whole, [1n, 1n])
  return [first!, second!]
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
  return rest === 0
    ? null
    : {
        id: recordIdOf(ITEM_RECORDS, newKey()),
        transaction: like.transaction,
        receipt: like.receipt,
        printed: '',
        note,
        amount: rest,
        category: like.category,
        payee: '',
        link: like.link,
        labels: [],
        ruleLabels: [],
        event: BY_DAYS,
        sharedCost: null,
        splitByLink: false,
      }
}

/**
 * An entry's items once the bank booked it at another amount. An entry of one item has it follow the amount, and a split entry
 * gains a Difference part in its first part's category for what the amount adds, so its parts keep adding up.
 */
export function itemsAtBankAmount(parts: readonly TransactionItem[], amount: AccountMoney, note: string, newKey: () => string = newRecordId): readonly TransactionItem[] {
  const [first] = parts
  if (first === undefined || !isSplit(parts)) return parts.map((item) => ({ ...item, amount }))
  const difference = differenceItem(amount, parts, first, note, newKey)
  return difference === null ? parts : [...parts, difference]
}
