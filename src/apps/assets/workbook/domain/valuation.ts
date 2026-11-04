import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What an asset was worth on a day, as you typed it, such as a bank's appraisal or your own guess. */
export interface Valuation {
  readonly id: RecordId
  readonly asset: RecordId
  readonly date: CivilDate
  /** Zero or above. */
  readonly value: Money
  readonly note: string
}
