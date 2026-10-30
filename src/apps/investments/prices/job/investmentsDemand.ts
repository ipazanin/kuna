import { isDay, isJsonObject, seriesKey } from '../domain/pricesFile'
import { parsedJson } from './priceJobPorts'

/** The sources the job fetches from. An instrument of any other source, `manual` among them, gets nothing. */
export const JOB_SOURCES = ['tiingo', 'alphavantage'] as const

export type JobSource = (typeof JOB_SOURCES)[number]

/** One listing the job keeps closes of, for every instrument that names it. */
export interface ListingDemand {
  readonly key: string
  readonly source: JobSource
  readonly symbol: string
  readonly currency: string
  /** The earliest first transaction of its instruments, or the first deposit for one with none, such as the benchmark. */
  readonly start: string
}

/** What the prices file needs, as the Investments file has it. */
export interface PriceDemand {
  readonly listings: readonly ListingDemand[]
  /** Every currency other than the euro the ECB keeps rates of for the file. */
  readonly currencies: readonly string[]
  /** The day the rates run from: the start of 2015, or the file's first record if that is earlier. */
  readonly ratesStart: string
}

export type DemandRead = { readonly kind: 'demand'; readonly demand: PriceDemand } | { readonly kind: 'refused'; readonly reason: 'investments-unreadable' | 'investments-newer' }

/** The schema version of the Investments file the job reads. A newer one may have moved the fields it reads. */
const KNOWN_SCHEMA: Readonly<Record<string, number>> = { investments: 1 }
/** Rates the import may need whatever the file holds, so a first import finds them. */
const ALWAYS_RATED = ['USD', 'GBP', 'CHF']
const RATES_FROM = '2015-01-01'
const EURO = 'EUR'
const CURRENCY = /^[A-Z]{3}$/

type StoredRecord = Readonly<Record<string, unknown>>

/** A field as text, as Kuna reads it: text trimmed, and a number as its decimal text. */
function fieldText(record: StoredRecord, name: string): string {
  const value = record[name]
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
}

function earliest(days: readonly string[]): string | null {
  return days.reduce<string | null>((found, day) => (found === null || day < found ? day : found), null)
}

/**
 * Reads only what prices need from the Investments file: each instrument's source and symbol with its first
 * transaction, the currencies its records name, and its first deposit. A record Kuna would refuse is skipped.
 */
export function priceDemand(text: string, today: string): DemandRead {
  const parsed = parsedJson(text)
  if (!isJsonObject(parsed) || parsed.format !== 'kuna' || parsed.app !== 'investments' || !isJsonObject(parsed.schema) || !isJsonObject(parsed.records)) {
    return { kind: 'refused', reason: 'investments-unreadable' }
  }
  const schema = parsed.schema
  const versions = Object.keys(schema).map((contributor) => ({ contributor, version: schema[contributor] }))
  if (versions.some(({ version }) => typeof version !== 'number')) {
    return { kind: 'refused', reason: 'investments-unreadable' }
  }
  if (versions.some(({ contributor, version }) => (version as number) > (KNOWN_SCHEMA[contributor] ?? 0))) {
    return { kind: 'refused', reason: 'investments-newer' }
  }
  const records = parsed.records
  const kind = (name: string): readonly StoredRecord[] => {
    const rows = records[name]
    return Array.isArray(rows) ? rows.filter(isJsonObject) : []
  }
  const dated = (rows: readonly StoredRecord[]): readonly StoredRecord[] => rows.filter((record) => isDay(fieldText(record, 'date')))

  const trades = dated(kind('trade'))
  const spinOffs = dated(kind('spin-off'))
  const cashMovements = dated(kind('cash-movement'))
  const income = dated(kind('income'))
  const exchanges = dated(kind('exchange'))
  const transfers = dated(kind('transfer'))
  const everyDated = [...trades, ...spinOffs, ...cashMovements, ...income, ...exchanges, ...transfers]
  const dayOf = (record: StoredRecord): string => fieldText(record, 'date')
  const firstDeposit = earliest(cashMovements.filter((movement) => fieldText(movement, 'kind') === 'deposit').map(dayOf)) ?? today

  const instruments = kind('instrument').filter((instrument) => JOB_SOURCES.some((source) => source === fieldText(instrument, 'prices')) && fieldText(instrument, 'source_symbol') !== '')
  const listings = new Map<string, ListingDemand>()
  for (const instrument of instruments) {
    const id = fieldText(instrument, 'id')
    const firstTransaction = earliest([...trades.filter((trade) => fieldText(trade, 'instrument') === id), ...spinOffs.filter((spinOff) => fieldText(spinOff, 'received') === id)].map(dayOf))
    const source = fieldText(instrument, 'prices') as JobSource
    const symbol = fieldText(instrument, 'source_symbol')
    const key = seriesKey(source, symbol)
    const start = firstTransaction ?? firstDeposit
    const known = listings.get(key)
    listings.set(key, known === undefined ? { key, source, symbol, currency: fieldText(instrument, 'currency'), start } : { ...known, start: start < known.start ? start : known.start })
  }

  const named = [
    ...kind('instrument').map((instrument) => fieldText(instrument, 'currency')),
    ...[...cashMovements, ...income, ...transfers].map((record) => fieldText(record, 'currency')),
    ...exchanges.flatMap((exchange) => ['sold_currency', 'bought_currency', 'fee_currency'].map((name) => fieldText(exchange, name))),
  ]
  const currencies = [...new Set([...ALWAYS_RATED, ...named.filter((currency) => CURRENCY.test(currency) && currency !== EURO)])]
  const firstRecord = earliest(everyDated.map(dayOf))
  return {
    kind: 'demand',
    demand: { listings: [...listings.values()], currencies, ratesStart: firstRecord !== null && firstRecord < RATES_FROM ? firstRecord : RATES_FROM },
  }
}
