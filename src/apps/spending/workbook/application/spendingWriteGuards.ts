import { SPENDING_PARTS, readSpendingBook, spendingRecordsOf } from '../domain/readSpendingBook'
import type { SpendingBook } from '../domain/readSpendingBook'
import { dependentRefusalsOf } from '../../../../shared/storage/application/dependentRefusals'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { FreshRecords } from '../../../../shared/storage/domain/writeRules'

/** Every kind a Spending write reads, since the rules across records reach from accounts and categories to entries and limits. */
export const SPENDING_KINDS = Object.values(SPENDING_PARTS) as readonly RecordKind<unknown>[]

/** The book the records make, with the kind's records as `read` gives them. */
export function bookWith<R>(kind: RecordKind<R>, read: RecordsRead<R>, records: FreshRecords): SpendingBook {
  return readSpendingBook(spendingRecordsOf(<K>(other: RecordKind<K>) => (other.name === kind.name ? (read as RecordsRead<unknown> as RecordsRead<K>) : records.of(other))))
}

/** Why a write would harm records of the Spending parts that read the written kind. */
export const dependentRefusals = dependentRefusalsOf((records) => readSpendingBook(spendingRecordsOf((kind) => records.of(kind))), SPENDING_PARTS)
