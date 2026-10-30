import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'

/** What the Performance screen's period bar offers: the last one, three or five years, everything, or one calendar year. */
export type PerformancePeriod = { readonly kind: 'years'; readonly years: 1 | 3 | 5 } | { readonly kind: 'all' } | { readonly kind: 'year'; readonly year: number }

/** The two closes a period is measured between. */
export interface PeriodSpan {
  readonly from: CivilDate
  readonly to: CivilDate
}

/**
 * A year runs from the close of the 31st of December before it to its own last day, or to today while it lasts. A
 * period that would start before the first deposit starts on it, and one that ends before it has no span.
 */
export function periodSpan(period: PerformancePeriod, firstDeposit: CivilDate, today: CivilDate): PeriodSpan | null {
  const asked = askedSpan(period, firstDeposit, today)
  const from = asked.from < firstDeposit ? firstDeposit : asked.from
  return asked.to < from ? null : { from, to: asked.to }
}

function askedSpan(period: PerformancePeriod, firstDeposit: CivilDate, today: CivilDate): PeriodSpan {
  switch (period.kind) {
    case 'all':
      return { from: firstDeposit, to: today }
    case 'years':
      return { from: dayMonthsLater(today, -12 * period.years), to: today }
    case 'year': {
      const yearEnd = civilDate(period.year, 12, 31)
      return { from: civilDate(period.year - 1, 12, 31), to: yearEnd < today ? yearEnd : today }
    }
  }
}

/** Whether a period from one close to another lasts a year or more, which a rate a year waits for. */
export function lastsAYear(from: CivilDate, to: CivilDate): boolean {
  return from <= dayMonthsLater(to, -12)
}

/** Every calendar year from the first deposit's to today's. */
export function yearsSince(firstDeposit: CivilDate, today: CivilDate): number[] {
  return Array.from({ length: Math.max(0, yearOf(today) - yearOf(firstDeposit) + 1) }, (_, offset) => yearOf(firstDeposit) + offset)
}
