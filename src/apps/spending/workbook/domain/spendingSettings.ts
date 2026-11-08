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
  /** The company's OIB, which tells an R1 receipt for it. Blank until you save one. */
  readonly companyOib: string
  /** The payees the owner flagged as people, whose names the chat and the AI tasks send as aliases. */
  readonly personPayees: readonly string[]
}

export const BANK_SYNC_DEPLOYMENT_KEY = 'bank_sync_deployment'
export const COMPANY_OIB_KEY = 'company_oib'
export const PERSON_PAYEES_KEY = 'person_payees'

export function bankLinkKey(bank: LinkableBank): string {
  return `bank_link_${bank}`
}

/** Each key Spending knows, and a bank's link ending only on a day. */
export const SPENDING_SETTING_CHECKS: SettingChecks = new Map<string, SettingValueCheck>([
  [BANK_SYNC_DEPLOYMENT_KEY, ANY_VALUE],
  [COMPANY_OIB_KEY, ANY_VALUE],
  [PERSON_PAYEES_KEY, ANY_VALUE],
  ...LINKABLE_BANKS.map(bankLinkKey).map((key) => [key, (value: string) => (parseCivilDate(value) === null ? [words.settingNotADay(key, value)] : [])] as const),
])

export const SETTING_CODEC: RecordCodec<SettingRow> = settingCodec(SETTING_RECORDS)

/** The settings the rows that count hold, and the defaults for the rest. */
export function spendingSettingsOf(rows: readonly SettingRow[]): SpendingSettings {
  const linkOf = (bank: LinkableBank): CivilDate | null => parseCivilDate(settingValue(rows, bankLinkKey(bank)))
  return {
    bankSyncDeployment: settingValue(rows, BANK_SYNC_DEPLOYMENT_KEY),
    bankLinks: { otp: linkOf('otp'), revolut: linkOf('revolut') },
    companyOib: settingValue(rows, COMPANY_OIB_KEY),
    personPayees: personPayeesOf(settingValue(rows, PERSON_PAYEES_KEY)),
  }
}
