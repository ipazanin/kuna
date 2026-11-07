/**
 * A saved description of how to read a document, which Kuna's own code runs. It is data, so it can do nothing but
 * produce rows, and a person or the chat can read and write it. A recipe that stops fitting fails and never guesses.
 */
export interface Recipe {
  readonly id: string
  /** What the screens call the document, such as IBKR's Activity Flex report. */
  readonly name: string
  /** The mail it is expected in, until the person changes that. */
  readonly mail: RecipeMail
  readonly file: RecipeFile
  readonly sections: readonly RecipeSection[]
}

/** Which mail holds the document: its senders, and a phrase of its subject and of its contents, blank for any. */
export interface RecipeMail {
  readonly senders: readonly string[]
  readonly subject: string
  readonly contents: string
}

/** The format of the file, and the root element it starts with. */
export interface RecipeFile {
  readonly format: 'xml'
  readonly root: string
}

/** Where rows are in a file, and what each row is. A row no kind takes is asked about, never guessed at. */
export interface RecipeSection {
  readonly name: string
  /** A section element and its row element, such as `Trades/Trade`. */
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
 * A test on one column of a row: its text is one of these, each of its parts is one of these (so a blank passes), or its
 * number is above or below zero.
 */
export type RowTest =
  | { readonly column: string; readonly is: readonly string[] }
  | { readonly column: string; readonly partsWithin: readonly string[]; readonly separator: string }
  | { readonly column: string; readonly sign: 'above-zero' | 'below-zero' }

/**
 * How one field of a record is read from its column. A blank cell makes the row a question unless `blank` allows it.
 * `part` takes one piece of the text, such as the EUR of `EUR.USD`. A date or a time gives the formats it may be written
 * in, using yyyy, MM, dd, HH, mm and ss, and a time reads the same column as its date.
 */
export type RecipeField =
  | { readonly from: string; readonly as: 'text'; readonly blank?: true }
  | { readonly from: string; readonly as: 'decimal'; readonly blank?: true }
  | { readonly from: string; readonly as: 'currency'; readonly blank?: true; readonly part?: { readonly separator: string; readonly at: number } }
  | { readonly from: string; readonly as: 'date' | 'time'; readonly formats: readonly string[]; readonly blank?: true }

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
