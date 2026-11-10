import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** The words in braces a number pattern may hold: the sequence and the year in two or four digits. */
export const NUMBER_TOKENS = ['{n}', '{yy}', '{yyyy}'] as const

/** A numbered document as the sequence reads it, such as an invoice or a travel order. */
export interface NumberedDocument {
  readonly number: string
  readonly issued: CivilDate
}

function hasYear(pattern: string): boolean {
  return pattern.includes('{yy}') || pattern.includes('{yyyy}')
}

/** The pattern filled in for one sequence number and year. */
export function numberOf(pattern: string, sequence: number, year: number): string {
  return pattern
    .replaceAll('{yyyy}', String(year))
    .replaceAll('{yy}', String(year % 100).padStart(2, '0'))
    .replaceAll('{n}', String(sequence))
}

function sequenceOf(pattern: string, number: string, year: number): number | null {
  const parts = pattern.split('{n}').map((part) => numberOf(part, 0, year).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const match = new RegExp(`^${parts[0]}(\\d+)${parts[1]}$`).exec(number.trim())
  return match === null ? null : Number(match[1])
}

/**
 * The number after the highest one of the issue year, by the pattern, or the first of the year.
 * The sequence restarts each year. With a year in the pattern, the year in the number decides,
 * and without one the issue date does. A number the pattern does not describe, such as one typed
 * for a special document, is passed over, and a deleted document leaves its number as a gap.
 */
export function nextYearlyNumber(pattern: string, issued: CivilDate, documents: readonly NumberedDocument[]): string {
  const year = yearOf(issued)
  const candidates = hasYear(pattern) ? documents : documents.filter((document) => yearOf(document.issued) === year)
  const highest = candidates.reduce((most, document) => Math.max(most, sequenceOf(pattern, document.number, year) ?? 0), 0)
  return numberOf(pattern, highest + 1, year)
}

/** Whether a number is taken already, ignoring case and the spaces around it. */
export function numberTaken(number: string, documents: readonly { readonly number: string }[]): boolean {
  const wanted = number.trim().toLowerCase()
  return documents.some((document) => document.number.trim().toLowerCase() === wanted)
}
