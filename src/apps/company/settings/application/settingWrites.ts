import { installedPack } from '../../packs/packContribution'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { SETTING_RECORDS } from '../../workbook/domain/coreKinds'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf, storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { readSettingRows, settingRow } from '../../../../shared/storage/domain/settingRows'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import { personPayeesOf, personPayeesText, withPayeeAsPerson } from '../../../../shared/privacy/domain/personPayees'
import { slugOf } from '../../../../shared/storage/domain/storedFields'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { PERSON_PAYEES_KEY, bucketLabelsClash, companySettingChecks, heldSettingValue } from '../domain/settings'
import type { SettingEntry } from '../domain/settings'
import { words } from './words'

/**
 * Settings, core's keys and the installed pack's. A value the key's check refuses, a key on two rows,
 * and bucket labels that would clash are refused. A key nothing reads is kept, so Undo can put one back.
 */
export const SETTING_WRITES: WriteRules<SettingRow> = {
  kind: SETTING_RECORDS,
  reads: [],
  undoable: true,
  read: (read) =>
    readSettingRows(
      read,
      companySettingChecks(
        read.records.map((stored) => stored.record.key),
        installedPack().workbook?.settings ?? null,
      ),
    ),
  refusals: (change) => {
    const stored = storedOf(change.before)
    const twice = change.edits.flatMap((edit) => {
      const key = slugOf((edit.before ?? edit.after)?.fields.key)
      const holding = stored.filter((other) => slugOf(other.fields.key) === key).length
      return holding > 1 ? [words.settings.keyOnRows(key, holding)] : []
    })
    if (twice.length > 0) {
      return twice
    }
    const clash = bucketLabelsClash(recordsOf(change.after))
    return clash !== null && bucketLabelsClash(recordsOf(change.before)) === null ? [clash] : []
  },
}

/**
 * Sets each key to its value: the setting the app read for the key is changed, or one is added when
 * the settings lack the key. A blank value for a key they lack adds nothing.
 */
export function setSettings(unit: UnitOfWork, held: RecordsRead<SettingRow>, values: readonly SettingEntry[]): void {
  const settings = unit.of(SETTING_WRITES)
  for (const { key, value } of values) {
    const id = recordIdOf(SETTING_RECORDS, key.trim().toLowerCase())
    const stored = held.records.find((candidate) => candidate.id === id)
    if (stored !== undefined) {
      settings.change(stored.record, { ...stored.record, value })
    } else if (value.trim() !== '') {
      settings.add(settingRow(SETTING_RECORDS, key.trim().toLowerCase(), value))
    }
  }
}

/** Takes each key off the settings, the record the app read for it removed. A key the settings lack is left alone. */
export function removeSettings(unit: UnitOfWork, held: RecordsRead<SettingRow>, keys: readonly string[]): void {
  const settings = unit.of(SETTING_WRITES)
  for (const key of keys) {
    const id = recordIdOf(SETTING_RECORDS, key.trim().toLowerCase())
    const stored = held.records.find((candidate) => candidate.id === id)
    if (stored !== undefined) {
      settings.remove(stored.record)
    }
  }
}

/** Flags the counterparty as a person, whose name the chat and the AI tasks then send as an alias, or takes every spelling of it off the flags. */
export function treatPayeeAsPerson(unit: UnitOfWork, held: RecordsRead<SettingRow>, payee: string, asPerson: boolean): void {
  const flagged = personPayeesText(withPayeeAsPerson(personPayeesOf(heldSettingValue(held, PERSON_PAYEES_KEY) ?? ''), payee, asPerson))
  if (flagged === '') {
    removeSettings(unit, held, [PERSON_PAYEES_KEY])
  } else {
    setSettings(unit, held, [{ key: PERSON_PAYEES_KEY, value: flagged }])
  }
}
