import { isReportKey } from './reportKey'
import { BY_HAND, proposedStartDay, startDayRefusal, takesRowFrom } from '../../../../shared/app/accountSource'
import type { StartDayRefusal } from '../../../../shared/app/accountSource'
import { firstUnfiledDay } from '../../tax/domain/taxDeadlines'
import type { InvestmentIntake } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A record that lands on accounts on a day, with the import key that says where it came from. */
export interface LandingRecord {
  readonly accounts: readonly RecordId[]
  readonly date: CivilDate
  readonly importKey: string | null
}

type LandingBook = Pick<InvestmentBook, 'accounts' | 'trades' | 'income' | 'cashMovements' | 'exchanges' | 'transfers' | 'mailReaders'>

/** A record that lands on an account, as the kinds that move money or units hold it. */
export type LandingKind = { readonly date: CivilDate; readonly importKey: string | null } & ({ readonly account: RecordId } | { readonly from: RecordId; readonly to: RecordId })

export function landingOf(record: LandingKind): LandingRecord {
  return { accounts: 'account' in record ? [record.account] : [record.from, record.to], date: record.date, importKey: record.importKey }
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
 * How each account's rows come in. An account that does not say, from a file kept before each account had its own start
 * day, reads as filled by the mail from the day its reader started when it holds a record of that reader's report, and by
 * hand otherwise.
 */
export function accountIntakes(book: LandingBook): ReadonlyMap<RecordId, InvestmentIntake> {
  const readerStart = new Map(book.mailReaders.flatMap((reader) => (reader.since === null ? [] : [[reader.recipe, reader.since] as const])))
  const derived = new Map<RecordId, InvestmentIntake>()
  for (const record of landingRecords(book)) {
    const startsOn = record.importKey !== null && isReportKey(record.importKey) ? readerStart.get(recipeOfKey(record.importKey)) : undefined
    if (startsOn === undefined) continue
    record.accounts.forEach((account) => derived.set(account, derived.get(account) ?? { rowsFrom: 'mail', startsOn, alsoFrom: [] }))
  }
  return new Map(book.accounts.map((account) => [account.id, account.intake ?? derived.get(account.id) ?? BY_HAND]))
}

/**
 * The book with each account that does not say how its rows come in saying it as it reads now, by `intakes`, and no reader
 * keeping the shared start day, which then no account needs.
 */
export function sourcesSaid(book: InvestmentBook, intakes: ReadonlyMap<RecordId, InvestmentIntake> = accountIntakes(book)): InvestmentBook {
  return {
    ...book,
    accounts: book.accounts.map((account) => (account.intake === null ? { ...account, intake: intakes.get(account.id) ?? BY_HAND } : account)),
    mailReaders: book.mailReaders.map((reader) => (reader.since === null ? reader : { ...reader, since: null })),
  }
}

/** Whether a write adds the record, or moves it to another account or day. A fix that keeps both, such as of its note, lands nothing new. */
export function landsAnew(before: LandingRecord | null, after: LandingRecord): boolean {
  return before === null || before.date !== after.date || before.accounts.join(' ') !== after.accounts.join(' ')
}

/** Whether the record came from IBKR's report, mailed or uploaded, which only the report's own import may bring. Any other is by hand. */
function fromReport(record: LandingRecord): boolean {
  return record.importKey !== null && isReportKey(record.importKey)
}

/**
 * The account the mail fills that the record may not land on, or null when it may land on all of its accounts. A record of a
 * report is the mail's own, since the import of an uploaded report checks what the account allows. Any other record is by
 * hand, which an account the mail fills takes on no day.
 */
export function mailOwned(intakes: ReadonlyMap<RecordId, InvestmentIntake>, record: LandingRecord): RecordId | null {
  if (fromReport(record)) return null
  return (
    record.accounts.find((account) => {
      const intake = intakes.get(account)
      return intake !== undefined && intake.rowsFrom === 'mail' && !takesRowFrom(intake.rowsFrom, intake.alsoFrom, 'by-hand')
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

/**
 * Why the account's new intake may not be written, or null when it may, as `startDayRefusal` says, with a tax year already
 * filed as the days the report's rows may not change. Records by hand from before the start day stay, and Holdings and Tax keep their cost.
 */
export function intakeRefusal(account: RecordId, before: InvestmentIntake | null, after: InvestmentIntake, records: readonly LandingRecord[], today: CivilDate): StartDayRefusal | null {
  return startDayRefusal(before, after, handDays(account, records), firstUnfiledDay(today))
}
