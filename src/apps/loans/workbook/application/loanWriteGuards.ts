import { LOAN_PARTS, loansRecordsOf, readLoanBook } from '../domain/readLoanBook'
import type { LoanBook, LoansRecords } from '../domain/readLoanBook'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { FreshRecords } from '../../../../shared/storage/domain/writeRules'
import { words } from '../../../../shared/storage/application/words'

/** The book the records make, with the kind's records as `read` gives them. */
export function bookWith<R>(kind: RecordKind<R>, read: RecordsRead<R>, records: FreshRecords): LoanBook {
  return readLoanBook(loansRecordsOf(<K>(other: RecordKind<K>) => (other.name === kind.name ? (read as RecordsRead<unknown> as RecordsRead<K>) : records.of(other))))
}

function outcomeOf(reading: Reading<{ readonly id: RecordId }>, id: RecordId): { readonly kept: boolean; readonly reasons: readonly string[] } {
  return { kept: reading.facts.some((fact) => fact.id === id), reasons: reading.problems.filter((problem) => problem.id === id).map((problem) => problem.reason) }
}

/**
 * Why the write would harm records of the parts whose reading reads the written kind, which the
 * write leaves in the file: one that counts would be left out or read with a new problem. Records the
 * write removes are gone after it, so they are no reason.
 */
export function dependentRefusals(parts: readonly (keyof LoansRecords)[], fresh: FreshRecords, after: FreshRecords): string[] {
  const before = readLoanBook(loansRecordsOf((kind) => fresh.of(kind)))
  const later = readLoanBook(loansRecordsOf((kind) => after.of(kind)))
  return parts.flatMap((part) => {
    const kind: RecordKind<unknown> = LOAN_PARTS[part]
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
