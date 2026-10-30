import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A deposit and a fee refund add cash. A withdrawal and a fee take it. */
export const CASH_MOVEMENT_KINDS = ['deposit', 'withdrawal', 'fee', 'fee-refund'] as const

export type CashMovementKind = (typeof CASH_MOVEMENT_KINDS)[number]

/** Cash into or out of an account that is not a trade, income or an exchange. */
export interface CashMovement {
  readonly id: RecordId
  readonly account: RecordId
  readonly kind: CashMovementKind
  readonly date: CivilDate
  readonly currency: CurrencyCode
  /** Above zero. The kind gives its direction. */
  readonly amount: Decimal
  /** Units of the currency per euro, null for euros. Where euros actually moved, it is the rate they moved at. */
  readonly rate: Decimal | null
  /** The key of the imported rows it came from, so importing them again adds nothing. Null for a record typed in. */
  readonly importKey: string | null
  readonly note: string
}
