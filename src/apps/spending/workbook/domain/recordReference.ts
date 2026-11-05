import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words } from '../../../../shared/storage/domain/words'

/** The id of the record of `kind` that the field names by its bare UUID, or null for a blank field. */
export function optionalReference(fields: StoredFields, field: string, kind: RecordKind): RecordId | null {
  const key = textOf(fields[field])
  return key === '' ? null : recordIdOf(kind, key)
}

/** The same, refused when the field is blank. */
export function requiredReference(fields: StoredFields, field: string, kind: RecordKind): RecordId {
  return optionalReference(fields, field, kind) ?? refuse(words.reasons.none(field, ''))
}
