import type { DateValue } from '@internationalized/date'
import { CalendarDate } from '@internationalized/date'

/** The earliest and the latest day a field takes, as YYYY-MM-DD, either left out when not given. */
export interface DayLimits {
  readonly min?: string | undefined
  readonly max?: string | undefined
}

/** A day as a field's value: YYYY-MM-DD once the year has all four digits, and blank before. */
export function typedDayText(typed: DateValue | undefined): string {
  return typed instanceof CalendarDate && typed.year >= 1000 ? typed.toString() : ''
}

/**
 * True for a whole day before the earliest or after the latest. A year still being typed is never outside, so its first
 * digits do not show as an error on their way to a day inside.
 */
export function isOutsideLimits(typed: DateValue, { min, max }: DayLimits): boolean {
  const text = typedDayText(typed)
  return text !== '' && ((min !== undefined && text < min) || (max !== undefined && text > max))
}
