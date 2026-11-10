import { parseCivilDate } from '../../calendar/civilDate'
import type { DatedRate } from '../../money/rateBook'

const FORMAT = 'kuna-rates'
const VERSION = 1

export const RATES_FILE_NAME = 'kuna-rates.json'

/** The mark the rates file carries under Kuna's key on Drive, so any device finds it wherever the person moved it. */
export const RATES_MARK = 'rates'

/** A series a source sent, oldest first with one rate a day. */
export interface FetchedSeries {
  /** The earliest day Kuna asked the source for, so it asks again only when something needs older rates. */
  readonly from: string
  /** The day of the last fetch the source answered, so a day it published nothing, such as a holiday, is not asked again. */
  readonly checked: string
  readonly rows: readonly DatedRate[]
}

/** A rate a person typed or pasted, with when, as an ISO timestamp. A null rate removes the one typed before, so the removal reaches other devices. */
export type HandRow = readonly [day: string, rate: string | null, at: string]

/**
 * The exchange rates file every app reads, `kuna-rates.json`. Rates are text in units of a currency per euro, so the
 * euro is the file's one base. Only `updateRates` writes it.
 */
export interface RatesFile {
  /** ISO timestamp of the last write, null for the empty file Kuna starts from. */
  readonly writtenAt: string | null
  /** Currencies a person added before any record names them, with the first day wanted. */
  readonly wanted: Readonly<Record<string, string>>
  /** The ECB's series, by currency. */
  readonly ecb: Readonly<Record<string, FetchedSeries>>
  /** Twelve Data's series, by currency. */
  readonly twelveData: Readonly<Record<string, FetchedSeries>>
  /** The person's own rates, typed or pasted, by currency, oldest first with one row a day. */
  readonly hand: Readonly<Record<string, readonly HandRow[]>>
}

/** Why a text is no rates file Kuna can read. */
export type RatesFileRefusal = 'not-json' | 'not-rates' | 'newer' | 'not-in-shape'

export type RatesFileRead = { readonly kind: 'read'; readonly file: RatesFile } | { readonly kind: 'refused'; readonly reason: RatesFileRefusal }

export function emptyRatesFile(): RatesFile {
  return { writtenAt: null, wanted: {}, ecb: {}, twelveData: {}, hand: {} }
}

const ECB = 'ecb'
const TWELVE_DATA = 'twelvedata'
const HAND = 'hand'

const CURRENCY = /^[A-Z]{3}$/
const RATE = /^\d+(\.\d{1,12})?$/

function isDay(text: unknown): text is string {
  return typeof text === 'string' && parseCivilDate(text) === text
}

/** A rate Kuna reads exactly, above zero, with at most twelve places. */
function isRate(text: unknown): text is string {
  return typeof text === 'string' && RATE.test(text) && /[1-9]/.test(text)
}

function isTimestamp(text: unknown): text is string {
  return typeof text === 'string' && !Number.isNaN(Date.parse(text))
}

function isJsonObject(candidate: unknown): candidate is Readonly<Record<string, unknown>> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}

/** One `"key": value` line per series, sorted by key. */
function seriesLines(file: RatesFile): string[] {
  const lines: [string, unknown][] = [
    ...Object.entries(file.ecb).map(([currency, series]): [string, unknown] => [`${ECB}:${currency}`, { currency, from: series.from, checked: series.checked, rows: series.rows }]),
    ...Object.entries(file.twelveData).map(([currency, series]): [string, unknown] => [`${TWELVE_DATA}:${currency}`, { currency, from: series.from, checked: series.checked, rows: series.rows }]),
    ...Object.entries(file.hand).map(([currency, rows]): [string, unknown] => [`${HAND}:${currency}`, { currency, rows }]),
  ]
  return lines.sort(([first], [second]) => (first < second ? -1 : 1)).map(([key, series]) => `    ${JSON.stringify(key)}: ${JSON.stringify(series)}`)
}

/** The file as Kuna writes it: one line per series, sorted by key, so a revision's diff shows one line per series that changed. */
export function encodeRatesFile(file: RatesFile): string {
  const series = seriesLines(file)
  const wanted = Object.fromEntries(
    Object.keys(file.wanted)
      .sort()
      .map((currency) => [currency, file.wanted[currency]]),
  )
  return [
    '{',
    `  "format": ${JSON.stringify(FORMAT)},`,
    `  "version": ${VERSION},`,
    `  "written_at": ${JSON.stringify(file.writtenAt)},`,
    `  "wanted": ${JSON.stringify(wanted)},`,
    `  "series": ${series.length === 0 ? '{}' : `{\n${series.join(',\n')}\n  }`}`,
    '}',
    '',
  ].join('\n')
}

/** Whether two files hold the same rates, whenever each was written. */
export function sameRates(first: RatesFile, second: RatesFile): boolean {
  return encodeRatesFile({ ...first, writtenAt: null }) === encodeRatesFile({ ...second, writtenAt: null })
}

/** The rates file a text holds, or why it is none. Rows must run oldest first with one a day. */
export function decodeRatesFile(text: string): RatesFileRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: 'refused', reason: 'not-json' }
  }
  if (!isJsonObject(parsed) || parsed.format !== FORMAT) {
    return { kind: 'refused', reason: 'not-rates' }
  }
  if (typeof parsed.version !== 'number' || parsed.version > VERSION) {
    return { kind: 'refused', reason: 'newer' }
  }
  const file = fileOf(parsed)
  return file === null ? { kind: 'refused', reason: 'not-in-shape' } : { kind: 'read', file }
}

function fileOf(parsed: Readonly<Record<string, unknown>>): RatesFile | null {
  const { written_at: writtenAt, wanted, series } = parsed
  if ((writtenAt !== null && !isTimestamp(writtenAt)) || !isJsonObject(wanted) || !isJsonObject(series)) {
    return null
  }
  if (!Object.entries(wanted).every(([currency, day]) => CURRENCY.test(currency) && isDay(day))) {
    return null
  }
  const file = {
    writtenAt,
    wanted: wanted as Record<string, string>,
    ecb: {} as Record<string, FetchedSeries>,
    twelveData: {} as Record<string, FetchedSeries>,
    hand: {} as Record<string, readonly HandRow[]>,
  }
  for (const [key, candidate] of Object.entries(series)) {
    const [source, currency = ''] = key.split(':')
    if (!CURRENCY.test(currency) || !isJsonObject(candidate) || candidate.currency !== currency) {
      return null
    }
    if (source === ECB || source === TWELVE_DATA) {
      const read = fetchedSeriesOf(candidate)
      if (read === null) return null
      const bySource = source === ECB ? file.ecb : file.twelveData
      bySource[currency] = read
    } else if (source === HAND) {
      const read = handRowsOf(candidate.rows)
      if (read === null) return null
      file.hand[currency] = read
    } else {
      return null
    }
  }
  return file
}

/** Whether each row's day comes after the one before it. */
function oneADay(rows: readonly (readonly unknown[])[]): boolean {
  return rows.every((row, place) => place === 0 || (rows[place - 1]![0] as string) < (row[0] as string))
}

function fetchedSeriesOf(candidate: Readonly<Record<string, unknown>>): FetchedSeries | null {
  const { from, checked, rows } = candidate
  if (!isDay(from) || !isDay(checked) || !Array.isArray(rows)) {
    return null
  }
  const read = (rows as unknown[]).map((row) => (Array.isArray(row) && row.length === 2 && isDay(row[0]) && isRate(row[1]) ? ([row[0], row[1]] as DatedRate) : null))
  return read.every((row) => row !== null) && oneADay(read) ? { from, checked, rows: read } : null
}

function handRowsOf(candidate: unknown): readonly HandRow[] | null {
  if (!Array.isArray(candidate)) {
    return null
  }
  const read = (candidate as unknown[]).map((row) =>
    Array.isArray(row) && row.length === 3 && isDay(row[0]) && (row[1] === null || isRate(row[1])) && isTimestamp(row[2]) ? ([row[0], row[1], row[2]] as HandRow) : null,
  )
  return read.every((row) => row !== null) && oneADay(read) ? read : null
}
