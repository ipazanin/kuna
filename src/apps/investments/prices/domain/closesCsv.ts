/** Reads daily closes from a CSV file, such as Yahoo's history download or a spreadsheet saved as CSV. */

import { isDay } from './pricesFile'
import type { CloseRow } from './pricesFile'

/** Why a CSV file gives no closes. A line is the 1-based line of the file. */
export type ClosesCsvRefusal =
  | { readonly kind: 'empty' }
  | { readonly kind: 'no-columns' }
  | { readonly kind: 'ambiguous-dates' }
  | { readonly kind: 'unreadable'; readonly line: number; readonly text: string }
  | { readonly kind: 'repeated-day'; readonly day: string }

export type ClosesCsvReading = { readonly kind: 'read'; readonly closes: readonly CloseRow[] } | { readonly kind: 'refused'; readonly refusal: ClosesCsvRefusal }

/** A date's day read day-first and read month-first, null where it does not read that way. ISO and dotted dates read one day both ways. */
interface DateReadings {
  readonly dayFirst: string | null
  readonly monthFirst: string | null
}

interface CsvRow {
  readonly line: number
  readonly text: string
  readonly dates: DateReadings
  readonly close: string
}

type DateOrder = keyof DateReadings

const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/
const NUMERIC_DATE = /^(\d{1,2})([./])(\d{1,2})\2(\d{4})\.?$/
const POINT_CLOSE = /^(\d+)(?:\.(\d+))?$/
const POINT_OR_COMMA_CLOSE = /^(\d+)(?:[.,](\d+))?$/
const MAX_PLACES = 12

/**
 * The closes a CSV file holds, oldest first with one a day, from its Date and Close columns. Rows Yahoo marks null are
 * skipped. Slash dates are read day-first or month-first for the whole file, as the dates themselves decide.
 */
export function readClosesCsv(text: string): ClosesCsvReading {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r\n|\n|\r/)
    .map((lineText, index) => ({ line: index + 1, text: lineText }))
    .filter((numbered) => numbered.text.trim() !== '')
  const [header, ...body] = lines
  if (header === undefined) {
    return refused({ kind: 'empty' })
  }
  const separator = !header.text.includes(',') && header.text.includes(';') ? ';' : ','
  const names = fieldsOf(header.text, separator).map((name) => name.trim().toLowerCase())
  const dateColumn = names.indexOf('date')
  const closeColumn = names.indexOf('close')
  if (dateColumn === -1 || closeColumn === -1) {
    return refused({ kind: 'no-columns' })
  }
  const closePattern = separator === ';' ? POINT_OR_COMMA_CLOSE : POINT_CLOSE
  const rows: CsvRow[] = []
  for (const numbered of body) {
    const fields = fieldsOf(numbered.text, separator)
    // A field past the header's, such as an unquoted comma decimal, would shift the close into the wrong column.
    if (fields.length > names.length) {
      return refused({ kind: 'unreadable', ...numbered })
    }
    const closeField = fields[closeColumn]?.trim()
    if (closeField?.toLowerCase() === 'null') {
      continue
    }
    const close = closeField === undefined ? null : closeOf(closeField, closePattern)
    const dates = dateReadingsOf(fields[dateColumn]?.trim() ?? '')
    if (close === null || (dates.dayFirst === null && dates.monthFirst === null)) {
      return refused({ kind: 'unreadable', ...numbered })
    }
    rows.push({ ...numbered, dates, close })
  }
  if (rows.length === 0) {
    return refused({ kind: 'empty' })
  }
  const order = dateOrderOf(rows)
  if (order === null) {
    return refused({ kind: 'ambiguous-dates' })
  }
  const closes: CloseRow[] = []
  for (const row of rows) {
    const day = row.dates[order]
    if (day === null) {
      return refused({ kind: 'unreadable', line: row.line, text: row.text })
    }
    closes.push([day, row.close])
  }
  closes.sort(([earlier], [later]) => (earlier < later ? -1 : earlier > later ? 1 : 0))
  const repeated = closes.find(([day], index) => index > 0 && closes[index - 1]![0] === day)
  if (repeated !== undefined) {
    return refused({ kind: 'repeated-day', day: repeated[0] })
  }
  return { kind: 'read', closes }
}

function refused(refusal: ClosesCsvRefusal): ClosesCsvReading {
  return { kind: 'refused', refusal }
}

/** A line's fields, where a field in double quotes may hold the separator and a doubled quote stands for one. */
function fieldsOf(lineText: string, separator: string): string[] {
  const fields: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < lineText.length; index += 1) {
    const character = lineText[index]!
    if (quoted) {
      if (character === '"' && lineText[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === separator) {
      fields.push(field)
      field = ''
    } else {
      field += character
    }
  }
  fields.push(field)
  return fields
}

/** The close as plain decimal text with no trailing zeros, or null when it is no close above zero with at most twelve places. */
function closeOf(field: string, pattern: RegExp): string | null {
  const match = pattern.exec(field)
  if (match === null) {
    return null
  }
  const whole = match[1]!.replace(/^0+(?=\d)/, '')
  const places = (match[2] ?? '').replace(/0+$/, '')
  if (places.length > MAX_PLACES || (whole === '0' && places === '')) {
    return null
  }
  return places === '' ? whole : `${whole}.${places}`
}

function dateReadingsOf(field: string): DateReadings {
  const iso = ISO_DATE.exec(field)
  if (iso !== null) {
    const day = isDay(iso[1]!) ? iso[1]! : null
    return { dayFirst: day, monthFirst: day }
  }
  const numeric = NUMERIC_DATE.exec(field)
  if (numeric === null) {
    return { dayFirst: null, monthFirst: null }
  }
  const first = numeric[1]!
  const second = numeric[3]!
  const year = numeric[4]!
  const dayFirst = dayOf(year, second, first)
  return { dayFirst, monthFirst: numeric[2] === '.' ? dayFirst : dayOf(year, first, second) }
}

function dayOf(year: string, month: string, dayOfMonth: string): string | null {
  const day = `${year}-${month.padStart(2, '0')}-${dayOfMonth.padStart(2, '0')}`
  return isDay(day) ? day : null
}

/**
 * The order the file's dates are written in: the order of the first date that reads only one way, otherwise either
 * order when both read every date alike, and null when the two orders give a different day for some date.
 */
function dateOrderOf(rows: readonly CsvRow[]): DateOrder | null {
  const decider = rows.find(({ dates }) => (dates.dayFirst === null) !== (dates.monthFirst === null))
  if (decider !== undefined) {
    return decider.dates.dayFirst === null ? 'monthFirst' : 'dayFirst'
  }
  return rows.every(({ dates }) => dates.dayFirst === dates.monthFirst) ? 'dayFirst' : null
}
