import { holdsReportKey, isAskedKey, isReportKey } from './reportKey'
import { givenDays, handedDays, inHandedDays, periodsChangeRefusal, proposedStartDay, sourceOn, takesRowOn } from '../../../../shared/app/accountSource'
import type { GivenDays, HandedDays, PeriodsChangeRefusal, RowOrigin } from '../../../../shared/app/accountSource'
import { firstUnfiledDay } from '../../tax/domain/taxDeadlines'
import { BY_HAND_SOURCES } from '../../workbook/domain/investmentAccount'
import type { InvestmentPeriod, InvestmentSource } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A record that lands on accounts on a day, with the import keys that say where it came from. */
export interface LandingRecord {
  readonly id: RecordId
  readonly accounts: readonly RecordId[]
  readonly date: CivilDate
  readonly importKeys: readonly string[]
}

type LandingBook = Pick<InvestmentBook, 'accounts' | 'trades' | 'income' | 'cashMovements' | 'exchanges' | 'transfers' | 'mailReaders'>

/** A record that lands on an account, as the kinds that move money or units hold it. */
export type LandingKind = { readonly id: RecordId; readonly date: CivilDate; readonly importKeys: readonly string[] } & (
  { readonly account: RecordId } | { readonly from: RecordId; readonly to: RecordId }
)

export function landingOf(record: LandingKind): LandingRecord {
  return { id: record.id, accounts: 'account' in record ? [record.account] : [record.from, record.to], date: record.date, importKeys: record.importKeys }
}

/** Every record of the book that lands on an account. */
export function landingRecords(book: LandingBook): LandingRecord[] {
  return [...book.trades, ...book.income, ...book.cashMovements, ...book.exchanges, ...book.transfers].map(landingOf)
}

/** The record of the book with the id as it lands on its accounts, or null when the book has none. */
export function landingRecordOf(book: LandingBook, id: RecordId): LandingRecord | null {
  const record = [...book.trades, ...book.income, ...book.cashMovements, ...book.exchanges, ...book.transfers].find((candidate) => candidate.id === id)
  return record === undefined ? null : landingOf(record)
}

/** The recipe a report's import key names, the part before its first colon. */
function recipeOfKey(key: string): string {
  return key.slice(0, key.indexOf(':'))
}

/**
 * Where each account's rows come from. An account that does not say, from a file kept before each account had its own start
 * day, reads as filled by the mail from the day its reader started when it holds a record of that reader's report, and by
 * hand otherwise.
 */
export function accountSources(book: LandingBook): ReadonlyMap<RecordId, readonly InvestmentPeriod[]> {
  const readerStart = new Map(book.mailReaders.flatMap((reader) => (reader.since === null ? [] : [[reader.recipe, reader.since] as const])))
  const derived = new Map<RecordId, readonly InvestmentPeriod[]>()
  for (const record of landingRecords(book)) {
    // A booked question's key reads as a report's, but a question uploaded by hand says nothing of where an account's rows come from.
    const startsOn = record.importKeys.flatMap((key) => (isReportKey(key) && !isAskedKey(key) ? (readerStart.get(recipeOfKey(key)) ?? []) : []))[0]
    if (startsOn === undefined) continue
    record.accounts.forEach((account) => derived.set(account, derived.get(account) ?? [{ source: 'mail', from: startsOn }]))
  }
  return new Map(book.accounts.map((account) => [account.id, account.sources ?? derived.get(account.id) ?? BY_HAND_SOURCES]))
}

/**
 * The book with each account that does not say where its rows come from saying it as it reads now, by `sources`, and no reader
 * keeping the shared start day, which then no account needs.
 */
export function sourcesSaid(book: InvestmentBook, sources: ReadonlyMap<RecordId, readonly InvestmentPeriod[]> = accountSources(book)): InvestmentBook {
  return {
    ...book,
    accounts: book.accounts.map((account) => (account.sources === null ? { ...account, sources: sources.get(account.id) ?? BY_HAND_SOURCES } : account)),
    mailReaders: book.mailReaders.map((reader) => (reader.since === null ? reader : { ...reader, since: null })),
  }
}

/** Whether a write adds the record, or moves it to another account or day. A fix that keeps both, such as of its note, lands nothing new. */
export function landsAnew(before: LandingRecord | null, after: LandingRecord): boolean {
  return before === null || before.date !== after.date || before.accounts.join(' ') !== after.accounts.join(' ')
}

/** Whether the record came from IBKR's report, mailed or uploaded, which only the report's own import may bring: it holds any report key. Any other is by hand. */
function fromReport(record: Pick<LandingRecord, 'importKeys'>): boolean {
  return holdsReportKey(record.importKeys)
}

/**
 * Where a record on the account came from, as its periods read it. A record of IBKR's report came from the mail on a day the
 * mail fills and from an uploaded report on any other day, since the two carry the same report. Any other is by hand.
 */
export function landingOrigin(record: Pick<LandingRecord, 'date' | 'importKeys'>, sources: readonly InvestmentPeriod[]): RowOrigin {
  if (!fromReport(record)) return 'by-hand'
  return sourceOn(sources, record.date) === 'mail' ? 'automation' : 'provider-file'
}

/**
 * The account the record may not land on, or null when it may land on all of its accounts. A record of a report the import of
 * the report checked. Any other record is by hand, which goes only on a day an account keeps by hand.
 */
export function mailOwned(sources: ReadonlyMap<RecordId, readonly InvestmentPeriod[]>, record: LandingRecord): RecordId | null {
  if (fromReport(record)) return null
  return (
    record.accounts.find((account) => {
      const periods = sources.get(account)
      return periods !== undefined && !takesRowOn(periods, record.date, 'by-hand')
    }) ?? null
  )
}

/** The day of each record by hand on the account. */
function handDays(account: RecordId, records: readonly LandingRecord[]): CivilDate[] {
  return records.filter((record) => record.accounts.includes(account) && !fromReport(record)).map((record) => record.date)
}

/** The start day proposed when an account comes to take its rows from the mail: the day after its last record by hand, or today, and never in a tax year already filed. */
export function proposedMailStart(account: RecordId, records: readonly LandingRecord[], today: CivilDate): CivilDate {
  return proposedStartDay(handDays(account, records), today, firstUnfiledDay(today))
}

/** The account's records, each by its day and where it came from as `sources` reads it. */
function datedOrigins(account: RecordId, records: readonly LandingRecord[], sources: readonly InvestmentPeriod[]): { readonly date: CivilDate; readonly origin: RowOrigin }[] {
  return records.filter((record) => record.accounts.includes(account)).map((record) => ({ date: record.date, origin: landingOrigin(record, sources) }))
}

/**
 * Why the account's new periods may not be written, or null when they may, as `periodsChangeRefusal` says, with a tax year
 * already filed as the days the report's rows may not change. `records` are the book's as the write leaves them, each read by
 * the periods it came in under: one already in by `before`, one the write puts back by `after`.
 */
export function sourcesRefusal(
  account: RecordId,
  before: readonly InvestmentPeriod[],
  after: readonly InvestmentPeriod[],
  records: { readonly kept: readonly LandingRecord[]; readonly back: readonly LandingRecord[] },
  firstOpen: CivilDate | null,
): PeriodsChangeRefusal | null {
  const rows = [...datedOrigins(account, records.kept, before), ...datedOrigins(account, records.back, after)]
  return periodsChangeRefusal(before, after, rows, firstOpen)
}

/** What giving an account's days to another source does: the records on those days the new source does not take go, and the new source brings its own. */
export interface SourceHandover {
  readonly runs: readonly HandedDays<InvestmentSource>[]
  readonly given: readonly GivenDays<InvestmentSource>[]
  /** The ids of the records that go. */
  readonly records: readonly RecordId[]
}

/** What giving the account the periods does, or null when no day changes source. Each record's origin is read by the periods it came in under. */
export function sourceHandover(account: RecordId, before: readonly InvestmentPeriod[], after: readonly InvestmentPeriod[], records: readonly LandingRecord[]): SourceHandover | null {
  const runs = handedDays(before, after)
  const given = givenDays(before, after)
  if (runs.length + given.length === 0) return null
  const days = [...runs, ...given]
  const going = records.filter((record) => record.accounts.includes(account) && inHandedDays(days, record.date) && !takesRowOn(after, record.date, landingOrigin(record, before)))
  return { runs, given, records: going.map((record) => record.id) }
}
