import { installedPack } from '../../packs/packContribution'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { SETTING_RECORDS } from '../../workbook/domain/coreKinds'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf, storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { slugOf } from '../../../../shared/storage/domain/storedFields'
import { personPayeesOf, personPayeesText, withPayeeAsPerson } from '../../../../shared/privacy/domain/personPayees'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { PERSON_PAYEES_KEY, heldSettingValue, readSettingsTab } from '../domain/settings'
import type { SettingEntry, SettingRow } from '../domain/settings'
import { words as settingWords } from '../domain/words'
import { words } from './words'

/** What the settings reader reports of the records, which a write may not add to. A key nothing reads is kept and not used, so putting one back, as Undo of its removal does, is left out. */
function readProblems(read: RecordsRead<SettingRow>): RecordProblem[] {
  return readSettingsTab(recordsOf(read), installedPack().workbook?.settings ?? null).problems.filter((problem) => problem.reason !== settingWords.settings.unknownKey)
}

function problemsOf(read: RecordsRead<SettingRow>): string[] {
  return readProblems(read).map((problem) => `${problem.label}: ${problem.reason}`)
}

/**
 * Settings, core's keys and the installed pack's. A key set on two records, or a value the settings
 * reader would not use, is refused.
 */
export const SETTING_WRITES: WriteRules<SettingRow> = {
  kind: SETTING_RECORDS,
  reads: [],
  undoable: true,
  read: (read) => ({
    facts: read.records.flatMap((stored) => (stored.id === null ? [] : [{ id: stored.id }])),
    problems: readProblems(read),
  }),
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
    const before = problemsOf(change.before)
    const introduced = problemsOf(change.after).filter((problem) => !before.includes(problem))
    return introduced.length === 0 ? [] : [words.settings.wouldNotRead(introduced.join('. '))]
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

/** Flags the counterparty as a person, whose name the chat and the AI tasks then send as an alias, or takes every spelling of it off the flags. */
export function treatPayeeAsPerson(unit: UnitOfWork, held: RecordsRead<SettingRow>, payee: string, asPerson: boolean): void {
  const flagged = personPayeesText(withPayeeAsPerson(personPayeesOf(heldSettingValue(held, PERSON_PAYEES_KEY) ?? ''), payee, asPerson))
  if (flagged === '') {
    removeSettings(unit, held, [PERSON_PAYEES_KEY])
  } else {
    setSettings(unit, held, [{ key: PERSON_PAYEES_KEY, value: flagged }])
  }
}
