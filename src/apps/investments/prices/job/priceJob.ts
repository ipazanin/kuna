import { decodePricesFile, encodePricesFile, rateSeriesKey } from '../domain/pricesFile'
import type { CloseRow, FailureReason, PriceFailure, PriceSeries, PricesFile, SplitNote } from '../domain/pricesFile'
import { alphaVantagePrices } from './alphaVantage'
import { ecbRates } from './ecb'
import { priceDemand } from './investmentsDemand'
import type { ListingDemand, PriceDemand } from './investmentsDemand'
import type { JobClock, PriceJobPorts } from './priceJobPorts'
import { tiingoPrices } from './tiingo'

/** The script properties the job reads, which the README's setup fills in. */
export const PROPERTIES = {
  investmentsFile: 'INVESTMENTS_FILE_ID',
  pricesFile: 'PRICES_FILE_ID',
  tiingoKey: 'TIINGO_KEY',
  alphaVantageKey: 'ALPHA_VANTAGE_KEY',
} as const

/** What one provider did on a run, for the log. */
interface ProviderTally {
  readonly name: string
  readonly asked: number
  updated: number
  readonly failed: FailureReason[]
}

/** What a run changes in the prices file. */
interface RunChanges {
  readonly series: Map<string, PriceSeries>
  readonly splits: SplitNote[]
  readonly failures: PriceFailure[]
  readonly tallies: ProviderTally[]
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
  const last = series.closes[series.closes.length - 1]
  return last === undefined ? series.from : last[0]
}

function tallyOf(changes: RunChanges, name: string, asked: number): ProviderTally {
  const tally: ProviderTally = { name, asked, updated: 0, failed: [] }
  changes.tallies.push(tally)
  return tally
}

function failed(changes: RunChanges, tally: ProviderTally, series: string, day: string, reason: FailureReason): void {
  changes.failures.push({ series, day, reason })
  tally.failed.push(reason)
}

function fetchTiingo(ports: PriceJobPorts, stored: PricesFile, listings: readonly ListingDemand[], day: string, changes: RunChanges): void {
  const tally = tallyOf(changes, 'Tiingo', listings.length)
  const key = ports.property(PROPERTIES.tiingoKey)
  for (const listing of listings) {
    const known = stored.series[listing.key]
    const history = known === undefined || known.from > listing.start
    const fetched = tiingoPrices(ports, key, listing.symbol, history ? listing.start : lastDayOf(known))
    if (fetched.kind === 'failed') {
      failed(changes, tally, listing.key, day, fetched.reason)
      continue
    }
    tally.updated += 1
    changes.series.set(listing.key, { currency: listing.currency, from: history ? listing.start : known.from, closes: mergedCloses(known?.closes ?? [], fetched.closes) })
    changes.splits.push(...fetched.splits.map((split): SplitNote => ({ series: listing.key, ...split })))
  }
}

function fetchAlphaVantage(ports: PriceJobPorts, stored: PricesFile, listings: readonly ListingDemand[], day: string, changes: RunChanges): void {
  const tally = tallyOf(changes, 'Alpha Vantage', listings.length)
  const key = ports.property(PROPERTIES.alphaVantageKey)
  for (const listing of listings) {
    const known = stored.series[listing.key]
    const history = known === undefined || known.from > listing.start
    const fetched = alphaVantagePrices(ports, key, listing.symbol, history)
    if (fetched.kind === 'failed') {
      failed(changes, tally, listing.key, day, fetched.reason)
      continue
    }
    tally.updated += 1
    if (fetched.historyFailure !== null) {
      failed(changes, tally, listing.key, day, fetched.historyFailure)
    }
    // Month ends that failed for now are asked again on the next run, so the series keeps a later start. Month ends a free key never gets are not.
    const historyDone = fetched.historyFailure === null || fetched.historyFailure === 'not-on-free-key'
    const from = history && historyDone ? listing.start : (known?.from ?? fetched.closes[0]?.[0] ?? day)
    changes.series.set(listing.key, { currency: listing.currency, from, closes: mergedCloses(known?.closes ?? [], fetched.closes) })
  }
}

/** The same day a year earlier, as ISO text compares. */
function yearBefore(day: string): string {
  return `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`
}

/** One currency's rates as stored, with the day the ECB is asked from and the `from` the series gets. */
interface WantedRates {
  readonly currency: string
  readonly key: string
  readonly known: PriceSeries | undefined
  readonly askFrom: string
  readonly from: string
}

function fetchRateGroup(ports: PriceJobPorts, wanted: readonly WantedRates[], day: string, tally: ProviderTally, changes: RunChanges): void {
  if (wanted.length === 0) {
    return
  }
  const askFrom = wanted.reduce((earliest, rates) => (rates.askFrom < earliest ? rates.askFrom : earliest), day)
  const fetched = ecbRates(
    ports,
    wanted.map((rates) => rates.currency),
    askFrom,
  )
  for (const { currency, key, known, from } of wanted) {
    const rows = fetched.kind === 'rates' ? (fetched.rates.get(currency) ?? []) : []
    if (fetched.kind === 'failed' || rows.length === 0) {
      failed(changes, tally, key, day, fetched.kind === 'failed' ? fetched.reason : 'unknown-symbol')
      continue
    }
    tally.updated += 1
    changes.series.set(key, { currency, from, closes: mergedCloses(known?.closes ?? [], rows) })
  }
}

/**
 * Asks the ECB for the history of each new currency in one request and for the latest rates of the others in a second,
 * so a currency the ECB never publishes costs one small request a day, not the history of all the others. A currency
 * with no rate in the year before the newest stored one is no longer published, as the kuna since 2023, and keeps what
 * it has.
 */
function fetchRates(ports: PriceJobPorts, stored: PricesFile, demand: PriceDemand, day: string, changes: RunChanges): void {
  const histories: WantedRates[] = []
  const continuing: WantedRates[] = []
  for (const currency of demand.currencies) {
    const key = rateSeriesKey(currency)
    const known = stored.series[key]
    if (known === undefined || known.from > demand.ratesStart) {
      histories.push({ currency, key, known, askFrom: demand.ratesStart, from: demand.ratesStart })
    } else {
      continuing.push({ currency, key, known, askFrom: lastDayOf(known), from: known.from })
    }
  }
  const newest = continuing.reduce((latest, rates) => (rates.askFrom > latest ? rates.askFrom : latest), '')
  const published = continuing.filter((rates) => rates.askFrom >= yearBefore(newest))
  const tally = tallyOf(changes, 'ECB', histories.length + published.length)
  fetchRateGroup(ports, histories, day, tally, changes)
  fetchRateGroup(ports, published, day, tally, changes)
}

/** The stored notes and the new ones, one per series and day. */
function mergedSplits(stored: readonly SplitNote[], reported: readonly SplitNote[]): SplitNote[] {
  const byKey = new Map<string, SplitNote>()
  for (const note of [...stored, ...reported]) {
    byKey.set(`${note.series} ${note.date}`, note)
  }
  return [...byKey.values()]
}

/** A tally as a log line: counts only, never a symbol or a figure. */
function tallyLine(tally: ProviderTally): string {
  const reasons = [...new Set(tally.failed)].map((reason) => `${tally.failed.filter((candidate) => candidate === reason).length} ${reason}`)
  return `${tally.name}: ${tally.asked} asked, ${tally.updated} updated${reasons.length === 0 ? '' : `, failed: ${reasons.join(', ')}`}.`
}

function storedPrices(ports: PriceJobPorts, fileId: string): PricesFile {
  let text: string
  try {
    text = ports.readFile(fileId)
  } catch (failure) {
    throw new Error(`Cannot open the prices file that ${PROPERTIES.pricesFile} names.`, { cause: failure })
  }
  const read = decodePricesFile(text)
  if (read.kind === 'refused') {
    throw new Error(`The file ${PROPERTIES.pricesFile} names is no prices file Kuna made (${read.reason}), so the job leaves it as it is.`)
  }
  return read.file
}

/**
 * One daily run: reads the Investments file for what needs prices, fetches the latest closes and the history of any new
 * series, and overwrites the prices file. A provider that fails keeps its series as they were, with the failure noted
 * in the file. When the Investments file cannot be read, the note is all that changes and the run throws after writing
 * it. It returns the log, which holds counts only.
 */
export function runPriceJob(ports: PriceJobPorts, clock: JobClock): readonly string[] {
  const investmentsId = ports.property(PROPERTIES.investmentsFile)
  const pricesId = ports.property(PROPERTIES.pricesFile)
  if (investmentsId === null || pricesId === null) {
    throw new Error(`Set the script properties ${PROPERTIES.investmentsFile} and ${PROPERTIES.pricesFile} first.`)
  }
  const stored = storedPrices(ports, pricesId)
  let investments: ReturnType<typeof priceDemand>
  try {
    investments = priceDemand(ports.readFile(investmentsId), clock.day)
  } catch {
    investments = { kind: 'refused', reason: 'investments-unreadable' }
  }
  if (investments.kind === 'refused') {
    ports.writeFile(pricesId, encodePricesFile({ ...stored, writtenAt: clock.at, failures: [{ series: null, day: clock.day, reason: investments.reason }] }))
    throw new Error(`Stopped with nothing fetched: ${investments.reason}.`)
  }

  const { demand } = investments
  const changes: RunChanges = { series: new Map(), splits: [], failures: [], tallies: [] }
  fetchTiingo(
    ports,
    stored,
    demand.listings.filter((listing) => listing.source === 'tiingo'),
    clock.day,
    changes,
  )
  fetchAlphaVantage(
    ports,
    stored,
    demand.listings.filter((listing) => listing.source === 'alphavantage'),
    clock.day,
    changes,
  )
  fetchRates(ports, stored, demand, clock.day, changes)

  const written: PricesFile = {
    writtenAt: clock.at,
    series: { ...stored.series, ...Object.fromEntries(changes.series) },
    splits: mergedSplits(stored.splits, changes.splits),
    failures: changes.failures,
  }
  ports.writeFile(pricesId, encodePricesFile(written))
  return [
    `Read ${demand.listings.length} listings and ${demand.currencies.length} currencies from the Investments file.`,
    ...changes.tallies.map(tallyLine),
    `Wrote ${Object.keys(written.series).length} series, ${written.splits.length} split notes and ${written.failures.length} failures.`,
  ]
}
