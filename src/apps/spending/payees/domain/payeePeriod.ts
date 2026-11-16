import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastTwelveMonths, monthRange, rangeContains } from '../../../../shared/calendar/dateRange'
import { monthOf } from '../../../../shared/calendar/monthKey'

/** The stretches the Payees tab counts over: this month, the twelve months up to this one, or every month. */
export const PAYEE_PERIODS = ['month', 'year', 'all'] as const

export type PayeePeriod = (typeof PAYEE_PERIODS)[number]

/** The stretch the tab opens on, which leaves the period out of the address. */
export const OPENING_PERIOD: PayeePeriod = 'year'

/** The period a page's `?period=` names, or the opening one. */
export function periodNamed(key: unknown): PayeePeriod {
  return PAYEE_PERIODS.find((period) => period === key) ?? OPENING_PERIOD
}

/** Whether a row of that day falls in the period, counted in whole months up to the month of the day, as Overview counts. */
export function inPeriod(period: PayeePeriod, day: CivilDate): (date: CivilDate) => boolean {
  if (period === 'all') return () => true
  const range = period === 'month' ? monthRange(monthOf(day)) : lastTwelveMonths(day)
  return (date) => rangeContains(range, date)
}
