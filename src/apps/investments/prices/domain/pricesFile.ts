/** The prices file Kuna writes after fetching closes and reads for the figures. Every figure stays the text a vendor sent. */

const FORMAT = 'kuna-prices'
const VERSION = 3

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
  /** The earliest day Kuna asked the vendor for, so it asks again only when an earlier record needs more. The first close is the earliest day the vendor has. */
  readonly from: string
  readonly closes: readonly CloseRow[]
  /** The day of the last fetch the vendor answered for it, so a weekday with no close, such as a market holiday, is not asked again. Null before one. */
  readonly checked: string | null
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
  /** The vendor sent a note instead of an answer, neither a limit nor a paid endpoint, such as one about maintenance. */
  'message',
] as const

export type FailureReason = (typeof FAILURE_REASONS)[number]

/** What failed on the last fetch. */
export interface PriceFailure {
  readonly series: string
  readonly day: string
  readonly reason: FailureReason
}

/** What the last fetch did: the series it asked for, those it left because their closes were up to date, and the facts it asked for and left to a later day by a vendor's daily limit. */
export interface LastFetch {
  readonly asked: number
  readonly upToDate: number
  readonly factsAsked: number
  readonly factsLeft: number
  /** The vendors of facts it wanted something from and had no key for, so a browser that holds one of those keys fetches again. */
  readonly factsKeyless: readonly string[]
}

/** A failure a vendor answered about a holding, kept on its fact so the fact is not asked for again until it is due. */
export const FACT_FAILURES = ['unknown-symbol', 'not-on-free-key', 'refused', 'limit', 'unreadable', 'message'] as const satisfies readonly FailureReason[]

export type FactFailure = (typeof FACT_FAILURES)[number]

/**
 * A company's profile in the vendor's words, each part null where the answer had none: its industry, its home country,
 * the exchange it lists on, its market capitalisation as decimal text in the vendor's unit and the currency of its
 * filings, and its IPO day. `failed` is why the vendor sent nothing, or null for an answer.
 */
export interface ProfileFact {
  readonly asked: string
  readonly industry: string | null
  readonly country: string | null
  readonly exchange: string | null
  readonly marketCap: string | null
  readonly currency: string | null
  readonly ipo: string | null
  readonly failed: FactFailure | null
}

/** A sector in the vendor's words and its weight as the decimal text of a fraction, such as `["INFORMATION TECHNOLOGY", "0.251"]`. */
export type SectorWeightRow = readonly [sector: string, weight: string]

/**
 * A fund's profile in the vendor's words, each part null where the answer had none: its expense ratio and dividend
 * yield as decimal text of a fraction, its net assets as decimal text, its inception day, whether it is leveraged in
 * the vendor's word, how many holdings it lists, and its weights by sector. `failed` is why the vendor sent nothing,
 * or null for an answer.
 */
export interface FundFact {
  readonly asked: string
  readonly expenseRatio: string | null
  readonly netAssets: string | null
  readonly inception: string | null
  readonly leveraged: string | null
  readonly holdings: number | null
  readonly dividendYield: string | null
  readonly sectors: readonly SectorWeightRow[]
  readonly failed: FactFailure | null
}

/** A dividend's ex day, its payment day and its amount a unit as decimal text, such as `["2026-11-14", "2026-12-15", "0.3100"]`. */
export type DividendRow = readonly [exDay: string, paymentDay: string, amount: string]

/** The dividends a vendor lists from the day asked on. */
export interface DividendsFact {
  readonly asked: string
  readonly dividends: readonly DividendRow[]
}

/** What a listing is, in the vendor's words, or null where its search did not find it. */
export interface TypeFact {
  readonly asked: string
  readonly type: string | null
}

/**
 * What vendors answered about instruments, beside the closes, each kept by vendor and the symbol or ISIN asked, with
 * the day it was asked. An empty answer is kept too, so it is not asked again.
 */
export interface FetchedFacts {
  readonly profiles: Readonly<Record<string, ProfileFact>>
  readonly funds: Readonly<Record<string, FundFact>>
  readonly dividends: Readonly<Record<string, DividendsFact>>
  readonly types: Readonly<Record<string, TypeFact>>
}

export const NO_FETCHED_FACTS: FetchedFacts = { profiles: {}, funds: {}, dividends: {}, types: {} }

export interface PricesFile {
  /** ISO timestamp of the last fetch's write, null for the empty file Kuna makes. */
  readonly writtenAt: string | null
  /** Null for a file no fetch has written, or one an older Kuna wrote. */
  readonly lastFetch: LastFetch | null
  /** By vendor and its symbol, such as `twelvedata:ABC` or `ecb:USD`, so two instruments on one listing share one. */
  readonly series: Readonly<Record<string, PriceSeries>>
  readonly splits: readonly SplitNote[]
  /** The last fetch's failures only. */
  readonly failures: readonly PriceFailure[]
  readonly facts: FetchedFacts
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
  return { writtenAt: null, lastFetch: null, series: {}, splits: [], failures: [], facts: NO_FETCHED_FACTS }
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
 * The file as Kuna writes it: one line per series and per fact, sorted by key, so Drive's preview reads it and a
 * revision's diff shows one line per series or fact that changed.
 */
export function encodePricesFile(file: PricesFile): string {
  const series = sortedLines(file.series, ({ currency, from, checked, closes }) => ({ currency, from, checked, closes }), '    ')
  const splits = file.splits.map((note) => `    ${JSON.stringify({ series: note.series, date: note.date, new: note.newUnits, old: note.oldUnits })}`)
  const failures = file.failures.map((failure) => `    ${JSON.stringify(failure)}`)
  const { profiles, funds, dividends, types } = file.facts
  const lastFetch =
    file.lastFetch === null
      ? null
      : { asked: file.lastFetch.asked, up_to_date: file.lastFetch.upToDate, facts_asked: file.lastFetch.factsAsked, facts_left: file.lastFetch.factsLeft, facts_keyless: file.lastFetch.factsKeyless }
  const facts = [
    factsBlock('profiles', profiles, ({ asked, industry, country, exchange, marketCap, currency, ipo, failed }) => ({
      asked,
      industry,
      country,
      exchange,
      market_cap: marketCap,
      currency,
      ipo,
      failed,
    })),
    factsBlock('funds', funds, (fund) => ({
      asked: fund.asked,
      expense_ratio: fund.expenseRatio,
      net_assets: fund.netAssets,
      inception: fund.inception,
      leveraged: fund.leveraged,
      holdings: fund.holdings,
      dividend_yield: fund.dividendYield,
      sectors: fund.sectors,
      failed: fund.failed,
    })),
    factsBlock('dividends', dividends, ({ asked, dividends: rows }) => ({ asked, dividends: rows })),
    factsBlock('types', types, ({ asked, type }) => ({ asked, type })),
  ]
  return [
    '{',
    `  "format": ${JSON.stringify(FORMAT)},`,
    `  "version": ${VERSION},`,
    `  "written_at": ${JSON.stringify(file.writtenAt)},`,
    `  "last_fetch": ${JSON.stringify(lastFetch)},`,
    `  "series": ${objectOf(series, '  ')},`,
    `  "splits": ${listOf(splits)},`,
    `  "failures": ${listOf(failures)},`,
    `  "facts": {\n${facts.join(',\n')}\n  }`,
    '}',
    '',
  ].join('\n')
}

function listOf(lines: readonly string[]): string {
  return lines.length === 0 ? '[]' : `[\n${lines.join(',\n')}\n  ]`
}

/** One `"key": value` line per entry, sorted by key. */
function sortedLines<Entry>(entries: Readonly<Record<string, Entry>>, written: (entry: Entry) => unknown, indent: string): string[] {
  return Object.keys(entries)
    .sort()
    .map((key) => `${indent}${JSON.stringify(key)}: ${JSON.stringify(written(entries[key]!))}`)
}

function objectOf(lines: readonly string[], closingIndent: string): string {
  return lines.length === 0 ? '{}' : `{\n${lines.join(',\n')}\n${closingIndent}}`
}

/** One kind of facts inside `facts`, one fact a line. */
function factsBlock<Fact>(kind: keyof FetchedFacts, entries: Readonly<Record<string, Fact>>, written: (fact: Fact) => unknown): string {
  return `    ${JSON.stringify(kind)}: ${objectOf(sortedLines(entries, written, '      '), '    ')}`
}

/**
 * The prices file a text holds, or why it is none. Closes must run oldest first with one a day. A version 1 file has
 * no facts. A version 2 file kept a company's industry and country alone and a fund's sector weights alone, so its
 * profiles and weights read with the day `OLDER_SHAPE_ASKED`, which the next day's fetch asks again.
 */
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
  const file = fileOf(parsed, parsed.version)
  return file === null ? { kind: 'refused', reason: 'not-in-shape' } : { kind: 'read', file }
}

function fileOf(parsed: Readonly<Record<string, unknown>>, version: number): PricesFile | null {
  const { written_at: writtenAt, last_fetch: lastFetch, series, splits, failures, facts } = parsed
  if ((writtenAt !== null && typeof writtenAt !== 'string') || !isJsonObject(series) || !Array.isArray(splits) || !Array.isArray(failures)) {
    return null
  }
  const readLastFetch = lastFetchOf(lastFetch)
  const readFacts = facts === undefined ? NO_FETCHED_FACTS : factsOf(facts, version)
  if (readLastFetch === undefined || readFacts === null) {
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
    lastFetch: readLastFetch,
    series: Object.fromEntries(readSeries) as Record<string, PriceSeries>,
    splits: readSplits as SplitNote[],
    failures: readFailures as PriceFailure[],
    facts: readFacts,
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** The last fetch's counts, null when the file has none, and undefined when they are not in shape. A version 1 file counts no facts. */
function lastFetchOf(candidate: unknown): LastFetch | null | undefined {
  if (candidate === undefined || candidate === null) {
    return null
  }
  if (!isJsonObject(candidate) || !isCount(candidate.asked) || !isCount(candidate.up_to_date)) {
    return undefined
  }
  const factsAsked = candidate.facts_asked ?? 0
  const factsLeft = candidate.facts_left ?? 0
  const factsKeyless = candidate.facts_keyless ?? []
  const keylessRead = Array.isArray(factsKeyless) && factsKeyless.every((vendorId) => typeof vendorId === 'string')
  return isCount(factsAsked) && isCount(factsLeft) && keylessRead
    ? { asked: candidate.asked, upToDate: candidate.up_to_date, factsAsked, factsLeft, factsKeyless: factsKeyless as string[] }
    : undefined
}

/** Each entry read by `read`, or null when the value is no object or an entry is out of shape. */
function entriesOf<Entry>(candidate: unknown, entryOf: (entry: Readonly<Record<string, unknown>>, asked: string) => Entry | null): Readonly<Record<string, Entry>> | null {
  if (!isJsonObject(candidate)) {
    return null
  }
  const entries: Record<string, Entry> = {}
  for (const [key, entry] of Object.entries(candidate)) {
    const read = isJsonObject(entry) && typeof entry.asked === 'string' && isDay(entry.asked) ? entryOf(entry, entry.asked) : null
    if (read === null) {
      return null
    }
    entries[key] = read
  }
  return entries
}

function isTextOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function rowsOf<Row extends readonly string[]>(candidate: unknown, fits: (row: readonly string[]) => boolean): Row[] | null {
  if (!Array.isArray(candidate)) {
    return null
  }
  const rows = candidate as unknown[]
  return rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string') && fits(row as string[])) ? (rows as Row[]) : null
}

/** The day a version 2 file's profiles and fund weights read as asked on, long enough ago to ask them again. */
export const OLDER_SHAPE_ASKED = '2000-01-01'

function isFactFailureOrNull(value: unknown): value is FactFailure | null {
  return value === null || FACT_FAILURES.some((failure) => failure === value)
}

/** A field a version 2 file did not keep reads as null, and so does one a version 3 file kept as null. */
function optionalText(entry: Readonly<Record<string, unknown>>, field: string): string | null | undefined {
  const value = entry[field] ?? null
  return isTextOrNull(value) ? value : undefined
}

function sectorRowsOf(candidate: unknown): SectorWeightRow[] | null {
  return rowsOf<SectorWeightRow>(candidate, (row) => row.length === 2 && isCloseText(row[1]!))
}

function profileOf(entry: Readonly<Record<string, unknown>>, asked: string): ProfileFact | null {
  const [industry, country, exchange, marketCap, currency, ipo] = ['industry', 'country', 'exchange', 'market_cap', 'currency', 'ipo'].map((field) => optionalText(entry, field))
  const failed = entry.failed ?? null
  if (industry === undefined || country === undefined || exchange === undefined || marketCap === undefined || currency === undefined || ipo === undefined || !isFactFailureOrNull(failed)) {
    return null
  }
  return { asked, industry, country, exchange, marketCap, currency, ipo, failed }
}

function fundOf(entry: Readonly<Record<string, unknown>>, asked: string): FundFact | null {
  const [expenseRatio, netAssets, inception, leveraged, dividendYield] = ['expense_ratio', 'net_assets', 'inception', 'leveraged', 'dividend_yield'].map((field) => optionalText(entry, field))
  const holdings = entry.holdings ?? null
  const failed = entry.failed ?? null
  const sectors = sectorRowsOf(entry.sectors)
  if (
    expenseRatio === undefined ||
    netAssets === undefined ||
    inception === undefined ||
    leveraged === undefined ||
    dividendYield === undefined ||
    (holdings !== null && !isCount(holdings)) ||
    !isFactFailureOrNull(failed) ||
    sectors === null
  ) {
    return null
  }
  return { asked, expenseRatio, netAssets, inception, leveraged, holdings, dividendYield, sectors, failed }
}

function factsOf(candidate: unknown, version: number): FetchedFacts | null {
  if (!isJsonObject(candidate)) {
    return null
  }
  const olderShape = version < 3
  const readProfiles = entriesOf(candidate.profiles, profileOf)
  const readFunds = entriesOf(olderShape ? candidate.sectors : candidate.funds, fundOf)
  const dividends = entriesOf(candidate.dividends, (entry, asked): DividendsFact | null => {
    const rows = rowsOf<DividendRow>(entry.dividends, (row) => row.length === 3 && isDay(row[0]!) && isDay(row[1]!) && isCloseText(row[2]!))
    return rows === null ? null : { asked, dividends: rows }
  })
  const types = entriesOf(candidate.types, (entry, asked): TypeFact | null => (isTextOrNull(entry.type) ? { asked, type: entry.type } : null))
  if (readProfiles === null || readFunds === null || dividends === null || types === null) {
    return null
  }
  const askedAgain = <Fact extends { readonly asked: string }>(facts: Readonly<Record<string, Fact>>): Readonly<Record<string, Fact>> =>
    olderShape ? Object.fromEntries(Object.entries(facts).map(([key, fact]) => [key, { ...fact, asked: OLDER_SHAPE_ASKED }])) : facts
  return { profiles: askedAgain(readProfiles), funds: askedAgain(readFunds), dividends, types }
}

function seriesOf(candidate: unknown): PriceSeries | null {
  if (!isJsonObject(candidate) || typeof candidate.currency !== 'string' || typeof candidate.from !== 'string' || !isDay(candidate.from) || !Array.isArray(candidate.closes)) {
    return null
  }
  const checked = candidate.checked ?? null
  if (checked !== null && (typeof checked !== 'string' || !isDay(checked))) {
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
  return { currency: candidate.currency, from: candidate.from, closes, checked }
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
