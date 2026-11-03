import { addDays, civilDate, weekdaysBetween, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

export function isWeekday(day: CivilDate): boolean {
  return weekdaysBetween(day, day) === 1
}

/** The day `count` days that count after the day, or before it for a count below zero. */
function countedDaysAfter(day: CivilDate, count: number, counts: (candidate: CivilDate) => boolean): CivilDate {
  const step = count < 0 ? -1 : 1
  let found = day
  for (let left = Math.abs(count); left > 0;) {
    found = addDays(found, step)
    if (counts(found)) {
      left -= 1
    }
  }
  return found
}

/** The weekday `count` weekdays after the day, or before it for a count below zero. Holidays count as weekdays. */
export function weekdaysAfter(day: CivilDate, count: number): CivilDate {
  return countedDaysAfter(day, count, isWeekday)
}

/** The day itself when it is a weekday, otherwise the next weekday, as a deadline moves past a weekend. */
export function weekdayOnOrAfter(day: CivilDate): CivilDate {
  return isWeekday(day) ? day : weekdaysAfter(day, 1)
}

/** The day itself when it is a weekday, otherwise the weekday before it. */
export function weekdayOnOrBefore(day: CivilDate): CivilDate {
  return isWeekday(day) ? day : weekdaysAfter(day, -1)
}

/** Easter Sunday by the Gregorian computus. */
function easterSunday(year: number): CivilDate {
  const golden = year % 19
  const century = Math.floor(year / 100)
  const ofCentury = year % 100
  const epact = (19 * golden + century - Math.floor(century / 4) - Math.floor((century - Math.floor((century - 8) / 25) + 1) / 3) + 15) % 30
  const weekday = (32 + 2 * (century % 4) + 2 * Math.floor(ofCentury / 4) - epact - (ofCentury % 4)) % 7
  const shift = Math.floor((golden + 11 * epact + 22 * weekday) / 451)
  const month = Math.floor((epact + weekday - 7 * shift + 114) / 31)
  const dayOfMonth = ((epact + weekday - 7 * shift + 114) % 31) + 1
  return civilDate(year, month, dayOfMonth)
}

/** The days TARGET is closed on a weekday, so the ECB publishes no reference rate: New Year's Day, Good Friday, Easter Monday, 1 May, 25 and 26 December. */
function isTargetHoliday(day: CivilDate): boolean {
  const easter = easterSunday(yearOf(day))
  const monthDay = day.slice(5)
  return ['01-01', '05-01', '12-25', '12-26'].includes(monthDay) || day === addDays(easter, -2) || day === addDays(easter, 1)
}

function isTargetDay(day: CivilDate): boolean {
  return isWeekday(day) && !isTargetHoliday(day)
}

/** The TARGET working day `count` such days after the day, or before it for a count below zero. */
export function targetDaysAfter(day: CivilDate, count: number): CivilDate {
  return countedDaysAfter(day, count, isTargetDay)
}
