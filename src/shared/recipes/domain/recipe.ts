import type { DecimalMark } from '../../money/decimal'

/**
 * A saved description of how to read a document, which Kuna's own code runs. It is data, so it can do nothing but
 * produce rows, and a person or the chat can read and write it. A recipe that stops fitting fails and never guesses.
 */
export interface Recipe<File extends RecipeFile = RecipeFile> {
  readonly id: string
  /** What the screens call the document, such as IBKR's Activity Flex report. */
  readonly name: string
  readonly file: File
  /** A table file holds one section, under the first row that names every column the section reads. */
  readonly sections: readonly RecipeSection[]
}

/** An XML file and the root element it starts with. */
export interface XmlFile {
  readonly format: 'xml'
  readonly root: string
}

/** A spreadsheet or a CSV file whose rows sit under a header row. */
export interface TableFile {
  readonly format: 'table'
}

export type RecipeFile = XmlFile | TableFile

/** Where rows are in a file, and what each row is. A row no kind takes is asked about, never guessed at. */
export interface RecipeSection {
  readonly name: string
  /** A section element and its row element, such as `Trades/Trade`. A table file leaves it blank. */
  readonly rows: string
  /** Only rows that pass every test belong to the section. Other rows of the file are not the document's business. */
  readonly keep: readonly RowTest[]
  /** The columns a question about a row shows, each only where the row has it. */
  readonly shown: readonly string[]
  /** Fields every kind of the section reads. */
  readonly fields: RecipeFields
  /** The first kind whose tests a row passes takes it. */
  readonly kinds: readonly RowKind[]
}

export interface RowKind {
  /** The name the code reading the rows knows it by. */
  readonly kind: string
  readonly when: readonly RowTest[]
  /** Fields this kind reads beyond the section's. */
  readonly fields: RecipeFields
}

export type RecipeFields = Readonly<Record<string, RecipeField>>

/**
 * A test on one column of a row: its text is one of these, in any case where `anyCase` says so, each of its parts is one of
 * these (so a blank passes), or its number is above or below zero.
 */
export type RowTest =
  | { readonly column: string; readonly is: readonly string[]; readonly anyCase?: true }
  | { readonly column: string; readonly partsWithin: readonly string[]; readonly separator: string }
  | { readonly column: string; readonly sign: 'above-zero' | 'below-zero' }

/**
 * How one field of a record is read from its column. A blank cell makes the row a question unless `blank` allows it.
 * `part` takes one piece of the text, such as the EUR of `EUR.USD`. A date or a time gives the formats it may be written
 * in, using yyyy, MM, dd, HH, mm and ss, and a time reads the same column as its date. A decimal written with a decimal
 * comma, or with thousands grouped, names its `mark`. Without one it is read as a record stores it, such as `-12.5`.
 */
export type RecipeField =
  | { readonly from: string; readonly as: 'text'; readonly blank?: true }
  | { readonly from: string; readonly as: 'decimal'; readonly blank?: true; readonly mark?: DecimalMark }
  | { readonly from: string; readonly as: 'currency'; readonly blank?: true; readonly part?: { readonly separator: string; readonly at: number } }
  | { readonly from: string; readonly as: 'date' | 'time'; readonly formats: readonly string[]; readonly blank?: true }

/** The columns a section reads from its rows, whichever kind a row turns out to be. Columns it only shows may be absent. */
export function sectionColumns(section: RecipeSection): string[] {
  const ofFields = (fields: RecipeFields): string[] => Object.values(fields).map((field) => field.from)
  const ofTests = (tests: readonly RowTest[]): string[] => tests.map((test) => test.column)
  return [...new Set([...ofTests(section.keep), ...ofFields(section.fields), ...section.kinds.flatMap((kind) => [...ofTests(kind.when), ...ofFields(kind.fields)])])]
}

/** One row of a file by its column names, as text. A column the file does not give is absent, which differs from a blank cell. */
export type SourceRow = ReadonlyMap<string, string>

/** The rows of each section by the section's name. A section the file does not hold is absent. */
export type SourceRows = ReadonlyMap<string, readonly SourceRow[]>

/** Why a file does not fit its recipe, which stops the whole file. */
export type RecipeMisfit =
  | { readonly kind: 'not-readable' }
  | { readonly kind: 'no-root'; readonly root: string }
  | { readonly kind: 'no-section'; readonly section: string }
  | { readonly kind: 'no-column'; readonly section: string; readonly column: string }
