import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

export const TRADE_SIDES = ['buy', 'sell'] as const

export type TradeSide = (typeof TRADE_SIDES)[number]

/** A buy or a sale of units in an account, in the instrument's quote currency. */
export interface Trade {
  readonly id: RecordId
  readonly account: RecordId
  readonly instrument: RecordId
  readonly side: TradeSide
  readonly date: CivilDate
  /** Above zero. The side gives its direction. */
  readonly quantity: Decimal
  readonly price: Decimal
  /** Null when not entered, which counts as zero and is flagged on the holding's page. */
  readonly fees: Decimal | null
  /** Units of the currency per euro, null for a trade in euros. */
  readonly rate: Decimal | null
  /** A bond's accrued interest as the broker's note gives it, paid with a buy and received with a sale. Null for anything else. */
  readonly accrued: Decimal | null
  /** The key of the imported rows it came from, so importing them again adds nothing. Null for a record typed in. */
  readonly importKey: string | null
  readonly note: string
}
