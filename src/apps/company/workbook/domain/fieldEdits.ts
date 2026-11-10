import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** Whether an edit changes this one field and nothing else, as giving a record the id of its bank row does. */
export function changesOnly(before: StoredFields, after: StoredFields, field: string): boolean {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names].every((name) => name === field || textOf(before[name]) === textOf(after[name]))
}
