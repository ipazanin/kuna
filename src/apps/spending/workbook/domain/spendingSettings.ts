import { SETTING_RECORDS } from './spendingKinds'
import { words } from './words'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { ANY_VALUE, settingCodec, settingValue } from '../../../../shared/storage/domain/settingRows'
import type { SettingChecks, SettingRow, SettingValueCheck } from '../../../../shared/storage/domain/settingRows'
import { personPayeesOf } from '../../../../shared/privacy/domain/personPayees'

/** The banks the bank sync can link. */
export const LINKABLE_BANKS = ['otp', 'revolut'] as const

export type LinkableBank = (typeof LINKABLE_BANKS)[number]

/** What the Spending file keeps besides its records. */
export interface SpendingSettings {
  /** The bank sync script's API executable deployment, blank until you save one, which leaves the whole sync off. */
  readonly bankSyncDeployment: string
  /** The day each bank's approval runs out, or null for a bank not linked. */
  readonly bankLinks: Readonly<Record<LinkableBank, CivilDate | null>>
  /** When any device last got an answer from each bank, in epoch milliseconds, or null for one never asked. */
  readonly bankFetchedAt: Readonly<Record<LinkableBank, number | null>>
  /** The company's OIB, which tells an R1 receipt for it. Blank until you save one. */
  readonly companyOib: string
  /** The payees the owner flagged as people, whose names the chat and the AI tasks send as aliases. */
  readonly personPayees: readonly string[]
  /** The bank accounts the owner said Kuna does not keep, each as its IBAN and currency, so the bank sync neither offers nor reads them. */
  readonly bankAccountsNotInKuna: readonly string[]
  /** The bank accounts whose Spending account keeps its own bank and kind, so the bank sync stops offering the bank's. Named as in `bankAccountsNotInKuna`. */
  readonly bankAccountsKeepMine: readonly string[]
}

export const BANK_SYNC_DEPLOYMENT_KEY = 'bank_sync_deployment'
export const COMPANY_OIB_KEY = 'company_oib'
export const PERSON_PAYEES_KEY = 'person_payees'
export const BANK_ACCOUNTS_NOT_IN_KUNA_KEY = 'bank_sync_not_in_kuna'
export const BANK_ACCOUNTS_KEEP_MINE_KEY = 'bank_sync_keep_mine'

/** One bank account per line: its IBAN, or the bank's hash for an account without one, then its currency. */
const BANK_ACCOUNT_LINE = /^\S+ [A-Z]{3}$/

function linesOf(value: string): readonly string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** The bank accounts as the setting's value holds them, one per line. */
export function bankAccountsText(keys: readonly string[]): string {
  return keys.join('\n')
}

function bankAccountLinesCheck(key: string): SettingValueCheck {
  return (value: string) => linesOf(value).flatMap((line) => (BANK_ACCOUNT_LINE.test(line) ? [] : [words.settingNotABankAccount(key, line)]))
}

export function bankLinkKey(bank: LinkableBank): string {
  return `bank_link_${bank}`
}

export function bankFetchedKey(bank: LinkableBank): string {
  return `bank_sync_fetched_${bank}`
}

/** A UTC time as `toISOString` writes it, such as 2026-11-09T07:40:00.000Z. */
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

function utcTimeOf(value: string): number | null {
  const time = UTC_TIME.test(value) ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? time : null
}

/** Each key Spending knows, a bank's link ending only on a day, and a bank's last fetch only at a UTC time. */
export const SPENDING_SETTING_CHECKS: SettingChecks = new Map<string, SettingValueCheck>([
  [BANK_SYNC_DEPLOYMENT_KEY, ANY_VALUE],
  [COMPANY_OIB_KEY, ANY_VALUE],
  [PERSON_PAYEES_KEY, ANY_VALUE],
  [BANK_ACCOUNTS_NOT_IN_KUNA_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_NOT_IN_KUNA_KEY)],
  [BANK_ACCOUNTS_KEEP_MINE_KEY, bankAccountLinesCheck(BANK_ACCOUNTS_KEEP_MINE_KEY)],
  ...LINKABLE_BANKS.map(bankLinkKey).map((key) => [key, (value: string) => (parseCivilDate(value) === null ? [words.settingNotADay(key, value)] : [])] as const),
  ...LINKABLE_BANKS.map(bankFetchedKey).map((key) => [key, (value: string) => (utcTimeOf(value) === null ? [words.settingNotATime(key, value)] : [])] as const),
])

export const SETTING_CODEC: RecordCodec<SettingRow> = settingCodec(SETTING_RECORDS)

/** The settings the rows that count hold, and the defaults for the rest. */
export function spendingSettingsOf(rows: readonly SettingRow[]): SpendingSettings {
  const linkOf = (bank: LinkableBank): CivilDate | null => parseCivilDate(settingValue(rows, bankLinkKey(bank)))
  const fetchedOf = (bank: LinkableBank): number | null => utcTimeOf(settingValue(rows, bankFetchedKey(bank)))
  return {
    bankSyncDeployment: settingValue(rows, BANK_SYNC_DEPLOYMENT_KEY),
    bankLinks: { otp: linkOf('otp'), revolut: linkOf('revolut') },
    bankFetchedAt: { otp: fetchedOf('otp'), revolut: fetchedOf('revolut') },
    companyOib: settingValue(rows, COMPANY_OIB_KEY),
    personPayees: personPayeesOf(settingValue(rows, PERSON_PAYEES_KEY)),
    bankAccountsNotInKuna: linesOf(settingValue(rows, BANK_ACCOUNTS_NOT_IN_KUNA_KEY)),
    bankAccountsKeepMine: linesOf(settingValue(rows, BANK_ACCOUNTS_KEEP_MINE_KEY)),
  }
}
