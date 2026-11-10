import { decimalOfNumber, decimalOfText } from '../../money/decimal'
import type { Decimal } from '../../money/decimal'
import type { Exposure, StoredValue } from '../../privacy/domain/exposure'
import { fold } from '../../text/fold'

export const FILTER_OPS = ['is', 'one-of', 'not', 'contains', 'at-least', 'at-most', 'empty', 'not-empty'] as const
export type FilterOp = (typeof FILTER_OPS)[number]

export const SORT_DIRECTIONS = ['ascending', 'descending'] as const
export type SortDirection = (typeof SORT_DIRECTIONS)[number]

/** A condition on one field of a record, as a model asks for it. */
export interface RecordFilter {
  readonly field: string
  readonly op: FilterOp
  readonly values: readonly string[]
}

export interface RecordSort {
  readonly field: string
  readonly direction: SortDirection
}

/** How a field compares: as an amount, a ref, an identifier, words someone wrote, or a plain value such as a day, a number or a name the owner gave. */
export type FieldClass = 'amount' | 'ref' | 'identifier' | 'words' | 'plain'

/** The ops each class of field takes. An identifier takes only a token it matches whole, so it cannot be guessed digit by digit. */
export const OPS_OF: Readonly<Record<FieldClass, readonly FilterOp[]>> = {
  amount: ['is', 'one-of', 'not', 'at-least', 'at-most', 'empty', 'not-empty'],
  ref: ['is', 'one-of', 'not', 'empty', 'not-empty'],
  identifier: ['is', 'one-of'],
  words: ['is', 'one-of', 'not', 'contains', 'empty', 'not-empty'],
  plain: FILTER_OPS,
}

/** The class of a field a kind reads, or null for one that never leaves. */
export function fieldClassOf(exposure: Exposure, amount: boolean): FieldClass | null {
  switch (exposure) {
    case 'never':
      return null
    case 'ref':
    case 'identifier':
      return exposure
    case 'party':
    case 'free-text':
      return 'words'
    default:
      return amount ? 'amount' : 'plain'
  }
}

/** Whether a field of the class sorts. A ref's id and an identifier say nothing in their order, and sorting an identifier would hint at its digits. */
export function sorts(fieldClass: FieldClass): boolean {
  return fieldClass !== 'ref' && fieldClass !== 'identifier'
}

/** One field of one record as a filter or a sort reads it. Words and plain values are as they leave the device, and identifiers are normalised. */
export type ComparedField =
  | { readonly class: 'amount'; readonly amount: Decimal | null }
  /** The record a ref field points at, as its kind and id. */
  | { readonly class: 'ref'; readonly id: string | null }
  | { readonly class: 'identifier'; readonly identifiers: readonly string[] }
  | { readonly class: 'words' | 'plain'; readonly value: StoredValue }

export type FieldTest = (field: ComparedField) => boolean

const PERIOD = /^\d{4}-\d{2}(?:-\d{2})?$/

type Held = string | number | boolean

function heldOf(value: StoredValue): readonly Held[] {
  if (value === null) return []
  return typeof value === 'object' ? value : [value]
}

function isEmpty(field: ComparedField): boolean {
  switch (field.class) {
    case 'amount':
      return field.amount === null
    case 'ref':
      return field.id === null || field.id === ''
    case 'identifier':
      return field.identifiers.every((identifier) => identifier === '')
    default:
      return heldOf(field.value).every((held) => held === '')
  }
}

function numberOf(held: Held): Decimal | null {
  if (typeof held === 'number') return decimalOfNumber(held, 12)
  return typeof held === 'string' ? decimalOfText(held.trim()) : null
}

function sameHeld(held: Held, wanted: string): boolean {
  const heldNumber = numberOf(held)
  const wantedNumber = decimalOfText(wanted.trim())
  if (heldNumber !== null && wantedNumber !== null) return heldNumber === wantedNumber
  return fold(String(held)) === fold(wanted)
}

/**
 * Whether the words are in a text. An alias Kuna handed out matches only whole, so `Person 1` does not find `Person 10`
 * and a search cannot spell out a name letter by letter.
 */
export function holdsWords(text: string, words: string, alias: boolean): boolean {
  if (!alias) return fold(text).includes(fold(words))
  const escaped = words.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}]| #\\d)`, 'u').test(text)
}

/** A bound of a range: an amount or a number, or a day or a month that compares by its prefix as from and to do. */
type Bound = { readonly number: Decimal } | { readonly period: string }

function boundOf(fieldClass: FieldClass, text: string): Bound | null {
  const number = decimalOfText(text.trim())
  if (number !== null) return { number }
  return fieldClass === 'plain' && PERIOD.test(text) ? { period: text } : null
}

function inRange(field: ComparedField, bound: Bound, atLeast: boolean): boolean {
  const compare = (held: Decimal | string, edge: Decimal | string) => (atLeast ? held >= edge : held <= edge)
  if (field.class === 'amount') return field.amount !== null && 'number' in bound && compare(field.amount, bound.number)
  if (field.class !== 'plain') return false
  return heldOf(field.value).some((held) => {
    if ('number' in bound) {
      const number = numberOf(held)
      return number !== null && compare(number, bound.number)
    }
    if (typeof held !== 'string' || !/^\d{4}-\d{2}/.test(held)) return false
    return atLeast ? held >= bound.period : held.slice(0, bound.period.length) <= bound.period
  })
}

function equals(field: ComparedField, wanted: readonly string[], amounts: readonly Decimal[]): boolean {
  switch (field.class) {
    case 'amount':
      return field.amount !== null && amounts.includes(field.amount)
    case 'ref':
      return field.id !== null && wanted.includes(field.id)
    case 'identifier':
      return field.identifiers.some((identifier) => wanted.includes(identifier))
    default:
      return heldOf(field.value).some((held) => wanted.some((one) => sameHeld(held, one)))
  }
}

/** How many values each op takes, as a refusal says it. */
function countProblem(op: FilterOp, count: number): string | null {
  if (op === 'empty' || op === 'not-empty') return count === 0 ? null : 'empty and not-empty take no values.'
  if (op === 'one-of' || op === 'not') return count > 0 ? null : 'one-of and not take one value or more.'
  return count === 1 ? null : 'is, contains, at-least and at-most take one value.'
}

/**
 * The test a filter puts to a field of the class, or why it cannot be put, in a sentence that repeats nothing the model
 * wrote. A ref's values come as the records its refs stand for, each as its kind and id, and an identifier's as the
 * normalised values its tokens stand for. `isAlias` says which words are an alias Kuna handed out.
 */
export function fieldTest(name: string, fieldClass: FieldClass, op: FilterOp, values: readonly string[], isAlias: (words: string) => boolean): FieldTest | string {
  if (!OPS_OF[fieldClass].includes(op)) return opsRefusal(name, fieldClass)
  const count = countProblem(op, values.length)
  if (count !== null) return count
  if (op === 'empty') return isEmpty
  if (op === 'not-empty') return (field) => !isEmpty(field)
  if (op === 'contains') {
    const [words] = values as [string]
    const alias = isAlias(words)
    return (field) => field.class !== 'amount' && 'value' in field && heldOf(field.value).some((held) => holdsWords(String(held), words, alias))
  }
  if (op === 'at-least' || op === 'at-most') {
    const bound = boundOf(fieldClass, values[0]!)
    if (bound === null) return fieldClass === 'amount' ? AMOUNT_TEXT : 'at-least and at-most take a number such as -12.50, or a day or a month such as 2026-10.'
    return (field) => inRange(field, bound, op === 'at-least')
  }
  const amounts = fieldClass === 'amount' ? values.flatMap((value) => decimalOfText(value.trim()) ?? []) : []
  if (amounts.length < (fieldClass === 'amount' ? values.length : 0)) return AMOUNT_TEXT
  return op === 'not' ? (field) => !equals(field, values, amounts) : (field) => equals(field, values, amounts)
}

const AMOUNT_TEXT = "An amount reads as decimal text in the record's own currency, such as -12.50."

/** Why a field does not take an op, naming the ops it takes. */
export function opsRefusal(name: string, fieldClass: FieldClass): string {
  const how = fieldClass === 'identifier' ? ', with a token a read gave you, such as HR•• ••••0160' : fieldClass === 'ref' ? ', with refs Kuna handed out' : ''
  return `${name} takes ${OPS_OF[fieldClass].join(', ')}${how}.`
}

/** What a sort compares a field by: a number, folded text, or nothing for an empty field, which goes last either way. */
export type SortKey = { readonly number: Decimal } | { readonly text: string } | null

export function sortKeyOf(field: ComparedField): SortKey {
  if (field.class === 'amount') return field.amount === null ? null : { number: field.amount }
  if (field.class !== 'words' && field.class !== 'plain') return null
  const held = heldOf(field.value).find((one) => one !== '')
  if (held === undefined) return null
  const number = numberOf(held)
  return number === null ? { text: fold(String(held)) } : { number }
}

function compareKeys(left: NonNullable<SortKey>, right: NonNullable<SortKey>): number {
  if ('number' in left && 'number' in right) return left.number < right.number ? -1 : left.number > right.number ? 1 : 0
  if ('text' in left && 'text' in right) return left.text < right.text ? -1 : left.text > right.text ? 1 : 0
  return 'number' in left ? -1 : 1
}

/**
 * The records in the order the sorts give, each key either way, with an empty key last either way and the record id
 * breaking every tie, so a page holds the same records from one call to the next.
 */
export function inOrder<R>(records: readonly R[], directions: readonly SortDirection[], keysOf: (record: R) => readonly SortKey[], idOf: (record: R) => string): readonly R[] {
  const keyed = records.map((record) => ({ record, keys: keysOf(record), id: idOf(record) }))
  keyed.sort((left, right) => {
    for (const [index, direction] of directions.entries()) {
      const one = left.keys[index] ?? null
      const other = right.keys[index] ?? null
      if (one === null || other === null) {
        if (one !== other) return one === null ? 1 : -1
        continue
      }
      const compared = compareKeys(one, other)
      if (compared !== 0) return direction === 'ascending' ? compared : -compared
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  })
  return keyed.map(({ record }) => record)
}
