import { keyOfRecordId, recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import type { RecordKind } from './recordKind'
import type { RecordFields } from './recordFields'
import { storedFieldsOfValues, textOf } from './storedFields'
import type { StoredField, StoredFields } from './storedFields'
import { words } from './words'

/**
 * How one kind's records are stored, whatever the storage: the key or id the stored fields hold,
 * the words that name them, the record the kind's factory makes of them, and the fields a record
 * is stored as. The factory refuses fields it cannot read by throwing with `refuse`.
 */
export interface RecordCodec<R> {
  readonly kind: RecordKind<R>
  /** The key the record is kept by, or null when the fields lack it. */
  key(fields: StoredFields): string | null
  /** The words that name the record for a person, such as an invoice's number. */
  label(fields: StoredFields): string
  make(fields: StoredFields, id: RecordId | null): R
  fieldsOf(record: R): RecordFields
}

/** The codec of each kind an app stores. Throws for a kind the app does not store. */
export type CodecOfKind = <R>(kind: RecordKind<R>) => RecordCodec<R>

/** The field that holds the id of a record of a kind without a business key. */
export const ID_FIELD = 'id'

/** The identity a record is stored by, or null when it lacks its key or id. */
export function identityOf<R>(codec: RecordCodec<R>, record: R): RecordId | null {
  const key = codec.key(storedFieldsOfValues(codec.fieldsOf(record)))
  return key === null ? null : recordIdOf(codec.kind, key)
}

/** The words that name a record, as its stored fields name it. */
export function labelOfRecord<R>(codec: RecordCodec<R>, record: R): string {
  return codec.label(storedFieldsOfValues(codec.fieldsOf(record)))
}

/** The codec of a kind whose records carry their id in the id field, beside the fields the record gives. */
export function withIdField<R extends { readonly id: RecordId }>(
  kind: RecordKind<R>,
  label: (fields: StoredFields) => string,
  make: (fields: StoredFields, id: RecordId | null) => R,
  fieldsOf: (record: R) => RecordFields,
): RecordCodec<R> {
  return {
    kind,
    key: (fields) => filledKey(textOf(fields[ID_FIELD])),
    label,
    make,
    fieldsOf: (record) => ({ ...fieldsOf(record), [ID_FIELD]: keyOfRecordId(kind, record.id) }),
  }
}

/** A label of the parts that are not blank, comma separated. */
export function labelWords(parts: readonly string[]): string {
  return parts.filter((part) => part !== '').join(', ') || words.unnamed
}

/** "month 3", or blank for a blank field. */
export function labelled(name: string, text: string): string {
  return text === '' ? '' : `${name} ${text}`
}

/** A key, or null when the record leaves it blank. */
export function filledKey(text: string): string | null {
  return text === '' ? null : text
}

/** A date field as its day, anything else as its text. */
export function dayText(field: StoredField | undefined): string {
  return field?.date ?? textOf(field)
}

/** A number field as the shortest text of its number, so `1200.50` and a cell holding 1200.5 both read `1200.5`. Anything else as its text. */
export function numberText(field: StoredField | undefined): string {
  return field?.number === null || field === undefined ? textOf(field) : String(field.number)
}
