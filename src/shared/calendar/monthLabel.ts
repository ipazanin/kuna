import { firstDayOf, parseMonthKey } from './monthKey'
import type { MonthKey } from './monthKey'

const LONG = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const SHORT = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })

/** "Oct 2026", for tooltips and running text. */
export function monthLabel(month: MonthKey): string {
  return LONG.format(new Date(firstDayOf(month)))
}

/** "Oct 26", for a month axis where space is tight. */
export function shortMonthLabel(month: MonthKey): string {
  return SHORT.format(new Date(firstDayOf(month)))
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
