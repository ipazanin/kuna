import { isReportKey } from './reportKey'
import { takesRowByHand } from '../../../../shared/app/accountSource'
import { firstUnfiledDay } from '../../tax/domain/taxDeadlines'
import { BY_HAND } from '../../workbook/domain/investmentAccount'
import type { AccountIntake } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { addDays, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A record that lands on accounts on a day, with the import key that says where it came from. */
export interface LandingRecord {
  readonly accounts: readonly RecordId[]
  readonly date: CivilDate
  readonly importKey: string | null
}

type LandingBook = Pick<InvestmentBook, 'accounts' | 'trades' | 'income' | 'cashMovements' | 'exchanges' | 'transfers' | 'mailReaders'>

/** Every record of the book that lands on an account. */
export function landingRecords(book: LandingBook): LandingRecord[] {
  return [
    ...[...book.trades, ...book.income, ...book.cashMovements, ...book.exchanges].map((record) => ({ accounts: [record.account], date: record.date, importKey: record.importKey })),
    ...book.transfers.map((transfer) => ({ accounts: [transfer.from, transfer.to], date: transfer.date, importKey: transfer.importKey })),
  ]
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
export function accountIntakes(book: LandingBook): ReadonlyMap<RecordId, AccountIntake> {
  const readerStart = new Map(book.mailReaders.flatMap((reader) => (reader.since === null ? [] : [[reader.recipe, reader.since] as const])))
  const derived = new Map<RecordId, AccountIntake>()
  for (const record of landingRecords(book)) {
    const startsOn = record.importKey !== null && isReportKey(record.importKey) ? readerStart.get(recipeOfKey(record.importKey)) : undefined
    if (startsOn === undefined) continue
    record.accounts.forEach((account) => derived.set(account, derived.get(account) ?? { rowsFrom: 'mail', startsOn }))
  }
  return new Map(book.accounts.map((account) => [account.id, account.intake ?? derived.get(account.id) ?? BY_HAND]))
}

/**
 * The book with each account that does not say how its rows come in saying it as it reads now, by `intakes`, and no reader
 * keeping the shared start day, which then no account needs.
 */
export function sourcesSaid(book: InvestmentBook, intakes: ReadonlyMap<RecordId, AccountIntake> = accountIntakes(book)): InvestmentBook {
  return {
    ...book,
    accounts: book.accounts.map((account) => (account.intake === null ? { ...account, intake: intakes.get(account.id) ?? BY_HAND } : account)),
    mailReaders: book.mailReaders.map((reader) => (reader.since === null ? reader : { ...reader, since: null })),
  }
}

/** An account whose rows of a day the mail brings, with its start day. */
export interface MailOwned {
  readonly account: RecordId
  readonly startsOn: CivilDate
}

/**
 * The account the mail fills on the record's day, which a record typed, copied or imported by hand may not land on, or
 * null when it may land on all of its accounts. A record of a report is the mail's own, mailed or uploaded.
 */
export function mailOwned(intakes: ReadonlyMap<RecordId, AccountIntake>, record: LandingRecord): MailOwned | null {
  if (record.importKey !== null && isReportKey(record.importKey)) return null
  for (const account of record.accounts) {
    const intake = intakes.get(account)
    if (intake !== undefined && intake.rowsFrom === 'mail' && !takesRowByHand(intake.rowsFrom, intake.startsOn, record.date)) return { account, startsOn: intake.startsOn }
  }
  return null
}

/**
 * The start day proposed when an account comes to take its rows from the mail: the day after its last record by hand, or
 * the day itself when it has none, and never in a tax year already filed.
 */
export function proposedMailStart(account: RecordId, records: readonly LandingRecord[], today: CivilDate): CivilDate {
  const byHand = records.filter((record) => record.accounts.includes(account) && (record.importKey === null || !isReportKey(record.importKey))).map((record) => record.date)
  const after =
    byHand.length === 0
      ? today
      : addDays(
          byHand.reduce((last, day) => (day > last ? day : last)),
          1,
        )
  const firstOpen = firstUnfiledDay(today)
  return after < firstOpen ? firstOpen : after
}

/** Why an account may not take its rows from the mail from its start day: a tax year already filed it reaches into, or records by hand on its days. */
export type IntakeRefusal =
  { readonly kind: 'filed-year'; readonly year: number; readonly firstOpen: CivilDate } | { readonly kind: 'rows-by-hand'; readonly count: number; readonly startsOn: CivilDate }

/**
 * Why the account's new intake may not be written, or null when it may. Only a change that gives the mail days it did not
 * have is checked, since a later start day or a switch to by hand brings no report row in. Such a start day may not reach
 * into a tax year already filed, which the report's rows would change, and no record by hand may sit on the days it gives the mail.
 */
export function intakeRefusal(account: RecordId, before: AccountIntake | null, after: AccountIntake, records: readonly LandingRecord[], today: CivilDate): IntakeRefusal | null {
  if (after.rowsFrom !== 'mail') return null
  if (before?.rowsFrom === 'mail' && after.startsOn >= before.startsOn) return null
  const firstOpen = firstUnfiledDay(today)
  if (after.startsOn < firstOpen) return { kind: 'filed-year', year: yearOf(after.startsOn), firstOpen }
  const intakes = new Map([[account, after]])
  const count = records.filter((record) => record.accounts.includes(account) && mailOwned(intakes, record) !== null).length
  return count === 0 ? null : { kind: 'rows-by-hand', count, startsOn: after.startsOn }
}

/** The earliest start day of the accounts the mail fills, where its search starts, or null while it fills none. */
export function earliestMailStart(intakes: ReadonlyMap<RecordId, AccountIntake>): CivilDate | null {
  const days = [...intakes.values()].flatMap((intake) => (intake.rowsFrom === 'mail' ? [intake.startsOn] : []))
  return days.length === 0 ? null : days.reduce((first, day) => (day < first ? day : first))
}
