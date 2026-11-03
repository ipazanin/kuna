import { targetDaysAfter, weekdaysAfter } from './workingDays'
import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'

/** US trades settle one business day after the trade from this day on (SEC release 2023-29). */
const US_ONE_DAY_FROM = civilDate(2024, 5, 28)

/**
 * The day a trade's money is paid, estimated from its day: one weekday later for a dollar instrument traded from
 * 28 May 2024, two otherwise. Euros settle on TARGET working days only. Exchange holidays are not known, so the
 * estimate can be a day early.
 */
export function settlementDay(tradeDay: CivilDate, currency: CurrencyCode): CivilDate {
  if (currency === EURO) {
    return targetDaysAfter(tradeDay, 2)
  }
  return weekdaysAfter(tradeDay, currency === 'USD' && tradeDay >= US_ONE_DAY_FROM ? 1 : 2)
}
