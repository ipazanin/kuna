import { rowSide } from '../../categories/domain/rowSide'
import type { RowPart } from '../../categories/domain/rowSide'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What a group of spending categories counts among some parts. */
export interface GroupSpent {
  readonly group: RecordId
  readonly spent: Money
}

/**
 * What some parts of the rows count in euros, as Spending's month counts them: money out on a spending category is spent and a
 * refund lowers it, money in on income is received and money out to investments saved. A transfer between your accounts, money
 * for the company and a loan's principal list among them and count nowhere.
 */
export interface PartTotals {
  readonly spent: Money
  readonly income: Money
  readonly saved: Money
  /** What each group of spending categories counts, in the order of its first part. */
  readonly groups: readonly GroupSpent[]
  /** The day of the newest row with a part kept, or null while no row has one. */
  readonly latest: CivilDate | null
  /** How many rows have a part kept. */
  readonly rows: number
  /** The rows on a side whose day the rates do not reach yet, so they count as nothing. */
  readonly unrated: number
}

/** Tells whether a part of a row is among those counted, by the row, the part as the figures count it and its place in the row. */
export type KeepsPart = (row: EuroRow, part: RowPart, place: number) => boolean

/** The totals of the parts `keeps` picks out of the rows. */
export function partTotals(rows: readonly EuroRow[], categories: ReadonlyMap<RecordId, Category>, keeps: KeepsPart): PartTotals {
  const sums = { spending: ZERO, income: ZERO, saved: ZERO }
  const groups = new Map<RecordId, Money>()
  let latest: CivilDate | null = null
  let kept = 0
  let unrated = 0
  for (const row of rows) {
    const parts = rowSide(row, categories).filter((part, place) => keeps(row, part, place))
    if (parts.length === 0) continue
    kept += 1
    if (latest === null || row.transaction.date > latest) latest = row.transaction.date
    const counting = parts.filter((part) => part.side !== 'nowhere' && part.category !== null)
    if (counting.some((part) => part.counted === null)) unrated += 1
    for (const { side, category, counted } of counting) {
      if (counted === null || side === 'nowhere' || category === null) continue
      sums[side] = addMoney(sums[side], counted)
      if (side === 'spending') {
        const group = category.parent ?? category.id
        groups.set(group, addMoney(groups.get(group) ?? ZERO, counted))
      }
    }
  }
  return {
    spent: sums.spending,
    income: sums.income,
    saved: sums.saved,
    groups: [...groups].map(([group, spent]) => ({ group, spent })),
    latest,
    rows: kept,
    unrated,
  }
}
