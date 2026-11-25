import type { Instrument } from '../../workbook/domain/instrument'
import { addDays, daysBetween, weekdaysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Decimal } from '../../../../shared/money/decimal'

/**
 * The price a day is valued at, in the instrument's quote currency and before any later split: the day's close, or for
 * today the quote a click on Fetch today brought, which the next day's fetch replaces with the close.
 */
export interface Close {
  readonly date: CivilDate
  readonly price: Decimal
  readonly byHand: boolean
  /** Only on a price from today's quote, which stays in the page and never in the prices file. */
  readonly quote?: CloseQuote
}

/** When a quoted price is from and whether its market was still open, so the screens can say the figure is live. */
export interface CloseQuote {
  /** ISO timestamp of the last trade, or null where the vendor gives the day alone. */
  readonly at: string | null
  readonly marketOpen: boolean
}

/** Where the figures read closes: the fetched ones, and those entered by hand where no fetched close exists for the day. */
export interface PriceBook {
  closeOnOrBefore(instrument: Instrument, day: CivilDate): Close | null
  /** Every close from the first day to the last, both included, oldest first and one a day. */
  closesBetween(instrument: Instrument, from: CivilDate, to: CivilDate): readonly Close[]
  /** The oldest close, fetched or by hand, or null for an instrument with none. */
  firstClose(instrument: Instrument): Close | null
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
