import { words } from './words'
import { answerOf, parsedJson, statusFailure } from './vendorAnswers'
import { isCloseText, isDay, isJsonObject } from '../../domain/pricesFile'
import type { CloseRow } from '../../domain/pricesFile'
import type { Fetched, PriceVendor, VendorCloses, VendorFetch } from '../../application/priceVendor'

/** One of Alpha Vantage's series: what the request asks for and the key the answer holds its days under. */
const DAILY = { query: 'function=TIME_SERIES_DAILY&outputsize=compact', days: 'Time Series (Daily)' }
const MONTHLY = { query: 'function=TIME_SERIES_MONTHLY', days: 'Monthly Time Series' }

async function seriesCloses(fetch: VendorFetch, key: string, symbol: string, series: typeof DAILY): Promise<Fetched<{ readonly kind: 'rows'; readonly closes: readonly CloseRow[] }>> {
  const fetched = await answerOf(fetch, `https://www.alphavantage.co/query?${series.query}&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`)
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
  const days = parsed[series.days]
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

export const alphaVantage: PriceVendor = {
  id: 'alphavantage',
  name: words.alphaVantage.name,
  covers: words.alphaVantage.covers,
  prices: 'listings',
  needsKey: true,
  keyAddress: 'https://www.alphavantage.co/support/#api-key',
  // Alpha Vantage states only the 25 a day. Five a minute and a gap of 1.5 seconds are the earlier free limits, kept so a burst is not refused.
  limits: { perMinute: 5, perDay: 25, gapMilliseconds: 1500 },
  closes: alphaVantageCloses,
}
