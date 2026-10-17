import { firstDayOf, lastDayOf, monthOf } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { monthLabel } from '../../../shared/calendar/monthLabel'
import { periodRange } from './filterState'
import type { Period } from './filterState'

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })

/**
 * The days a period covers, such as "Oct 2025 – Sept 2026". A custom range that does not start and
 * end on a month's edges names its days. A range that reaches into a month the ledger does not
 * cover in full says so, such as "Oct so far".
 */
export function periodInWords(period: Period, window: LedgerWindow): string {
  const range = periodRange(period, window)
  if (range !== null && (range.from !== firstDayOf(monthOf(range.from)) || range.to !== lastDayOf(monthOf(range.to)))) {
    return `${DAY.format(new Date(range.from))} – ${DAY.format(new Date(range.to))}`
  }
  const from = range === null ? window.firstMonth : monthOf(range.from)
  const to = range === null ? window.partMonth : monthOf(range.to)
  const span = from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`
  const covers = (month: MonthKey): boolean => from <= month && month <= to
  const notes = [
    ...(window.firstMonth !== window.firstCompleteMonth && covers(window.firstMonth) ? [`${monthName(window.firstMonth)} in part`] : []),
    ...(covers(window.partMonth) ? [`${monthName(window.partMonth)} so far`] : []),
  ]
  return notes.length === 0 ? span : `${span}, ${notes.join(' and ')}`
}

function monthName(month: MonthKey): string {
  return MONTH_NAME.format(new Date(`${month}-01`))
}
