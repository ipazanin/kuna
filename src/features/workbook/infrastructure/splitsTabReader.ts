import { ZERO, addMoney, plainAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { holdsSplitKey, partOrder } from '../domain/splits'
import type { LedgerSplit, SplitKey, SplitPart } from '../domain/splits'
import type { Category, Transaction } from '../domain/workbook'
import { idOf, inTabOrder, isUnreadable, readRow, refuse, requiredDate, requiredMoney, slugOf, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/** One row of the `splits` tab: the key of a ledger row and one part of it. */
export interface SplitTabRow {
  readonly key: SplitKey
  readonly amount: Money
  /** Blank when the cell is. */
  readonly category: string
  readonly note: string
  readonly sheetRow: number
  readonly id?: string
}

export interface SplitsReading extends TabReading<SplitTabRow> {
  /** Each split whose guards pass, in the order its first row appears on the tab, its parts larger first. */
  readonly splits: readonly LedgerSplit[]
}

interface SplitRows {
  readonly key: SplitKey
  readonly parts: SplitTabRow[]
  /** Rows with this key that cannot be read as a part. */
  readonly unreadable: number[]
}

/**
 * The `splits` tab, one row per part. The rows that share a date, account, row amount and row
 * balance make one split of the ledger row those four find. A split is refused whole, each of its
 * rows reported, when the key finds no row or several, a row of it cannot be read, it has fewer
 * than two parts, a part is zero or has the other sign to the row, the parts do not add up to the
 * row, or a part's category is not on the categories tab. The bank row then counts whole.
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
  for (const row of inTabOrder(rows)) {
    const key = readRow(() => keyOf(row))
    if (isUnreadable(key)) {
      problems.push({ sheetRow: row.sheetRow, reason: key.unreadable })
      continue
    }
    const part = readRow(() => partOf(row))
    if (isUnreadable(part)) {
      problems.push({ sheetRow: row.sheetRow, reason: part.unreadable })
      groupOf(key).unreadable.push(row.sheetRow)
      continue
    }
    groupOf(key).parts.push({ key, ...part, sheetRow: row.sheetRow, ...idOf(row.cells) })
  }

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const facts: SplitTabRow[] = []
  const splits: LedgerSplit[] = []
  for (const group of groups.values()) {
    const found = transactions.filter((transaction) => holdsSplitKey(transaction, group.key))
    const reasons = [...rowReasons(group, found), ...partReasons(group, categoryBySlug)]
    if (reasons.length > 0) {
      const reason = `${reasons.join(', ')}, so the ledger row counts whole`
      problems.push(...group.parts.map((part) => ({ sheetRow: part.sheetRow, reason })))
      continue
    }
    facts.push(...group.parts)
    splits.push({
      row: found[0]!,
      parts: group.parts
        .map((part): SplitPart => {
          const category = categoryBySlug.get(part.category)!
          return { amount: part.amount, category: part.category, family: category.family, bucket: category.bucket, note: part.note, sheetRow: part.sheetRow, ...(part.id === undefined ? {} : { id: part.id }) }
        })
        .sort(partOrder),
    })
  }
  return { facts, problems: problems.sort((upper, lower) => upper.sheetRow - lower.sheetRow), splits }
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

function rowReasons(group: SplitRows, found: readonly Transaction[]): string[] {
  const { key, unreadable } = group
  const row = `${key.account} row of ${key.date} with the amount ${plainAmount(key.rowAmount)} and the balance ${plainAmount(key.rowBalance)}`
  return [
    ...(found.length === 0 ? [`the ledger holds no ${row}`] : []),
    ...(found.length > 1 ? [`${found.length} ledger rows are the ${row} (rows ${found.map((candidate) => candidate.sheetRow).join(', ')})`] : []),
    ...(unreadable.length > 0 ? [`${unreadable.length === 1 ? 'row' : 'rows'} ${unreadable.join(' and ')} of this split cannot be read`] : []),
  ]
}

function partReasons(group: SplitRows, categoryBySlug: ReadonlyMap<string, Category>): string[] {
  const { key, parts } = group
  const reasons: string[] = []
  if (parts.length + group.unreadable.length < 2) {
    reasons.push('a split has at least two parts, and this one has one')
  }
  for (const part of parts) {
    if (part.amount === 0) {
      reasons.push(`the part on row ${part.sheetRow} is zero`)
    } else if (Math.sign(part.amount) !== Math.sign(key.rowAmount)) {
      reasons.push(`the part on row ${part.sheetRow} has the other sign to the row`)
    }
    if (part.category === '') {
      reasons.push(`the part on row ${part.sheetRow} has no category`)
    } else if (!categoryBySlug.has(part.category)) {
      reasons.push(`"${part.category}" on row ${part.sheetRow} is not on the categories tab`)
    }
  }
  const total = parts.reduce((sum, part) => addMoney(sum, part.amount), ZERO)
  if (group.unreadable.length === 0 && parts.length >= 2 && total !== key.rowAmount) {
    reasons.push(`the parts add up to ${plainAmount(total)} and the row is ${plainAmount(key.rowAmount)}`)
  }
  return reasons
}
