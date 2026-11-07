import type { RecordKind, RecordNoun } from '../storage/domain/recordKind'

/**
 * How a stored field may leave the device.
 * - `plain`: as stored, such as a date, a flag or a name the owner gave a category.
 * - `ref`: the id of a record, as a ref that lasts one chat.
 * - `money`: an amount, which is ordinary data for reading.
 * - `counterparty`: who was paid or who paid, as an alias only when it names a person, so a shop's name still helps to sort a row.
 * - `person`, `iban`, `oib`, `address`: always as an alias while anonymising is on.
 * - `free-text`: what someone wrote, with anything in it that reads as one of those replaced by an alias.
 * - `never-read`: never, and the reader does not hand it over at all.
 */
export type FieldClass = 'plain' | 'ref' | 'money' | 'counterparty' | 'person' | 'iban' | 'oib' | 'address' | 'free-text' | 'never-read'

export type StoredValue = string | number | boolean | null

/** A field that goes as text or a flag, with `read` for one stored in another shape. */
interface ValueField<R> {
  readonly meaning: string
  readonly class: 'plain' | 'counterparty' | 'person' | 'iban' | 'oib' | 'address' | 'free-text'
  readonly read?: (record: R) => StoredValue
}

/** What a field means and how it may leave the device. */
export type FieldDoc<R> =
  | ValueField<R>
  | { readonly meaning: string; readonly class: 'ref'; readonly to: string }
  | { readonly meaning: string; readonly class: 'money' }
  | { readonly meaning: string; readonly class: 'never-read' }

/** Every stored field of a record type, with no default, so a new field fails the typecheck until someone classifies it. */
export type FieldDocs<R> = { readonly [Field in keyof R]-?: FieldDoc<R> }

/** One field of a record, handed to the chat as its class says. A `never-read` field is not among them. */
export type ReadableField =
  | { readonly name: string; readonly class: ValueField<never>['class']; readonly value: StoredValue }
  | { readonly name: string; readonly class: 'ref'; readonly to: string; readonly id: string | null }
  | { readonly name: string; readonly class: 'money'; readonly cents: number; readonly currency: string }

export interface ReadableRow {
  readonly id: string
  readonly fields: readonly ReadableField[]
}

/** A kind of record the chat can read: what its fields mean, which needs no books, and its rows, which do. */
export interface ReadableKind {
  readonly name: string
  readonly noun: RecordNoun
  readonly about: string
  readonly fields: readonly { readonly name: string; readonly meaning: string; readonly class: FieldClass }[]
  /** The field a date filter and the newest-first order read, or null for a kind with no date. */
  readonly dated: string | null
  rows(): readonly ReadableRow[]
}

export interface ReadableKindOf<R extends { readonly id: string }> {
  readonly kind: RecordKind<R>
  readonly about: string
  readonly fields: FieldDocs<R>
  readonly dated: (keyof R & string) | null
  rows(): readonly R[]
  /** The currency of the record's amounts. */
  currencyOf(record: R): string
}

function readableFields<R extends { readonly id: string }>(kind: ReadableKindOf<R>, record: R): readonly ReadableField[] {
  return (Object.entries(kind.fields) as [keyof R & string, FieldDoc<R>][]).flatMap(([name, doc]): ReadableField[] => {
    switch (doc.class) {
      case 'never-read':
        return []
      case 'ref':
        return [{ name, class: 'ref', to: doc.to, id: record[name] as string | null }]
      case 'money':
        return [{ name, class: 'money', cents: record[name] as number, currency: kind.currencyOf(record) }]
      default:
        return [{ name, class: doc.class, value: doc.read === undefined ? (record[name] as StoredValue) : doc.read(record) }]
    }
  })
}

/** A kind's stored records as the chat may have them, with the type of each kept to this one place. */
export function readableKind<R extends { readonly id: string }>(kind: ReadableKindOf<R>): ReadableKind {
  return {
    name: kind.kind.name,
    noun: kind.kind.noun,
    about: kind.about,
    fields: Object.entries<FieldDoc<R>>(kind.fields).map(([name, doc]) => ({ name, meaning: doc.meaning, class: doc.class })),
    dated: kind.dated,
    rows: () => kind.rows().map((record) => ({ id: record.id, fields: readableFields(kind, record) })),
  }
}

/** A figure Kuna computed: an amount, a rate in basis points, or a count. */
export type ReportFigure =
  { readonly label: string; readonly cents: number; readonly currency: string } | { readonly label: string; readonly basisPoints: number } | { readonly label: string; readonly count: number }

/** Named figures from the app's own functions, for a month or a day. */
export interface AssistantReport {
  readonly id: string
  /** What a person reads on the row that shows this report went. */
  readonly title: string
  readonly about: string
  readonly period: 'month' | 'day'
  /** The figures of the period, or of the current one for null. Throws a RangeError for a period that does not read as one. */
  figures(period: string | null): readonly ReportFigure[]
}

/** What the chat can read of an app, once the person allows it. Nothing here writes. */
export interface AppReader {
  /** Whether the app's file is open in this page, so its records can be read. */
  status(): 'open' | 'opening' | 'none'
  readonly kinds: readonly ReadableKind[]
  readonly reports: readonly AssistantReport[]
}
