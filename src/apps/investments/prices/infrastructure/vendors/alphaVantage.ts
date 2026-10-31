import { words } from './words'
import { answerOf, parsedJson, statusFailure } from './vendorAnswers'
import { isCloseText, isDay, isJsonObject } from '../../domain/pricesFile'
import type { CloseRow } from '../../domain/pricesFile'
import type { Fetched, PriceVendor, ReportedSplit, VendorCloses, VendorFetch, VendorSplits } from '../../application/priceVendor'
import { splitRatioOf } from '../../domain/splitFactor'

/** One of Alpha Vantage's series: what the request asks for and the key the answer holds its days under. */
const DAILY = { query: 'function=TIME_SERIES_DAILY&outputsize=compact', days: 'Time Series (Daily)' }
const MONTHLY = { query: 'function=TIME_SERIES_MONTHLY', days: 'Monthly Time Series' }

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
  if (typeof parsed.Information === 'string' && /premium/i.test(parsed.Information)) {
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

export const alphaVantage: PriceVendor & Required<Pick<PriceVendor, 'splits'>> = {
  id: 'alphavantage',
  name: words.alphaVantage.name,
  covers: words.alphaVantage.covers,
  prices: 'listings',
  needsKey: true,
  keyAddress: 'https://www.alphavantage.co/support/#api-key',
  // Alpha Vantage states only the 25 a day. Five a minute and a gap of 1.5 seconds are the earlier free limits, kept so a burst is not refused.
  limits: { perMinute: 5, perDay: 25, gapMilliseconds: 1500 },
  // The symbol of Alpha Vantage's own examples.
  testSymbol: 'IBM',
  closes: alphaVantageCloses,
  splits: alphaVantageSplits,
}
