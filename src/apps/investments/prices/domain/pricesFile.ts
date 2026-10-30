/** The prices file Kuna writes after fetching closes and reads for the figures. Every figure stays the text a vendor sent. */

const FORMAT = 'kuna-prices'
const VERSION = 1

/** The prices file's name on Drive, beside the Investments file. */
export const PRICES_FILE_NAME = 'kuna-investments-prices.json'

/** The source of the ECB's daily euro reference rates, whose series hold units of a currency per euro. */
export const ECB_SOURCE = 'ecb'

/** A day and its close as decimal text, such as `["2026-10-29", "515.10"]`. */
export type CloseRow = readonly [day: string, close: string]

/** One listing's closes, or one currency's ECB rates, oldest first with one close a day. */
export interface PriceSeries {
  /** The quote currency, or for an ECB series the currency its rates are in. */
  readonly currency: string
  /** The earliest day Kuna asked the vendor for, so it asks again only when an earlier record needs more. */
  readonly from: string
  readonly closes: readonly CloseRow[]
}

/** A split the vendor reported, which Kuna offers to add as a record. `newUnits` and `oldUnits` are whole numbers as text. */
export interface SplitNote {
  readonly series: string
  readonly date: string
  readonly newUnits: string
  readonly oldUnits: string
}

/** Why a series got nothing new. */
export const FAILURE_REASONS = [
  /** This browser keeps no key for the vendor. */
  'no-key',
  /** The request got no answer at all. */
  'no-answer',
  /** The vendor answered with an error status. */
  'refused',
  /** The vendor does not know the symbol or the currency. */
  'unknown-symbol',
  /** The vendor's daily or per-minute limit was reached. */
  'limit',
  /** The vendor keeps the series for paid keys. */
  'not-on-free-key',
  /** The answer was not in the shape Kuna reads. */
  'unreadable',
] as const

export type FailureReason = (typeof FAILURE_REASONS)[number]

/** What failed on the last fetch. */
export interface PriceFailure {
  readonly series: string
  readonly day: string
  readonly reason: FailureReason
}

export interface PricesFile {
  /** ISO timestamp of the last fetch's write, null for the empty file Kuna makes. */
  readonly writtenAt: string | null
  /** By vendor and its symbol, such as `twelvedata:ABC` or `ecb:USD`, so two instruments on one listing share one. */
  readonly series: Readonly<Record<string, PriceSeries>>
  readonly splits: readonly SplitNote[]
  /** The last fetch's failures only. */
  readonly failures: readonly PriceFailure[]
}

/** Why a text is no prices file Kuna can read. */
export type PricesFileRefusal = 'not-json' | 'not-prices' | 'newer' | 'not-in-shape'

export type PricesFileRead = { readonly kind: 'read'; readonly file: PricesFile } | { readonly kind: 'refused'; readonly reason: PricesFileRefusal }

export function seriesKey(source: string, symbol: string): string {
  return `${source}:${symbol}`
}

/** The key of a currency's ECB series. */
export function rateSeriesKey(currency: string): string {
  return seriesKey(ECB_SOURCE, currency)
}

export function emptyPricesFile(): PricesFile {
  return { writtenAt: null, series: {}, splits: [], failures: [] }
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const CLOSE = /^\d+(\.\d{1,12})?$/
const WHOLE = /^[1-9]\d*$/

/** Whether the text is a calendar day written `yyyy-mm-dd`. */
export function isDay(text: string): boolean {
  const match = DAY.exec(text)
  if (match === null) {
    return false
  }
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return utc.toISOString().slice(0, 10) === text
}

/** Whether the text is a close Kuna reads exactly: zero or more with at most twelve places. */
export function isCloseText(text: string): boolean {
  return CLOSE.test(text)
}

/**
 * The file as Kuna writes it: one line per series, sorted by key, so Drive's preview reads it and a revision's diff
 * shows one line per series that changed.
 */
export function encodePricesFile(file: PricesFile): string {
  const series = Object.keys(file.series)
    .sort()
    .map((key) => {
      const { currency, from, closes } = file.series[key]!
      return `    ${JSON.stringify(key)}: ${JSON.stringify({ currency, from, closes })}`
    })
  const splits = file.splits.map((note) => `    ${JSON.stringify({ series: note.series, date: note.date, new: note.newUnits, old: note.oldUnits })}`)
  const failures = file.failures.map((failure) => `    ${JSON.stringify(failure)}`)
  return [
    '{',
    `  "format": ${JSON.stringify(FORMAT)},`,
    `  "version": ${VERSION},`,
    `  "written_at": ${JSON.stringify(file.writtenAt)},`,
    `  "series": ${series.length === 0 ? '{}' : `{\n${series.join(',\n')}\n  }`},`,
    `  "splits": ${listOf(splits)},`,
    `  "failures": ${listOf(failures)}`,
    '}',
    '',
  ].join('\n')
}

function listOf(lines: readonly string[]): string {
  return lines.length === 0 ? '[]' : `[\n${lines.join(',\n')}\n  ]`
}

/** The prices file a text holds, or why it is none. Closes must run oldest first with one a day. */
export function decodePricesFile(text: string): PricesFileRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: 'refused', reason: 'not-json' }
  }
  if (!isJsonObject(parsed) || parsed.format !== FORMAT) {
    return { kind: 'refused', reason: 'not-prices' }
  }
  if (typeof parsed.version !== 'number' || parsed.version > VERSION) {
    return { kind: 'refused', reason: 'newer' }
  }
  const file = fileOf(parsed)
  return file === null ? { kind: 'refused', reason: 'not-in-shape' } : { kind: 'read', file }
}

function fileOf(parsed: Readonly<Record<string, unknown>>): PricesFile | null {
  const { written_at: writtenAt, series, splits, failures } = parsed
  if ((writtenAt !== null && typeof writtenAt !== 'string') || !isJsonObject(series) || !Array.isArray(splits) || !Array.isArray(failures)) {
    return null
  }
  const readSeries = Object.keys(series).map((key) => [key, seriesOf(series[key])] as const)
  const readSplits = splits.map(splitOf)
  const readFailures = failures.map(failureOf)
  if (readSeries.some(([, read]) => read === null) || readSplits.some((read) => read === null) || readFailures.some((read) => read === null)) {
    return null
  }
  return {
    writtenAt,
    series: Object.fromEntries(readSeries) as Record<string, PriceSeries>,
    splits: readSplits as SplitNote[],
    failures: readFailures as PriceFailure[],
  }
}

function seriesOf(candidate: unknown): PriceSeries | null {
  if (!isJsonObject(candidate) || typeof candidate.currency !== 'string' || typeof candidate.from !== 'string' || !isDay(candidate.from) || !Array.isArray(candidate.closes)) {
    return null
  }
  const closes: CloseRow[] = []
  for (const row of candidate.closes as unknown[]) {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || typeof row[1] !== 'string' || !isDay(row[0]) || !isCloseText(row[1])) {
      return null
    }
    const previous = closes[closes.length - 1]
    if (previous !== undefined && previous[0] >= row[0]) {
      return null
    }
    closes.push([row[0], row[1]])
  }
  return { currency: candidate.currency, from: candidate.from, closes }
}

function splitOf(candidate: unknown): SplitNote | null {
  if (!isJsonObject(candidate)) {
    return null
  }
  const { series, date, new: newUnits, old: oldUnits } = candidate
  if (typeof series !== 'string' || typeof date !== 'string' || !isDay(date) || typeof newUnits !== 'string' || typeof oldUnits !== 'string' || !WHOLE.test(newUnits) || !WHOLE.test(oldUnits)) {
    return null
  }
  return { series, date, newUnits, oldUnits }
}

function failureOf(candidate: unknown): PriceFailure | null {
  if (!isJsonObject(candidate)) {
    return null
  }
  const { series, day, reason } = candidate
  if (typeof series !== 'string' || typeof day !== 'string' || !isDay(day) || !FAILURE_REASONS.some((known) => known === reason)) {
    return null
  }
  return { series, day, reason: reason as FailureReason }
}

/** Whether a parsed JSON value is an object, not an array or null. */
export function isJsonObject(candidate: unknown): candidate is Readonly<Record<string, unknown>> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}
