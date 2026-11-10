import { addDays, daysBetween, parseCivilDate } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'

export const MINUTES_IN_HOUR = 60
export const MINUTES_IN_DAY = 24 * MINUTES_IN_HOUR

/** A day and a time on the wall clock where the traveller is, such as `2026-03-12 07:30`. Kuna counts every day as 24 hours, also across a clock change. */
export interface TripMoment {
  readonly day: CivilDate
  /** Minutes after midnight, from 0 to 1439. */
  readonly minute: number
}

const MOMENT_TEXT = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})$/

/** A moment from text such as `2026-03-12 07:30`, or null for anything else. */
export function tripMomentOf(text: string): TripMoment | null {
  const match = MOMENT_TEXT.exec(text.trim())
  if (match === null) return null
  const day = parseCivilDate(match[1]!)
  const hours = Number(match[2])
  const minutes = Number(match[3])
  if (day === null || hours > 23 || minutes > 59) return null
  return { day, minute: hours * MINUTES_IN_HOUR + minutes }
}

/** The moment as a field writes it, such as `2026-03-12 07:30`. */
export function tripMomentText(moment: TripMoment): string {
  return `${moment.day} ${clockText(moment.minute)}`
}

/** The time of day, such as `07:30`. */
export function clockText(minute: number): string {
  const hours = Math.floor(minute / MINUTES_IN_HOUR)
  return `${String(hours).padStart(2, '0')}:${String(minute % MINUTES_IN_HOUR).padStart(2, '0')}`
}

/** Minutes from `from` to `to`, negative when `to` is earlier. */
export function minutesBetween(from: TripMoment, to: TripMoment): number {
  return daysBetween(from.day, to.day) * MINUTES_IN_DAY + to.minute - from.minute
}

/** The moment some minutes later, or earlier for a negative count. */
export function minutesAfter(moment: TripMoment, minutes: number): TripMoment {
  const total = moment.minute + minutes
  const days = Math.floor(total / MINUTES_IN_DAY)
  return { day: addDays(moment.day, days), minute: total - days * MINUTES_IN_DAY }
}
