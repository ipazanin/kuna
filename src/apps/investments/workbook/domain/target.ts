import type { MixGroup } from './mixGroup'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The share of the value one group of a mix should hold. The targets of a file are of one mix and add up to 100%. */
export interface Target {
  readonly id: RecordId
  readonly slice: MixGroup
  /** In percent, so 60 is 60%. */
  readonly percent: Decimal
}
