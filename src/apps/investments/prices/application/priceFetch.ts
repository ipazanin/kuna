import { factWork } from './factFetch'
import type { PriceFetchPorts } from './pricesPorts'
import type { ClosesVendor, PriceVendor, VendorAnswer, VendorFetch, VendorLimits } from './priceVendor'
import { priceDemand } from '../domain/priceDemand'
import type { PriceDemand, RatesWanted } from '../domain/priceDemand'
import { investmentLots } from '../../holdings/domain/lots'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { decodePricesFile, encodePricesFile, seriesKey } from '../domain/pricesFile'
import type { CloseRow, FailureReason, PriceFailure, PriceSeries, PricesFile, PricesFileRefusal, SplitNote } from '../domain/pricesFile'
import { addDays, parseCivilDate, weekdaysBetween } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'

/** When the fetch runs: an ISO timestamp and the day in the page's time zone. */
export interface PriceFetchClock {
  readonly at: string
  readonly day: string
}

export type PriceFetchOutcome = { readonly kind: 'written'; readonly file: PricesFile } | { readonly kind: 'refused'; readonly reason: PricesFileRefusal }

/** One series a vendor is asked for, with the earliest day the records need it from and the last. */
interface WantedSeries {
  readonly key: string
  readonly symbol: string
  readonly currency: string
  readonly start: string
  /** Today while an instrument on it is held, is the benchmark or has no trades, and for the rates. Else the day of its last trade. */
  readonly end: string
  /** An instrument on it has units held, so the value on the Overview waits for it. */
  readonly held: boolean
}

/** What a fetch changes in the prices file. */
interface FetchChanges {
  readonly series: Map<string, PriceSeries>
  readonly splits: SplitNote[]
  readonly failures: PriceFailure[]
}

/** A history is asked from a week before its start, so a start on a weekend or a holiday still gets the close before it. */
const HISTORY_LEAD_DAYS = 7

/** A vendor's minute, with a second to spare for the time a request takes to reach it. */
const PACING_WINDOW_MILLISECONDS = 61_000

/** Milliseconds paused so far in one fetch, which is all the time the pacing counts on. */
export interface PausedTime {
  elapsed: number
}

/** Where one vendor's requests stand: when each went out by the paused clock, and whether its limit stopped it for the day. */
export interface VendorPacing {
  readonly sentAt: number[]
  stopped: boolean
}

export function newPacing(): VendorPacing {
  return { sentAt: [], stopped: false }
}

/** How long to wait at `clock` before the next request, so no more than the vendor's limits go out in any window. */
function waitBefore(limits: VendorLimits, sentAt: readonly number[], clock: number): number {
  const windowWait = limits.perMinute !== null && sentAt.length >= limits.perMinute ? sentAt[sentAt.length - limits.perMinute]! + PACING_WINDOW_MILLISECONDS - clock : 0
  const gapWait = limits.gapMilliseconds !== null && sentAt.length > 0 ? sentAt[sentAt.length - 1]! + limits.gapMilliseconds - clock : 0
  return Math.max(windowWait, gapWait, 0)
}

/**
 * The fetch through which every request of one vendor goes. It pauses so that no more than the vendor's per-minute
 * limit go out in any window. When the vendor still answers that the minute's limit is used up, it pauses a whole
 * window and asks once more. A daily limit, the vendor's own or its answer, or a second limit straight after that
 * pause stops the vendor, and from then on it answers as the vendor would, without asking.
 */
export function pacedFetch(ports: Pick<PriceFetchPorts, 'fetch' | 'pause'>, vendor: Pick<PriceVendor, 'limits' | 'limitOf'>, paused: PausedTime, pacing: VendorPacing = newPacing()): VendorFetch {
  const { limits } = vendor
  const pause = async (milliseconds: number): Promise<void> => {
    await ports.pause(milliseconds)
    paused.elapsed += milliseconds
  }
  const send = async (url: string): Promise<VendorAnswer> => {
    const wait = waitBefore(limits, pacing.sentAt, paused.elapsed)
    if (wait > 0) {
      await pause(wait)
    }
    pacing.sentAt.push(paused.elapsed)
    return ports.fetch(url)
  }
  return async (url) => {
    if (pacing.stopped || (limits.perDay !== null && pacing.sentAt.length >= limits.perDay)) {
      return { status: 429, text: '' }
    }
    const answer = await send(url)
    const limit = vendor.limitOf(answer)
    if (limit !== 'minute') {
      pacing.stopped = limit === 'day'
      return answer
    }
    await pause(PACING_WINDOW_MILLISECONDS)
    const again = await send(url)
    pacing.stopped = vendor.limitOf(again) !== null
    return again
  }
}

/** Closes oldest first with one a day, a fetched close replacing a stored one of the same day. */
function mergedCloses(stored: readonly CloseRow[], fetched: readonly CloseRow[]): CloseRow[] {
  const byDay = new Map<string, string>()
  for (const [day, close] of [...stored, ...fetched]) {
    byDay.set(day, close)
  }
  return [...byDay.keys()].sort().map((day): CloseRow => [day, byDay.get(day)!])
}

function lastDayOf(series: PriceSeries): string {
  return series.closes[series.closes.length - 1]?.[0] ?? series.from
}

/** The same day a year earlier, as ISO text compares. */
function yearBefore(day: string): string {
  return `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`
}

/** A series whose last close is a year older than the newest of its vendor is no longer published, as the kuna's rates since 2023, and keeps what it has. */
function stillPublished(vendor: ClosesVendor, stored: PricesFile, wanted: readonly WantedSeries[]): WantedSeries[] {
  if (vendor.prices !== 'rates') {
    return [...wanted]
  }
  const known = wanted.map((series) => stored.series[series.key]).filter((series) => series !== undefined)
  const newest = known.map(lastDayOf).reduce((latest, day) => (day > latest ? day : latest), '')
  return wanted.filter((series) => {
    const kept = stored.series[series.key]
    return kept === undefined || kept.from > series.start || lastDayOf(kept) >= yearBefore(newest)
  })
}

/** How long each listing is wanted and whether it is held, by its series key. */
type ListingSpans = ReadonlyMap<string, { readonly end: string; readonly held: boolean }>

/** A sold holding needs closes up to its last trade only, so once they are in, its series is never asked for again. */
function listingSpans(book: InvestmentBook, today: string): ListingSpans {
  const lots = investmentLots(book)
  const spans = new Map<string, { readonly end: string; readonly held: boolean }>()
  for (const instrument of book.instruments) {
    if (instrument.prices === 'manual' || instrument.sourceSymbol === '') {
      continue
    }
    const held = (lots.get(instrument.id)?.open ?? []).some((lot) => lot.quantity > DECIMAL_ZERO)
    const lastTrade = book.trades.filter((trade) => trade.instrument === instrument.id).reduce<string | null>((latest, trade) => (latest === null || trade.date > latest ? trade.date : latest), null)
    const end = held || instrument.benchmark || lastTrade === null ? today : lastTrade
    const key = seriesKey(instrument.prices, instrument.sourceSymbol)
    const known = spans.get(key)
    spans.set(key, { end: known === undefined || end > known.end ? end : known.end, held: held || known?.held === true })
  }
  return spans
}

function wantedOf(vendor: ClosesVendor, demand: PriceDemand, spans: ListingSpans, today: string): WantedSeries[] {
  if (vendor.prices === 'rates') {
    return demand.currencies.map((currency) => ({ key: seriesKey(vendor.id, currency), symbol: currency, currency, start: demand.ratesStart, end: today, held: false }))
  }
  return demand.listings.filter((listing) => listing.source === vendor.id).map((listing) => ({ ...listing, end: spans.get(listing.key)?.end ?? today, held: spans.get(listing.key)?.held ?? false }))
}

/** The series each vendor is asked for, as the records want them, without the rates a vendor no longer publishes. */
function wantedSeries(vendor: ClosesVendor, stored: PricesFile, book: InvestmentBook, day: string, ratesWanted: RatesWanted | null = null): WantedSeries[] {
  return stillPublished(vendor, stored, wantedOf(vendor, priceDemand(book, day, ratesWanted), listingSpans(book, day), day))
}

/** The vendors the records need closes or rates from, in the order given. */
export function vendorsNeeded(vendors: readonly PriceVendor[], book: InvestmentBook, day: string): ClosesVendor[] {
  const demand = priceDemand(book, day)
  return closesVendors(vendors).filter((vendor) => wantedOf(vendor, demand, new Map(), day).length > 0)
}

/** The vendors that give closes or rates, without those that give facts alone. */
export function closesVendors(vendors: readonly PriceVendor[]): ClosesVendor[] {
  return vendors.filter((vendor): vendor is ClosesVendor => vendor.prices !== 'facts')
}

/** The weekday before the day, the latest whose close a fetch on the day takes. */
function lastTradingDayBefore(day: string): string {
  let candidate = addDays(parseCivilDate(day)!, -1)
  while (weekdaysBetween(candidate, candidate) === 0) {
    candidate = addDays(candidate, -1)
  }
  return candidate
}

/**
 * Whether the file already holds every close a fetch on the day could bring for the series: its history from the
 * start the records need, and a close of its last trading day, or an answer on a later day that had none for it,
 * as for a market holiday.
 */
function upToDate(known: PriceSeries | undefined, series: WantedSeries, day: string): boolean {
  if (known === undefined || known.from > series.start) {
    return false
  }
  const lastTradingDay = lastTradingDayBefore(day)
  const due = series.end < lastTradingDay ? series.end : lastTradingDay
  const lastClose = known.closes[known.closes.length - 1]?.[0] ?? ''
  return lastClose >= due || (known.checked !== null && known.checked > due)
}

/** One vendor in a fetch: its key in this browser, and the pacing its requests share. */
export interface VendorPlan<Vendor extends PriceVendor = PriceVendor> {
  readonly vendor: Vendor
  readonly key: string | null
  readonly pacing: VendorPacing
  readonly fetch: VendorFetch
}

/** One series to ask for, and the vendor that has it. */
interface SeriesAsk {
  readonly plan: VendorPlan<ClosesVendor>
  readonly series: WantedSeries
}

/** One request of a fetch, a series or a fact, with the vendor whose pacing it waits for. */
export interface Asking {
  readonly plan: VendorPlan
  ask(): Promise<void>
}

/** What a fetch asks for: the day's closes and rates, the ECB rates alone with those an import wants, or a few series the day's fetch did not bring. */
export type PriceFetchScope = { readonly kind: 'day' } | { readonly kind: 'rates'; readonly wanted: RatesWanted } | { readonly kind: 'series'; readonly keys: readonly string[] }

const DAY_FETCH: PriceFetchScope = { kind: 'day' }

/** The holdings held come first, then those sold and the benchmark, then the rates, so the Overview is right as early as it can be. */
function askingOrder(asking: readonly SeriesAsk[]): SeriesAsk[] {
  const rank = ({ plan, series }: SeriesAsk): number => (plan.vendor.prices === 'rates' ? 2 : series.held ? 0 : 1)
  return [...asking].sort((first, second) => rank(first) - rank(second))
}

/** The time the vendors' pacing still needs for the series from `from` on, one request each, starting at `clock`. */
function pacingLeft(ordered: readonly Pick<Asking, 'plan'>[], from: number, clock: number): number {
  const sent = new Map<VendorPacing, number[]>()
  let at = clock
  for (const { plan } of ordered.slice(from)) {
    if ((plan.vendor.needsKey && plan.key === null) || plan.pacing.stopped) {
      continue
    }
    const history = sent.get(plan.pacing) ?? [...plan.pacing.sentAt]
    at += waitBefore(plan.vendor.limits, history, at)
    history.push(at)
    sent.set(plan.pacing, history)
  }
  return at - clock
}

async function fetchSeries(plan: SeriesAsk['plan'], series: WantedSeries, stored: PricesFile, clock: PriceFetchClock, changes: FetchChanges): Promise<void> {
  const failed = (reason: FailureReason): void => {
    changes.failures.push({ series: series.key, day: clock.day, reason })
  }
  if (plan.vendor.needsKey && plan.key === null) {
    failed('no-key')
    return
  }
  const known = stored.series[series.key]
  const history = known === undefined || known.from > series.start
  const from = history ? series.start : lastDayOf(known)
  const fetched = await plan.vendor.closes(plan.fetch, plan.key, series.symbol, history ? addDays(parseCivilDate(from)!, -HISTORY_LEAD_DAYS) : from)
  if (fetched.kind === 'failed') {
    failed(fetched.reason)
    return
  }
  if (fetched.earlierFailure !== null) {
    failed(fetched.earlierFailure)
  }
  // A close of today may still move while its market is open, so it waits for the next day's fetch.
  const settled = fetched.closes.filter(([day]) => day < clock.day)
  // A new series keeps the last close before its start, so a month-end close covers the days until the first daily one.
  const startIndex = settled.findIndex(([day]) => day >= from)
  const firstAtStart = startIndex < 0 ? settled.length : startIndex
  const firstKept = history && firstAtStart > 0 ? firstAtStart - 1 : firstAtStart
  const closes = settled.slice(firstKept)
  // Earlier closes that failed for a passing reason are asked again next time, so the series keeps a later start. Any
  // other answer, such as a free key's short history or a listing younger than the records, is all the vendor has.
  const reached = fetched.earlierFailure === null || !PASSING_FAILURES.includes(fetched.earlierFailure)
  const seriesFrom = !history ? known.from : reached ? series.start : (known?.from ?? closes[0]?.[0] ?? clock.day)
  changes.series.set(series.key, { currency: series.currency, from: seriesFrom, checked: clock.day, closes: mergedCloses(known?.closes ?? [], closes) })
  changes.splits.push(...fetched.splits.map((split): SplitNote => ({ series: series.key, ...split })))
}

/** The stored notes and the new ones, one per series and day. */
function mergedSplits(stored: readonly SplitNote[], reported: readonly SplitNote[]): SplitNote[] {
  const byKey = new Map<string, SplitNote>()
  for (const note of [...stored, ...reported]) {
    byKey.set(`${note.series} ${note.date}`, note)
  }
  return [...byKey.values()]
}

/** Failures that may clear on their own: a vendor's limit and no answer at all. */
const PASSING_FAILURES: readonly FailureReason[] = ['limit', 'no-answer']

/** How long a series that failed for a passing reason waits after the fetch that noted it, so a page shown again and again does not ask each time. */
const ASK_AGAIN_AFTER_MILLISECONDS = 15 * 60_000

/**
 * The series a fetch should ask for again on a day whose fetch already wrote the prices file: one whose closes are not
 * up to date, such as an instrument added after that fetch, unless it failed today. One that failed today for a reason
 * that may clear on its own is asked again once a while has passed. One that failed for its own reason, such as an
 * unknown symbol or no key, waits for the next day.
 */
export function seriesToAskAgain(vendors: readonly PriceVendor[], stored: PricesFile, book: InvestmentBook, clock: PriceFetchClock): string[] {
  const waited = stored.writtenAt === null || Date.parse(clock.at) - Date.parse(stored.writtenAt) >= ASK_AGAIN_AFTER_MILLISECONDS
  return closesVendors(vendors).flatMap((vendor) =>
    wantedSeries(vendor, stored, book, clock.day)
      .filter((series) => {
        if (upToDate(stored.series[series.key], series, clock.day)) {
          return false
        }
        const failure = stored.failures.find((failed) => failed.series === series.key && failed.day === clock.day)
        return failure === undefined || (waited && PASSING_FAILURES.includes(failure.reason))
      })
      .map((series) => series.key),
  )
}

/**
 * Fetches the closes the Investments records need from each vendor, the history of any new series and the latest
 * closes of the others, and overwrites the prices file. The holdings held are asked for first. A series that fails
 * keeps its closes as they were, with the failure noted in the file. A file that is no prices file Kuna can read is
 * left as it is. A day's fetch then asks for the facts `factWork` names, through the same pacing, so they spend what
 * the closes leave of a vendor's day.
 *
 * The rates scope fetches the ECB rates alone, those wanted beside those the records need. That is no day's fetch, so
 * the file keeps the time of the last one. It and the series scope keep the failures noted for the series they did not ask for.
 */
export async function fetchPrices(ports: PriceFetchPorts, vendors: readonly PriceVendor[], clock: PriceFetchClock, scope: PriceFetchScope = DAY_FETCH): Promise<PriceFetchOutcome> {
  const read = decodePricesFile(await ports.readPrices())
  if (read.kind === 'refused') {
    return read
  }
  const stored = read.file
  const book = ports.investments()
  const paused: PausedTime = { elapsed: 0 }
  let current = 0
  let upToDateCount = 0
  const asking: SeriesAsk[] = []
  const plans: VendorPlan[] = []
  const planOf = <Vendor extends PriceVendor>(vendor: Vendor): VendorPlan<Vendor> => {
    const reportingPause = async (milliseconds: number): Promise<void> => {
      ports.progress({
        asked: current + 1,
        of: ordered.length,
        leftMilliseconds: milliseconds + pacingLeft(ordered, current + 1, paused.elapsed + milliseconds),
        pause: { vendorId: vendor.id, milliseconds },
      })
      await ports.pause(milliseconds)
    }
    const pacing = newPacing()
    const plan = { vendor, key: vendor.needsKey ? ports.key(vendor.id) : null, pacing, fetch: pacedFetch({ fetch: ports.fetch, pause: reportingPause }, vendor, paused, pacing) }
    plans.push(plan)
    return plan
  }
  for (const vendor of scope.kind === 'rates' ? vendors.filter((candidate) => candidate.prices === 'rates') : vendors) {
    if (vendor.prices === 'facts') {
      planOf(vendor)
      continue
    }
    const plan = planOf(vendor)
    const wanted = wantedSeries(vendor, stored, book, clock.day, scope.kind === 'rates' ? scope.wanted : null)
    const covered = wanted.filter((series) => upToDate(stored.series[series.key], series, clock.day))
    upToDateCount += covered.length
    asking.push(...wanted.filter((series) => !covered.includes(series) && (scope.kind !== 'series' || scope.keys.includes(series.key))).map((series) => ({ plan, series })))
  }
  const seriesAsked = askingOrder(asking)
  const changes: FetchChanges = { series: new Map(), splits: [], failures: [] }
  const facts = scope.kind === 'day' ? factWork(plans, stored.facts, book, clock.day) : null
  const ordered: Asking[] = [...seriesAsked.map(({ plan, series }) => ({ plan, ask: () => fetchSeries(plan, series, stored, clock, changes) })), ...(facts?.asks ?? [])]
  ports.progress({ asked: 0, of: ordered.length, leftMilliseconds: pacingLeft(ordered, 0, 0), pause: null })
  for (const [place, { ask }] of ordered.entries()) {
    current = place
    ports.progress({ asked: place + 1, of: ordered.length, leftMilliseconds: pacingLeft(ordered, place, paused.elapsed), pause: null })
    await ask()
  }
  const askedSeries = new Set(seriesAsked.map(({ series }) => series.key))
  // A fetch of a few series asks for no facts, so the day's counts of them stay.
  const factCounts = facts?.counts() ?? { asked: stored.lastFetch?.factsAsked ?? 0, left: stored.lastFetch?.factsLeft ?? 0, keyless: stored.lastFetch?.factsKeyless ?? [] }
  const written: PricesFile = {
    writtenAt: scope.kind === 'rates' ? stored.writtenAt : clock.at,
    lastFetch:
      scope.kind === 'rates'
        ? stored.lastFetch
        : {
            asked: seriesAsked.filter(({ plan }) => !plan.vendor.needsKey || plan.key !== null).length,
            upToDate: upToDateCount,
            factsAsked: factCounts.asked,
            factsLeft: factCounts.left,
            factsKeyless: factCounts.keyless,
          },
    series: { ...stored.series, ...Object.fromEntries(changes.series) },
    splits: mergedSplits(stored.splits, changes.splits),
    failures: scope.kind === 'day' ? changes.failures : [...stored.failures.filter((failure) => !askedSeries.has(failure.series)), ...changes.failures],
    facts: facts?.facts() ?? stored.facts,
  }
  await ports.writePrices(encodePricesFile(written))
  return { kind: 'written', file: written }
}
