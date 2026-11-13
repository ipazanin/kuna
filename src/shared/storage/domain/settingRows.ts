import { filledKey, labelWords } from './recordCodec'
import type { RecordCodec } from './recordCodec'
import { filledFields } from './recordFields'
import type { FieldValue } from './recordFields'
import { recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import type { RecordKind } from './recordKind'
import { readEach } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { ownId, slugOf, textOf } from './storedFields'
import type { StoredField } from './storedFields'

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

/** How a key's value is stored: the text a stored field holds for it, and the field its text is written as. */
export interface SettingValueStorage {
  read(field: StoredField | undefined, key: string): string
  write(value: string, key: string): FieldValue
}

/** Every value as the text the cell holds. */
const AS_TEXT: SettingValueStorage = {
  read: (field) => textOf(field),
  write: (value) => value,
}

/** How an app keeps its settings, one row per key, in its own kind, each named by the label `labelOf` gives its key and each value stored as `storage` stores it. */
export function settingCodec(kind: RecordKind<SettingRow>, labelOf: (key: string) => string, storage: SettingValueStorage = AS_TEXT): RecordCodec<SettingRow> {
  return {
    kind,
    key: (fields) => filledKey(slugOf(fields.key)),
    label: (fields) => labelWords([labelOf(slugOf(fields.key))]),
    make: (fields, id) => ({ id: ownId(id), key: textOf(fields.key), value: storage.read(fields.value, textOf(fields.key)) }),
    fieldsOf: (setting) => filledFields({ key: setting.key, value: storage.write(setting.value, setting.key) }),
  }
}

/** A setting's row, whose id is its key. */
export function settingRow(kind: RecordKind<SettingRow>, key: string, value: string): SettingRow {
  return { id: recordIdOf(kind, key), key, value }
}

/**
 * A key the app does not know, with the reason `unknownKey` words for it, and a value its key's check
 * refuses, are listed and left out, so a newer app's setting never stops the file from opening. A retired
 * key, one the app no longer reads that an older file may hold, reads silently and a save keeps its row.
 */
export function readSettingRows(read: RecordsRead<SettingRow>, checks: SettingChecks, retired: ReadonlySet<string>, unknownKey: (key: string) => string): Reading<SettingRow> {
  return readEach(read, ({ record: { key, value } }) => {
    const check = checks.get(key)
    if (check !== undefined) return check(value)
    return retired.has(key) ? [] : [unknownKey(key)]
  })
}

/** The value the key holds, blank when no row holds it. */
export function settingValue(rows: readonly SettingRow[], key: string): string {
  return rows.find((row) => row.key === key)?.value ?? ''
}
