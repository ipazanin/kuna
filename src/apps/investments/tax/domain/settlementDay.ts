import { targetDaysAfter, weekdaysAfter } from './workingDays'
import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Trade } from '../../workbook/domain/trade'

/** The first trade day that settles one business day after the trade: in the US by SEC release 2023-29, on EU venues by Regulation (EU) 2025/2075. */
export const ONE_DAY_SETTLEMENT_FROM = { USD: civilDate(2024, 5, 28), EUR: civilDate(2027, 10, 11) } as const

/**
 * The day a trade's money is paid, estimated from its day: one business day later for a dollar or a euro instrument
 * traded from the day its market moved to one, two otherwise. Euros settle on TARGET working days only, other
 * currencies on weekdays. Exchange holidays are not known, so the estimate can be a day early.
 */
export function estimatedSettlementDay(tradeDay: CivilDate, currency: CurrencyCode): CivilDate {
  if (currency === EURO) {
    return targetDaysAfter(tradeDay, tradeDay >= ONE_DAY_SETTLEMENT_FROM.EUR ? 1 : 2)
  }
  return weekdaysAfter(tradeDay, currency === 'USD' && tradeDay >= ONE_DAY_SETTLEMENT_FROM.USD ? 1 : 2)
}

/** The day a trade settles, and whether Kuna estimated it because no broker's report gave one. */
export interface Settlement {
  readonly day: CivilDate
  readonly estimated: boolean
}

/** The day the broker's report gives the trade, or the estimate from its trade day when none did. */
export function settlementOf(trade: Pick<Trade, 'date' | 'settles'>, currency: CurrencyCode): Settlement {
  return trade.settles === undefined ? { day: estimatedSettlementDay(trade.date, currency), estimated: true } : { day: trade.settles, estimated: false }
}
