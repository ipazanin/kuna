import { words } from './words'
import { answerOf, parsedJson, statusFailure } from './vendorAnswers'
import { isCloseText, isDay, isJsonObject } from '../../domain/pricesFile'
import type { CloseRow, DividendRow, SectorWeightRow } from '../../domain/pricesFile'
import type {
  ClosesVendor,
  Fetched,
  FoundListing,
  ReportedSplit,
  VendorAnswer,
  VendorCloses,
  VendorDividends,
  VendorFetch,
  VendorFundSectors,
  VendorLimit,
  VendorSearch,
  VendorSplits,
} from '../../application/priceVendor'
import { splitRatioOf } from '../../domain/splitFactor'

// The field names of ETF_PROFILE (`sectors` of `sector` and `weight`), DIVIDENDS (`data` of `ex_dividend_date`,
// `payment_date` and `amount`) and SYMBOL_SEARCH (`bestMatches` of `1. symbol`, `2. name`, `3. type`, `4. region` and
// `8. currency`) are read from Alpha Vantage's documentation, unconfirmed until a request with a real key.

/** One of Alpha Vantage's series: what the request asks for and the key the answer holds its days under. */
const DAILY = { query: 'function=TIME_SERIES_DAILY&outputsize=compact', days: 'Time Series (Daily)' }
const MONTHLY = { query: 'function=TIME_SERIES_MONTHLY', days: 'Monthly Time Series' }

/**
 * Alpha Vantage answers a limit with status 200 and a note under Information or Note. One asking to spread requests
 * out, or about requests a second or a minute, is the burst limit, though it names the 25 a day as well. One about
 * requests a day, or a higher call volume, is the daily limit. Both mention the premium plans, so they are read before
 * the note of a premium endpoint.
 */
function limitInNote(note: string): VendorLimit | null {
  if (/sparingly|per second|per minute|frequency/i.test(note)) {
    return 'minute'
  }
  return /per day|a day|daily|call volume/i.test(note) ? 'day' : null
}

function noteOf(parsed: unknown): string | null {
  if (!isJsonObject(parsed)) {
    return null
  }
  const note = typeof parsed.Information === 'string' ? parsed.Information : parsed.Note
  return typeof note === 'string' ? note : null
}

function alphaVantageLimit(answer: VendorAnswer): VendorLimit | null {
  if (answer.status === 429) {
    return 'minute'
  }
  const note = answer.status === 200 ? noteOf(parsedJson(answer.text)) : null
  return note === null ? null : limitInNote(note)
}

/** The answer's JSON object, or why there is none: the vendor's error, premium, limit and information notes included. */
async function answerObject(fetch: VendorFetch, query: string, key: string): Promise<Fetched<{ readonly kind: 'object'; readonly answer: Readonly<Record<string, unknown>> }>> {
  const fetched = await answerOf(fetch, `https://www.alphavantage.co/query?${query}&apikey=${encodeURIComponent(key)}`)
  if (fetched.kind === 'failed') {
    return fetched
  }
  if (fetched.answer.status !== 200) {
    return { kind: 'failed', reason: statusFailure(fetched.answer.status) }
  }
  const parsed = parsedJson(fetched.answer.text)
  if (!isJsonObject(parsed)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  if ('Error Message' in parsed) {
    return { kind: 'failed', reason: 'unknown-symbol' }
  }
  const note = noteOf(parsed)
  if (note !== null && limitInNote(note) === null && /premium (endpoint|feature)/i.test(note)) {
    return { kind: 'failed', reason: 'not-on-free-key' }
  }
  if ('Note' in parsed || 'Information' in parsed) {
    return { kind: 'failed', reason: 'limit' }
  }
  return { kind: 'object', answer: parsed }
}

async function seriesCloses(fetch: VendorFetch, key: string, symbol: string, series: typeof DAILY): Promise<Fetched<{ readonly kind: 'rows'; readonly closes: readonly CloseRow[] }>> {
  const fetched = await answerObject(fetch, `${series.query}&symbol=${encodeURIComponent(symbol)}`, key)
  if (fetched.kind === 'failed') {
    return fetched
  }
  const days = fetched.answer[series.days]
  if (!isJsonObject(days)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const closes: CloseRow[] = []
  for (const day of Object.keys(days).sort()) {
    const values = days[day]
    const close = isJsonObject(values) ? values['4. close'] : undefined
    if (!isDay(day) || typeof close !== 'string' || !isCloseText(close)) {
      return { kind: 'failed', reason: 'unreadable' }
    }
    closes.push([day, close])
  }
  return { kind: 'rows', closes }
}

/**
 * The last 100 daily closes of a listing, which is all a free key gets, and the month-end closes before them when the
 * day asked from is earlier. Alpha Vantage sends closes as text, which is kept as sent.
 */
async function alphaVantageCloses(fetch: VendorFetch, key: string | null, symbol: string, from: string): Promise<Fetched<VendorCloses>> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const daily = await seriesCloses(fetch, key, symbol, DAILY)
  if (daily.kind === 'failed') {
    return daily
  }
  const firstDaily = daily.closes[0]?.[0]
  if (firstDaily === undefined || firstDaily <= from) {
    return { kind: 'closes', closes: daily.closes, splits: [], earlierFailure: null }
  }
  const monthly = await seriesCloses(fetch, key, symbol, MONTHLY)
  if (monthly.kind === 'failed') {
    return { kind: 'closes', closes: daily.closes, splits: [], earlierFailure: monthly.reason }
  }
  return { kind: 'closes', closes: [...monthly.closes.filter(([day]) => day < firstDaily), ...daily.closes], splits: [], earlierFailure: null }
}

/** The splits of a listing, from its split factors that are ratios of small whole numbers, such as 4.0000 for 4 for 1. */
async function alphaVantageSplits(fetch: VendorFetch, key: string | null, symbol: string): Promise<Fetched<VendorSplits>> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const fetched = await answerObject(fetch, `function=SPLITS&symbol=${encodeURIComponent(symbol)}`, key)
  if (fetched.kind === 'failed') {
    return fetched
  }
  const listed = fetched.answer.data
  if (!Array.isArray(listed)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const splits: ReportedSplit[] = []
  for (const split of listed) {
    const day = isJsonObject(split) ? split.effective_date : undefined
    const factor = isJsonObject(split) && typeof split.split_factor === 'string' ? Number(split.split_factor) : Number.NaN
    if (typeof day !== 'string' || !isDay(day) || !Number.isFinite(factor)) {
      return { kind: 'failed', reason: 'unreadable' }
    }
    const ratio = splitRatioOf(factor)
    if (ratio !== null) {
      splits.push({ date: day, newUnits: String(ratio.newUnits), oldUnits: String(ratio.oldUnits) })
    }
  }
  return { kind: 'splits', splits: splits.sort((earlier, later) => (earlier.date < later.date ? -1 : 1)) }
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' && value !== 'None' ? value.trim() : null
}

/** A fund's sector weights, each a fraction as text. An answer with no sectors, as for a share, is an empty answer, and a row Kuna cannot read is left out. */
async function alphaVantageFundSectors(fetch: VendorFetch, key: string | null, symbol: string): Promise<Fetched<VendorFundSectors>> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const fetched = await answerObject(fetch, `function=ETF_PROFILE&symbol=${encodeURIComponent(symbol)}`, key)
  if (fetched.kind === 'failed') {
    return fetched
  }
  const listed = fetched.answer.sectors ?? []
  if (!Array.isArray(listed)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const sectors: SectorWeightRow[] = []
  for (const entry of listed) {
    const sector = isJsonObject(entry) ? textOrNull(entry.sector) : null
    const weight = isJsonObject(entry) ? entry.weight : undefined
    if (sector !== null && typeof weight === 'string' && isCloseText(weight)) {
      sectors.push([sector, weight])
    }
  }
  return { kind: 'fund-sectors', sectors }
}

/** A listing's dividends with a known ex day and payment day, oldest payment first, each amount a unit as text. A row Kuna cannot read is left out. */
async function alphaVantageDividends(fetch: VendorFetch, key: string | null, symbol: string): Promise<Fetched<VendorDividends>> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const fetched = await answerObject(fetch, `function=DIVIDENDS&symbol=${encodeURIComponent(symbol)}`, key)
  if (fetched.kind === 'failed') {
    return fetched
  }
  const listed = fetched.answer.data ?? []
  if (!Array.isArray(listed)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const dividends: DividendRow[] = []
  for (const entry of listed) {
    if (!isJsonObject(entry)) {
      continue
    }
    const [exDay, paymentDay, amount] = [textOrNull(entry.ex_dividend_date), textOrNull(entry.payment_date), textOrNull(entry.amount)]
    if (exDay !== null && paymentDay !== null && amount !== null && isDay(exDay) && isDay(paymentDay) && isCloseText(amount)) {
      dividends.push([exDay, paymentDay, amount])
    }
  }
  return { kind: 'dividends', dividends: dividends.sort((earlier, later) => (earlier[1] < later[1] ? -1 : 1)) }
}

/** The listings whose symbol or name matches the text, as Alpha Vantage ranks them. Its free key gives the daily closes of every listing it has. */
async function alphaVantageSearch(fetch: VendorFetch, key: string | null, text: string): Promise<Fetched<VendorSearch>> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const fetched = await answerObject(fetch, `function=SYMBOL_SEARCH&keywords=${encodeURIComponent(text)}`, key)
  if (fetched.kind === 'failed') {
    return fetched
  }
  const matches = fetched.answer.bestMatches
  if (!Array.isArray(matches)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const listings = matches.flatMap((found): FoundListing[] => {
    const symbol = isJsonObject(found) ? textOrNull(found['1. symbol']) : null
    if (symbol === null || !isJsonObject(found)) {
      return []
    }
    return [
      {
        symbol,
        name: textOrNull(found['2. name']) ?? symbol,
        mic: null,
        market: textOrNull(found['4. region']),
        currency: textOrNull(found['8. currency']),
        type: textOrNull(found['3. type']),
        freeCloses: true,
      },
    ]
  })
  return { kind: 'found', listings }
}

export const alphaVantage: ClosesVendor & Required<Pick<ClosesVendor, 'splits' | 'fundSectors' | 'dividends' | 'search'>> = {
  id: 'alphavantage',
  name: words.alphaVantage.name,
  covers: words.alphaVantage.covers,
  prices: 'listings',
  needsKey: true,
  keyAddress: 'https://www.alphavantage.co/support/#api-key',
  origin: 'https://www.alphavantage.co/',
  // Alpha Vantage states only the 25 a day. Five a minute and a gap of 1.5 seconds are the earlier free limits, kept so a burst is not refused.
  limits: { perMinute: 5, perDay: 25, gapMilliseconds: 1500 },
  limitOf: alphaVantageLimit,
  // The symbol of Alpha Vantage's own examples.
  testSymbol: 'IBM',
  closes: alphaVantageCloses,
  splits: alphaVantageSplits,
  fundSectors: alphaVantageFundSectors,
  dividends: alphaVantageDividends,
  search: alphaVantageSearch,
}
