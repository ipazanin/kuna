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

/** A Sheets serial date such as 46310. A fraction is a time of day, which is dropped. */
export function civilDateFromSerial(serial: number): CivilDate {
  if (!Number.isFinite(serial)) {
    throw new RangeError(`${serial} is not a serial date.`)
  }
  return fromUtc(SERIAL_EPOCH + Math.floor(serial) * MILLISECONDS_PER_DAY)
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

export function yearOf(date: CivilDate): number {
  return Number(date.slice(0, 4))
}

export function dayOfMonth(date: CivilDate): number {
  return Number(date.slice(8, 10))
}

function toUtc(date: CivilDate): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
}

function fromUtc(milliseconds: number): CivilDate {
  return new Date(milliseconds).toISOString().slice(0, 10) as CivilDate
}
