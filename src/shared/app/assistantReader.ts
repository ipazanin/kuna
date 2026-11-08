import type { Exposure, FieldDoc, FieldDocs, StoredValue } from '../privacy/domain/exposure'
import type { FigureTrace } from '../ai/domain/chatElement'
import type { AccountMoney } from '../money/accountMoney'
import type { CurrencyCode } from '../money/currencyCode'
import type { Money } from '../money/money'
import type { RecordKind, RecordNoun } from '../storage/domain/recordKind'

/** One field of a record, handed to the chat as its exposure says. A field that never leaves is not among them. */
export type ReadableField =
  | { readonly name: string; readonly exposure: 'plain' | 'identifier' | 'party' | 'free-text'; readonly value: StoredValue }
  | { readonly name: string; readonly exposure: 'ref'; readonly to: string; readonly id: string | null }
  | { readonly name: string; readonly exposure: 'plain'; readonly of: 'account' | 'app'; readonly cents: number; readonly currency: string }

export interface ReadableRow {
  readonly id: string
  readonly fields: readonly ReadableField[]
}

/** A named part of a kind's rows that a search can keep to, such as the rows waiting on To review. */
export interface ReadableSet {
  readonly name: string
  readonly about: string
  /** The ids of the rows in it as the books stand. */
  ids(): ReadonlySet<string>
}

/** A kind of record the chat can read: what its fields mean, which needs no books, and its rows, which do. */
export interface ReadableKind {
  readonly name: string
  readonly noun: RecordNoun
  readonly about: string
  readonly fields: readonly { readonly name: string; readonly meaning: string; readonly exposure: Exposure; readonly amount: boolean }[]
  /** The field a date filter and the newest-first order read, or null for a kind with no date. */
  readonly dated: string | null
  rows(): readonly ReadableRow[]
  readonly sets?: readonly ReadableSet[]
  /** The route of the app's place that opens one record of this kind, which a link to one of its records fills in. */
  readonly page?: `/${string}`
}

export interface ReadableKindOf<R extends { readonly id: string }> {
  readonly kind: Pick<RecordKind<R>, 'name' | 'noun'>
  readonly about: string
  readonly fields: FieldDocs<R>
  readonly dated: (keyof R & string) | null
  rows(): readonly R[]
  /** The currency of the record's amounts. */
  currencyOf(record: R): string
  readonly sets?: readonly { readonly name: string; readonly about: string; holds(record: R): boolean }[]
  readonly page?: `/${string}`
}

function readableFields<R extends { readonly id: string }>(kind: ReadableKindOf<R>, record: R): readonly ReadableField[] {
  return (Object.entries(kind.fields) as [keyof R & string, FieldDoc<R>][]).flatMap(([name, doc]): ReadableField[] => {
    if (doc.exposure === 'never') {
      return []
    }
    if (doc.exposure === 'ref') {
      return [{ name, exposure: 'ref', to: doc.to, id: record[name] as string | null }]
    }
    if ('amount' in doc) {
      return [{ name, exposure: 'plain', of: doc.amount, cents: record[name] as number, currency: kind.currencyOf(record) }]
    }
    return [{ name, exposure: doc.exposure, value: doc.read === undefined ? (record[name] as StoredValue) : doc.read(record) }]
  })
}

/** A kind's stored records as the chat may have them, with the type of each kept to this one place. */
export function readableKind<R extends { readonly id: string }>(kind: ReadableKindOf<R>): ReadableKind {
  return {
    name: kind.kind.name,
    noun: kind.kind.noun,
    about: kind.about,
    fields: Object.entries<FieldDoc<R>>(kind.fields).map(([name, doc]) => ({ name, meaning: doc.meaning, exposure: doc.exposure, amount: 'amount' in doc })),
    dated: kind.dated,
    rows: () => kind.rows().map((record) => ({ id: record.id, fields: readableFields(kind, record) })),
    ...(kind.sets === undefined ? {} : { sets: kind.sets.map(({ name, about, holds }) => ({ name, about, ids: () => new Set(kind.rows().flatMap((record) => (holds(record) ? [record.id] : []))) })) }),
    ...(kind.page === undefined ? {} : { page: kind.page }),
  }
}

/** A figure Kuna computed: an amount in the app's own currency, an account's amount in the account's currency, a rate in basis points, or a count. */
export type ReportFigure =
  | { readonly label: string; readonly of: 'app'; readonly cents: Money; readonly currency: CurrencyCode }
  | { readonly label: string; readonly of: 'account'; readonly cents: AccountMoney; readonly currency: CurrencyCode }
  | { readonly label: string; readonly basisPoints: number }
  | { readonly label: string; readonly count: number }

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

/** The rules a trace cites, as the app's ruleset holds them. */
export interface TraceRules {
  /** The terms of each rule version the trace cites. */
  versionsOf(trace: FigureTrace): readonly object[]
  /** The day the rules' sources were last checked. */
  readonly checkedSince: string
}

/** What the chat can read of an app, once the person allows it. Nothing here writes. */
export interface AppReader {
  /** Whether the app's file is open in this page, so its records can be read. */
  status(): 'open' | 'opening' | 'none'
  readonly kinds: readonly ReadableKind[]
  readonly reports: readonly AssistantReport[]
  /** The rules behind the app's figure build-ups, for an app whose figures cite any. */
  readonly traceRules?: TraceRules
}
