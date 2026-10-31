import { priceInTodaysUnits } from './holding'
import type { HoldingFigures, PortfolioSources } from './holding'
import { closePerUnit } from './quoting'
import type { Trade } from '../../workbook/domain/trade'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { Decimal } from '../../../../shared/money/decimal'

/** The close on or before a day, in the quote currency and in today's units. */
export interface PricePoint {
  readonly date: CivilDate
  readonly price: Decimal
}

/** A trade at its price in today's units, so it sits on the same scale as the closes. */
export interface TradeMark {
  readonly trade: Trade
  readonly price: Decimal
}

export interface PriceHistory {
  readonly points: readonly PricePoint[]
  /** Oldest first, as the file holds them on a day. */
  readonly marks: readonly TradeMark[]
}

/**
 * A holding's close at each month end from the month its first units came, and on the figures' day, with its trades.
 * Month ends before its first close are left out. A close per troy ounce of gold becomes a price per gram, as its
 * trades are.
 */
export function priceHistory(holding: Pick<HoldingFigures, 'instrument' | 'firstAcquired'>, sources: PortfolioSources): PriceHistory {
  const { instrument } = holding
  const firstDay = holding.firstAcquired?.date ?? null
  const { book, prices, today } = sources
  const days =
    firstDay === null
      ? []
      : [
          ...monthsFrom(monthOf(firstDay), monthOf(today))
            .map(lastDayOf)
            .filter((date) => date >= firstDay && date < today),
          today,
        ]
  const points = days.flatMap((date): PricePoint[] => {
    const close = prices.closeOnOrBefore(instrument, date)
    return close === null ? [] : [{ date, price: closePerUnit(instrument.quoted, priceInTodaysUnits(book, instrument, close.date, close.price)) }]
  })
  const marks = book.trades
    .filter((trade) => trade.instrument === instrument.id)
    .map((trade): TradeMark => ({ trade, price: priceInTodaysUnits(book, instrument, trade.date, trade.price) }))
    .sort((earlier, later) => earlier.trade.date.localeCompare(later.trade.date))
  return { points, marks }
}
