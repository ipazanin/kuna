import { ZERO, addMoney, plainAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { holdsSplitKey, partOrder } from '../domain/splits'
import type { LedgerSplit, SplitKey, SplitPart } from '../domain/splits'
import type { Category, Transaction } from '../domain/workbook'
import type { RecordId } from '../domain/recordId'
import { isUnreadable, ownIdOf, readRow, refuse, requiredDate, requiredMoney, sharedIds, slugOf, tabReading, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import { labelOfRow } from './tabRecords'
import type { SheetRow } from './workbookSnapshot'

/** One row of the `splits` tab: the key of a ledger row and one part of it. */
export interface SplitTabRow {
  readonly key: SplitKey
  readonly amount: Money
  /** Blank when the cell is. */
  readonly category: string
  readonly note: string
  readonly id: RecordId
}

export interface SplitsReading extends TabReading<SplitTabRow> {
  /** Each split whose guards pass, in the order its first row appears on the tab, its parts larger first. */
  readonly splits: readonly LedgerSplit[]
}

interface SplitRows {
  readonly key: SplitKey
  readonly parts: { readonly row: SheetRow; readonly part: SplitTabRow }[]
  /** Rows with this key that cannot be read as a part. */
  readonly unreadable: SheetRow[]
}

/**
 * The `splits` tab, one row per part. The rows that share a date, account, row amount and row
 * balance make one split of the ledger row those four find. A split is refused whole, each of its
 * rows reported, when the key finds no row or several, a row of it cannot be read, it has fewer
 * than two parts, a part is zero or has the other sign to the row, the parts do not add up to the
 * row, a part's category is not on the categories tab, or a part has no id or one another row
 * holds. The bank row then counts whole.
 */
export function readSplits(rows: readonly SheetRow[], transactions: readonly Transaction[], categories: readonly Category[]): SplitsReading {
  const problems: RowProblem[] = []
  const groups = new Map<string, SplitRows>()
  const groupOf = (key: SplitKey): SplitRows => {
    const id = `${key.date}|${key.account}|${key.rowAmount}|${key.rowBalance}`
    const group = groups.get(id) ?? { key, parts: [], unreadable: [] }
    groups.set(id, group)
    return group
  }
  const shared = sharedIds(rows)
  for (const row of rows) {
    const key = readRow(() => keyOf(row))
    if (isUnreadable(key)) {
      problems.push({ sheetRow: row.sheetRow, reason: key.unreadable })
      continue
    }
    const part = readRow(() => ({ ...partOf(row), id: ownIdOf('splits', row, shared) }))
    if (isUnreadable(part)) {
      problems.push({ sheetRow: row.sheetRow, reason: part.unreadable })
      groupOf(key).unreadable.push(row)
      continue
    }
    groupOf(key).parts.push({ row, part: { key, ...part } })
  }

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const facts: SplitTabRow[] = []
  const splits: LedgerSplit[] = []
  for (const group of groups.values()) {
    const found = transactions.filter((transaction) => holdsSplitKey(transaction, group.key))
    const reasons = [...rowReasons(group, found, transactions), ...partReasons(group, categoryBySlug)]
    if (reasons.length > 0) {
      const reason = `${reasons.join(', ')}, so the ledger row counts whole`
      problems.push(...group.parts.map(({ row }) => ({ sheetRow: row.sheetRow, reason })))
      continue
    }
    facts.push(...group.parts.map(({ part }) => part))
    splits.push({
      row: found[0]!,
      parts: group.parts
        .map(({ part }): SplitPart => {
          const category = categoryBySlug.get(part.category)!
          return { amount: part.amount, category: part.category, family: category.family, bucket: category.bucket, note: part.note, id: part.id }
        })
        .sort(partOrder),
    })
  }
  return { ...tabReading('splits', rows, facts, problems), splits }
}

function keyOf(row: SheetRow): SplitKey {
  const date = requiredDate(row.cells, 'date')
  const account = slugOf(row.cells.account)
  if (account === '') refuse('no account')
  return { date, account, rowAmount: requiredMoney(row.cells, 'row_amount'), rowBalance: requiredMoney(row.cells, 'row_balance') }
}

function partOf(row: SheetRow): Pick<SplitTabRow, 'amount' | 'category' | 'note'> {
  return { amount: requiredMoney(row.cells, 'amount'), category: slugOf(row.cells.category), note: textOf(row.cells.note) }
}

/** A split counts only on a ledger row that no other row shares its key with, since the split is kept by that key. */
function rowReasons(group: SplitRows, found: readonly Transaction[], transactions: readonly Transaction[]): string[] {
  const { key, unreadable } = group
  const row = `${key.account} row of ${key.date} with the amount ${plainAmount(key.rowAmount)} and the balance ${plainAmount(key.rowBalance)}`
  const sharing = found.length === 1 ? transactions.filter((transaction) => transaction.id === found[0]!.id).length : 0
  return [
    ...(found.length === 0 ? [`the ledger holds no ${row}`] : []),
    ...(found.length > 1 ? [`${found.length} ledger rows are the ${row}`] : []),
    ...(sharing > 1 ? [`the ${row} shares its key with another ledger row`] : []),
    ...(unreadable.length > 0 ? [`${unreadable.length === 1 ? 'a part' : `${unreadable.length} parts`} of this split cannot be read`] : []),
  ]
}

function partReasons(group: SplitRows, categoryBySlug: ReadonlyMap<string, Category>): string[] {
  const { key, parts } = group
  const reasons: string[] = []
  if (parts.length + group.unreadable.length < 2) {
    reasons.push('a split has at least two parts, and this one has one')
  }
  for (const { row, part } of parts) {
    const named = `the part "${labelOfRow('splits', row.cells)}"`
    if (part.amount === 0) {
      reasons.push(`${named} is zero`)
    } else if (Math.sign(part.amount) !== Math.sign(key.rowAmount)) {
      reasons.push(`${named} has the other sign to the row`)
    }
    if (part.category === '') {
      reasons.push(`${named} has no category`)
    } else if (!categoryBySlug.has(part.category)) {
      reasons.push(`"${part.category}" of ${named} is not on the categories tab`)
    }
  }
  const total = parts.reduce((sum, { part }) => addMoney(sum, part.amount), ZERO)
  if (group.unreadable.length === 0 && parts.length >= 2 && total !== key.rowAmount) {
    reasons.push(`the parts add up to ${plainAmount(total)} and the row is ${plainAmount(key.rowAmount)}`)
  }
  return reasons
}
