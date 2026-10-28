import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'

export const RATE_TYPES = ['fixed', 'variable'] as const

/** The yearly rate a bank loan pays from one instalment until the next period starts. A variable rate's index and margin go in the note. */
export interface RatePeriod {
  readonly id: RecordId
  readonly loan: RecordId
  /** The due date of the first instalment at this rate. */
  readonly from: CivilDate
  readonly rate: YearlyRate
  readonly rateType: (typeof RATE_TYPES)[number]
  readonly note: string
}
