import { heldListings, newPacing, pacedFetch } from './priceFetch'
import type { HeldListing, PausedTime } from './priceFetch'
import type { PriceFetchPorts } from './pricesPorts'
import type { PriceVendor, QuoteAfterClose, VendorFetch } from './priceVendor'
import type { QuotedDay, TodaysQuote } from '../domain/todaysQuotes'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { parseCivilDate, startOfDayIn } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { decimalOfText } from '../../../../shared/money/decimal'

/** The day and the hour a vendor's close is in are those of Zagreb, where the owner clicks. */
const QUOTES_TIME_ZONE = 'Europe/Zagreb'
const HOUR_MILLISECONDS = 60 * 60 * 1000

/** When a click asks: an ISO timestamp and the day in Zagreb. */
export interface QuoteClock {
  readonly at: string
  readonly day: CivilDate
}

export type QuoteFetchPorts = Pick<PriceFetchPorts, 'fetch' | 'pause' | 'key'>

/** What a click brought: the day's quotes so far, how many listings it asked and how many of those got no quote. */
export interface QuotesFetched {
  readonly quoted: QuotedDay
  readonly asked: number
  readonly failed: number
}

function isWeekday(day: CivilDate): boolean {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  return weekday !== 0 && weekday !== 6
}

/** The quotes of the click's day before it, or none when they are of an earlier day. */
function earlierToday(earlier: QuotedDay | null, day: CivilDate): QuotedDay {
  return earlier !== null && earlier.day === day ? earlier : { day, quotes: [], askedOnce: [] }
}

/** Whether a vendor that quotes the close alone has its markets closed at the click's time on the click's day. */
function closedBy(rule: QuoteAfterClose, clock: QuoteClock): boolean {
  return Date.parse(clock.at) >= startOfDayIn(clock.day, QUOTES_TIME_ZONE) + rule.fromHour * HOUR_MILLISECONDS
}

function quotableWithKey(vendors: readonly PriceVendor[], book: InvestmentBook, day: CivilDate, hasKey: (vendorId: string) => boolean): HeldListing[] {
  return heldListings(vendors, book, day).filter(({ vendor }) => vendor.quote !== undefined && (!vendor.needsKey || hasKey(vendor.id)))
}

/**
 * The held listings a click asks for. A vendor that quotes live is asked for each listing it prices, when this browser
 * holds its key. A vendor that quotes the close alone is asked only on a weekday from the hour its markets have closed,
 * once a day for each listing, answered or not, and for no more listings a day than it allows.
 */
export function quotesToAsk(vendors: readonly PriceVendor[], book: InvestmentBook, clock: QuoteClock, earlier: QuotedDay | null, hasKey: (vendorId: string) => boolean): HeldListing[] {
  const today = earlierToday(earlier, clock.day)
  const quotable = quotableWithKey(vendors, book, clock.day, hasKey)
  const afterCloseLeft = new Map<string, number>()
  return quotable.filter(({ vendor, series }) => {
    const rule = vendor.quoteAfterClose
    if (rule === undefined) {
      return true
    }
    if (!closedBy(rule, clock) || !isWeekday(clock.day) || today.askedOnce.includes(series)) {
      return false
    }
    const spentToday = quotable.filter((listing) => listing.vendor.id === vendor.id && today.askedOnce.includes(listing.series)).length
    const left = afterCloseLeft.get(vendor.id) ?? rule.perDay - spentToday
    afterCloseLeft.set(vendor.id, left - 1)
    return left > 0
  })
}

/** Why a click would ask no vendor: no holding has a vendor that quotes it, a vendor lacks its key, a close is still to come at an hour, or the day's quotes are all in. */
export type QuotesOff = { readonly kind: 'nothing-quoted' } | { readonly kind: 'no-key' } | { readonly kind: 'before-close'; readonly fromHour: number } | { readonly kind: 'all-in' }

/** Why a click now would ask nothing, or null while it would ask a vendor for at least one listing. */
export function quotesOff(vendors: readonly PriceVendor[], book: InvestmentBook, clock: QuoteClock, earlier: QuotedDay | null, hasKey: (vendorId: string) => boolean): QuotesOff | null {
  if (quotesToAsk(vendors, book, clock, earlier, hasKey).length > 0) {
    return null
  }
  const quotable = heldListings(vendors, book, clock.day).filter(({ vendor }) => vendor.quote !== undefined)
  if (quotable.length === 0) {
    return { kind: 'nothing-quoted' }
  }
  if (quotable.some(({ vendor }) => vendor.needsKey && !hasKey(vendor.id))) {
    return { kind: 'no-key' }
  }
  const today = earlierToday(earlier, clock.day)
  const closesToCome = quotableWithKey(vendors, book, clock.day, hasKey).flatMap(({ vendor, series }) => {
    const rule = vendor.quoteAfterClose
    return rule !== undefined && isWeekday(clock.day) && !closedBy(rule, clock) && !today.askedOnce.includes(series) ? [rule.fromHour] : []
  })
  return closesToCome.length === 0 ? { kind: 'all-in' } : { kind: 'before-close', fromHour: Math.min(...closesToCome) }
}

/**
 * Asks each listing `quotesToAsk` names for its quote, through each vendor's pacing, and adds what came to the day's
 * quotes, a new quote of a listing replacing the earlier one. A listing whose quote failed keeps an earlier one.
 */
export async function fetchQuotes(ports: QuoteFetchPorts, vendors: readonly PriceVendor[], book: InvestmentBook, clock: QuoteClock, earlier: QuotedDay | null): Promise<QuotesFetched> {
  const today = earlierToday(earlier, clock.day)
  const asks = quotesToAsk(vendors, book, clock, earlier, (vendorId) => ports.key(vendorId) !== null)
  const paused: PausedTime = { elapsed: 0 }
  const fetches = new Map<string, VendorFetch>()
  const fetchOf = (vendor: PriceVendor): VendorFetch => {
    const paced = fetches.get(vendor.id) ?? pacedFetch(ports, vendor, paused, newPacing())
    fetches.set(vendor.id, paced)
    return paced
  }
  const quotes = new Map(today.quotes.map((quote) => [quote.series, quote]))
  let failed = 0
  for (const { vendor, series, symbol } of asks) {
    const answer = await vendor.quote!(fetchOf(vendor), vendor.needsKey ? ports.key(vendor.id) : null, symbol)
    const day = answer.kind === 'quote' ? parseCivilDate(answer.day) : null
    const price = answer.kind === 'quote' ? decimalOfText(answer.price) : null
    if (answer.kind !== 'quote' || day === null || price === null) {
      failed += 1
      continue
    }
    const quote: TodaysQuote = { series, day, price, at: answer.at, marketOpen: answer.marketOpen }
    quotes.set(series, quote)
  }
  const askedOnce = [...today.askedOnce, ...asks.filter(({ vendor }) => vendor.quoteAfterClose !== undefined).map(({ series }) => series)]
  return { quoted: { day: clock.day, quotes: [...quotes.values()], askedOnce }, asked: asks.length, failed }
}
