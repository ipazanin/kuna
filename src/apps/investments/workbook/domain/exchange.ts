import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What an exchange charged, already inside the amounts sold and bought. */
export interface ExchangeFees {
  readonly amount: Decimal
  readonly currency: CurrencyCode
}

/** Cash of one currency changed into another in an account, each amount as booked after fees. */
export interface Exchange {
  readonly id: RecordId
  readonly account: RecordId
  readonly date: CivilDate
  readonly sold: Decimal
  readonly soldCurrency: CurrencyCode
  readonly bought: Decimal
  readonly boughtCurrency: CurrencyCode
  readonly fees: ExchangeFees | null
  readonly note: string
}
