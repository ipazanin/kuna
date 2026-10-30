import type { Instrument } from '../../workbook/domain/instrument'
import { addDays, daysBetween, weekdaysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Decimal } from '../../../../shared/money/decimal'

/** A day's closing price in the instrument's quote currency, as it closed, before any later split. */
export interface Close {
  readonly date: CivilDate
  readonly price: Decimal
  readonly byHand: boolean
}

/** Where the figures read closes: the fetched ones, and those entered by hand where no fetched close exists for the day. */
export interface PriceBook {
  closeOnOrBefore(instrument: Instrument, day: CivilDate): Close | null
}

/** Weekdays a fetched close may lag before it is late, which leaves room for exchange holidays. */
const LISTED_WEEKDAYS = 3
/** Days a price entered by hand may lag before it is late, about one monthly statement. */
const BY_HAND_DAYS = 35

/** A fetched close is late once three weekdays have passed between it and today, a close entered by hand after 35 days. */
export function closeIsLate(close: Close, today: CivilDate): boolean {
  if (close.byHand) {
    return daysBetween(close.date, today) > BY_HAND_DAYS
  }
  return weekdaysBetween(addDays(close.date, 1), addDays(today, -1)) >= LISTED_WEEKDAYS
}

/** The newest fetched close among the holdings' closes, and whether even it is late, so the prices themselves are behind. */
export interface PricesAge {
  readonly newest: CivilDate
  readonly late: boolean
}

/** Null when no holding has a fetched close, as when every price is entered by hand. */
export function pricesAge(closes: readonly Close[], today: CivilDate): PricesAge | null {
  const newest = closes.filter((close) => !close.byHand).reduce<Close | null>((found, close) => (found === null || close.date > found.date ? close : found), null)
  return newest === null ? null : { newest: newest.date, late: closeIsLate(newest, today) }
}
