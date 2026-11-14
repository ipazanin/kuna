import { dateFormat } from './dateFormat'
import { yearOf } from './civilDate'
import type { CivilDate } from './civilDate'

const LONG = dateFormat({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const SHORT = dateFormat({ day: 'numeric', month: 'short', timeZone: 'UTC' })
const WITH_WEEKDAY = dateFormat({ weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "20 Nov 2026". */
export function dayLabel(day: CivilDate): string {
  return LONG(new Date(day))
}

/** "20 Nov", where the year is plain from around it. */
export function shortDayLabel(day: CivilDate): string {
  return SHORT(new Date(day))
}

/** "20 Nov" for a day of the year it is now, and "20 Nov 2025" before, as in a list of the newest entries. */
export function recentDayLabel(day: CivilDate, today: CivilDate): string {
  return yearOf(day) === yearOf(today) ? shortDayLabel(day) : dayLabel(day)
}

/** "Friday 20 Nov", for a recent day such as the close the figures are at. */
export function weekdayDayLabel(day: CivilDate): string {
  return WITH_WEEKDAY(new Date(day))
}
