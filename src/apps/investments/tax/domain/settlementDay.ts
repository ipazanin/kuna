import { targetDaysAfter, weekdaysAfter } from './workingDays'
import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'

/** The first trade day that settles one business day after the trade: in the US by SEC release 2023-29, on EU venues by Regulation (EU) 2025/2075. */
export const ONE_DAY_SETTLEMENT_FROM = { USD: civilDate(2024, 5, 28), EUR: civilDate(2027, 10, 11) } as const

/**
 * The day a trade's money is paid, estimated from its day: one business day later for a dollar or a euro instrument
 * traded from the day its market moved to one, two otherwise. Euros settle on TARGET working days only, other
 * currencies on weekdays. Exchange holidays are not known, so the estimate can be a day early.
 */
export function settlementDay(tradeDay: CivilDate, currency: CurrencyCode): CivilDate {
  if (currency === EURO) {
    return targetDaysAfter(tradeDay, tradeDay >= ONE_DAY_SETTLEMENT_FROM.EUR ? 1 : 2)
  }
  return weekdaysAfter(tradeDay, currency === 'USD' && tradeDay >= ONE_DAY_SETTLEMENT_FROM.USD ? 1 : 2)
}
