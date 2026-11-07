import { priceInTodaysUnits } from '../../holdings/domain/holding'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { notedSplits } from '../../performance/domain/benchmark'
import { priceLine } from '../../performance/domain/portfolioPerformance'
import type { ComparedListing, ListedSource } from '../../prices/domain/priceDemand'
import { seriesKey } from '../../prices/domain/pricesFile'
import type { SplitNote } from '../../prices/domain/pricesFile'
import { INSTRUMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import { PRICE_SOURCES } from '../../workbook/domain/instrument'
import type { Instrument } from '../../workbook/domain/instrument'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { shareFromRatio } from '../../../../shared/money/percent'
import type { Share } from '../../../../shared/money/percent'

/** A listing compared with on a chart, by the vendor that prices it and its symbol there, as the address keeps it. */
export type ComparedTicker = Pick<ComparedListing, 'source' | 'symbol'>

/** A listing to compare with and the currency of its closes, as a search or a named fund picks it. */
export type ComparedPick = Omit<ComparedListing, 'from'>

export function comparedKey(ticker: ComparedTicker): string {
  return seriesKey(ticker.source, ticker.symbol)
}

function listedSource(id: string): ListedSource | undefined {
  return PRICE_SOURCES.find((known): known is ListedSource => known !== 'manual' && known === id)
}

/** The ticker an address names as `source:symbol`, or null for none and for a source that prices no listings. */
export function tickerNamed(value: unknown): ComparedTicker | null {
  const split = typeof value === 'string' ? value.indexOf(':') : -1
  if (typeof value !== 'string' || split < 0) return null
  const source = listedSource(value.slice(0, split))
  const symbol = value.slice(split + 1).trim()
  return source === undefined || symbol === '' ? null : { source, symbol }
}

/**
 * The first vendor that found a listing and gives its closes on a free key, which a comparison with it is priced by.
 * Null for a listing none gives closes of, or one in no currency Kuna knows.
 */
export function comparedSourceOf(listing: { readonly sources: readonly string[]; readonly currency: string | null }): ListedSource | null {
  const source = listing.sources.map(listedSource).find((known) => known !== undefined)
  return source === undefined || listing.currency === null || currencyCodeOf(listing.currency) === null ? null : source
}

/**
 * The ticker as an instrument quoted per unit in its series' currency, which no record holds, so its closes and its
 * rates are read as a holding's are.
 */
export function comparedInstrument(ticker: ComparedTicker, currency: CurrencyCode): Instrument {
  return {
    id: recordIdOf(INSTRUMENT_RECORDS, `compared ${comparedKey(ticker)}`),
    name: ticker.symbol,
    type: null,
    class: 'stocks',
    isin: null,
    symbol: ticker.symbol,
    exchange: null,
    currency,
    quoted: { kind: 'unit' },
    prices: ticker.source,
    sourceSymbol: ticker.symbol,
    benchmark: false,
    sector: null,
    country: null,
    ter: null,
    distribution: null,
    note: '',
  }
}

/**
 * The sources with the compared instrument's splits as the only splits, so its closes count in today's units. Those are
 * the split records of the first instrument priced by the same series that has any, as a benchmark's records win, and
 * otherwise the splits its vendor reported, which the prices file notes.
 */
export function comparedSources(sources: PortfolioSources, compared: Instrument, notes: readonly SplitNote[]): PortfolioSources {
  const key = compared.prices === 'manual' ? null : seriesKey(compared.prices, compared.sourceSymbol)
  const recorded = sources.book.instruments
    .filter((named) => named.prices !== 'manual' && seriesKey(named.prices, named.sourceSymbol) === key)
    .map((named) => sources.book.splits.filter((split) => split.instrument === named.id))
    .find((splits) => splits.length > 0)
  const splits = recorded === undefined ? notedSplits(compared, notes) : recorded.map((split) => ({ ...split, instrument: compared.id }))
  return { ...sources, book: { ...sources.book, splits } }
}

/** A point over a first point above zero, less one, so lines that start at 100 and at 50 read alike. */
export function changeSince(first: number, point: number): Share {
  return shareFromRatio(point / first - 1)
}

/** Each point as change since the first. Empty when the first is not above zero. */
export function percentChange(points: readonly number[]): Share[] {
  const first = points[0]
  return first === undefined || !(first > 0) ? [] : points.map((point) => changeSince(first, point))
}

/** The compared closes on or before each day in their own currency, as change since the first day. Null when the first day has no close yet. */
export function changeAsQuoted(compared: Instrument, days: readonly CivilDate[], sources: PortfolioSources): Share[] | null {
  const closes = days.map((day) => sources.prices.closeOnOrBefore(compared, day))
  if (closes.length === 0 || closes[0] === null) {
    return null
  }
  return percentChange(closes.map((close) => Number(priceInTodaysUnits(sources.book, compared, close!.date, close!.price))))
}

/** The compared closes in euros at the ECB rate of each close's day, as the benchmark's line is, as change since the first day. Null when a day has no close or no rate. */
export function changeInEuros(compared: Instrument, days: readonly CivilDate[], sources: PortfolioSources): Share[] | null {
  const line = priceLine(compared, days, sources)
  return line === null ? null : percentChange(line)
}

/** A line a chart compares with: its name, and its change since the chart's first day at each of the chart's points. */
export interface ComparedLine {
  readonly name: string
  readonly change: readonly Share[]
}
