import type { KeptQuotes } from '../application/pricesUpdate'
import { keptOverReload } from '../domain/todaysQuotes'
import type { TodaysQuote } from '../domain/todaysQuotes'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { jsonChoice } from '../../../../shared/device/deviceChoice'
import { decimalOfText, decimalText } from '../../../../shared/money/decimal'

/** This browser's requests to each vendor on one day, kept beside the keys so Settings can set them against the daily limit. */
const USAGE_PREFIX = 'kuna.price-vendor-usage.'

/** The vendors' daily limits reset at midnight UTC, so the requests are counted by the UTC day. */
function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/** Where storage is denied, as in a private window, nothing is counted. */
function usageOf(vendorId: string) {
  return jsonChoice(`${USAGE_PREFIX}${vendorId}`, (stored): { readonly day: string; readonly count: number } | null =>
    typeof stored === 'object' && stored !== null && 'day' in stored && 'count' in stored && typeof stored.day === 'string' && typeof stored.count === 'number'
      ? { day: stored.day, count: stored.count }
      : null,
  )
}

/** The requests this browser sent the vendor on the UTC day of `at`. */
export function requestsToday(vendorId: string, at: Date): number {
  const usage = usageOf(vendorId).read()
  return usage !== null && usage.day === utcDay(at) ? usage.count : 0
}

/** Sets the requests this browser sent the vendor on the UTC day of `at`. */
export function setRequestsToday(vendorId: string, at: Date, count: number): void {
  usageOf(vendorId).remember({ day: utcDay(at), count })
}

/** Counts one request to the vendor, starting the count afresh on a new UTC day. */
export function countRequest(vendorId: string, at: Date): void {
  setRequestsToday(vendorId, at, requestsToday(vendorId, at) + 1)
}

/** A kept close as the entry stores it, with its price as text, since JSON holds no bigint. */
interface StoredQuote {
  readonly series: string
  readonly day: string
  readonly price: string
  readonly at: string | null
  readonly marketOpen: boolean
}

function quoteOfStored(stored: unknown): TodaysQuote | null {
  if (typeof stored !== 'object' || stored === null || !('series' in stored) || !('day' in stored) || !('price' in stored) || !('at' in stored) || !('marketOpen' in stored)) {
    return null
  }
  const { series, day, price, at, marketOpen } = stored
  const civil = typeof day === 'string' ? parseCivilDate(day) : null
  const decimal = typeof price === 'string' ? decimalOfText(price) : null
  if (typeof series !== 'string' || civil === null || decimal === null || (at !== null && typeof at !== 'string') || typeof marketOpen !== 'boolean') {
    return null
  }
  return { series, day: civil, price: decimal, at, marketOpen }
}

/**
 * The series this browser asked a once-a-day quote of, by the Zagreb day the click was on, with the closes those asks
 * brought and the Investments file the click was on. An entry from before the closes or the file were kept reads as
 * asks with no closes, or with no file.
 */
const quoteAsks = jsonChoice(
  'kuna.price-quote-asks',
  (stored): { readonly day: string; readonly series: readonly string[]; readonly quotes: readonly unknown[]; readonly investmentsFileId: string | null } | null => {
    if (typeof stored !== 'object' || stored === null || !('day' in stored) || !('series' in stored) || typeof stored.day !== 'string') {
      return null
    }
    if (!Array.isArray(stored.series) || !stored.series.every((series) => typeof series === 'string')) {
      return null
    }
    return {
      day: stored.day,
      series: stored.series,
      quotes: 'quotes' in stored && Array.isArray(stored.quotes) ? stored.quotes : [],
      investmentsFileId: 'investmentsFileId' in stored && typeof stored.investmentsFileId === 'string' ? stored.investmentsFileId : null,
    }
  },
)

/** The day's once-a-day asks and the closes they brought, or none for another day. */
export function quoteAsksOn(day: CivilDate): KeptQuotes {
  const asks = quoteAsks.read()
  if (asks === null || asks.day !== day) {
    return { quoted: { day, quotes: [], askedOnce: [] }, investmentsFileId: null }
  }
  return { quoted: { day, quotes: asks.quotes.map(quoteOfStored).filter((quote) => quote !== null), askedOnce: asks.series }, investmentsFileId: asks.investmentsFileId }
}

/** Keeps the day's once-a-day asks and the closes they brought, as `keptOverReload` picks them, with the file the click was on. */
export function rememberQuoteAsks({ quoted, investmentsFileId }: KeptQuotes): void {
  const kept = keptOverReload(quoted)
  quoteAsks.remember({
    day: kept.day,
    series: kept.askedOnce,
    quotes: kept.quotes.map((quote): StoredQuote => ({ ...quote, price: decimalText(quote.price) })),
    investmentsFileId,
  })
}
