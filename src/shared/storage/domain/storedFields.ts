import { civilDateFromSerial, parseCivilDate } from '../../calendar/civilDate'
import type { CivilDate } from '../../calendar/civilDate'
import type { DateRange } from '../../calendar/dateRange'
import { moneyFromAmount } from '../../money/money'
import type { Money } from '../../money/money'
import type { RecordId } from './recordId'
import type { FieldValue, RecordFields } from './recordFields'
import { words } from './words'

/**
 * One filled field of a stored record: its text, and what it holds where the storage keeps it as a
 * date, an amount, a number or a flag. A field the storage leaves blank is absent.
 */
export interface StoredField {
  readonly text: string
  readonly date: CivilDate | null
  readonly money: Money | null
  readonly number: number | null
  readonly flag: boolean | null
}

/** A stored record's filled fields, by their names in the workbook format. */
export type StoredFields = Readonly<Record<string, StoredField>>

/** The serial numbers of 0001-01-01 and of the day after 9999-12-31. */
const SERIAL_DAYS = { first: -693_593, after: 2_958_466 } as const

/**
 * A value as a storage keeps it, text, a number or true and false, as the domain reads the field:
 * a number is also the amount it holds and, as a serial number of a day from the year 1 to 9999, the
 * day it counts.
 */
export function storedFieldOf(value: string | number | boolean): StoredField {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : null
  return {
    text: String(value).trim(),
    date: number !== null && number >= SERIAL_DAYS.first && number < SERIAL_DAYS.after ? civilDateFromSerial(number) : null,
    money: number === null ? null : moneyFromAmount(number),
    number,
    flag: typeof value === 'boolean' ? value : null,
  }
}

/** Decimal text such as `-95.49` or `2025`, without grouping or an exponent. */
const DECIMAL = /^-?\d+(\.\d+)?$/

/** A field's text as the number it writes, or null for text that is not decimal. */
export function decimalOf(text: string): number | null {
  return DECIMAL.test(text) ? Number(text) : null
}

/**
 * A record's field as the domain reads it: text such as `2025-05-12` is also the day it names, and
 * decimal text is also the number and the amount it holds.
 */
export function storedFieldOfValue(value: FieldValue): StoredField {
  if (typeof value === 'boolean') {
    return storedFieldOf(value)
  }
  const text = value.trim()
  const number = decimalOf(text)
  return { text, date: parseCivilDate(text), money: number === null ? null : moneyFromAmount(number), number, flag: null }
}

/** A record's fields as the domain reads them. */
export function storedFieldsOfValues(fields: RecordFields): StoredFields {
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, storedFieldOfValue(value)]))
}

/** Why a kind's factory refuses a stored record. `refuse` throws it, and the reader of the records catches it. */
class RecordRefused extends Error {}

export function refuse(reason: string): never {
  throw new RecordRefused(reason)
}

/** The record a factory makes, or the reason it refuses the fields. */
export function refusalOr<Made>(make: () => Made): { readonly made: Made } | { readonly refused: string } {
  try {
    return { made: make() }
  } catch (failure) {
    if (failure instanceof RecordRefused) {
      return { refused: failure.message }
    }
    throw failure
  }
}

export function textOf(field: StoredField | undefined): string {
  return field?.text ?? ''
}

export function slugOf(field: StoredField | undefined): string {
  return textOf(field).toLowerCase()
}

/** A comma-separated list in lower case, such as `revenue, watched`. */
export function slugListOf(field: StoredField | undefined): string[] {
  return textOf(field)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')
}

/** A whole number, from a number or from text such as `7`. */
export function wholeNumberOf(field: StoredField | undefined): number | null {
  const number = field?.number ?? (field !== undefined && field.text !== '' ? Number(field.text) : Number.NaN)
  return Number.isInteger(number) ? number : null
}

/** TRUE or FALSE, from a flag or from text. Null for anything else. */
export function booleanOf(field: StoredField): boolean | null {
  if (field.flag !== null) return field.flag
  const text = field.text.toLowerCase()
  if (['true', 'yes', 'on', '1'].includes(text)) return true
  if (['false', 'no', 'off', '0'].includes(text)) return false
  return null
}

export function optionalDate(fields: StoredFields, name: string): CivilDate | null {
  const field = fields[name]
  if (field === undefined) return null
  return field.date ?? refuse(words.reasons.notADateCell(name, field.text))
}

export function requiredDate(fields: StoredFields, name: string): CivilDate {
  return optionalDate(fields, name) ?? refuse(words.reasons.noDate(name))
}

/** Two optional dates that together make a period. Both blank is no period. */
export function optionalPeriod(fields: StoredFields, fromName: string, toName: string): DateRange | null {
  const from = optionalDate(fields, fromName)
  const to = optionalDate(fields, toName)
  if (from === null && to === null) return null
  if (from === null || to === null) refuse(words.reasons.goTogether(fromName, toName))
  if (to < from) refuse(words.reasons.before(toName, to, fromName, from))
  return { from, to }
}

export function optionalMoney(fields: StoredFields, name: string): Money | null {
  const field = fields[name]
  if (field === undefined) return null
  return field.money ?? refuse(words.reasons.notANumber(name, field.text))
}

export function requiredMoney(fields: StoredFields, name: string): Money {
  return optionalMoney(fields, name) ?? refuse(words.reasons.none(name, ''))
}

export function positiveMoney(fields: StoredFields, name: string): Money {
  const money = requiredMoney(fields, name)
  return money > 0 ? money : refuse(words.reasons.notAboveZero(name))
}

/** A year such as 2026, from a number or text. */
export function requiredYear(fields: StoredFields, name: string): number {
  const year = wholeNumberOf(fields[name])
  if (year === null || year < 1900 || year > 2100) {
    refuse(fields[name] === undefined ? words.reasons.none(name, '') : words.reasons.notAYear(name, textOf(fields[name])))
  }
  return year
}

/** One of a fixed set of lower-case words. `noun` names what the word is in English, the field's name by default. */
export function requiredChoice<Choice extends string>(fields: StoredFields, name: string, choices: readonly Choice[], noun = ''): Choice {
  const word = slugOf(fields[name])
  if (word === '') refuse(words.reasons.none(name, noun))
  return (choices as readonly string[]).includes(word) ? (word as Choice) : refuse(words.reasons.notAChoice(word, name, noun, choices.join(', ')))
}

/** The id of a record of a kind without a business key, refused when the record has none. */
export function ownId(id: RecordId | null): RecordId {
  return id ?? refuse(words.reasons.noId)
}

/** The id a record's business key makes, which every record the factory accepts has. */
export function keyedId(id: RecordId | null): RecordId {
  if (id === null) {
    throw new Error('A record was read without its key.')
  }
  return id
}
