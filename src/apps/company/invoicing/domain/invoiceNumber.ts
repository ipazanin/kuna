import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** The number pattern the invoice generator has always used: the sequence, a fixed 1, and the year's last two digits. */
export const DEFAULT_NUMBER_PATTERN = '{n}-1-{yy}'

const NUMBER_TOKENS = ['{n}', '{yy}', '{yyyy}'] as const

const TOKEN = /\{[^}]*\}/g

/** Null when the pattern holds the sequence once and no word in braces the app does not fill in. */
export function numberPatternProblem(pattern: string): string | null {
  if (pattern.trim() === '') return 'a pattern such as {n}-1-{yy}'
  const unknown = (pattern.match(TOKEN) ?? []).filter((token) => !(NUMBER_TOKENS as readonly string[]).includes(token))
  if (unknown.length > 0) return `${unknown.join(', ')} is not one of ${NUMBER_TOKENS.join(', ')}`
  if (pattern.split('{n}').length !== 2) return 'the pattern needs {n}, the sequence, exactly once'
  return null
}

function hasYear(pattern: string): boolean {
  return pattern.includes('{yy}') || pattern.includes('{yyyy}')
}

/** The pattern filled in for one sequence number and year. */
export function invoiceNumberOf(pattern: string, sequence: number, year: number): string {
  return pattern
    .replaceAll('{yyyy}', String(year))
    .replaceAll('{yy}', String(year % 100).padStart(2, '0'))
    .replaceAll('{n}', String(sequence))
}

function sequenceOf(pattern: string, number: string, year: number): number | null {
  const parts = pattern.split('{n}').map((part) => invoiceNumberOf(part, 0, year).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const match = new RegExp(`^${parts[0]}(\\d+)${parts[1]}$`).exec(number.trim())
  return match === null ? null : Number(match[1])
}

/**
 * The number after the highest one of the issue year, by the pattern, or the first of the year.
 * The sequence restarts each year. With a year in the pattern, the year in the number decides,
 * and without one the issue date does. A number the pattern does not describe, such as one typed
 * for a special invoice, is passed over.
 */
export function nextInvoiceNumber(pattern: string, issued: CivilDate, invoices: readonly { readonly number: string; readonly issued: CivilDate }[]): string {
  const year = yearOf(issued)
  const candidates = hasYear(pattern) ? invoices : invoices.filter((invoice) => yearOf(invoice.issued) === year)
  const highest = candidates.reduce((most, invoice) => Math.max(most, sequenceOf(pattern, invoice.number, year) ?? 0), 0)
  return invoiceNumberOf(pattern, highest + 1, year)
}

/** Whether a number is on the register already, for any client, as the generator checks it. */
export function numberTaken(number: string, invoices: readonly { readonly number: string }[]): boolean {
  const wanted = number.trim().toLowerCase()
  return invoices.some((invoice) => invoice.number.trim().toLowerCase() === wanted)
}
