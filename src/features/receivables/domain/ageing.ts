import { daysBetween } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { ZERO, addMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { MatchedInvoice } from './invoiceMatching'

/** How late what is still owed is, by days past its due date, or past its issue date when it has none. */
export const AGEING_BUCKETS = ['not-due', 'days-0-30', 'days-31-60', 'days-61-90', 'days-over-90'] as const

export type AgeingBucket = (typeof AGEING_BUCKETS)[number]

export const AGEING_LABELS: Readonly<Record<AgeingBucket, string>> = {
  'not-due': 'Not due yet',
  'days-0-30': '0–30 days',
  'days-31-60': '31–60 days',
  'days-61-90': '61–90 days',
  'days-over-90': 'Over 90 days',
}

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
