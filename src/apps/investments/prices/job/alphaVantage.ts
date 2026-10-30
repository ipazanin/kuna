import { isCloseText, isDay, isJsonObject } from '../domain/pricesFile'
import type { CloseRow, FailureReason } from '../domain/pricesFile'
import { fetchedText, parsedJson } from './priceJobPorts'
import type { Fetched, PriceJobPorts } from './priceJobPorts'

export interface AlphaVantagePrices {
  readonly kind: 'closes'
  readonly closes: readonly CloseRow[]
  /** Why the month-end closes before the daily ones failed, or null when they came or were not asked for. */
  readonly historyFailure: FailureReason | null
}

/** One of Alpha Vantage's series: what the request asks for and the key the answer holds its days under. */
const DAILY = { query: 'function=TIME_SERIES_DAILY&outputsize=compact', days: 'Time Series (Daily)' }
const MONTHLY = { query: 'function=TIME_SERIES_MONTHLY', days: 'Monthly Time Series' }
/** Alpha Vantage asks a free key for at most one request a second and may refuse a burst. */
const SPACING_MILLISECONDS = 1500

function seriesCloses(ports: PriceJobPorts, key: string, symbol: string, series: typeof DAILY): Fetched<{ readonly kind: 'closes'; readonly closes: readonly CloseRow[] }> {
  ports.pause(SPACING_MILLISECONDS)
  const answer = fetchedText(ports, `https://www.alphavantage.co/query?${series.query}&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`)
  if (answer.kind === 'failed') {
    return answer
  }
  const parsed = parsedJson(answer.text)
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
  return { kind: 'closes', closes }
}

/**
 * The last 100 daily closes of a listing, which is all a free key gets, and with `history` the month-end closes before
 * them. Alpha Vantage sends closes as text, which is kept as sent.
 */
export function alphaVantagePrices(ports: PriceJobPorts, key: string | null, symbol: string, history: boolean): Fetched<AlphaVantagePrices> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const daily = seriesCloses(ports, key, symbol, DAILY)
  if (daily.kind === 'failed') {
    return daily
  }
  if (!history) {
    return { kind: 'closes', closes: daily.closes, historyFailure: null }
  }
  const monthly = seriesCloses(ports, key, symbol, MONTHLY)
  if (monthly.kind === 'failed') {
    return { kind: 'closes', closes: daily.closes, historyFailure: monthly.reason }
  }
  const firstDaily = daily.closes[0]?.[0]
  const earlier = firstDaily === undefined ? monthly.closes : monthly.closes.filter(([day]) => day < firstDaily)
  return { kind: 'closes', closes: [...earlier, ...daily.closes], historyFailure: null }
}
