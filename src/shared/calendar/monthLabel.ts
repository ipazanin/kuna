import { dateFormat } from './dateFormat'
import { firstDayOf, parseMonthKey, yearOfMonth } from './monthKey'
import type { MonthKey } from './monthKey'

const LONG = dateFormat({ month: 'short', year: 'numeric', timeZone: 'UTC' })
const SHORT = dateFormat({ month: 'short', year: '2-digit', timeZone: 'UTC' })
const NAME = dateFormat({ month: 'long', timeZone: 'UTC' })
const SHORT_NAME = dateFormat({ month: 'short', timeZone: 'UTC' })
const NAME_AND_YEAR = dateFormat({ month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "Oct 2026", for tooltips and running text. */
export function monthLabel(month: MonthKey): string {
  return LONG(new Date(firstDayOf(month)))
}

/** "Oct 26", for a month axis where space is tight. */
export function shortMonthLabel(month: MonthKey): string {
  return SHORT(new Date(firstDayOf(month)))
}

/** "October". */
export function monthName(month: MonthKey): string {
  return NAME(new Date(firstDayOf(month)))
}

/** "Oct", where the year is plain from around it. */
export function shortMonthName(month: MonthKey): string {
  return SHORT_NAME(new Date(firstDayOf(month)))
}

/** "September" in `year`, "September 2025" in any other. */
export function monthInYear(month: MonthKey, year: number): string {
  return yearOfMonth(month) === year ? monthName(month) : NAME_AND_YEAR(new Date(firstDayOf(month)))
}

/** The label of a month axis that holds month keys: short on the axis, long in the tooltip. */
export function monthAxisLabel(form: 'short' | 'long'): (category: string) => string {
  return (category) => {
    const month = parseMonthKey(category)
    if (month === null) {
      return category
    }
    return form === 'short' ? shortMonthLabel(month) : monthLabel(month)
  }
}
