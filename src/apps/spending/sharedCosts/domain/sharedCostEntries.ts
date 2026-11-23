import { sharedCostCounts, sharedCostEuros } from '../../analytics/domain/countedRow'
import type { CountedRow } from '../../analytics/domain/countedRow'
import { entriesNewestFirst, euroRows } from '../../rates/domain/euroRows'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RateBook } from '../../../../shared/money/rateBook'

/** A row of a shared cost with the parts of it the shared cost holds, every part of a whole row or one part of a split one. */
export interface SharedCostMember {
  readonly row: EuroRow
  readonly parts: readonly TransactionItem[]
}

/** A shared cost as Entries lists it: the record, what it counts as every figure counts it, and its rows in the book's order of days, oldest first. */
export interface SharedCostEntry {
  readonly sharedCost: SharedCost
  readonly counted: CountedRow
  readonly members: readonly SharedCostMember[]
}

/** One line of Entries: an entry, or a shared cost with its rows under it. */
export type EntriesLine = { readonly kind: 'entry'; readonly row: EuroRow } | { readonly kind: 'shared-cost'; readonly entry: SharedCostEntry }

/** The day a line sits under on Entries. */
export function dayOfLine(line: EntriesLine): CivilDate {
  return line.kind === 'entry' ? line.row.transaction.date : line.entry.sharedCost.day
}

/** Whether a row stays an entry of its own: it holds a part outside every shared cost. A row wholly in shared costs shows only under them, whatever its own day. */
export function listedOnItsOwn(row: Pick<EuroRow, 'items'>): boolean {
  return row.items.some((item) => item.sharedCost === null)
}

/**
 * Entries and shared costs in one order, newest day first, a shared cost before the entries of its day, and within a day the
 * entry added last first. A shared cost lists its rows under it with their own days, so a repayment from another month shows only
 * there, and a row wholly in shared costs is no entry of its own.
 */
export function entriesAndSharedCosts(book: Pick<SpendingBook, 'accounts' | 'transactions' | 'items' | 'sharedCosts'>, rates: RateBook): EntriesLine[] {
  const rows = entriesNewestFirst(book, rates)
  const counts = sharedCostCounts(book, rates)
  const oldestFirst = [...rows].reverse()
  const sharedCosts = book.sharedCosts.flatMap((sharedCost): EntriesLine[] => {
    const counted = counts.get(sharedCost.id)
    if (counted === undefined) return []
    const members = oldestFirst.flatMap((row) => {
      const parts = row.items.filter((item) => item.sharedCost === sharedCost.id)
      return parts.length === 0 ? [] : [{ row, parts }]
    })
    return [{ kind: 'shared-cost', entry: { sharedCost, counted, members } }]
  })
  const lines: EntriesLine[] = [...sharedCosts, ...rows.filter(listedOnItsOwn).map((row): EntriesLine => ({ kind: 'entry', row }))]
  return lines.sort((first, second) => {
    const [a, b] = [dayOfLine(first), dayOfLine(second)]
    if (a !== b) return a < b ? 1 : -1
    return first.kind === second.kind ? 0 : first.kind === 'shared-cost' ? -1 : 1
  })
}

/** What a shared cost made of these rows would count, since it takes every part of each, or null while the rates do not reach one of their days. */
export function eurosOfNewSharedCost(book: Pick<SpendingBook, 'accounts' | 'items'>, rows: readonly Transaction[], rates: RateBook): Money | null {
  return sharedCostEuros(euroRows({ ...book, transactions: rows }, rates).map((row) => row.euros))
}
