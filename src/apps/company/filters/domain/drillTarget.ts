import { monthRange } from '../../../../shared/calendar/dateRange'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { OwnerAdvance, Transaction } from '../../workbook/domain/workbook'
import { EVERY_OWNER_ADVANCE } from './filterState'
import type { AmountRange, FilterState, Period } from './filterState'

/** The filters that reproduce the rows behind a figure, which a click on it opens on Transactions. */
export interface DrillTarget {
  readonly filters: Partial<FilterState>
}

/** An amount on screen together with the rows that make it up. */
export interface Figure {
  readonly amount: Money
  readonly drill: DrillTarget
}

export function drillToTransactions(filters: Partial<FilterState>): DrillTarget {
  return { filters }
}

export function monthPeriod(month: MonthKey): Period {
  return { preset: 'custom', range: monthRange(month) }
}

/** The one row, found again by its day, category and exact amount. */
export function rowDrill(row: Transaction): DrillTarget {
  return drillToTransactions({
    period: { preset: 'custom', range: { from: row.date, to: row.date } },
    categories: [row.category],
    amount: { min: row.amount, max: row.amount },
  })
}

/** The one owner advance, found again by its day and the exact amount it books. */
export function advanceDrill(advance: Pick<OwnerAdvance, 'date' | 'amount'>): DrillTarget {
  const booked = negateMoney(advance.amount)
  return drillToTransactions({
    period: { preset: 'custom', range: { from: advance.date, to: advance.date } },
    categories: [EVERY_OWNER_ADVANCE],
    amount: { min: booked, max: booked },
  })
}

/**
 * The filters after a drill. A figure is computed from rows the current filters already narrowed,
 * so the drill narrows further: lists and the amount range intersect, while the period and text
 * the drill names replace the current ones. Returns null when the two cannot both hold, which
 * means the figure has no rows behind it.
 */
export function applyDrill(current: FilterState, drill: Partial<FilterState>): FilterState | null {
  const accounts = intersectSelections(current.accounts, drill.accounts)
  const buckets = intersectSelections(current.buckets, drill.buckets)
  const families = intersectSelections(current.families, drill.families)
  const categories = intersectSelections(current.categories, drill.categories)
  const counterparties = intersectSelections(current.counterparties, drill.counterparties)
  const amount = drill.amount === undefined ? current.amount : intersectAmounts(current.amount, drill.amount)
  if (
    accounts === null ||
    buckets === null ||
    families === null ||
    categories === null ||
    counterparties === null ||
    amount === null
  ) {
    return null
  }
  return {
    period: drill.period ?? current.period,
    accounts,
    buckets,
    families,
    categories,
    counterparties,
    text: drill.text ?? current.text,
    amount,
    needsReview: current.needsReview || (drill.needsReview ?? false),
  }
}

function intersectSelections<Value>(
  current: readonly Value[],
  drilled: readonly Value[] | undefined,
): readonly Value[] | null {
  if (drilled === undefined || drilled.length === 0) {
    return current
  }
  if (current.length === 0) {
    return drilled
  }
  const kept = current.filter((selected) => drilled.includes(selected))
  return kept.length === 0 ? null : kept
}

function intersectAmounts(current: AmountRange, drilled: AmountRange): AmountRange | null {
  const min = boundOf(current.min, drilled.min, Math.max)
  const max = boundOf(current.max, drilled.max, Math.min)
  return min !== null && max !== null && min > max ? null : { min, max }
}

function boundOf(left: Money | null, right: Money | null, pick: (a: number, b: number) => number): Money | null {
  if (left === null) {
    return right
  }
  return right === null ? left : (pick(left, right) as Money)
}
