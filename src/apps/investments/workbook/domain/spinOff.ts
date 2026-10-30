import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Units of a new instrument received for holding the parent, with the fraction of the parent's cost that moves to them. */
export interface SpinOff {
  readonly id: RecordId
  /** The parent. */
  readonly instrument: RecordId
  readonly received: RecordId
  readonly date: CivilDate
  readonly quantity: Decimal
  readonly costShare: Decimal
  /** The key of the imported rows it came from, so importing them again adds nothing. Null for a record typed in. */
  readonly importKey: string | null
  readonly note: string
}
