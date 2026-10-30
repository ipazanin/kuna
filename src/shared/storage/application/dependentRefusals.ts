import type { RecordId } from '../domain/recordId'
import type { RecordKind } from '../domain/recordKind'
import { storedOf } from '../domain/recordsRead'
import type { Reading } from '../domain/recordsRead'
import type { FreshRecords } from '../domain/writeRules'
import { words } from './words'

function outcomeOf(reading: Reading<{ readonly id: RecordId }>, id: RecordId): { readonly kept: boolean; readonly reasons: readonly string[] } {
  return { kept: reading.facts.some((fact) => fact.id === id), reasons: reading.problems.filter((problem) => problem.id === id).map((problem) => problem.reason) }
}

/**
 * Builds an app's dependent-refusal rule from how it reads its book. The rule says why a write would harm records of the
 * parts whose reading reads the written kind, which the write leaves in the file: one that counts would be left out or
 * read with a new problem. Records the write removes are gone after it, so they are no reason.
 */
export function dependentRefusalsOf<Part extends string>(
  readBook: (records: FreshRecords) => { readonly readings: Readonly<Record<Part, Reading<{ readonly id: RecordId }>>> },
  kinds: Readonly<Record<Part, RecordKind<unknown>>>,
): (parts: readonly Part[], fresh: FreshRecords, after: FreshRecords) => string[] {
  return (parts, fresh, after) => {
    const before = readBook(fresh)
    const later = readBook(after)
    return parts.flatMap((part) => {
      const kind = kinds[part]
      return storedOf(after.of(kind)).flatMap((stored) => {
        if (stored.id === null || !outcomeOf(before.readings[part], stored.id).kept) return []
        const known = outcomeOf(before.readings[part], stored.id).reasons
        const { kept, reasons } = outcomeOf(later.readings[part], stored.id)
        if (!kept) return [words.refusals.leftOutThen(kind.noun, stored.label, reasons.join(', '))]
        const introduced = reasons.filter((reason) => !known.includes(reason))
        return introduced.length === 0 ? [] : [words.refusals.problemThen(kind.noun, stored.label, introduced.join(', '))]
      })
    })
  }
}
