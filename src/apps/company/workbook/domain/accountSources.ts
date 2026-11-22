import { isBankStatementRow } from './rowOrigin'
import type { AccountRecord } from './accountsReading'
import { BY_HAND_SOURCES } from './workbook'
import type { Account, CompanyPeriod, Transaction } from './workbook'
import { waitingStatements } from './heldStatements'
import type { HeldStatement } from './heldStatements'
import { periodTallies, runsOf, sourceOn } from '../../../../shared/app/accountSource'
import type { DatedOrigin, PeriodTally, RowOrigin } from '../../../../shared/app/accountSource'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import { booleanOf, heldSettingValue } from '../../settings/domain/settings'
import type { CompanySource } from './workbook'

type LedgerRow = Pick<Transaction, 'account' | 'date' | 'sequence' | 'statement' | 'reference'>

type DatedRow = Pick<Transaction, 'account' | 'date' | 'statement' | 'reference'>

/**
 * Where a ledger row came from, as the account's periods read it. A row of the bank's own camt statement came from the mail on a
 * day the mail fills and from the bank's file on any other day, since the two carry the same statement. Any other row is by hand.
 */
export function ledgerRowOrigin(row: Pick<Transaction, 'date' | 'statement' | 'reference'>, sources: readonly CompanyPeriod[]): RowOrigin {
  if (!isBankStatementRow(row)) return 'by-hand'
  return sourceOn(sources, row.date) === 'mail' ? 'automation' : 'provider-file'
}

/** The account's rows, each by its day and where it came from as the periods read it. */
export function datedOriginsOf(account: Pick<Account, 'slug'>, sources: readonly CompanyPeriod[], ledger: readonly DatedRow[]): DatedOrigin[] {
  return ledger.filter((row) => row.account === account.slug).map((row) => ({ date: row.date, origin: ledgerRowOrigin(row, sources) }))
}

/** Each of the account's periods with how many of its rows each origin brought on its days. */
export function sourceTallies(account: Pick<Account, 'slug' | 'sources'>, ledger: readonly DatedRow[]): readonly PeriodTally<CompanySource>[] {
  return periodTallies(account.sources, datedOriginsOf(account, account.sources, ledger))
}

/**
 * The periods of an account that does not say, from a file kept before each account said how its rows come in. While the
 * statements folder was filed on each sync, an account whose newest row came from a camt statement reads as filled by the mail
 * from the first day of the statements after its last row by hand, and not before the day after that row. The days before take
 * no row. Any other account reads as by hand. It reads the ledger alone, so the day it says does not move with today.
 */
export function derivedSources(account: Pick<Account, 'slug'>, ledger: readonly LedgerRow[], folderFiled: boolean): readonly CompanyPeriod[] {
  if (!folderFiled) return BY_HAND_SOURCES
  const rows = ledger.filter((row) => row.account === account.slug).sort((earlier, later) => earlier.sequence - later.sequence)
  const newest = rows[rows.length - 1]
  if (newest === undefined || !isBankStatementRow(newest)) return BY_HAND_SOURCES
  const lastByHand = rows.map((row) => isBankStatementRow(row)).lastIndexOf(false)
  const firstStatementDay = rows[lastByHand + 1]!.date
  const afterHand = lastByHand === -1 ? firstStatementDay : addDays(rows[lastByHand]!.date, 1)
  return [{ source: 'mail', from: afterHand > firstStatementDay ? afterHand : firstStatementDay }]
}

/**
 * Whether the statements folder was filed on each sync, as a file from before each account said how its rows come in holds it:
 * a folder named, and the sync switch not off. It reads the stored rows, since the switch is no longer a setting.
 */
export function folderFiledOnSync(settingRows: RecordsRead<SettingRow>): boolean {
  const folder = heldSettingValue(settingRows, 'statements_folder') ?? ''
  const sync = heldSettingValue(settingRows, 'statements_sync') ?? ''
  return folder.trim() !== '' && booleanOf(sync) !== false
}

/** The accounts with the periods each says, or derives when it does not. A write of an account then stores them. */
export function accountsWithSources(accounts: readonly Omit<AccountRecord, 'id'>[], ledger: readonly LedgerRow[], folderFiled: boolean): Account[] {
  return accounts.map((account) => ({ ...account, sources: account.sources ?? derivedSources(account, ledger, folderFiled) }))
}

/**
 * The day the bank's statement mail must still reach back to, or null while the mail fills no account: the day the mail was last
 * read up to, which the books keep, or before the first read the newest day of a statement row the mail filled. An account that
 * goes quiet no longer holds it back. A run of days the mail fills that holds no statement row yet, such as a new account's or one
 * a start moved earlier, reaches back to its first day, and a statement the books remember as held and waiting reaches back to the
 * day its mail came.
 */
export function statementMailReach(
  accounts: readonly Pick<Account, 'slug' | 'sources'>[],
  ledger: readonly DatedRow[],
  held: readonly Pick<HeldStatement, 'mailedOn' | 'passedOverOn'>[],
  readTo: CivilDate | null,
): CivilDate | null {
  const runs = accounts.flatMap((account) => runsOf(account.sources, 'mail').map((run) => ({ ...run, account: account.slug })))
  if (runs.length === 0) return null
  const filled = (run: (typeof runs)[number]): DatedRow[] =>
    ledger.filter((row) => row.account === run.account && isBankStatementRow(row) && (run.from === null || row.date >= run.from) && (run.to === null || row.date <= run.to))
  const unfilled = runs.flatMap((run) => (run.from !== null && filled(run).length === 0 ? [run.from] : []))
  const newest = runs.flatMap(filled).reduce<CivilDate | null>((last, row) => (last === null || row.date > last ? row.date : last), null)
  const last = readTo ?? newest
  const days = [...unfilled, ...(last === null ? [] : [last]), ...waitingStatements(held).map((statement) => statement.mailedOn)]
  return days.length === 0 ? null : days.reduce((oldest, day) => (day < oldest ? day : oldest))
}
