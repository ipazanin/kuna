import { words } from './words'
import { answerOf, parsedJson, statusFailure } from './vendorAnswers'
import { isCloseText, isDay, isJsonObject } from '../../domain/pricesFile'
import type { CloseRow, FailureReason } from '../../domain/pricesFile'
import type { Fetched, PriceVendor, VendorCloses, VendorFetch } from '../../application/priceVendor'

/** The most rows one answer holds. With a start day, Twelve Data sends the latest rows of the range. */
const PAGE_ROWS = 5000

type Page = Fetched<{ readonly kind: 'rows'; readonly closes: readonly CloseRow[] }>

/** Why an answer Twelve Data marked as an error got nothing, by the code in its body. */
function errorFailure(code: number, message: string): FailureReason | 'no-rows' {
  if (code === 400 && /no data is available/i.test(message)) {
    return 'no-rows'
  }
  if (code === 403) {
    return 'not-on-free-key'
  }
  // The symbol is the only part of the request that varies, so an invalid request means an unknown symbol.
  return code === 400 ? 'unknown-symbol' : statusFailure(code)
}

async function page(fetch: VendorFetch, key: string, symbol: string, from: string, through: string | null): Promise<Page> {
  // adjust=none keeps each close as it closed, which Kuna's figures and split records expect.
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${from}` +
    `${through === null ? '' : `&end_date=${through}`}&outputsize=${PAGE_ROWS}&order=asc&adjust=none&apikey=${encodeURIComponent(key)}`
  const fetched = await answerOf(fetch, url)
  if (fetched.kind === 'failed') {
    return fetched
  }
  const { status, text } = fetched.answer
  const parsed = parsedJson(text)
  if (isJsonObject(parsed) && parsed.status === 'error') {
    const failure = errorFailure(typeof parsed.code === 'number' ? parsed.code : status, typeof parsed.message === 'string' ? parsed.message : '')
    return failure === 'no-rows' ? { kind: 'rows', closes: [] } : { kind: 'failed', reason: failure }
  }
  if (status !== 200) {
    return { kind: 'failed', reason: statusFailure(status) }
  }
  if (!isJsonObject(parsed) || !Array.isArray(parsed.values)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const closes: CloseRow[] = []
  for (const row of parsed.values as unknown[]) {
    const day = isJsonObject(row) ? row.datetime : undefined
    const close = isJsonObject(row) ? row.close : undefined
    if (typeof day !== 'string' || typeof close !== 'string' || !isDay(day) || !isCloseText(close)) {
      return { kind: 'failed', reason: 'unreadable' }
    }
    closes.push([day, close])
  }
  return { kind: 'rows', closes: closes.sort(([earlier], [later]) => (earlier < later ? -1 : 1)) }
}

/**
 * The daily closes of a US listing from the day on, a page of 5000 at a time going back from the latest. Twelve Data's
 * free key has no splits, so it reports none.
 */
async function twelveDataCloses(fetch: VendorFetch, key: string | null, symbol: string, from: string): Promise<Fetched<VendorCloses>> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  let closes: readonly CloseRow[] = []
  let through: string | null = null
  for (;;) {
    const fetched = await page(fetch, key, symbol, from, through)
    if (fetched.kind === 'failed') {
      return closes.length === 0 ? fetched : { kind: 'closes', closes, splits: [], earlierFailure: fetched.reason }
    }
    const earlier = through === null ? fetched.closes : fetched.closes.filter(([day]) => day < through!)
    closes = [...earlier, ...closes]
    if (fetched.closes.length < PAGE_ROWS || earlier.length === 0) {
      return { kind: 'closes', closes, splits: [], earlierFailure: null }
    }
    through = closes[0]![0]
  }
}

export const twelveData: PriceVendor = {
  id: 'twelvedata',
  name: words.twelveData.name,
  covers: words.twelveData.covers,
  prices: 'listings',
  needsKey: true,
  keyAddress: 'https://twelvedata.com/register',
  limits: { perMinute: 8, perDay: 800, gapMilliseconds: null },
  closes: twelveDataCloses,
}
