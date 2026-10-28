import { civilDate, dayOfMonth } from './civilDate'
import type { CivilDate } from './civilDate'

/** A calendar month written `YYYY-MM`. Like CivilDate, the text form sorts chronologically. */
export type MonthKey = string & { readonly __calendar: 'month' }

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/

export function monthKey(year: number, month: number): MonthKey {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`${year}-${month} is not a calendar month.`)
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}` as MonthKey
}

export function parseMonthKey(text: string): MonthKey | null {
  const match = MONTH_KEY_PATTERN.exec(text)
  if (match === null) {
    return null
  }
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? monthKey(Number(match[1]), month) : null
}

export function monthOf(date: CivilDate): MonthKey {
  return date.slice(0, 7) as MonthKey
}

export function yearOfMonth(month: MonthKey): number {
  return Number(month.slice(0, 4))
}

export function monthNumber(month: MonthKey): number {
  return Number(month.slice(5, 7))
}

export function addMonths(month: MonthKey, count: number): MonthKey {
  const index = yearOfMonth(month) * 12 + monthNumber(month) - 1 + count
  return monthKey(Math.floor(index / 12), (index % 12) + 1)
}

/** Months from `from` to `to`, counting both ends. Zero when `to` is before `from`. */
export function monthCountBetween(from: MonthKey, to: MonthKey): number {
  const span = (yearOfMonth(to) - yearOfMonth(from)) * 12 + monthNumber(to) - monthNumber(from) + 1
  return Math.max(0, span)
}

/** Every month from `from` to `to`, both included, ascending. */
export function monthsFrom(from: MonthKey, to: MonthKey): MonthKey[] {
  return Array.from({ length: monthCountBetween(from, to) }, (_, offset) => addMonths(from, offset))
}

export function firstDayOf(month: MonthKey): CivilDate {
  return civilDate(yearOfMonth(month), monthNumber(month), 1)
}

export function lastDayOf(month: MonthKey): CivilDate {
  const days = new Date(Date.UTC(yearOfMonth(month), monthNumber(month), 0)).getUTCDate()
  return civilDate(yearOfMonth(month), monthNumber(month), days)
}

/** The same day of the month `count` months on, or that month's last day when it is shorter, so the 31st of January is followed by the 28th or 29th of February. */
export function dayMonthsLater(date: CivilDate, count: number): CivilDate {
  const month = addMonths(monthOf(date), count)
  const last = lastDayOf(month)
  return dayOfMonth(date) < dayOfMonth(last) ? civilDate(yearOfMonth(month), monthNumber(month), dayOfMonth(date)) : last
}
