import type { AmountSign, Exposure, FieldDoc, FieldDocs, StoredValue } from '../privacy/domain/exposure'
import type { FigureTrace } from '../ai/domain/chatElement'
import type { CivilDate } from '../calendar/civilDate'
import type { AccountMoney } from '../money/accountMoney'
import type { CurrencyCode } from '../money/currencyCode'
import { decimalText } from '../money/decimal'
import type { Decimal } from '../money/decimal'
import type { Money } from '../money/money'
import type { Booking } from '../money/lookAlikeBookings'
import type { RecordKind, RecordNoun } from '../storage/domain/recordKind'

/** One field of a record, handed to the chat as its exposure says. A field that never leaves is not among them. */
export type ReadableField =
  | { readonly name: string; readonly exposure: 'plain' | 'identifier' | 'party' | 'free-text'; readonly value: StoredValue }
  | { readonly name: string; readonly exposure: 'ref'; readonly to: string; readonly id: string | null }
  | { readonly name: string; readonly exposure: 'plain'; readonly of: 'account' | 'app'; readonly cents: number; readonly currency: string }
  /** A decimal amount, which leaves as its text, such as `12.5 USD`, and compares as the decimal. */
  | { readonly name: string; readonly exposure: 'plain'; readonly value: string; readonly decimal: Decimal }

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
  /** Each field, with the sign of an amount and null for any other field. */
  readonly fields: readonly { readonly name: string; readonly meaning: string; readonly exposure: Exposure; readonly amount: AmountSign | null }[]
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
      const cents = record[name] as number | null
      return [cents === null ? { name, exposure: 'plain', value: null } : { name, exposure: 'plain', of: doc.amount, cents, currency: kind.currencyOf(record) }]
    }
    if ('decimal' in doc) {
      const held = doc.decimal(record)
      return [held === null ? { name, exposure: 'plain', value: null } : { name, exposure: 'plain', value: `${decimalText(held.amount)} ${held.currency}`, decimal: held.amount }]
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
    fields: Object.entries<FieldDoc<R>>(kind.fields).map(([name, doc]) => ({ name, meaning: doc.meaning, exposure: doc.exposure, amount: 'sign' in doc ? doc.sign : null })),
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
  /** Set on a report that holds employees' pay, which stays on the device while Anonymise is on and the app knows an employee. */
  readonly employees?: true
  /** The figures of the period, or of the current one for null. Throws a RangeError for a period that does not read as one. */
  figures(period: string | null): readonly ReportFigure[]
}

/** The rules a trace cites, as the app's ruleset holds them. */
export interface TraceRules {
  /** The terms of each rule version the trace cites. */
  versionsOf(trace: FigureTrace): readonly object[]
  /** The day the rules' sources were last checked. */
  readonly checkedSince: string
  /** The ref kind a rule's page takes as its parameter, so a build-up hands out a ref for each rule it cites. */
  readonly ruleKind?: string
}

/** What the chat can read of an app, once the person allows it. Nothing here writes. */
export interface AppReader {
  /** Whether the app's file is open in this page, so its records can be read. */
  status(): 'open' | 'opening' | 'none'
  readonly kinds: readonly ReadableKind[]
  readonly reports: readonly AssistantReport[]
  /** The rules behind the app's figure build-ups, for an app whose figures cite any. */
  readonly traceRules?: TraceRules
  /** The bookings of each bank account, which rows copied off a statement are matched against, for an app that keeps any. */
  readonly bookings?: AccountBookings
  /** The payments a fiscal receipt may be, for an app that splits payments by receipts. */
  readonly receipts?: ReceiptPayments
}

/** A fiscal receipt as the chat read it, with the photo it was read off when there is one. */
export interface ReceiptRead {
  readonly date: CivilDate
  readonly total: Money
  readonly merchant: string
  readonly photo: Blob | null
}

/** A payment a receipt may be: the record that holds it, its day and amount, and how far its amount is from the receipt's total. */
export interface ReceiptCandidateRead {
  readonly id: string
  readonly date: CivilDate
  readonly amount: AccountMoney
  readonly difference: AccountMoney
  readonly currency: CurrencyCode
}

/**
 * What an app found for a receipt: the date and total it matched on, the QR code's when the photo holds one, and one payment
 * ready, several to pick from, or none.
 */
export interface ReceiptPaymentsFound {
  readonly date: CivilDate
  readonly total: Money
  readonly fromCode: boolean
  readonly match: 'ready' | 'pick' | 'none'
  readonly candidates: readonly ReceiptCandidateRead[]
}

/** An app's payments as a fiscal receipt is matched against them. */
export interface ReceiptPayments {
  /** The kind of the records a receipt may split, such as Spending's transactions. */
  readonly kind: string
  match(receipt: ReceiptRead): Promise<ReceiptPaymentsFound>
}

/** A booking in the books, by the id of the record that holds it. */
export interface BookedRecord {
  readonly id: string
  readonly booking: Booking<Money | AccountMoney>
}

/** An app's bookings by bank account, as a statement's rows are matched against them. */
export interface AccountBookings {
  /** The kind of the records that hold the bookings, such as Spending's transactions. */
  readonly kind: string
  /** The kind of the record an account's ref names. */
  readonly accountKind: string
  /** Every booking of the account, of any source, or null for an account the books do not hold. */
  of(account: string): readonly BookedRecord[] | null
  /** The account when the books hold exactly one, or null. */
  onlyAccount(): string | null
}
