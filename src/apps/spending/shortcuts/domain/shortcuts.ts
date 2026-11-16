import { takesNewRowsByHand } from '../../workbook/domain/account'
import { isTransferCategory } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { Shortcut, ShortcutPart } from '../../workbook/domain/shortcut'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold } from '../../../../shared/text/fold'

/** Why a part of a shortcut does not count: its amount is zero, it goes the other way from a sibling, or its category or a label is not one a part can take. */
export type ShortcutPartProblem = 'zero' | 'mixed-ways' | 'unknown-category' | 'between-accounts' | 'unknown-label'

/** A shortcut with its parts, in the order of the file. */
export interface ShortcutWithParts {
  readonly shortcut: Shortcut
  readonly parts: readonly ShortcutPart[]
}

/**
 * Why a part of a shortcut does not count, or null. Its amount is not zero and goes the way of its siblings, its category is in
 * the file and is not Between my accounts, and each label is in the file. The reader and every write ask this. A part may stay
 * on a category that later gets children, as an entry does.
 */
export function shortcutPartProblem(
  part: Pick<ShortcutPart, 'amount' | 'category' | 'labels'>,
  siblings: readonly Pick<ShortcutPart, 'amount'>[],
  book: { readonly categories: readonly Category[]; readonly labels: readonly { readonly id: RecordId }[] },
): ShortcutPartProblem | null {
  if (part.amount === 0) return 'zero'
  if (siblings.some((sibling) => sibling.amount < 0 !== part.amount < 0)) return 'mixed-ways'
  const category = book.categories.find((candidate) => candidate.id === part.category)
  if (category === undefined) return 'unknown-category'
  if (isTransferCategory(category)) return 'between-accounts'
  const labels = new Set(book.labels.map((label) => label.id))
  return part.labels.every((label) => labels.has(label)) ? null : 'unknown-label'
}

/** The money a shortcut writes, its parts added up. */
export function shortcutAmount(parts: readonly Pick<ShortcutPart, 'amount'>[]): AccountMoney {
  return sumAccountMoney(parts.map((part) => part.amount))
}

/** What you give a shortcut: its name, account and payee, and each part's amount signed as the entry is, category, note and labels. */
export interface ShortcutDraft {
  readonly name: string
  readonly account: Shortcut['account']
  readonly payee: string
  readonly parts: readonly Pick<ShortcutPart, 'amount' | 'category' | 'note' | 'labels'>[]
}

/** The shortcut that writes the entry again: its account, payee and parts, with no name of its own. A part waiting on review has no category, so it makes none. */
export function shortcutDraftOf(row: Pick<Transaction, 'account' | 'payee'>, items: readonly Pick<TransactionItem, 'amount' | 'category' | 'note' | 'labels'>[]): ShortcutDraft | null {
  const parts = items.flatMap((item) => (item.category === null ? [] : [{ amount: item.amount, category: item.category, note: item.note, labels: item.labels }]))
  return parts.length === 0 || parts.length !== items.length ? null : { name: '', account: row.account, payee: row.payee, parts }
}

/** Each shortcut with its parts, in order. */
export function shortcutsWithParts(book: Pick<SpendingBook, 'shortcuts' | 'shortcutParts'>): readonly ShortcutWithParts[] {
  return book.shortcuts.map((shortcut) => ({ shortcut, parts: book.shortcutParts.filter((part) => part.shortcut === shortcut.id) }))
}

/** The shortcuts a tap can write today: on an open account kept by hand, in order. One on a closed account or one the bank fills stays on the file. */
export function shortcutsShown(book: Pick<SpendingBook, 'shortcuts' | 'shortcutParts' | 'accounts'>): readonly ShortcutWithParts[] {
  const open = new Set(book.accounts.filter(takesNewRowsByHand).map((account) => account.id))
  return shortcutsWithParts(book).filter(({ shortcut, parts }) => open.has(shortcut.account) && parts.length > 0)
}

/** How many typed entries in a row make an entry worth a shortcut, inside how many days. */
export const REPEATS = { entries: 3, days: 30 } as const

/** What an entry not split is, for telling whether it repeats: its account, payee once folded, amount and category. */
export interface RepeatedEntry {
  readonly account: RecordId
  readonly payee: string
  readonly amount: AccountMoney
  readonly category: RecordId
}

function sameEntry(one: RepeatedEntry, other: RepeatedEntry): boolean {
  return one.account === other.account && fold(one.payee) === fold(other.payee) && one.amount === other.amount && one.category === other.category
}

/**
 * Whether the entry about to be added would be the third typed one like it in 30 days up to its day, with no shortcut that
 * writes it yet. Like it means the same account, payee once folded, amount and category, on an entry not split and with no
 * link. Typed entries before it on other days and the same day both count.
 */
export function repeatsWithoutShortcut(book: Pick<SpendingBook, 'transactions' | 'items' | 'shortcuts' | 'shortcutParts'>, entry: RepeatedEntry, day: CivilDate): boolean {
  const itemsOf = rowItemsOf(book)
  const since = addDays(day, -(REPEATS.days - 1))
  const likeIt = (row: Transaction): boolean => {
    const items = itemsOf(row)
    const [only] = items
    if (row.source !== 'typed' || row.pair !== null || items.length !== 1 || only === undefined || only.category === null || only.link !== null) return false
    return row.date >= since && row.date <= day && sameEntry(entry, { account: row.account, payee: row.payee, amount: row.amount, category: only.category })
  }
  const covered = shortcutsWithParts(book).some(
    ({ shortcut, parts }) => parts.length === 1 && sameEntry(entry, { account: shortcut.account, payee: shortcut.payee, amount: parts[0]!.amount, category: parts[0]!.category }),
  )
  return !covered && book.transactions.filter(likeIt).length + 1 >= REPEATS.entries
}
