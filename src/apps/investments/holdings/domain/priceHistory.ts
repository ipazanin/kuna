import { priceInTodaysUnits, quantityInTodaysUnits } from './holding'
import type { HoldingFigures, PortfolioSources } from './holding'
import { closePerUnit, priceOfWorth, tradeWorth } from './quoting'
import type { Close } from '../../prices/domain/priceBook'
import type { Trade, TradeSide } from '../../workbook/domain/trade'
import { weekdaysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { DECIMAL_ZERO, inEuros, sumDecimal } from '../../../../shared/money/decimal'
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
  /** The day of the chart point that holds them: a close's day on a daily line, a month end or the figures' day on a monthly one. */
  readonly date: CivilDate
  /** Oldest first, as the file holds them on a day. */
  readonly marks: readonly TradeMark[]
  readonly units: Decimal
  /** Where the dot sits: what its trades came to in the quote currency over their units. */
  readonly price: Decimal
  readonly amount: Money
}

export interface PriceHistory {
  /** Whether the line runs close by close, once the series has a close on most weekdays it covers, or month end by month end. */
  readonly daily: boolean
  readonly points: readonly PricePoint[]
  /** Point by point, a point's buys before its sales. */
  readonly dots: readonly TradeDot[]
}

/** A line runs day by day once its closes fall on at least this share of the weekdays it spans, so month-end closes, or a vendor's monthly history, keep the monthly line. */
const DAILY_SHARE = 0.5

/**
 * A holding's closes from the day its first units came to the figures' day: each close once the series is daily,
 * otherwise the close at each month end and on the figures' day. Each point's trades merge into one dot per side, the
 * trades of a day on a daily line and of a month on a monthly one, those before the first close left out. A close per
 * troy ounce of gold becomes a price per gram, as its trades are.
 */
export function priceHistory(holding: Pick<HoldingFigures, 'instrument' | 'quantity' | 'firstAcquired'>, sources: PortfolioSources): PriceHistory {
  const { instrument } = holding
  const firstDay = holding.firstAcquired?.date ?? null
  const { book, prices, today } = sources
  const inTodaysUnits = (close: Close): PricePoint => ({ date: close.date, price: closePerUnit(instrument.quoted, priceInTodaysUnits(book, instrument, close.date, close.price)) })
  const trades = book.trades.filter((trade) => trade.instrument === instrument.id).sort((earlier, later) => earlier.date.localeCompare(later.date))
  // A fetch stops a sold holding's series at its last trade, so its share of closes counts the weekdays to that trade.
  const seriesEnd = holding.quantity > DECIMAL_ZERO ? today : (trades.at(-1)?.date ?? today)
  const closes = firstDay === null ? [] : prices.closesBetween(instrument, firstDay, today)
  const daily = firstDay !== null && closes.length > 0 && closes.length >= DAILY_SHARE * weekdaysBetween(firstDay, seriesEnd)
  const days =
    firstDay === null || daily
      ? []
      : [
          ...monthsFrom(monthOf(firstDay), monthOf(today))
            .map(lastDayOf)
            .filter((date) => date >= firstDay && date < today),
          today,
        ]
  const points = daily
    ? closes.map(inTodaysUnits)
    : days.flatMap((date): PricePoint[] => {
        const close = prices.closeOnOrBefore(instrument, date)
        return close === null ? [] : [{ ...inTodaysUnits(close), date }]
      })
  const pointOfMonth = new Map(points.map((point) => [monthOf(point.date), point.date]))
  const latestPointOn = (day: CivilDate): CivilDate | null => points.reduce<CivilDate | null>((found, point) => (point.date <= day ? point.date : found), null)
  const pointOf = (day: CivilDate): CivilDate | null => (daily ? latestPointOn(day) : (pointOfMonth.get(monthOf(day)) ?? null))
  const merged = new Map<string, { readonly date: CivilDate; readonly marks: TradeMark[] }>()
  for (const trade of trades) {
    const date = pointOf(trade.date)
    if (date === null) continue
    const key = `${date} ${trade.side}`
    const mark: TradeMark = {
      trade,
      units: quantityInTodaysUnits(book, instrument, trade.date, trade.quantity),
      price: priceInTodaysUnits(book, instrument, trade.date, trade.price),
      amount: inEuros(tradeWorth(instrument.quoted, trade.quantity, trade.price), trade.rate),
    }
    const known = merged.get(key)
    if (known === undefined) {
      merged.set(key, { date, marks: [mark] })
    } else {
      known.marks.push(mark)
    }
  }
  const dots = [...merged]
    .sort(([earlier], [later]) => earlier.localeCompare(later))
    .map(([, { date, marks }]): TradeDot => {
      const units = sumDecimal(marks.map((mark) => mark.units))
      const worth = sumDecimal(marks.map((mark) => tradeWorth(instrument.quoted, mark.units, mark.price)))
      return {
        side: marks[0]!.trade.side,
        date,
        marks,
        units,
        price: priceOfWorth(instrument.quoted, worth, units),
        amount: sumMoney(marks.map((mark) => mark.amount)),
      }
    })
  return { daily, points, dots }
}
