import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { firstDayOf, lastDayOf, monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { monthLabel, shortMonthName } from '../../../../shared/calendar/monthLabel'
import { periodRange } from './filterState'
import type { Period } from './filterState'

/**
 * The days a period covers, such as "Oct 2025 – Sep 2026". A custom range that does not start and
 * end on a month's edges names its days. A range that reaches into a month the ledger does not
 * cover in full says so, such as "Oct so far".
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
    ...(window.firstMonth !== window.firstCompleteMonth && covers(window.firstMonth) ? [`${shortMonthName(window.firstMonth)} in part`] : []),
    ...(covers(window.partMonth) ? [`${shortMonthName(window.partMonth)} so far`] : []),
  ]
  return notes.length === 0 ? span : `${span}, ${notes.join(' and ')}`
}
