/**
 * A calendar day with no time and no time zone, written `YYYY-MM-DD`. The text form sorts the way
 * the calendar does, so two dates compare with `<`.
 */
export type CivilDate = string & { readonly __calendar: 'day' }

const MILLISECONDS_PER_DAY = 86_400_000
// Day zero of the serial numbers Google Sheets and Excel give a date cell.
const SERIAL_EPOCH = Date.UTC(1899, 11, 30)
const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function civilDate(year: number, month: number, day: number): CivilDate {
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new RangeError(`${year}-${month}-${day} is not a calendar day.`)
  }
  return fromUtc(utc.getTime())
}

/** The day it is on this device. */
export function today(): CivilDate {
  const now = new Date()
  return civilDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** A Sheets serial date such as 46310. A fraction is a time of day, which is dropped. */
export function civilDateFromSerial(serial: number): CivilDate {
  if (!Number.isFinite(serial)) {
    throw new RangeError(`${serial} is not a serial date.`)
  }
  return fromUtc(SERIAL_EPOCH + Math.floor(serial) * MILLISECONDS_PER_DAY)
}

/** The serial number Sheets and Excel give this day as a date cell. */
export function serialFromCivilDate(date: CivilDate): number {
  return (toUtc(date) - SERIAL_EPOCH) / MILLISECONDS_PER_DAY
}

export function parseCivilDate(text: string): CivilDate | null {
  const match = CIVIL_DATE_PATTERN.exec(text)
  if (match === null) {
    return null
  }
  try {
    return civilDate(Number(match[1]), Number(match[2]), Number(match[3]))
  } catch {
    return null
  }
}

export function addDays(date: CivilDate, days: number): CivilDate {
  return fromUtc(toUtc(date) + days * MILLISECONDS_PER_DAY)
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: CivilDate, to: CivilDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / MILLISECONDS_PER_DAY)
}

/** Monday to Friday from `from` to `to`, both included, public holidays counted as working days the way a monthly fund of hours counts them. */
export function weekdaysBetween(from: CivilDate, to: CivilDate): number {
  let count = 0
  for (let day = toUtc(from); day <= toUtc(to); day += MILLISECONDS_PER_DAY) {
    const weekday = new Date(day).getUTCDay()
    if (weekday !== 0 && weekday !== 6) {
      count += 1
    }
  }
  return count
}

export function yearOf(date: CivilDate): number {
  return Number(date.slice(0, 4))
}

export function dayOfMonth(date: CivilDate): number {
  return Number(date.slice(8, 10))
}

/** The day an instant, in epoch milliseconds, falls on in a time zone such as Europe/Zagreb. */
export function civilDateIn(instant: number, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((candidate) => candidate.type === type)?.value)
  return civilDate(part('year'), part('month'), part('day'))
}

/** The instant, in epoch milliseconds, a day starts in a time zone such as Europe/Zagreb. */
export function startOfDayIn(date: CivilDate, timeZone: string): number {
  const midnightUtc = toUtc(date)
  const once = midnightUtc - zoneOffset(midnightUtc, timeZone)
  return midnightUtc - zoneOffset(once, timeZone)
}

/** How far a time zone's clock is ahead of UTC at an instant, in milliseconds. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((candidate) => candidate.type === type)?.value)
  const wallClock = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
  return wallClock - Math.floor(instant / 1000) * 1000
}

function toUtc(date: CivilDate): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
}

function fromUtc(milliseconds: number): CivilDate {
  return new Date(milliseconds).toISOString().slice(0, 10) as CivilDate
}
