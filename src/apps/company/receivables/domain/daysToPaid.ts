import { daysBetween } from '../../../../shared/calendar/civilDate'
import { rangeContains } from '../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { MatchedInvoice } from './invoiceMatching'

export interface DaysToPaid {
  /** Days from issue to the payment that settled it, one per invoice paid in the range, shortest first. */
  readonly days: readonly number[]
  /** Null when no invoice was paid in the range. */
  readonly median: number | null
  readonly mean: number | null
}

/**
 * How long invoices settled in a range took to be paid. The median is the figure, because one
 * invoice paid months late moves a mean a long way. A null range means all time.
 */
export function daysToPaid(invoices: readonly MatchedInvoice[], range: DateRange | null): DaysToPaid {
  const days = invoices
    .flatMap((matched) =>
      matched.status === 'paid' && matched.received !== null && (range === null || rangeContains(range, matched.received))
        ? [daysBetween(matched.invoice.issued, matched.received)]
        : [],
    )
    .sort((shorter, longer) => shorter - longer)
  if (days.length === 0) {
    return { days, median: null, mean: null }
  }
  const middle = Math.floor(days.length / 2)
  return {
    days,
    median: days.length % 2 === 1 ? days[middle]! : (days[middle - 1]! + days[middle]!) / 2,
    mean: days.reduce((total, count) => total + count, 0) / days.length,
  }
}
