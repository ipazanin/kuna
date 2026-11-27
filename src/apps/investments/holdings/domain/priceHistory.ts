import { priceInTodaysUnits, quantityInTodaysUnits } from './holding'
import type { HoldingFigures, PortfolioSources } from './holding'
import { closePerUnit, priceOfWorth, tradeWorth } from './quoting'
import { seriesSplits } from './seriesSplits'
import type { Close } from '../../prices/domain/priceBook'
import type { SplitNote } from '../../prices/domain/pricesFile'
import type { Instrument } from '../../workbook/domain/instrument'
import type { Trade, TradeSide } from '../../workbook/domain/trade'
import { addDays, daysBetween, weekdaysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { dayMonthsLater, lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
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
  /** The point that holds the day the first units came in, null when the window leaves it out. */
  readonly firstBuy: CivilDate | null
}

/** A line runs day by day once its closes fall on at least this share of the weekdays it spans, so month-end closes, or a vendor's monthly history, keep the monthly line. */
const DAILY_SHARE = 0.5

/**
 * The days of a holding's line: from its first close, fetched or by hand, to the figures' day, or for a holding sold to
 * its last close no later than a month after its last trade. Null for one with no close.
 */
export function priceSpan(holding: Pick<HoldingFigures, 'instrument' | 'quantity'>, sources: PortfolioSources): DateRange | null {
  const first = sources.prices.firstClose(holding.instrument)
  const last = sources.prices.closeOnOrBefore(holding.instrument, sources.today)
  if (first === null || last === null) return null
  const end = lineEnd(holding, sources)
  return { from: first.date, to: holding.quantity > DECIMAL_ZERO || end < last.date ? end : last.date }
}

/** The last day a holding's line may reach: the figures' day while units are held, and a month after the last trade of one sold, as a series another holding shares runs on past its sale. */
function lineEnd(holding: Pick<HoldingFigures, 'instrument' | 'quantity'>, sources: PortfolioSources): CivilDate {
  const lastTrade = holding.quantity > DECIMAL_ZERO ? null : lastTradeOf(holding.instrument, sources.book.trades)
  const monthAfterSale = lastTrade === null ? sources.today : dayMonthsLater(lastTrade, 1)
  return monthAfterSale < sources.today ? monthAfterSale : sources.today
}

/** Before its first buy a held period's chart shows at least this share of the days from that buy to the window's end, so the first-buy rule stands clear of the axis on a long window too. */
const LEAD_IN_SHARE = 0.03

/**
 * A holding's chart opens on the days it was held, with a lead-in before its first units of a month or 3% of the held
 * days, whichever is longer, to the end of its span, which ends a month after its last trade once sold. It never opens
 * on less than the last year, nor before the first close. Null means its whole line.
 */
export function openingWindow(holding: Pick<HoldingFigures, 'firstAcquired'>, span: DateRange | null, sources: PortfolioSources): DateRange | null {
  if (span === null) return null
  const yearAgo = dayMonthsLater(sources.today, -12)
  const firstDay = holding.firstAcquired?.date ?? yearAgo
  // A holding opening on the last year keeps its whole year, sold in it or not.
  if (firstDay >= yearAgo) return yearAgo <= span.from ? null : { from: yearAgo, to: span.to }
  const { to } = span
  const monthBefore = dayMonthsLater(firstDay, -1)
  const shareBefore = addDays(firstDay, -Math.ceil(LEAD_IN_SHARE * daysBetween(firstDay, to)))
  const leadIn = shareBefore < monthBefore ? shareBefore : monthBefore
  const from = leadIn < span.from ? span.from : leadIn
  return from <= span.from && to >= span.to ? null : { from, to }
}

/** The day of the instrument's last trade, null for one never traded. */
function lastTradeOf(instrument: Instrument, trades: readonly Trade[]): CivilDate | null {
  return trades.reduce<CivilDate | null>((last, trade) => (trade.instrument === instrument.id && (last === null || trade.date > last) ? trade.date : last), null)
}

/**
 * A holding's closes over the window, null for every close the prices file has, before its first units came too, up to
 * the figures' day, or a month after the last trade of a holding sold: each close once the closes fall on most weekdays
 * of the window, otherwise the close at each month end and on the window's last day. Each point's trades in the window
 * merge into one dot per side, the trades of a day on a daily line and of a month on a monthly one, those before the
 * first close left out. Closes and trades count after the splits of a held holding's own records, as its figures do,
 * and after the splits of a sold holding's series up to the line's end, so it reads in the units it was held in. A
 * close per troy ounce of gold becomes a price per gram, as its trades are.
 */
export function priceHistory(
  holding: Pick<HoldingFigures, 'instrument' | 'quantity' | 'firstAcquired'>,
  sources: PortfolioSources,
  notes: readonly SplitNote[],
  window: DateRange | null,
): PriceHistory {
  const { instrument } = holding
  const { prices } = sources
  const end = lineEnd(holding, sources)
  const book = holding.quantity > DECIMAL_ZERO ? sources.book : { ...sources.book, splits: seriesSplits(instrument, sources.book, notes).filter((split) => split.date <= end) }
  const firstClose = prices.firstClose(instrument)?.date ?? null
  const from = firstClose === null ? null : window === null || window.from < firstClose ? firstClose : window.from
  const to = window === null || window.to > end ? end : window.to
  const inTodaysUnits = (close: Close): PricePoint => ({ date: close.date, price: closePerUnit(instrument.quoted, priceInTodaysUnits(book, instrument, close.date, close.price)) })
  const trades = book.trades
    .filter((trade) => trade.instrument === instrument.id && trade.date <= to && (window === null || trade.date >= window.from))
    .sort((earlier, later) => earlier.date.localeCompare(later.date))
  const lastTrade = lastTradeOf(instrument, book.trades)
  // A fetch stops a sold holding's series at its last trade, so its share of closes counts the weekdays to that trade.
  const seriesEnd = holding.quantity > DECIMAL_ZERO || lastTrade === null || lastTrade > to ? to : lastTrade
  const closes = from === null || from > to ? [] : prices.closesBetween(instrument, from, to)
  const daily = from !== null && closes.length > 0 && closes.length >= DAILY_SHARE * weekdaysBetween(from, seriesEnd)
  const days =
    from === null || from > to || daily
      ? []
      : [
          ...monthsFrom(monthOf(from), monthOf(to))
            .map(lastDayOf)
            .filter((date) => date >= from && date < to),
          to,
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
  const firstDay = holding.firstAcquired?.date ?? null
  const firstBuy = firstDay === null || from === null || firstDay < from || firstDay > to ? null : pointOf(firstDay)
  return { daily, points, dots, firstBuy }
}

/** The lowest and highest close of the last 52 weeks, in the quote currency and in today's units, and how much of the year the closes cover. */
export interface YearRange {
  readonly low: PricePoint
  readonly high: PricePoint
  /** The day of the first close in the year. */
  readonly from: CivilDate
  /** The day of the last close. */
  readonly to: CivilDate
  /** Whether the closes end more than a week before today, as those of a holding sold in the year end with its last trade. */
  readonly ended: boolean
  /** Whether the closes reach back to a year ago, give or take a week of holidays, and have not ended. */
  readonly wholeYear: boolean
  /** Whether a close falls on most weekdays of the span, so a vendor's month-end closes before its daily ones do not hide a low or a high between them. */
  readonly daily: boolean
}

/** Closes that start within this many days of a year ago, or end within it of today, still cover the year, as a holiday or a weekend may fall on its first or last day. */
const YEAR_SLACK_DAYS = 7

/** The range of an instrument's closes from a year before the figures' day to that day, or null for one with no close in that time. */
export function yearRange(instrument: Instrument, sources: PortfolioSources): YearRange | null {
  const { book, prices, today } = sources
  const yearAgo = dayMonthsLater(today, -12)
  const closes = prices.closesBetween(instrument, addDays(yearAgo, 1), today)
  const points = closes.map((close): PricePoint => ({ date: close.date, price: closePerUnit(instrument.quoted, priceInTodaysUnits(book, instrument, close.date, close.price)) }))
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) {
    return null
  }
  const ended = last.date < addDays(today, -YEAR_SLACK_DAYS)
  const low = points.reduce((lowest, point) => (point.price < lowest.price ? point : lowest), first)
  const high = points.reduce((highest, point) => (point.price > highest.price ? point : highest), first)
  return {
    low,
    high,
    from: first.date,
    to: last.date,
    ended,
    wholeYear: first.date <= addDays(yearAgo, YEAR_SLACK_DAYS) && !ended,
    daily: closes.length >= DAILY_SHARE * weekdaysBetween(first.date, last.date),
  }
}
