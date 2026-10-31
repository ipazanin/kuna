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

/**
 * Whether the period opens before its first day's records, with nothing in yet, so the day's deposits are put in and
 * its fees count inside the period. That is All, and any period asked from before the first deposit. A year opens at
 * the close of the 31st of December before it, so a first deposit on that day counts in that day's year alone.
 */
export function opensBeforeRecords(period: PerformancePeriod, firstDeposit: CivilDate, today: CivilDate): boolean {
  return period.kind === 'all' || askedSpan(period, firstDeposit, today).from < firstDeposit
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

/** The last one, three and five years that start after the first deposit, then everything, so no two periods show the same months. */
export function rollingPeriods(firstDeposit: CivilDate | null, today: CivilDate): PerformancePeriod[] {
  const longer = ([1, 3, 5] as const).filter((years) => firstDeposit !== null && dayMonthsLater(today, -12 * years) > firstDeposit)
  return [...longer.map((years): PerformancePeriod => ({ kind: 'years', years })), { kind: 'all' }]
}

/** What Performance offers: the rolling periods, then each calendar year once there are two, since a single year is everything. */
export function performancePeriods(firstDeposit: CivilDate | null, today: CivilDate): PerformancePeriod[] {
  const years = firstDeposit === null ? [] : yearsSince(firstDeposit, today)
  return [...rollingPeriods(firstDeposit, today), ...(years.length < 2 ? [] : years.map((year): PerformancePeriod => ({ kind: 'year', year })))]
}
