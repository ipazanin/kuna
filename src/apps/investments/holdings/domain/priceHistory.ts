import { priceInTodaysUnits, quantityInTodaysUnits } from './holding'
import type { HoldingFigures, PortfolioSources } from './holding'
import { closePerUnit, priceOfWorth, tradeWorth } from './quoting'
import type { Trade, TradeSide } from '../../workbook/domain/trade'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { inEuros, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** The close on or before a day, in the quote currency and in today's units. */
export interface PricePoint {
  readonly date: CivilDate
  readonly price: Decimal
}

/** A trade in today's units, so it sits on the same scale as the closes. */
export interface TradeMark {
  readonly trade: Trade
  readonly units: Decimal
  readonly price: Decimal
  /** Units × price in euros at the trade's own rate, without its fees. */
  readonly amount: Money
}

/** The buys, or the sales, of one chart point as one dot. */
export interface TradeDot {
  readonly side: TradeSide
  /** The month of the chart point that holds them. */
  readonly month: MonthKey
  /** Oldest first, as the file holds them on a day. */
  readonly marks: readonly TradeMark[]
  readonly units: Decimal
  /** Where the dot sits: what its trades came to in the quote currency over their units. */
  readonly price: Decimal
  readonly amount: Money
}

export interface PriceHistory {
  readonly points: readonly PricePoint[]
  /** Month by month, a month's buys before its sales. */
  readonly dots: readonly TradeDot[]
}

/**
 * A holding's close at each month end from the month its first units came, and on the figures' day, with its trades
 * merged per month and side. Month ends before its first close are left out, and so are the trades of those months.
 * A close per troy ounce of gold becomes a price per gram, as its trades are.
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
  const charted = new Set(points.map((point) => monthOf(point.date)))
  const trades = book.trades.filter((trade) => trade.instrument === instrument.id && charted.has(monthOf(trade.date))).sort((earlier, later) => earlier.date.localeCompare(later.date))
  const merged = new Map<string, TradeMark[]>()
  for (const trade of trades) {
    const key = `${monthOf(trade.date)} ${trade.side}`
    const mark: TradeMark = {
      trade,
      units: quantityInTodaysUnits(book, instrument, trade.date, trade.quantity),
      price: priceInTodaysUnits(book, instrument, trade.date, trade.price),
      amount: inEuros(tradeWorth(instrument.quoted, trade.quantity, trade.price), trade.rate),
    }
    merged.set(key, [...(merged.get(key) ?? []), mark])
  }
  const dots = [...merged]
    .sort(([earlier], [later]) => earlier.localeCompare(later))
    .map(([, marks]): TradeDot => {
      const units = sumDecimal(marks.map((mark) => mark.units))
      const worth = sumDecimal(marks.map((mark) => tradeWorth(instrument.quoted, mark.units, mark.price)))
      return {
        side: marks[0]!.trade.side,
        month: monthOf(marks[0]!.trade.date),
        marks,
        units,
        price: priceOfWorth(instrument.quoted, worth, units),
        amount: sumMoney(marks.map((mark) => mark.amount)),
      }
    })
  return { points, dots }
}
