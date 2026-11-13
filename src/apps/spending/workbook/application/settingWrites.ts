import { PERSON_PAYEES_KEY, spendingSettingsOf } from '../domain/spendingSettings'
import { SPENDING_RETIRED_SETTING_KEYS, SPENDING_SETTING_CHECKS } from '../domain/readSpendingBook'
import { SETTING_RECORDS } from '../domain/spendingKinds'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { setSetting, settingWrites } from '../../../../shared/storage/application/settingWrites'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import { personPayeesText, withPayeeAsPerson } from '../../../../shared/privacy/domain/personPayees'

export const SETTING_WRITES = settingWrites(SETTING_RECORDS, SPENDING_SETTING_CHECKS, SPENDING_RETIRED_SETTING_KEYS)

/** Flags the payee as a person, whose name the chat and the AI tasks then send as an alias, or takes every spelling of it off the flags. */
export function treatPayeeAsPerson(unit: UnitOfWork, rows: readonly SettingRow[], payee: string, asPerson: boolean): void {
  const flagged = withPayeeAsPerson(spendingSettingsOf(rows).personPayees, payee, asPerson)
  setSetting(unit, SETTING_WRITES, rows, PERSON_PAYEES_KEY, personPayeesText(flagged))
}
