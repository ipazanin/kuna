import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ANY_VALUE, settingValue } from '../../../../shared/storage/domain/settingRows'
import type { SettingChecks, SettingRow, SettingValueCheck } from '../../../../shared/storage/domain/settingRows'

/** What the Spending file keeps besides its records. */
export interface SpendingSettings {
  /** The id of the Enable Banking application whose key signs the bank sync's calls, blank until a key is checked, which leaves the whole sync off. */
  readonly bankSyncApplication: string
  /** The bank accounts the owner said Kuna does not keep, each as its IBAN and currency, so the bank sync neither offers nor reads them. */
  readonly bankAccountsNotInKuna: readonly string[]
  /** The bank accounts whose Spending account keeps its own bank and kind, so the bank sync stops offering the bank's. Named as in `bankAccountsNotInKuna`. */
  readonly bankAccountsKeepMine: readonly string[]
  /** Per loan, the last due date its card of past instalments on To review offered when you said Not now. */
  readonly instalmentsPutOff: readonly InstalmentPutOff[]
  /** The day of the latest payment from your company the card asking where Kuna files them had in view when you said Not now, or null. */
  readonly companyRolesPutOff: CivilDate | null
  /** The day of the latest payment from your company the card of rows filed already offered when you said Not now, or null. */
  readonly companyPaymentsPutOff: CivilDate | null
}

/** A loan whose past instalments To review no longer offers up to a due date. */
export interface InstalmentPutOff {
  /** The loan's key, as a row's link names it. */
  readonly loan: string
  readonly through: CivilDate
}

export const BANK_SYNC_APPLICATION_KEY = 'bank_sync_application'
/** The payees an older file marks as people, one per line, which the first payee write moves onto payees. */
export const PERSON_PAYEES_KEY = 'person_payees'
export const BANK_ACCOUNTS_NOT_IN_KUNA_KEY = 'bank_sync_not_in_kuna'
export const BANK_ACCOUNTS_KEEP_MINE_KEY = 'bank_sync_keep_mine'
export const INSTALMENTS_PUT_OFF_KEY = 'loan_instalments_not_now'
export const COMPANY_ROLES_PUT_OFF_KEY = 'company_roles_not_now'
export const COMPANY_PAYMENTS_PUT_OFF_KEY = 'company_payments_not_now'

/** One loan per line: its key, then the last due date put off. */
const PUT_OFF_LINE = /^(\S+) (\S+)$/

/** The loan and day a line of the put-off setting names, or null for a line of another shape. */
export function instalmentPutOffOf(line: string): InstalmentPutOff | null {
  const [, loan = '', day = ''] = PUT_OFF_LINE.exec(line) ?? []
  const through = parseCivilDate(day)
  return loan === '' || through === null ? null : { loan, through }
}

/** The loans as the put-off setting's value holds them, one per line. */
export function instalmentsPutOffText(putOff: readonly InstalmentPutOff[]): string {
  return putOff.map(({ loan, through }) => `${loan} ${through}`).join('\n')
}

/** One bank account per line: its IBAN, or the bank's hash for an account without one, then its currency. */
const BANK_ACCOUNT_LINE = /^\S+ [A-Z]{3}$/

/** Whether a line of a bank accounts setting names one bank account as it should. */
export function isBankAccountLine(line: string): boolean {
  return BANK_ACCOUNT_LINE.test(line)
}

/** The lines of a setting's value that hold something, trimmed. */
export function linesOf(value: string): readonly string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** The bank accounts as the setting's value holds them, one per line. */
export function bankAccountsText(keys: readonly string[]): string {
  return keys.join('\n')
}

/** A UTC time as `toISOString` writes it, such as 2026-11-09T07:40:00.000Z. */
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

/** The epoch milliseconds of a UTC time, or null for text of another shape. */
export function utcTimeOf(value: string): number | null {
  const time = UTC_TIME.test(value) ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? time : null
}

/** Whether the book uses bank sync: an application is kept, whose key every device fetches with the other secrets. */
export function bankSyncSetUp(settings: Pick<SpendingSettings, 'bankSyncApplication'>): boolean {
  return settings.bankSyncApplication !== ''
}

/** The settings the rows that count hold, and the defaults for the rest. */
export function spendingSettingsOf(rows: readonly SettingRow[]): SpendingSettings {
  return {
    bankSyncApplication: settingValue(rows, BANK_SYNC_APPLICATION_KEY),
    bankAccountsNotInKuna: linesOf(settingValue(rows, BANK_ACCOUNTS_NOT_IN_KUNA_KEY)),
    bankAccountsKeepMine: linesOf(settingValue(rows, BANK_ACCOUNTS_KEEP_MINE_KEY)),
    instalmentsPutOff: linesOf(settingValue(rows, INSTALMENTS_PUT_OFF_KEY)).flatMap((line) => instalmentPutOffOf(line) ?? []),
    companyRolesPutOff: parseCivilDate(settingValue(rows, COMPANY_ROLES_PUT_OFF_KEY)),
    companyPaymentsPutOff: parseCivilDate(settingValue(rows, COMPANY_PAYMENTS_PUT_OFF_KEY)),
  }
}

/** The sentences a setting's check refuses a value with, each naming the key and the value or line it refuses. */
export interface SpendingSettingWords {
  readonly settingNotADay: (key: string, text: string) => string
  readonly settingNotATime: (key: string, text: string) => string
  readonly settingNotABankAccount: (key: string, line: string) => string
  readonly settingNotAPutOff: (key: string, line: string) => string
}

/** A check that refuses a value that is not a day. */
export function dayCheck(key: string, said: SpendingSettingWords): SettingValueCheck {
  return (value) => (parseCivilDate(value) === null ? [said.settingNotADay(key, value)] : [])
}

function bankAccountLinesCheck(key: string, said: SpendingSettingWords): SettingValueCheck {
  return (value) => linesOf(value).flatMap((line) => (isBankAccountLine(line) ? [] : [said.settingNotABankAccount(key, line)]))
}

function instalmentsPutOffCheck(said: SpendingSettingWords): SettingValueCheck {
  return (value) => linesOf(value).flatMap((line) => (instalmentPutOffOf(line) === null ? [said.settingNotAPutOff(INSTALMENTS_PUT_OFF_KEY, line)] : []))
}

/** Each key `spendingSettingsOf` reads, with the check of its value. */
export function spendingSettingChecks(said: SpendingSettingWords): SettingChecks {
  return new Map<string, SettingValueCheck>([
    [BANK_SYNC_APPLICATION_KEY, ANY_VALUE],
    [BANK_ACCOUNTS_NOT_IN_KUNA_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_NOT_IN_KUNA_KEY, said)],
    [BANK_ACCOUNTS_KEEP_MINE_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_KEEP_MINE_KEY, said)],
    [INSTALMENTS_PUT_OFF_KEY, instalmentsPutOffCheck(said)],
    [COMPANY_ROLES_PUT_OFF_KEY, dayCheck(COMPANY_ROLES_PUT_OFF_KEY, said)],
    [COMPANY_PAYMENTS_PUT_OFF_KEY, dayCheck(COMPANY_PAYMENTS_PUT_OFF_KEY, said)],
  ])
}
