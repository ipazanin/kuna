import { PERSON_PAYEES_KEY, readSettingRows, settingRow, spendingSettingsOf } from '../domain/spendingSettings'
import type { SettingRow } from '../domain/spendingSettings'
import { SETTING_RECORDS } from '../domain/spendingKinds'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { personPayeesText, withPayeeAsPerson } from '../../../../shared/privacy/domain/personPayees'

/** Settings read nothing else. */
export const SETTING_WRITES: WriteRules<SettingRow> = {
  kind: SETTING_RECORDS,
  reads: [],
  undoable: true,
  read: readSettingRows,
  refusals: () => [],
}

/** The key holds this value, or no row at all for a blank one. */
export function setSetting(unit: UnitOfWork, rows: readonly SettingRow[], key: string, value: string): void {
  const held = rows.find((row) => row.key === key)
  const settings = unit.of(SETTING_WRITES)
  if (held === undefined) {
    if (value !== '') settings.add(settingRow(key, value))
  } else if (value === '') {
    settings.remove(held)
  } else if (held.value !== value) {
    settings.change(held, settingRow(key, value))
  }
}

/** Flags the payee as a person, whose name the chat and the AI tasks then send as an alias, or takes every spelling of it off the flags. */
export function treatPayeeAsPerson(unit: UnitOfWork, rows: readonly SettingRow[], payee: string, asPerson: boolean): void {
  const flagged = withPayeeAsPerson(spendingSettingsOf(rows).personPayees, payee, asPerson)
  setSetting(unit, rows, PERSON_PAYEES_KEY, personPayeesText(flagged))
}
