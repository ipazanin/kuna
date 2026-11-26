import { dateFormat } from './dateFormat'
import { yearOf } from './civilDate'
import { language } from '../text/language'
import type { CivilDate } from './civilDate'
import type { DateRange } from './dateRange'
import { monthOf } from './monthKey'
import { words } from './words'

const LONG = dateFormat({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const SHORT = dateFormat({ day: 'numeric', month: 'short', timeZone: 'UTC' })
const DAY = dateFormat({ day: 'numeric', timeZone: 'UTC' })
// Inside a sentence Croatian names the month, which Intl puts in the genitive after a day: 14. ožujka 2026.
const IN_TEXT = dateFormat({ day: 'numeric', month: language === 'hr' ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' })
const IN_TEXT_NO_YEAR = dateFormat({ day: 'numeric', month: language === 'hr' ? 'long' : 'short', timeZone: 'UTC' })
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

/** A run of days in one line, its year once within a year: "13–17 Nov 2026", "28 Oct – 3 Nov 2026" and "30 Dec 2026 – 2 Jan 2027". */
export function dayRangeLabel(range: DateRange): string {
  const { from, to } = range
  if (from === to) return dayLabel(from)
  if (monthOf(from) === monthOf(to)) return `${DAY(new Date(from))}–${dayLabel(to)}`
  return `${yearOf(from) === yearOf(to) ? shortDayLabel(from) : dayLabel(from)} – ${dayLabel(to)}`
}

/** A day inside a sentence: "14 Mar 2026", or "14. ožujka 2026." in Croatian. */
export function dayInTextLabel(day: CivilDate): string {
  return IN_TEXT(new Date(day))
}

/**
 * A run of days inside a sentence, its first day as short as the last allows: "13–17 Nov 2026", "28 Oct – 3 Nov 2026" and
 * "30 Dec 2026 – 2 Jan 2027" as `dayRangeLabel` writes them, or "od 13. do 17. studenoga 2026." in Croatian.
 */
export function dayRunInText(range: DateRange): string {
  const { from, to } = range
  if (from === to) return dayInTextLabel(to)
  if (monthOf(from) === monthOf(to)) return words.dayRun.inOneMonth(DAY(new Date(from)), dayInTextLabel(to))
  return words.dayRun.acrossMonths(yearOf(from) === yearOf(to) ? IN_TEXT_NO_YEAR(new Date(from)) : dayInTextLabel(from), dayInTextLabel(to))
}
