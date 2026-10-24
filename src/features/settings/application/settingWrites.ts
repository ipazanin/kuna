import { installedPack } from '../../packs/packContribution'
import type { UnitOfWork } from '../../workbook/application/repository'
import { recordIdOf } from '../../workbook/domain/recordId'
import { SETTING_RECORDS } from '../../workbook/domain/recordKind'
import { recordsOf, storedOf } from '../../workbook/domain/recordsRead'
import type { RecordsRead } from '../../workbook/domain/recordsRead'
import { slugOf } from '../../workbook/domain/storedFields'
import type { WriteRules } from '../../workbook/domain/writeRules'
import { readSettingsTab } from '../domain/settings'
import type { SettingEntry, SettingRow } from '../domain/settings'

function problemsOf(read: RecordsRead<SettingRow>): string[] {
  return readSettingsTab(recordsOf(read), installedPack().workbook?.settings ?? null).problems.map((problem) => `${problem.label}: ${problem.reason}`)
}

/**
 * Settings, core's keys and the installed pack's. A key set on two records, or a value the settings
 * reader would not use, is refused. Settings keep no Undo.
 */
export const SETTING_WRITES: WriteRules<SettingRow> = {
  kind: SETTING_RECORDS,
  reads: [],
  undoable: false,
  read: (read) => ({
    facts: read.records.flatMap((stored) => (stored.id === null ? [] : [{ id: stored.id }])),
    problems: readSettingsTab(recordsOf(read), installedPack().workbook?.settings ?? null).problems,
  }),
  refusals: (change) => {
    const stored = storedOf(change.before)
    const twice = change.edits.flatMap((edit) => {
      const key = slugOf((edit.before ?? edit.after)?.fields.key)
      const holding = stored.filter((other) => slugOf(other.fields.key) === key).length
      return holding > 1 ? [`The settings tab sets "${key}" on ${holding} rows. Keep one of them in the Sheet first.`] : []
    })
    if (twice.length > 0) {
      return twice
    }
    const before = problemsOf(change.before)
    const introduced = problemsOf(change.after).filter((problem) => !before.includes(problem))
    return introduced.length === 0 ? [] : [`The settings would not read cleanly: ${introduced.join('. ')}.`]
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
      settings.add({ key: key.trim().toLowerCase(), value })
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
