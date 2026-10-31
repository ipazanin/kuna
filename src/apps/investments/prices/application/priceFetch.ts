import type { PriceFetchPorts } from './pricesPorts'
import type { PriceVendor, VendorFetch, VendorLimits } from './priceVendor'
import { priceDemand } from '../domain/priceDemand'
import type { PriceDemand, RatesWanted } from '../domain/priceDemand'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { decodePricesFile, encodePricesFile, seriesKey } from '../domain/pricesFile'
import type { CloseRow, FailureReason, PriceFailure, PriceSeries, PricesFile, PricesFileRefusal, SplitNote } from '../domain/pricesFile'

/** When the fetch runs: an ISO timestamp and the day in the page's time zone. */
export interface PriceFetchClock {
  readonly at: string
  readonly day: string
}

export type PriceFetchOutcome = { readonly kind: 'written'; readonly file: PricesFile } | { readonly kind: 'refused'; readonly reason: PricesFileRefusal }

/** One series a vendor is asked for, with the earliest day the records need it from. */
interface WantedSeries {
  readonly key: string
  readonly symbol: string
  readonly currency: string
  readonly start: string
}

/** What a fetch changes in the prices file. */
interface FetchChanges {
  readonly series: Map<string, PriceSeries>
  readonly splits: SplitNote[]
  readonly failures: PriceFailure[]
}

/** A vendor's minute, with a second to spare for the time a request takes to reach it. */
const PACING_WINDOW_MILLISECONDS = 61_000

/** Milliseconds paused so far in one fetch, which is all the time the pacing counts on. */
export interface PausedTime {
  elapsed: number
}

/**
 * The fetch through which every request of one vendor goes: it pauses so that no more than the vendor's per-minute
 * limit go out in any window, and past its daily limit it answers as the vendor would, without asking.
 */
export function pacedFetch(ports: Pick<PriceFetchPorts, 'fetch' | 'pause'>, limits: VendorLimits, paused: PausedTime): VendorFetch {
  const sentAt: number[] = []
  return async (url) => {
    if (limits.perDay !== null && sentAt.length >= limits.perDay) {
      return { status: 429, text: '' }
    }
    const windowWait = limits.perMinute !== null && sentAt.length >= limits.perMinute ? sentAt[sentAt.length - limits.perMinute]! + PACING_WINDOW_MILLISECONDS - paused.elapsed : 0
    const gapWait = limits.gapMilliseconds !== null && sentAt.length > 0 ? sentAt[sentAt.length - 1]! + limits.gapMilliseconds - paused.elapsed : 0
    const wait = Math.max(windowWait, gapWait)
    if (wait > 0) {
      await ports.pause(wait)
      paused.elapsed += wait
    }
    sentAt.push(paused.elapsed)
    return ports.fetch(url)
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
function stillPublished(vendor: PriceVendor, stored: PricesFile, wanted: readonly WantedSeries[]): WantedSeries[] {
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

function wantedOf(vendor: PriceVendor, demand: PriceDemand): WantedSeries[] {
  if (vendor.prices === 'rates') {
    return demand.currencies.map((currency) => ({ key: seriesKey(vendor.id, currency), symbol: currency, currency, start: demand.ratesStart }))
  }
  return demand.listings.filter((listing) => listing.source === vendor.id)
}

/** The vendors the records need closes or rates from, in the order given. */
export function vendorsNeeded(vendors: readonly PriceVendor[], book: InvestmentBook, day: string): PriceVendor[] {
  const demand = priceDemand(book, day)
  return vendors.filter((vendor) => wantedOf(vendor, demand).length > 0)
}

/** One fetch's run through the series, which counts each series as it is asked for. */
interface FetchRun {
  readonly clock: PriceFetchClock
  readonly paused: PausedTime
  readonly changes: FetchChanges
  asking(): void
}

async function fetchVendor(ports: PriceFetchPorts, vendor: PriceVendor, wanted: readonly WantedSeries[], stored: PricesFile, run: FetchRun): Promise<void> {
  const { clock, changes } = run
  const failed = (series: WantedSeries, reason: FailureReason): void => {
    changes.failures.push({ series: series.key, day: clock.day, reason })
  }
  const key = vendor.needsKey ? ports.key(vendor.id) : null
  if (vendor.needsKey && key === null) {
    for (const series of wanted) {
      run.asking()
      failed(series, 'no-key')
    }
    return
  }
  const fetch = pacedFetch(ports, vendor.limits, run.paused)
  let limited = false
  for (const series of wanted) {
    run.asking()
    if (limited) {
      failed(series, 'limit')
      continue
    }
    const known = stored.series[series.key]
    const history = known === undefined || known.from > series.start
    const from = history ? series.start : lastDayOf(known)
    const fetched = await vendor.closes(fetch, key, series.symbol, from)
    if (fetched.kind === 'failed') {
      failed(series, fetched.reason)
      limited = fetched.reason === 'limit'
      continue
    }
    if (fetched.earlierFailure !== null) {
      failed(series, fetched.earlierFailure)
    }
    // A close of today may still move while its market is open, so it waits for the next day's fetch.
    const settled = fetched.closes.filter(([day]) => day < clock.day)
    // A new series keeps the last close before its start, so a month-end close covers the days until the first daily one.
    const startIndex = settled.findIndex(([day]) => day >= from)
    const firstKept = startIndex < 0 ? settled.length : history && startIndex > 0 ? startIndex - 1 : startIndex
    const closes = settled.slice(firstKept)
    // Earlier closes that failed for now are asked again next time, so the series keeps a later start. Those a free key never gets are not.
    const reached = fetched.earlierFailure === null || fetched.earlierFailure === 'not-on-free-key'
    const seriesFrom = !history ? known.from : reached ? series.start : (known?.from ?? closes[0]?.[0] ?? clock.day)
    changes.series.set(series.key, { currency: series.currency, from: seriesFrom, closes: mergedCloses(known?.closes ?? [], closes) })
    changes.splits.push(...fetched.splits.map((split): SplitNote => ({ series: series.key, ...split })))
  }
}

/** The stored notes and the new ones, one per series and day. */
function mergedSplits(stored: readonly SplitNote[], reported: readonly SplitNote[]): SplitNote[] {
  const byKey = new Map<string, SplitNote>()
  for (const note of [...stored, ...reported]) {
    byKey.set(`${note.series} ${note.date}`, note)
  }
  return [...byKey.values()]
}

/**
 * Fetches the closes the Investments records need from each vendor, the history of any new series and the latest
 * closes of the others, and overwrites the prices file. A vendor that fails keeps its series as they were, with the
 * failure noted in the file. A file that is no prices file Kuna can read is left as it is.
 *
 * With rates wanted, it fetches the ECB rates alone, those wanted beside those the records need. That is no day's
 * fetch, so the file keeps the time of the last one and the failures it noted for the closes.
 */
export async function fetchPrices(ports: PriceFetchPorts, vendors: readonly PriceVendor[], clock: PriceFetchClock, ratesWanted: RatesWanted | null = null): Promise<PriceFetchOutcome> {
  const read = decodePricesFile(await ports.readPrices())
  if (read.kind === 'refused') {
    return read
  }
  const stored = read.file
  const demand = priceDemand(ports.investments(), clock.day, ratesWanted)
  const fetched = ratesWanted === null ? vendors : vendors.filter((vendor) => vendor.prices === 'rates')
  const plans = fetched.map((vendor) => ({ vendor, wanted: stillPublished(vendor, stored, wantedOf(vendor, demand)) }))
  const total = plans.reduce((sum, plan) => sum + plan.wanted.length, 0)
  let asked = 0
  const changes: FetchChanges = { series: new Map(), splits: [], failures: [] }
  const run: FetchRun = {
    clock,
    paused: { elapsed: 0 },
    changes,
    asking() {
      asked += 1
      ports.progress(asked, total)
    },
  }
  ports.progress(0, total)
  for (const { vendor, wanted } of plans) {
    await fetchVendor(ports, vendor, wanted, stored, run)
  }
  const askedSeries = new Set(plans.flatMap((plan) => plan.wanted.map((series) => series.key)))
  const written: PricesFile = {
    writtenAt: ratesWanted === null ? clock.at : stored.writtenAt,
    series: { ...stored.series, ...Object.fromEntries(changes.series) },
    splits: mergedSplits(stored.splits, changes.splits),
    failures: ratesWanted === null ? changes.failures : [...stored.failures.filter((failure) => !askedSeries.has(failure.series)), ...changes.failures],
  }
  await ports.writePrices(encodePricesFile(written))
  return { kind: 'written', file: written }
}
