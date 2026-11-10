import type { FetchedSeries, HandRow, RatesFile } from './ratesFile'
import type { DatedRate } from '../../money/rateBook'

/** The earlier of two days, or of two timestamps, as text compares. */
function earlier(first: string, second: string): string {
  return first < second ? first : second
}

function later(first: string, second: string): string {
  return first > second ? first : second
}

/** Each key of either record, merged by `both` where the two hold it. */
function byKey<Entry>(first: Readonly<Record<string, Entry>>, second: Readonly<Record<string, Entry>>, both: (one: Entry, other: Entry) => Entry): Record<string, Entry> {
  const merged: Record<string, Entry> = { ...first }
  for (const [key, entry] of Object.entries(second)) {
    const held = merged[key]
    merged[key] = held === undefined ? entry : both(held, entry)
  }
  return merged
}

/** Rows oldest first, one a day, where `wins` picks between two rows of the same day. */
function rowsByDay<Row extends readonly [string, ...unknown[]]>(first: readonly Row[], second: readonly Row[], wins: (one: Row, other: Row) => Row): Row[] {
  const byDay = new Map<string, Row>(first.map((row) => [row[0], row]))
  for (const row of second) {
    const held = byDay.get(row[0])
    byDay.set(row[0], held === undefined ? row : wins(held, row))
  }
  return [...byDay.keys()].sort().map((day) => byDay.get(day)!)
}

/** On a day both series hold, the one checked later wins. A tie keeps the larger text, so the order of the two files never matters. */
function mergedSeries(first: FetchedSeries, second: FetchedSeries): FetchedSeries {
  const newer = first.checked === second.checked ? null : first.checked > second.checked ? first : second
  const wins = (one: DatedRate, other: DatedRate): DatedRate => (newer === null ? (one[1] >= other[1] ? one : other) : newer === first ? one : other)
  return { from: earlier(first.from, second.from), checked: later(first.checked, second.checked), rows: rowsByDay(first.rows, second.rows, wins) }
}

/** On a day both hold, the row typed later wins, a removal as much as a rate. A tie keeps the larger text. */
function newerRow(one: HandRow, other: HandRow): HandRow {
  if (one[2] !== other[2]) return one[2] > other[2] ? one : other
  return JSON.stringify(one) >= JSON.stringify(other) ? one : other
}

/**
 * Two copies of the rates file as one, such as this browser's and the one on Drive. Drive refuses no stale write, so the
 * merge is what keeps a rate typed on another device. The same two files in either order give the same file.
 */
export function mergeRates(first: RatesFile, second: RatesFile): RatesFile {
  const writtenAt = first.writtenAt === null ? second.writtenAt : second.writtenAt === null ? first.writtenAt : later(first.writtenAt, second.writtenAt)
  return {
    writtenAt,
    wanted: byKey(first.wanted, second.wanted, earlier),
    ecb: byKey(first.ecb, second.ecb, mergedSeries),
    twelveData: byKey(first.twelveData, second.twelveData, mergedSeries),
    hand: byKey(first.hand, second.hand, (one, other) => rowsByDay(one, other, newerRow)),
  }
}
