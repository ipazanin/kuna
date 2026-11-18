import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Percent } from '../../../../shared/money/percent'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Your part of an asset from a day on, such as all of it once you buy out the other owner. */
export interface AssetShare {
  readonly id: RecordId
  readonly asset: RecordId
  readonly from: CivilDate
  /** Above 0% and at most 100%. */
  readonly share: Percent
  readonly note: string
}
