import { dependentRefusalsOf } from '../../../../shared/storage/application/dependentRefusals'
import { INVESTMENT_RETIRED_SETTING_KEYS, INVESTMENT_SETTING_CHECKS } from './settingWrites'
import { INVESTMENT_PARTS, investmentsRecordsOf, readInvestmentBook } from '../domain/readInvestmentBook'
import type { InvestmentBookReading } from '../domain/readInvestmentBook'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { FreshRecords } from '../../../../shared/storage/domain/writeRules'

/** Every kind of the Investments file. Each kind's reading reads them all, since the book is read across records. */
export const INVESTMENT_KINDS = Object.values(INVESTMENT_PARTS) as readonly RecordKind<unknown>[]

/** The book the records make, with the kind's records as `read` gives them. */
export function bookWith<R>(kind: RecordKind<R>, read: RecordsRead<R>, records: FreshRecords): InvestmentBookReading {
  return readInvestmentBook(
    investmentsRecordsOf(<K>(other: RecordKind<K>) => (other.name === kind.name ? (read as RecordsRead<unknown> as RecordsRead<K>) : records.of(other))),
    INVESTMENT_SETTING_CHECKS,
    INVESTMENT_RETIRED_SETTING_KEYS,
  )
}

export function bookOf(records: FreshRecords): InvestmentBookReading {
  return readInvestmentBook(
    investmentsRecordsOf((kind) => records.of(kind)),
    INVESTMENT_SETTING_CHECKS,
    INVESTMENT_RETIRED_SETTING_KEYS,
  )
}

/** Why a write would harm records of the investment parts that read the written kind. */
export const dependentRefusals = dependentRefusalsOf(bookOf, INVESTMENT_PARTS)
