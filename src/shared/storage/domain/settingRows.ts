import { filledKey, labelWords } from './recordCodec'
import type { RecordCodec } from './recordCodec'
import { filledFields } from './recordFields'
import { recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import type { RecordKind } from './recordKind'
import { readEach } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { ownId, slugOf, textOf } from './storedFields'
import { words } from './words'

/** One setting as stored, kept by its key. */
export interface SettingRow {
  readonly id: RecordId
  readonly key: string
  readonly value: string
}

/** Why a stored value of one key does not count, each a sentence. Empty for a value that counts. */
export type SettingValueCheck = (value: string) => readonly string[]

/** The keys an app knows, each with the check its value must pass. */
export type SettingChecks = ReadonlyMap<string, SettingValueCheck>

/** The check of a key whose value is free text. */
export const ANY_VALUE: SettingValueCheck = () => []

/** How an app keeps its settings, one row per key, in its own kind, each named by the label `labelOf` gives its key. */
export function settingCodec(kind: RecordKind<SettingRow>, labelOf: (key: string) => string): RecordCodec<SettingRow> {
  return {
    kind,
    key: (fields) => filledKey(slugOf(fields.key)),
    label: (fields) => labelWords([labelOf(slugOf(fields.key))]),
    make: (fields, id) => ({ id: ownId(id), key: textOf(fields.key), value: textOf(fields.value) }),
    fieldsOf: (setting) => filledFields({ key: setting.key, value: setting.value }),
  }
}

/** A setting's row, whose id is its key. */
export function settingRow(kind: RecordKind<SettingRow>, key: string, value: string): SettingRow {
  return { id: recordIdOf(kind, key), key, value }
}

/** A key the app does not know, and a value its key's check refuses, are listed and left out, so a newer app's setting never stops the file from opening. */
export function readSettingRows(read: RecordsRead<SettingRow>, checks: SettingChecks): Reading<SettingRow> {
  return readEach(read, ({ record: { key, value } }) => {
    const check = checks.get(key)
    return check === undefined ? [words.settingUnknown(key)] : check(value)
  })
}

/** The value the key holds, blank when no row holds it. */
export function settingValue(rows: readonly SettingRow[], key: string): string {
  return rows.find((row) => row.key === key)?.value ?? ''
}
