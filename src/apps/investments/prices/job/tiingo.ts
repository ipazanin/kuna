import { isCloseText, isDay, isJsonObject } from '../domain/pricesFile'
import type { CloseRow } from '../domain/pricesFile'
import { fetchedText, parsedJson } from './priceJobPorts'
import type { Fetched, PriceJobPorts } from './priceJobPorts'

/** A split on the day it took effect, as whole numbers of new and old units. */
export interface ReportedSplit {
  readonly date: string
  readonly newUnits: string
  readonly oldUnits: string
}

export interface TiingoPrices {
  readonly kind: 'closes'
  readonly closes: readonly CloseRow[]
  readonly splits: readonly ReportedSplit[]
}

/** The largest number of old units a split ratio is looked for over, which covers every reverse split seen in practice. */
const LARGEST_OLD_UNITS = 100

/**
 * Whole new and old units for Tiingo's split factor, such as 10 for 1 from 10 and 1 for 3 from 0.333333. Null for a
 * factor that is no split or whose ratio is not found.
 */
export function splitRatio(factor: number): { readonly newUnits: number; readonly oldUnits: number } | null {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) {
    return null
  }
  for (let oldUnits = 1; oldUnits <= LARGEST_OLD_UNITS; oldUnits += 1) {
    const newUnits = Math.round(factor * oldUnits)
    if (newUnits >= 1 && Math.abs(factor * oldUnits - newUnits) < 0.0001) {
      return { newUnits, oldUnits }
    }
  }
  return null
}

/**
 * The end-of-day closes of a US listing from the day on, and the splits Tiingo reports among them. Tiingo sends closes
 * as JSON numbers, which are written back as their shortest text, exact for up to fifteen significant digits.
 */
export function tiingoPrices(ports: PriceJobPorts, key: string | null, symbol: string, from: string): Fetched<TiingoPrices> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const url = `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(symbol)}/prices?startDate=${from}`
  const answer = fetchedText(ports, url, { Authorization: `Token ${key}` })
  if (answer.kind === 'failed') {
    return answer
  }
  const rows = parsedJson(answer.text)
  if (!Array.isArray(rows)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const closes: CloseRow[] = []
  const splits: ReportedSplit[] = []
  for (const row of rows as unknown[]) {
    if (!isJsonObject(row) || typeof row.date !== 'string' || typeof row.close !== 'number') {
      return { kind: 'failed', reason: 'unreadable' }
    }
    const day = row.date.slice(0, 10)
    const close = String(row.close)
    if (!isDay(day) || !isCloseText(close)) {
      return { kind: 'failed', reason: 'unreadable' }
    }
    closes.push([day, close])
    const ratio = typeof row.splitFactor === 'number' ? splitRatio(row.splitFactor) : null
    if (ratio !== null) {
      splits.push({ date: day, newUnits: String(ratio.newUnits), oldUnits: String(ratio.oldUnits) })
    }
  }
  return { kind: 'closes', closes, splits }
}
