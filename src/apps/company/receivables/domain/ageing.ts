import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { MatchedInvoice } from './invoiceMatching'

/** How late what is still owed is, by days past its due date, or past its issue date when it has none. */
export const AGEING_BUCKETS = ['not-due', 'days-0-30', 'days-31-60', 'days-61-90', 'days-over-90'] as const

export type AgeingBucket = (typeof AGEING_BUCKETS)[number]

/** Days from the due date, else the issue date, to the day the ageing is taken. Negative before it is due. */
export function daysPastDue(matched: MatchedInvoice, asOf: CivilDate): number {
  return daysBetween(matched.invoice.due ?? matched.invoice.issued, asOf)
}

export function ageingBucketOf(days: number): AgeingBucket {
  if (days < 0) return 'not-due'
  if (days <= 30) return 'days-0-30'
  if (days <= 60) return 'days-31-60'
  if (days <= 90) return 'days-61-90'
  return 'days-over-90'
}

/** What is still owed, split by how late it is on the given day. Every bucket is present, zero when empty. */
export function ageingOf(invoices: readonly MatchedInvoice[], asOf: CivilDate): Readonly<Record<AgeingBucket, Money>> {
  const totals = Object.fromEntries(AGEING_BUCKETS.map((bucket) => [bucket, ZERO])) as Record<AgeingBucket, Money>
  for (const matched of invoices) {
    if (matched.remaining > 0) {
      const bucket = ageingBucketOf(daysPastDue(matched, asOf))
      totals[bucket] = addMoney(totals[bucket], matched.remaining)
    }
  }
  return totals
}

export interface AmountsOwed {
  /** What the invoices still have unpaid. */
  readonly outstanding: Money
  /** The part of it past its due date, or past the issue date for an invoice without one. */
  readonly overdue: Money
  readonly openCount: number
  readonly overdueCount: number
}

/** What the invoices still have unpaid on the given day, and how much of it is late. */
export function amountsOwed(invoices: readonly MatchedInvoice[], asOf: CivilDate): AmountsOwed {
  const open = invoices.filter((invoice) => invoice.remaining > 0)
  const late = open.filter((invoice) => daysPastDue(invoice, asOf) > 0)
  return {
    outstanding: open.reduce((total, invoice) => addMoney(total, invoice.remaining), ZERO),
    overdue: late.reduce((total, invoice) => addMoney(total, invoice.remaining), ZERO),
    openCount: open.length,
    overdueCount: late.length,
  }
}
