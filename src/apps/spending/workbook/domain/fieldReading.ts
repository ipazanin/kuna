import { booleanOf, refuse, textOf, wholeNumberOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words } from './words'

/** A true or false field, false when blank. */
export function flagOf(fields: StoredFields, name: string): boolean {
  const field = fields[name]
  if (field === undefined) return false
  return booleanOf(field) ?? refuse(words.notAFlag(name, field.text))
}

/** A whole number field, zero when blank. */
export function orderOf(fields: StoredFields, name: string): number {
  const field = fields[name]
  if (field === undefined) return 0
  return wholeNumberOf(field) ?? refuse(words.notAWholeNumber(name, textOf(field)))
}
