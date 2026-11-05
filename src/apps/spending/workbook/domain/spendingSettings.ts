import { SETTING_RECORDS } from './spendingKinds'
import { words } from './words'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { filledKey, labelWords } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { ownId, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'

/** One setting as stored, kept by its key. */
export interface SettingRow {
  readonly id: RecordId
  readonly key: string
  readonly value: string
}

/** The banks the bank sync can link. */
export const LINKABLE_BANKS = ['otp', 'revolut'] as const

export type LinkableBank = (typeof LINKABLE_BANKS)[number]

/** What the Spending file keeps besides its records. */
export interface SpendingSettings {
  /** The bank sync script's API executable deployment, blank until you save one, which leaves the whole sync off. */
  readonly bankSyncDeployment: string
  /** The day each bank's approval runs out, or null for a bank not linked. */
  readonly bankLinks: Readonly<Record<LinkableBank, CivilDate | null>>
}

export const BANK_SYNC_DEPLOYMENT_KEY = 'bank_sync_deployment'

export function bankLinkKey(bank: LinkableBank): string {
  return `bank_link_${bank}`
}

const LINK_KEYS: readonly string[] = LINKABLE_BANKS.map(bankLinkKey)

export const SETTING_CODEC: RecordCodec<SettingRow> = {
  kind: SETTING_RECORDS,
  key: (fields) => filledKey(slugOf(fields.key)),
  label: (fields) => labelWords([slugOf(fields.key)]),
  make: (fields, id) => ({ id: ownId(id), key: textOf(fields.key), value: textOf(fields.value) }),
  fieldsOf: (setting) => filledFields({ key: setting.key, value: setting.value }),
}

/** A setting's row, whose id is its key. */
export function settingRow(key: string, value: string): SettingRow {
  return { id: recordIdOf(SETTING_RECORDS, key), key, value }
}

/** A key Kuna does not know is listed and left out, so a newer app's setting never stops this file from opening. */
export function readSettingRows(read: RecordsRead<SettingRow>): Reading<SettingRow> {
  return readEach(read, ({ record: { key, value } }) => {
    if (key !== BANK_SYNC_DEPLOYMENT_KEY && !LINK_KEYS.includes(key)) return [words.settingUnknown(key)]
    return LINK_KEYS.includes(key) && parseCivilDate(value) === null ? [words.settingNotADay(key, value)] : []
  })
}

/** The settings the rows that count hold, and the defaults for the rest. */
export function spendingSettingsOf(rows: readonly SettingRow[]): SpendingSettings {
  const valueOf = (key: string): string => rows.find((row) => row.key === key)?.value ?? ''
  const linkOf = (bank: LinkableBank): CivilDate | null => parseCivilDate(valueOf(bankLinkKey(bank)))
  return { bankSyncDeployment: valueOf(BANK_SYNC_DEPLOYMENT_KEY), bankLinks: { otp: linkOf('otp'), revolut: linkOf('revolut') } }
}
