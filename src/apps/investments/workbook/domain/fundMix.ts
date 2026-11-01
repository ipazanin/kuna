import type { FundMixGroup } from './mixGroup'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** One line of a fund's own mix by sector or by country, as typed from its factsheet. The lines of one fund and mix add up to 100%. */
export interface FundMixLine {
  readonly id: RecordId
  readonly instrument: RecordId
  readonly slice: FundMixGroup
  /** In percent, so 62.5 is 62.5%. */
  readonly percent: Decimal
}
