import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { ZERO, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Figure } from '../../filters/domain/drillTarget'
import { categoryTotals, outsideProfitAndLossTotals } from '../../spending/domain/categoryTotals'
import type { Booking } from '../../workbook/domain/workbook'

export interface CategoryChange {
  readonly category: string
  readonly family: string
  readonly current: Figure | null
  /** Null when there is no prior stretch to compare with. */
  readonly prior: Figure | null
  /** Current less prior, a missing side counting as zero. Null without a prior stretch, or when it is partial. */
  readonly change: Money | null
}

export interface CategoryChangeSection {
  readonly key: 'income' | 'cost' | 'outside'
  readonly rows: readonly CategoryChange[]
}

/**
 * Each category in the compared stretch against the stretch before it, income, costs and the
 * categories outside profit and loss apart. The biggest movers come first, either way.
 */
export function categoryChanges(
  bookings: readonly Booking[],
  current: DateRange,
  prior: { readonly range: DateRange; readonly partial: boolean } | null,
  window: LedgerWindow,
): CategoryChangeSection[] {
  const periodOf = (range: DateRange) => ({ preset: 'custom' as const, range })
  const now = categoryTotals(bookings, periodOf(current), window)
  const before = prior === null ? [] : categoryTotals(bookings, periodOf(prior.range), window)
  const outsideNow = outsideProfitAndLossTotals(bookings, periodOf(current), window)
  const outsideBefore = prior === null ? [] : outsideProfitAndLossTotals(bookings, periodOf(prior.range), window)
  const compare = (
    currentRows: readonly { readonly category: string; readonly family: string; readonly amount: Figure }[],
    priorRows: readonly { readonly category: string; readonly family: string; readonly amount: Figure }[],
  ): CategoryChange[] => {
    const priorBy = new Map(priorRows.map((row) => [row.category, row]))
    const categories = [...new Set([...currentRows.map((row) => row.category), ...priorRows.map((row) => row.category)])]
    return categories
      .map((category): CategoryChange => {
        const thisOne = currentRows.find((row) => row.category === category) ?? null
        const earlierOne = priorBy.get(category) ?? null
        return {
          category,
          family: (thisOne ?? earlierOne)?.family ?? '',
          current: thisOne?.amount ?? null,
          prior: prior === null ? null : (earlierOne?.amount ?? null),
          change: prior === null || prior.partial ? null : subtractMoney(thisOne?.amount.amount ?? ZERO, earlierOne?.amount.amount ?? ZERO),
        }
      })
      .sort(
        (left, right) =>
          Math.abs(right.change ?? 0) - Math.abs(left.change ?? 0) || Math.abs(right.current?.amount ?? 0) - Math.abs(left.current?.amount ?? 0) || left.category.localeCompare(right.category),
      )
  }
  const sections: CategoryChangeSection[] = [
    {
      key: 'income',
      rows: compare(
        now.filter((row) => row.direction === 'income'),
        before.filter((row) => row.direction === 'income'),
      ),
    },
    {
      key: 'cost',
      rows: compare(
        now.filter((row) => row.direction === 'cost'),
        before.filter((row) => row.direction === 'cost'),
      ),
    },
    { key: 'outside', rows: compare(outsideNow, outsideBefore) },
  ]
  return sections.filter((section) => section.rows.length > 0)
}
