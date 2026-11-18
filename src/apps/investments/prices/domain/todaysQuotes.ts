import type { Close, PriceBook } from './priceBook'
import { seriesKey } from './pricesFile'
import type { Instrument } from '../../workbook/domain/instrument'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Decimal } from '../../../../shared/money/decimal'

/** A listing's price as a click on Fetch today brought it, for the session's day. */
export interface TodaysQuote {
  /** The listing's series key, as its closes are kept under. */
  readonly series: string
  readonly day: CivilDate
  readonly price: Decimal
  /** ISO timestamp of the last trade, or null where the vendor gives the day alone. */
  readonly at: string | null
  readonly marketOpen: boolean
}

/** The quotes of one Zagreb day, which the page keeps until the day turns or another file comes on screen. */
export interface QuotedDay {
  readonly day: CivilDate
  readonly quotes: readonly TodaysQuote[]
  /** The series asked of a vendor that quotes the close once a day, answered or not, so a later click asks them no more. */
  readonly askedOnce: readonly string[]
}

/**
 * What a reload keeps of the day's quotes: the series asked once a day, with the closes those asks brought. A close does
 * not change after its session, so it stays true after a reload, where a live quote would read as now when it is not.
 */
export function keptOverReload(quoted: QuotedDay): QuotedDay {
  return { day: quoted.day, quotes: quoted.quotes.filter((quote) => quoted.askedOnce.includes(quote.series)), askedOnce: quoted.askedOnce }
}

function quoteOf(quotes: readonly TodaysQuote[], instrument: Instrument): TodaysQuote | undefined {
  if (instrument.prices === 'manual') {
    return undefined
  }
  const series = seriesKey(instrument.prices, instrument.sourceSymbol)
  return quotes.find((quote) => quote.series === series)
}

function closeOfQuote(quote: TodaysQuote): Close {
  return { date: quote.day, price: quote.price, byHand: false, quote: { at: quote.at, marketOpen: quote.marketOpen } }
}

/**
 * The stored closes with each quote added on its session's day. A quote counts only when its day is later than the
 * listing's newest stored close, so a stored close of the same day wins and a quote of a day the closes already hold, as
 * a click before the US session brings, changes nothing.
 */
export function quotedPriceBook(prices: PriceBook, quotes: readonly TodaysQuote[]): PriceBook {
  if (quotes.length === 0) {
    return prices
  }
  const counted = (instrument: Instrument): TodaysQuote | null => {
    const quote = quoteOf(quotes, instrument)
    if (quote === undefined) {
      return null
    }
    const stored = prices.closeOnOrBefore(instrument, quote.day)
    return stored === null || stored.date < quote.day ? quote : null
  }
  return {
    closeOnOrBefore(instrument, day) {
      const quote = counted(instrument)
      return quote !== null && quote.day <= day ? closeOfQuote(quote) : prices.closeOnOrBefore(instrument, day)
    },
    closesBetween(instrument, from, to) {
      const quote = counted(instrument)
      const stored = prices.closesBetween(instrument, from, to)
      return quote !== null && quote.day >= from && quote.day <= to ? [...stored, closeOfQuote(quote)] : stored
    },
  }
}
