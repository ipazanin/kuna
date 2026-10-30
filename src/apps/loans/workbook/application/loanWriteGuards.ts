import { LOAN_PARTS, loansRecordsOf, readLoanBook } from '../domain/readLoanBook'
import type { LoanBook } from '../domain/readLoanBook'
import { dependentRefusalsOf } from '../../../../shared/storage/application/dependentRefusals'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { FreshRecords } from '../../../../shared/storage/domain/writeRules'

/** The book the records make, with the kind's records as `read` gives them. */
export function bookWith<R>(kind: RecordKind<R>, read: RecordsRead<R>, records: FreshRecords): LoanBook {
  return readLoanBook(loansRecordsOf(<K>(other: RecordKind<K>) => (other.name === kind.name ? (read as RecordsRead<unknown> as RecordsRead<K>) : records.of(other))))
}

/** Why a write would harm records of the loan parts that read the written kind. */
export const dependentRefusals = dependentRefusalsOf((records) => readLoanBook(loansRecordsOf((kind) => records.of(kind))), LOAN_PARTS)
