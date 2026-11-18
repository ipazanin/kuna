import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Percent } from '../../../../shared/money/percent'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Your part of what a bank loan owes from a day on, such as all of it once the other borrower leaves the loan. */
export interface LoanShare {
  readonly id: RecordId
  readonly loan: RecordId
  readonly from: CivilDate
  /** Above 0% and at most 100%. */
  readonly share: Percent
  readonly note: string
}
