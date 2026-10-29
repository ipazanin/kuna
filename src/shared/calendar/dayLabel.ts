import { intlLocale } from '../text/language'
import type { CivilDate } from './civilDate'

const LONG = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const SHORT = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "20 Nov 2026". */
export function dayLabel(day: CivilDate): string {
  return LONG.format(new Date(day))
}

/** "20 Nov", where the year is plain from around it. */
export function shortDayLabel(day: CivilDate): string {
  return SHORT.format(new Date(day))
}
