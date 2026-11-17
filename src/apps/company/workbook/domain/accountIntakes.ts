import { isBankStatementRow } from './rowOrigin'
import type { AccountRecord } from './accountsReading'
import type { Account, CompanyIntake, Transaction } from './workbook'
import { BY_HAND } from '../../../../shared/app/accountSource'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import { booleanOf, heldSettingValue } from '../../settings/domain/settings'

type LedgerRow = Pick<Transaction, 'account' | 'date' | 'sequence' | 'statement' | 'reference'>

/**
 * How an account that does not say reads, from a file kept before each account said how its rows come in. While the statements
 * folder was filed on each sync, an account whose newest row came from a camt statement reads as filled by the bank's
 * statements from the first day of the statements after its last row by hand, and not before the day after that row. Any
 * other account reads as by hand. It reads the ledger alone, so the day it says does not move with today.
 */
export function derivedIntake(account: Pick<Account, 'slug'>, ledger: readonly LedgerRow[], folderFiled: boolean): CompanyIntake {
  if (!folderFiled) return BY_HAND
  const rows = ledger.filter((row) => row.account === account.slug).sort((earlier, later) => earlier.sequence - later.sequence)
  const newest = rows[rows.length - 1]
  if (newest === undefined || !isBankStatementRow(newest)) return BY_HAND
  const lastByHand = rows.map((row) => isBankStatementRow(row)).lastIndexOf(false)
  const firstStatementDay = rows[lastByHand + 1]!.date
  const afterHand = lastByHand === -1 ? firstStatementDay : addDays(rows[lastByHand]!.date, 1)
  return { rowsFrom: 'mail', startsOn: afterHand > firstStatementDay ? afterHand : firstStatementDay, alsoFrom: [] }
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

/** The day of each row by hand on the account: a bank sheet's and a copied one. */
export function handDaysOf(account: string, ledger: readonly Pick<Transaction, 'account' | 'date' | 'statement' | 'reference'>[]): CivilDate[] {
  return ledger.filter((row) => row.account === account && !isBankStatementRow(row)).map((row) => row.date)
}

/** The accounts with the intake each says, or derives when it does not. A write of an account then stores it. */
export function accountsWithIntakes(accounts: readonly Omit<AccountRecord, 'id'>[], ledger: readonly LedgerRow[], folderFiled: boolean): Account[] {
  return accounts.map((account) => ({ ...account, intake: account.intake ?? derivedIntake(account, ledger, folderFiled) }))
}
