import type { DecimalMark } from '../../money/decimal'
import { readRecipe } from './readRecipe'
import type { Recipe, RecipeField, RecipeFields, RowKind, RowTest, TableFile } from './recipe'

/**
 * The fields an app reads from a table recipe's rows, which a recipe editor and the chat fill: the field the day goes to
 * and the one its time goes to when the format writes one, the field of one signed amount or the fields of a debit and
 * credit pair, the fields it may read besides, and the kinds a row can be.
 */
export interface TableRecipeFields {
  readonly date: string
  readonly time: string
  readonly amount: string
  readonly debit: string
  readonly credit: string
  readonly optional: readonly { readonly field: string; readonly as: 'text' | 'decimal' }[]
  /** The kinds in the app's order. A kind that `reads` comes in and reads the fields, and any other is only counted. */
  readonly kinds: readonly { readonly kind: string; readonly reads: boolean }[]
}

/** A test a kind of a draft holds a row to: the column's text is one of the values, in any case, or the column is not blank. */
export type DraftTest = { readonly column: string; readonly is: readonly string[] } | { readonly column: string; readonly filled: true }

/** A kind of a draft, which takes every row while it tests none. */
export interface DraftKind {
  readonly kind: string
  readonly test: DraftTest | null
}

/** One signed amount, or a debit and a credit column, of which a row fills one. */
export type DraftAmount = { readonly column: string } | { readonly debit: string; readonly credit: string }

/** A table recipe as a person or the chat writes it, column by column. */
export interface TableRecipeDraft {
  readonly name: string
  readonly date: { readonly column: string; readonly format: string }
  readonly amount: DraftAmount
  readonly mark: DecimalMark
  /** The column of each optional field the recipe reads, by the field. A field it does not read is absent. */
  readonly columns: Readonly<Record<string, string>>
  /** The first kind whose test a row passes takes it. */
  readonly kinds: readonly DraftKind[]
}

/** The draft with its kind at the place replaced by the kind given. */
export function kindChanged(draft: TableRecipeDraft, at: number, kind: DraftKind): TableRecipeDraft {
  return { ...draft, kinds: draft.kinds.map((held, place) => (place === at ? kind : held)) }
}

/** The draft with one more kind last, the app's first kind taking every row. */
export function kindAdded(draft: TableRecipeDraft, fields: TableRecipeFields): TableRecipeDraft {
  return { ...draft, kinds: [...draft.kinds, { kind: fields.kinds[0]?.kind ?? '', test: null }] }
}

/** The draft without its kind at the place. */
export function kindRemoved(draft: TableRecipeDraft, at: number): TableRecipeDraft {
  return { ...draft, kinds: draft.kinds.filter((_kind, place) => place !== at) }
}

/** The draft with its kind at the place moved one place earlier or later, so rows try it sooner or later. A kind already first or last stays. */
export function kindMoved(draft: TableRecipeDraft, at: number, step: -1 | 1): TableRecipeDraft {
  const to = at + step
  const moving = draft.kinds[at]
  const swapped = draft.kinds[to]
  if (moving === undefined || swapped === undefined) return draft
  return { ...draft, kinds: draft.kinds.map((kind, place) => (place === at ? swapped : place === to ? moving : kind)) }
}

/** What a draft still lacks, or what in it cannot be a recipe. A problem of one kind names it and its place in the draft's kinds. */
export type DraftProblem =
  | { readonly kind: 'no-name' }
  | { readonly kind: 'no-date' }
  | { readonly kind: 'no-format' }
  | { readonly kind: 'no-amount' }
  | { readonly kind: 'no-kind' }
  | { readonly kind: 'nothing-comes-in' }
  | { readonly kind: 'unknown-kind'; readonly name: string; readonly at: number }
  | { readonly kind: 'test-no-column'; readonly name: string; readonly at: number }
  | { readonly kind: 'test-no-value'; readonly name: string; readonly at: number }
  | { readonly kind: 'doubled-column'; readonly column: string }
  | { readonly kind: 'unreadable' }

/** Where a problem of a draft sits: under a field, under a part of one kind by its place, or across the fields for a rule over several. */
export type DraftPlace = 'name' | 'day' | 'format' | 'amount' | 'kinds' | 'across' | { readonly at: number; readonly part: 'kind' | 'column' | 'values' }

/** Where a person fixes a problem of a draft. */
export function placeOfProblem(problem: DraftProblem): DraftPlace {
  switch (problem.kind) {
    case 'no-name':
      return 'name'
    case 'no-date':
      return 'day'
    case 'no-format':
      return 'format'
    case 'no-amount':
      return 'amount'
    case 'no-kind':
      return 'kinds'
    case 'unknown-kind':
      return { at: problem.at, part: 'kind' }
    case 'test-no-column':
      return { at: problem.at, part: 'column' }
    case 'test-no-value':
      return { at: problem.at, part: 'values' }
    case 'nothing-comes-in':
    case 'doubled-column':
    case 'unreadable':
      return 'across'
  }
}

/** The day formats a draft may take, from the letters `runRecipe` reads. A sheet's own day cells read as the first two. */
export const DRAFT_DATE_FORMATS = ['yyyy-MM-dd', 'yyyy-MM-dd HH:mm:ss', 'dd.MM.yyyy', 'dd.MM.yyyy.', 'dd.MM.yyyy HH:mm', 'dd.MM.yyyy. HH:mm', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy'] as const

/** Whether a day format also writes the time of day. */
function writesTime(format: string): boolean {
  return format.includes('HH')
}

function isPair(amount: DraftAmount): amount is { readonly debit: string; readonly credit: string } {
  return 'debit' in amount
}

function amountColumns(amount: DraftAmount): readonly string[] {
  return isPair(amount) ? [amount.debit, amount.credit] : [amount.column]
}

/** Each column the draft reads, once for every field that reads it. The time reads the day's own column, so it counts once. */
function readColumns(draft: TableRecipeDraft): readonly string[] {
  return [draft.date.column, ...amountColumns(draft.amount), ...Object.values(draft.columns)].map((column) => column.trim()).filter((column) => column !== '')
}

/** Everything the draft lacks, and a column two of its fields read, in the order of its fields. None means it can be a recipe for these fields. */
export function draftProblems(draft: TableRecipeDraft, fields: TableRecipeFields): readonly DraftProblem[] {
  const columns = readColumns(draft)
  const doubled = columns.find((column, at) => columns.indexOf(column) !== at)
  const kinds = draft.kinds.flatMap(({ kind, test }, at): DraftProblem[] => [
    ...(fields.kinds.some((known) => known.kind === kind) ? [] : [{ kind: 'unknown-kind', name: kind, at } as const]),
    ...(test !== null && test.column.trim() === '' ? [{ kind: 'test-no-column', name: kind, at } as const] : []),
    ...(test !== null && 'is' in test && test.is.every((value) => value.trim() === '') ? [{ kind: 'test-no-value', name: kind, at } as const] : []),
  ])
  const comesIn = draft.kinds.some(({ kind }) => fields.kinds.find((known) => known.kind === kind)?.reads === true)
  return [
    ...(draft.name.trim() === '' ? [{ kind: 'no-name' } as const] : []),
    ...(draft.date.column.trim() === '' ? [{ kind: 'no-date' } as const] : []),
    ...(draft.date.format.trim() === '' ? [{ kind: 'no-format' } as const] : []),
    ...(amountColumns(draft.amount).some((column) => column.trim() === '') ? [{ kind: 'no-amount' } as const] : []),
    ...(doubled === undefined ? [] : [{ kind: 'doubled-column', column: doubled } as const]),
    ...(draft.kinds.length === 0 ? [{ kind: 'no-kind' } as const] : kinds),
    ...(draft.kinds.length === 0 || comesIn ? [] : [{ kind: 'nothing-comes-in' } as const]),
  ]
}

/** The fields a kind that comes in reads from a draft's columns. */
function readFields(draft: TableRecipeDraft, fields: TableRecipeFields): RecipeFields {
  const mark = { mark: draft.mark }
  const date = draft.date.column.trim()
  const formats = [draft.date.format.trim()]
  const amount: RecipeFields = isPair(draft.amount)
    ? { [fields.debit]: { from: draft.amount.debit.trim(), as: 'decimal', blank: true, ...mark }, [fields.credit]: { from: draft.amount.credit.trim(), as: 'decimal', blank: true, ...mark } }
    : { [fields.amount]: { from: draft.amount.column.trim(), as: 'decimal', ...mark } }
  const optional = fields.optional.flatMap(({ field, as }): [string, RecipeField][] => {
    const column = draft.columns[field]?.trim() ?? ''
    if (column === '') return []
    return [[field, as === 'decimal' ? { from: column, as, blank: true, ...mark } : { from: column, as, blank: true }]]
  })
  return {
    [fields.date]: { from: date, as: 'date', formats },
    ...(writesTime(formats[0]!) ? { [fields.time]: { from: date, as: 'time', formats } } : {}),
    ...amount,
    ...Object.fromEntries(optional),
  }
}

function testOf(test: DraftTest | null): readonly RowTest[] {
  if (test === null) return []
  const column = test.column.trim()
  return 'filled' in test ? [{ column, filled: true }] : [{ column, is: test.is.map((value) => value.trim()).filter((value) => value !== ''), anyCase: true }]
}

/**
 * The recipe a draft makes, with the id its record has, checked by `readRecipe` as a stored recipe is, or the draft's
 * problems. Every kind that comes in reads the same fields, and a day format with a time reads the time from the same column.
 */
export function tableRecipeOf(id: string, draft: TableRecipeDraft, fields: TableRecipeFields): { readonly recipe: Recipe<TableFile> } | { readonly problems: readonly DraftProblem[] } {
  const problems = draftProblems(draft, fields)
  if (problems.length > 0) return { problems }
  const read = readFields(draft, fields)
  const kinds: RowKind[] = draft.kinds.map(({ kind, test }) => ({ kind, when: testOf(test), fields: fields.kinds.find((known) => known.kind === kind)?.reads === true ? read : {} }))
  const name = draft.name.trim()
  const file: TableFile = { format: 'table' }
  const recipe = readRecipe(id, name, file, JSON.stringify([{ name, rows: '', keep: [], shown: [], fields: {}, kinds }]))
  if (recipe === null || recipe.file.format !== 'table') return { problems: [{ kind: 'unreadable' }] }
  return { recipe: { ...recipe, file } }
}

function draftTestOf(when: readonly RowTest[]): DraftTest | null | undefined {
  if (when.length === 0) return null
  const [test] = when
  if (when.length > 1 || test === undefined) return undefined
  if ('filled' in test) return { column: test.column, filled: true }
  return 'is' in test && test.anyCase === true ? { column: test.column, is: test.is } : undefined
}

/** The draft a table recipe was written as, for its editor, or null for one a draft cannot hold, such as Revolut's, whose kinds test two columns. */
export function draftOfRecipe(recipe: Recipe, fields: TableRecipeFields): TableRecipeDraft | null {
  const [section] = recipe.sections
  if (recipe.file.format !== 'table' || section === undefined || recipe.sections.length !== 1) return null
  const kinds = section.kinds.map((kind) => ({ kind: kind.kind, test: draftTestOf(kind.when) }))
  if (kinds.some((kind) => kind.test === undefined)) return null
  const read = { ...section.fields, ...section.kinds.find((kind) => fields.kinds.find((known) => known.kind === kind.kind)?.reads === true)?.fields }
  const date = read[fields.date]
  const amount = read[fields.amount]
  const debit = read[fields.debit]
  const credit = read[fields.credit]
  const marked = [amount, debit, credit].find((field) => field?.as === 'decimal')
  if (date?.as !== 'date' || marked?.as !== 'decimal' || marked.mark === undefined) return null
  const columns = fields.optional.flatMap(({ field }) => (read[field] === undefined ? [] : [[field, read[field].from] as const]))
  return {
    name: recipe.name,
    date: { column: date.from, format: date.formats[0] ?? '' },
    amount: amount === undefined ? { debit: debit?.from ?? '', credit: credit?.from ?? '' } : { column: amount.from },
    mark: marked.mark,
    columns: Object.fromEntries(columns),
    kinds: kinds.map((kind) => ({ kind: kind.kind, test: kind.test ?? null })),
  }
}
