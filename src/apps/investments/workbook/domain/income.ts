import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A dividend and a coupon name their instrument. Interest and other income may not. */
export const INCOME_KINDS = ['dividend', 'coupon', 'interest', 'other'] as const

export type IncomeKind = (typeof INCOME_KINDS)[number]

/** Money an account received for holding something, with the tax withheld at source, or a reversal of such a payment. */
export interface Income {
  readonly id: RecordId
  readonly account: RecordId
  readonly kind: IncomeKind
  readonly instrument: RecordId | null
  readonly date: CivilDate
  readonly currency: CurrencyCode
  /** Below zero for a reversal the broker booked against an earlier payment, which the note says. */
  readonly gross: Decimal
  /** Zero when nothing was withheld. Signed as gross is, so a reversal gives the tax back below zero. */
  readonly withheld: Decimal
  /** Units of the currency per euro, null for income in euros. */
  readonly rate: Decimal | null
  /** The key of the imported rows it came from, so importing them again adds nothing. Null for a record typed in. */
  readonly importKey: string | null
  readonly note: string
}
