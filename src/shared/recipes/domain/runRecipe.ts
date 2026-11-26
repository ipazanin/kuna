import { parseCivilDate } from '../../calendar/civilDate'
import type { CivilDate } from '../../calendar/civilDate'
import { currencyCodeOf } from '../../money/currencyCode'
import type { CurrencyCode } from '../../money/currencyCode'
import { DECIMAL_ZERO, decimalOfMarkedText, decimalOfText } from '../../money/decimal'
import type { Decimal } from '../../money/decimal'
import { factKey } from '../../text/factKey'
import { sectionColumns } from './recipe'
import type { NumberCells, Recipe, RecipeFields, RecipeMisfit, RecipeSection, RowKind, RowTest, SourceRow, SourceRows } from './recipe'

/** A row a kind took, with its fields by type. A blank field is null where the recipe allows it. */
export interface RecipeRow {
  readonly section: string
  /** The row's index among its section's rows in the file, kept or not. */
  readonly place: number
  readonly kind: string
  /** The row's text in the columns it read, which tells whether a later file changed it. */
  readonly facts: string
  readonly texts: Readonly<Record<string, string | null>>
  readonly decimals: Readonly<Record<string, Decimal | null>>
  readonly dates: Readonly<Record<string, CivilDate | null>>
  readonly currencies: Readonly<Record<string, CurrencyCode | null>>
}

/** Why a row needs the person: no kind takes it, or a field its kind reads cannot be read. */
export type AskedWhy = { readonly kind: 'no-kind' } | { readonly kind: 'unreadable'; readonly field: string; readonly text: string } | { readonly kind: 'changed' }

/** A row the recipe will not guess at, for the person to see. */
export interface AskedRow {
  /** Stable across files, since it comes from the row's own text. */
  readonly key: string
  readonly section: string
  /** The row's index among its section's rows in the file, kept or not, or null for a row that changed since an earlier file. */
  readonly place: number | null
  /** The columns the section shows, as the file writes them. */
  readonly shown: readonly (readonly [column: string, text: string])[]
  /** The dates the section's own fields read from the row, null where one cannot be read, so a question has a day even when no kind takes its row. */
  readonly dates: Readonly<Record<string, CivilDate | null>>
  readonly why: AskedWhy
}

export type RecipeRun = { readonly kind: 'misfit'; readonly misfit: RecipeMisfit } | { readonly kind: 'read'; readonly rows: readonly RecipeRow[]; readonly asked: readonly AskedRow[] }

const NO_NUMBERS: ReadonlySet<string> = new Set()

function passes(test: RowTest, row: SourceRow): boolean {
  const text = (row.get(test.column) ?? '').trim()
  if ('is' in test) return test.anyCase === true ? test.is.some((one) => one.toLowerCase() === text.toLowerCase()) : test.is.includes(text)
  if ('filled' in test) return text !== ''
  if ('partsWithin' in test) return text === '' || text.split(test.separator).every((part) => test.partsWithin.includes(part.trim()))
  const number = decimalOfText(text)
  return number !== null && (test.sign === 'above-zero' ? number > DECIMAL_ZERO : number < DECIMAL_ZERO)
}

/**
 * Reads a date or a time written in exactly one of the formats. A format's letters match digits and anything else matches
 * itself. A format with a time of day also reads its day alone, as a sheet writes a day cell that holds no time.
 */
function partsByFormat(text: string, formats: readonly string[]): Readonly<Record<string, string>> | null {
  for (const format of formats.flatMap((written) => (written.includes(' HH') ? [written, written.slice(0, written.indexOf(' HH'))] : [written]))) {
    const pattern = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/yyyy|MM|dd|HH|mm|ss/g, (token) => `(?<${token}>\\d{${token.length}})`)
    const groups = new RegExp(`^${pattern}$`).exec(text)?.groups
    if (groups !== undefined) return groups
  }
  return null
}

/** The day a text writes in one of a recipe's day formats, or null when it fits none. */
export function dateFrom(text: string, formats: readonly string[]): CivilDate | null {
  const parts = partsByFormat(text, formats)
  if (parts === null || parts.yyyy === undefined || parts.MM === undefined || parts.dd === undefined) return null
  return parseCivilDate(`${parts.yyyy}-${parts.MM}-${parts.dd}`)
}

/** The time as `hh:mm:ss`, or a blank for a format that has none, as a date alone does. Null when the text fits no format. */
function timeFrom(text: string, formats: readonly string[]): string | null {
  const parts = partsByFormat(text, formats)
  if (parts === null) return null
  return parts.HH === undefined ? '' : [parts.HH, parts.mm ?? '00', parts.ss ?? '00'].join(':')
}

/** The fields read from the row, or the first that cannot be. A column in `numbers` holds a sheet's number cell. */
function fieldsOf(
  fields: RecipeFields,
  row: SourceRow,
  numbers: ReadonlySet<string>,
): Pick<RecipeRow, 'texts' | 'decimals' | 'dates' | 'currencies'> | { readonly unreadable: string; readonly text: string } {
  const texts: Record<string, string | null> = {}
  const decimals: Record<string, Decimal | null> = {}
  const dates: Record<string, CivilDate | null> = {}
  const currencies: Record<string, CurrencyCode | null> = {}
  for (const [name, field] of Object.entries(fields)) {
    const text = (row.get(field.from) ?? '').trim()
    const blank = text === ''
    if (blank && field.blank !== true) return { unreadable: name, text }
    const unreadable = { unreadable: name, text }
    switch (field.as) {
      case 'text':
        texts[name] = blank ? null : text
        break
      case 'time': {
        const time = blank ? null : timeFrom(text, field.formats)
        if (!blank && time === null) return unreadable
        texts[name] = time
        break
      }
      case 'decimal': {
        const decimal = blank ? null : field.mark === undefined || numbers.has(field.from) ? decimalOfText(text) : decimalOfMarkedText(text, field.mark)
        if (!blank && decimal === null) return unreadable
        decimals[name] = decimal
        break
      }
      case 'date': {
        const date = blank ? null : dateFrom(text, field.formats)
        if (!blank && date === null) return unreadable
        dates[name] = date
        break
      }
      case 'currency': {
        const currency = blank ? null : currencyCodeOf(field.part === undefined ? text : (text.split(field.part.separator)[field.part.at] ?? ''))
        if (!blank && currency === null) return unreadable
        currencies[name] = currency
        break
      }
    }
  }
  return { texts, decimals, dates, currencies }
}

/** The key of a row asked about: its whole text, so the same row in a later file is the same question. */
function askedKey(section: RecipeSection, row: SourceRow): string {
  return factKey([section.name, ...[...row].map(([column, text]) => `${column}=${text}`).sort()])
}

function sectionDates(section: RecipeSection, row: SourceRow): Readonly<Record<string, CivilDate | null>> {
  return Object.fromEntries(Object.entries(section.fields).flatMap(([name, field]) => (field.as === 'date' ? [[name, dateFrom((row.get(field.from) ?? '').trim(), field.formats)]] : [])))
}

function askedRow(section: RecipeSection, row: SourceRow, place: number, why: AskedWhy): AskedRow {
  return {
    key: askedKey(section, row),
    section: section.name,
    place,
    shown: section.shown.flatMap((column) => (row.get(column) ? [[column, row.get(column)!] as const] : [])),
    dates: sectionDates(section, row),
    why,
  }
}

function firstKind(section: RecipeSection, row: SourceRow): RowKind | undefined {
  return section.kinds.find((kind) => kind.when.every((test) => passes(test, row)))
}

/**
 * Runs a recipe over the rows of a file. A section the file lacks, or a column a section reads that a row lacks, means the
 * file is not the document the recipe describes, so nothing is read. A row that fits no kind, or whose field cannot be
 * read, is asked about and everything else goes on. A sheet's reading says which of its cells are numbers.
 */
export function runRecipe(recipe: Recipe, source: { readonly rows: SourceRows; readonly numbers?: NumberCells }): RecipeRun {
  const rows: RecipeRow[] = []
  const asked: AskedRow[] = []
  for (const section of recipe.sections) {
    const sourceRows = source.rows.get(section.name)
    const numbers = source.numbers?.get(section.name) ?? []
    if (sourceRows === undefined) return { kind: 'misfit', misfit: { kind: 'no-section', section: section.name } }
    const columns = sectionColumns(section)
    for (const [place, row] of sourceRows.entries()) {
      const lacking = columns.find((column) => !row.has(column))
      if (lacking !== undefined) return { kind: 'misfit', misfit: { kind: 'no-column', section: section.name, column: lacking } }
      if (!section.keep.every((test) => passes(test, row))) continue
      const kind = firstKind(section, row)
      if (kind === undefined) {
        asked.push(askedRow(section, row, place, { kind: 'no-kind' }))
        continue
      }
      const fields = { ...section.fields, ...kind.fields }
      const read = fieldsOf(fields, row, numbers[place] ?? NO_NUMBERS)
      if ('unreadable' in read) {
        asked.push(askedRow(section, row, place, { kind: 'unreadable', field: read.unreadable, text: read.text }))
        continue
      }
      const facts = Object.values(fields)
        .map((field) => row.get(field.from) ?? '')
        .join('|')
      rows.push({ section: section.name, place, kind: kind.kind, facts, ...read })
    }
  }
  return { kind: 'read', rows, asked }
}
