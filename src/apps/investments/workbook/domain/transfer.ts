import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

export interface TransferredUnits {
  readonly kind: 'units'
  readonly instrument: RecordId
  readonly quantity: Decimal
}

export interface TransferredCash {
  readonly kind: 'cash'
  readonly currency: CurrencyCode
  readonly amount: Decimal
}

/** Units or cash moved between two of Ivan's accounts. It closes no lot and is no gain. */
export interface Transfer {
  readonly id: RecordId
  readonly from: RecordId
  readonly to: RecordId
  readonly date: CivilDate
  readonly moved: TransferredUnits | TransferredCash
  readonly note: string
}
