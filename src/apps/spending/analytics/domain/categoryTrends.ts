import { AVERAGED_MONTHS, averagedMonths } from './averageMonth'
import { categoryMonths } from './categoryMonths'
import type { MonthTotals } from './monthTotals'
import type { Category } from '../../workbook/domain/category'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { absMoney, divideMoney, moneyFromAmount, ratioOf, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Share } from '../../../../shared/money/percent'

/** How many of the newest whole months a trend reads, against the twelve before them. */
export const RECENT_MONTHS = 3
/** A book with fewer whole months than this shows no trend. */
export const FEWEST_TREND_MONTHS = 6
/** A category grows or shrinks only when its recent average moves by at least this share of the one before. */
export const TREND_SHARE = 0.1
/** And by at least this much a month. */
export const TREND_FLOOR = moneyFromAmount(25)

export type Trend = 'growing' | 'shrinking' | 'steady'

/** A spending category's last three whole months against the twelve before them, each as an average month. */
export interface CategoryTrend {
  readonly category: Category
  readonly recent: Money
  readonly before: Money
  readonly change: Money
  /** The change over the average before, null while that average is zero. */
  readonly share: Share | null
  readonly trend: Trend
}

function average(months: readonly { readonly counted: Money }[]): Money {
  return divideMoney(sumMoney(months.map((month) => month.counted)), months.length)
}

/** Growing or shrinking when the change reaches both floors, else steady. A rise from nothing grows once it reaches the money floor. */
export function trendOf(change: Money, share: Share | null): Trend {
  if (absMoney(change) < TREND_FLOOR || (share !== null && Math.abs(share) < TREND_SHARE)) return 'steady'
  return change > 0 ? 'growing' : 'shrinking'
}

/**
 * Each spending group and child with a figure in the fifteen whole months before the day's, its last three months against the
 * up to twelve before them. A book with under six whole months has no trend.
 */
export function categoryTrends(totalsOf: (month: MonthKey) => MonthTotals, categories: readonly Category[], day: CivilDate, firstMonth: MonthKey | null): CategoryTrend[] {
  const months = averagedMonths(day, firstMonth, RECENT_MONTHS + AVERAGED_MONTHS)
  if (months.length < FEWEST_TREND_MONTHS) return []
  return categories
    .filter((category) => category.kind === 'spending')
    .flatMap((category): CategoryTrend[] => {
      const counted = categoryMonths(totalsOf, category, months)
      if (counted.every((month) => month.counted === 0)) return []
      const recent = average(counted.slice(-RECENT_MONTHS))
      const before = average(counted.slice(0, -RECENT_MONTHS))
      const change = subtractMoney(recent, before)
      const share = ratioOf(change, absMoney(before))
      return [{ category, recent, before, change, share, trend: trendOf(change, share) }]
    })
}
