import type { VendorAnswer, VendorFetch } from '../../application/priceVendor'
import { isWeekday } from './fakePrices'
import { addDays, parseCivilDate, today } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { fakeEcbFetch } from '../../../../../shared/rates/infrastructure/fake/fakeEcbRates'

/** The fake build's answers start no earlier than this, however far back a request asks. */
const EARLIEST = '2023-01-02'

function json(status: number, body: unknown): VendorAnswer {
  return { status, text: JSON.stringify(body) }
}

/** The weekdays from the day to today, both included. */
function weekdaysFrom(from: string): CivilDate[] {
  const days: CivilDate[] = []
  const last = today()
  for (let day = parseCivilDate(from > EARLIEST ? from : EARLIEST)!; day <= last; day = addDays(day, 1)) {
    if (isWeekday(day)) {
      days.push(day)
    }
  }
  return days
}

/** A made-up close for a symbol on a day, with two places, that wanders a little from day to day. */
function madeUpClose(symbol: string, day: string, base: number): string {
  const seed = [...`${symbol}${day}`].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 1000, 7)
  const cents = base * 100 + seed
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** The first request for a listing's closes on each page is told the vendor's minute is used up, so a fetch shows its pause. */
let minuteLimitAnswered = false

/** The vendor's answer when its minute is used up, for the first request of the page for a listing's closes. The key Test's symbols get theirs at once. */
function minuteLimitOnce(url: string, query: URLSearchParams): VendorAnswer | null {
  const closes = url.startsWith('https://api.twelvedata.com/time_series?')
    ? query.get('symbol') !== 'EUR/USD'
    : url.startsWith('https://www.alphavantage.co/query?') && query.get('function')?.startsWith('TIME_SERIES') === true && query.get('symbol') !== 'IBM'
  if (minuteLimitAnswered || !closes) {
    return null
  }
  minuteLimitAnswered = true
  return url.startsWith('https://api.twelvedata.com/')
    ? json(429, { code: 429, message: 'You have run out of API credits for the current minute. 9 API credits were used, with the current limit being 8.', status: 'error' })
    : json(200, { Information: 'Thank you for using Alpha Vantage! Please consider spreading out your free API requests more sparingly (1 request per second).' })
}

interface FakeListing {
  readonly name: string
  readonly mic: string
  readonly market: string
  readonly country: string
  readonly currency: string
  readonly type: string
}

/** What the fake vendors know of the made-up listings: a name, a market and its country, a currency and a type. */
const FAKE_LISTINGS: Readonly<Record<string, FakeListing>> = {
  ABC: { name: 'Example Tech', mic: 'XNAS', market: 'NASDAQ', country: 'United States', currency: 'USD', type: 'Common Stock' },
  DEF: { name: 'Example Dividend Co', mic: 'XNYS', market: 'NYSE', country: 'United States', currency: 'USD', type: 'Common Stock' },
  IDX: { name: 'Example Index Fund', mic: 'ARCX', market: 'NYSE ARCA', country: 'United States', currency: 'USD', type: 'ETF' },
  EXQ: { name: 'Example Quality Fund', mic: 'XNAS', market: 'NASDAQ', country: 'United States', currency: 'USD', type: 'ETF' },
}

/** The fake search: the made-up listing of the text when there is one, else a made-up share and a made-up fund of that symbol. */
function fakeListings(text: string): (FakeListing & { readonly symbol: string })[] {
  const symbol = text.trim().toUpperCase()
  const known = FAKE_LISTINGS[symbol]
  return known !== undefined
    ? [{ symbol, ...known }]
    : [
        { symbol, name: `Example ${symbol} Co`, mic: 'XNAS', market: 'NASDAQ', country: 'United States', currency: 'USD', type: 'Common Stock' },
        { symbol, name: `Example ${symbol} UCITS ETF`, mic: 'XETR', market: 'XETR', country: 'Germany', currency: 'EUR', type: 'ETF' },
      ]
}

function twelveDataSearch(query: URLSearchParams): VendorAnswer {
  const data = fakeListings(query.get('symbol') ?? '').map((listing) => ({
    symbol: listing.symbol,
    instrument_name: listing.name,
    exchange: listing.market,
    mic_code: listing.mic,
    exchange_timezone: 'America/New_York',
    instrument_type: listing.type,
    country: listing.country,
    currency: listing.currency,
  }))
  return json(200, { data, status: 'ok' })
}

function twelveData(query: URLSearchParams): VendorAnswer {
  const symbol = query.get('symbol') ?? ''
  const through = query.get('end_date') ?? '9999-12-31'
  const days = weekdaysFrom(query.get('start_date') ?? EARLIEST).filter((day) => day <= through)
  if (days.length === 0) {
    return json(400, { code: 400, message: 'No data is available on the specified dates.', status: 'error' })
  }
  return json(200, { meta: { symbol }, values: days.map((day) => ({ datetime: day, close: madeUpClose(symbol, day, 100) })), status: 'ok' })
}

/** The splits the fake Alpha Vantage lists, the made-up workbook's split among them. */
const FAKE_SPLITS: Readonly<Record<string, readonly { readonly effective_date: string; readonly split_factor: string }[]>> = {
  ABC: [{ effective_date: '2025-06-10', split_factor: '2.0000' }],
}

/** The fund profiles the fake Alpha Vantage gives the made-up funds, as its ETF_PROFILE answers them. */
const FAKE_FUND_PROFILES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  EMF: {
    net_assets: '2450000000',
    net_expense_ratio: '0.0015',
    portfolio_turnover: '0.12',
    dividend_yield: '0.031',
    inception_date: '2012-03-19',
    leveraged: 'NO',
    sectors: [
      { sector: 'FINANCIALS', weight: '0.900' },
      { sector: 'INDUSTRIALS', weight: '0.100' },
    ],
    holdings: Array.from({ length: 48 }, (_, place) => ({ symbol: `EX${place + 1}`, description: `EXAMPLE HOLDING ${place + 1}`, weight: '0.0208' })),
  },
  'XYZ.DEX': {
    net_assets: '18200000000',
    net_expense_ratio: '0.0019',
    portfolio_turnover: '0.04',
    dividend_yield: '0.0145',
    inception_date: '2019-07-23',
    leveraged: 'NO',
    sectors: [
      { sector: 'INFORMATION TECHNOLOGY', weight: '0.251' },
      { sector: 'FINANCIALS', weight: '0.160' },
      { sector: 'HEALTHCARE', weight: '0.110' },
      { sector: 'INDUSTRIALS', weight: '0.479' },
    ],
    holdings: Array.from({ length: 120 }, (_, place) => ({ symbol: `EXW${place + 1}`, description: `EXAMPLE WORLD HOLDING ${place + 1}`, weight: '0.0083' })),
  },
}

/** The dividends the fake Alpha Vantage lists of the made-up payer, one paid and one announced. */
const FAKE_DIVIDENDS: Readonly<Record<string, readonly Readonly<Record<string, string>>[]>> = {
  DEF: [
    { ex_dividend_date: '2026-12-28', declaration_date: '2026-12-01', record_date: '2026-12-29', payment_date: '2027-01-12', amount: '0.34' },
    { ex_dividend_date: '2026-07-01', declaration_date: '2026-06-02', record_date: '2026-07-02', payment_date: '2026-07-15', amount: '0.3325' },
  ],
}

function alphaVantage(query: URLSearchParams): VendorAnswer {
  const symbol = query.get('symbol') ?? ''
  if (query.get('function') === 'SPLITS') {
    return json(200, { symbol, data: FAKE_SPLITS[symbol] ?? [] })
  }
  if (query.get('function') === 'ETF_PROFILE') {
    return json(200, FAKE_FUND_PROFILES[symbol] ?? {})
  }
  if (query.get('function') === 'DIVIDENDS') {
    return json(200, { symbol, data: FAKE_DIVIDENDS[symbol] ?? [] })
  }
  if (query.get('function') === 'SYMBOL_SEARCH') {
    const bestMatches = fakeListings(query.get('keywords') ?? '').map((listing) => ({
      '1. symbol': listing.mic === 'XETR' ? `${listing.symbol}.DEX` : listing.symbol,
      '2. name': listing.name,
      '3. type': listing.type === 'Common Stock' ? 'Equity' : listing.type,
      '4. region': listing.mic === 'XETR' ? 'XETRA' : 'United States',
      '8. currency': listing.currency,
      '9. matchScore': '1.0000',
    }))
    return json(200, { bestMatches })
  }
  const days = weekdaysFrom(EARLIEST)
  const rows = (picked: readonly CivilDate[]): Record<string, Record<string, string>> => Object.fromEntries(picked.map((day) => [day, { '4. close': madeUpClose(symbol, day, 90) }]))
  if (query.get('function') === 'TIME_SERIES_DAILY') {
    return json(200, { 'Meta Data': { '2. Symbol': symbol }, 'Time Series (Daily)': rows(days.slice(-100)) })
  }
  const monthEnds = days.filter((day, place) => days[place + 1]?.slice(0, 7) !== day.slice(0, 7))
  return json(200, { 'Meta Data': { '2. Symbol': symbol }, 'Monthly Time Series': rows(monthEnds) })
}

/** The made-up companies the fake Finnhub has profiles of, by ISIN or symbol, its test symbol among them, as profile2 answers them. */
const FAKE_PROFILES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  XX000000ABC1: {
    finnhubIndustry: 'Technology',
    country: 'US',
    name: 'Example Tech',
    currency: 'USD',
    exchange: 'NASDAQ NMS - GLOBAL MARKET',
    ipo: '2004-08-19',
    marketCapitalization: 2125400.5,
    shareOutstanding: 13950.2,
  },
  GHI: { finnhubIndustry: '', country: 'US', name: 'Example Spinco', currency: 'USD', exchange: 'NEW YORK STOCK EXCHANGE, INC.' },
  AAPL: { finnhubIndustry: 'Technology', country: 'US', name: 'Example Test Co', currency: 'USD', exchange: 'NASDAQ NMS - GLOBAL MARKET', ipo: '1980-12-12', marketCapitalization: 1415993 },
}

/** The made-up companies whose profile the fake Finnhub keeps for paid keys, as it answers a premium endpoint. */
const PREMIUM_PROFILES: ReadonlySet<string> = new Set(['US000000DEF2'])

function finnhub(url: string, query: URLSearchParams): VendorAnswer {
  if (url.startsWith('https://finnhub.io/api/v1/stock/profile2?')) {
    const asked = query.get('isin') ?? query.get('symbol') ?? ''
    if (PREMIUM_PROFILES.has(asked)) {
      return json(403, { error: "You don't have access to this resource." })
    }
    const profile = FAKE_PROFILES[asked]
    return json(200, profile === undefined ? {} : { ...profile, ticker: query.get('symbol') ?? '' })
  }
  const result = fakeListings(query.get('q') ?? '').map((listing) => ({ description: listing.name.toUpperCase(), displaySymbol: listing.symbol, symbol: listing.symbol, type: listing.type }))
  return json(200, { count: result.length, result })
}

/** The fake build's vendors: made-up closes and facts for any symbol and any key, so no request leaves the page. */
export const fakeVendorFetch: VendorFetch = async (url) => {
  const query = new URL(url).searchParams
  const limited = minuteLimitOnce(url, query)
  if (limited !== null) {
    return limited
  }
  if (url.startsWith('https://api.twelvedata.com/time_series?')) {
    return twelveData(query)
  }
  if (url.startsWith('https://api.twelvedata.com/symbol_search?')) {
    return twelveDataSearch(query)
  }
  if (url.startsWith('https://finnhub.io/api/v1/')) {
    return finnhub(url, query)
  }
  if (url.startsWith('https://www.alphavantage.co/query?')) {
    return alphaVantage(query)
  }
  if (url.startsWith('https://data-api.ecb.europa.eu/service/data/EXR/D.')) {
    return fakeEcbFetch(url)
  }
  return json(404, { message: 'The fake build knows no such vendor address.' })
}
