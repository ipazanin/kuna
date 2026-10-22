import type { RecordKind } from './recordKind'

/**
 * A record's kind and its business key or id, the same on every read and write. Only the record's
 * own domain and the spreadsheet adapter make one, and nothing reads it apart.
 */
export type RecordId = string & { readonly __record: 'id' }

export function recordIdOf(kind: RecordKind, key: string): RecordId {
  return `${kind.name}:${key}` as RecordId
}

/** A new id for a record of a kind without a business key: a random version 4 UUID. */
export function newRecordId(): string {
  return crypto.randomUUID()
}
