import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** An account at a broker, which holds units of instruments and cash in each currency. */
export interface InvestmentAccount {
  readonly id: RecordId
  readonly name: string
  readonly note: string
}
