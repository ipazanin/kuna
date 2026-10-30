import type { RecordKind } from './recordKind'

/**
 * A record's kind and its business key or id, the same on every read and write. Only the record's
 * own domain and the spreadsheet adapter make one, and only a storage reads the key or id back out
 * of it, to store a record of a kind without a business key.
 */
export type RecordId = string & { readonly __record: 'id' }

export function recordIdOf(kind: RecordKind, key: string): RecordId {
  return `${kind.name}:${key}` as RecordId
}

/** The key or id a record id was made from. Throws for an id of another kind. */
export function keyOfRecordId(kind: RecordKind, id: RecordId): string {
  const prefix = `${kind.name}:`
  if (!id.startsWith(prefix)) {
    throw new Error(`${id} is not the id of ${kind.noun.en.article} ${kind.noun.en.one}.`)
  }
  return id.slice(prefix.length)
}

/** A new id for a record of a kind without a business key: a random version 4 UUID. */
export function newRecordId(): string {
  return crypto.randomUUID()
}
