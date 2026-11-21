import { dayLabel } from './dayLabel'
import { firstDayOf, lastDayOf, monthOf } from './monthKey'
import type { MonthKey } from './monthKey'
import type { LedgerWindow } from './ledgerWindow'
import { monthLabel } from './monthLabel'
import { listInWords } from '../text/listInWords'
import { periodRange } from './period'
import type { Period } from './period'
import { words } from './words'

/**
 * The days a period covers, such as "Oct 2025 – Sep 2026". A custom range that does not start and
 * end on a month's edges names its days. A range that reaches into a month the ledger does not
 * cover in full says so, such as "Oct so far". A ledger that starts in the month still filling notes only that it is so far.
 */
export function periodInWords(period: Period, window: LedgerWindow): string {
  const range = periodRange(period, window)
  if (range !== null && (range.from !== firstDayOf(monthOf(range.from)) || range.to !== lastDayOf(monthOf(range.to)))) {
    return `${dayLabel(range.from)} – ${dayLabel(range.to)}`
  }
  const from = range === null ? window.firstMonth : monthOf(range.from)
  const to = range === null ? window.partMonth : monthOf(range.to)
  const span = from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`
  const covers = (month: MonthKey): boolean => from <= month && month <= to
  const notes = [
    ...(window.firstMonth !== window.firstCompleteMonth && window.firstMonth !== window.partMonth && covers(window.firstMonth) ? [words.period.inPart(window.firstMonth)] : []),
    ...(covers(window.partMonth) ? [words.period.soFar(window.partMonth)] : []),
  ]
  return notes.length === 0 ? span : `${span}, ${listInWords(notes)}`
}
