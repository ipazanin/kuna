import { weekdayOnOrAfter, weekdayOnOrBefore } from './workingDays'
import { addDays, civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthKey } from '../../../../shared/calendar/monthKey'

/** The JOPPD for a year's capital gains, and paying its tax: the last day of the next February, moved past a weekend to the next weekday. */
export function joppdDue(year: number): CivilDate {
  return weekdayOnOrAfter(lastDayOf(monthKey(year + 1, 2)))
}

export interface InoDohDue {
  /** 31 January of the next year, moved past a weekend to the next weekday. */
  readonly due: CivilDate
  /** The last weekday on or before 31 January, which is due whether the move holds or not. */
  readonly fileBy: CivilDate
}

/** The INO-DOH for a year's income with tax withheld abroad. */
export function inoDohDue(year: number): InoDohDue {
  const deadline = civilDate(year + 1, 1, 31)
  return { due: weekdayOnOrAfter(deadline), fileBy: weekdayOnOrBefore(deadline) }
}

/** Tax on income with nothing withheld abroad is paid and reported within 30 days of the payment. The day is not moved. */
export function thirtyDaysDue(paid: CivilDate): CivilDate {
  return addDays(paid, 30)
}

/** The INO-IZJAVA is due within eight days of the year's first payment with tax withheld abroad. */
export function inoIzjavaDue(firstPaid: CivilDate): CivilDate {
  return addDays(firstPaid, 8)
}

/** The year whose JOPPD is due next: last year until its deadline has passed, then this year. */
export function yearDueNext(today: CivilDate): number {
  const year = yearOf(today)
  return today <= joppdDue(year - 1) ? year - 1 : year
}
