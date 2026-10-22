/** A new id for a record of a kind without a business key: a random version 4 UUID. */
export function newRecordId(): string {
  return crypto.randomUUID()
}
