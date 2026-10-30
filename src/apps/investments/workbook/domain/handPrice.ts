import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A close entered by hand, in the instrument's quote currency, such as a fund's price from its statement. */
export interface HandPrice {
  readonly id: RecordId
  readonly instrument: RecordId
  readonly date: CivilDate
  readonly price: Decimal
  readonly note: string
}
