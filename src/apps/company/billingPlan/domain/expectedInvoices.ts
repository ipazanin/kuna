import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'
import type { BillingItem } from '../../workbook/domain/billingPlan'
import type { Invoice } from '../../workbook/domain/workbook'
import { plannedAgainstInvoiced } from './plannedAgainstInvoiced'
import type { MatchedBillingItem } from './plannedAgainstInvoiced'

/** What a client is still to be invoiced for the rows dated in one month. */
export interface ExpectedInvoice {
  readonly client: string
  readonly month: MonthKey
  readonly amount: Money
  /** The rows still open, oldest first. */
  readonly items: readonly MatchedBillingItem[]
}

/**
 * The plan rows the invoices have not billed, by month and client, oldest month first. Invoices
 * take rows oldest first, so these are the rows after the invoices' coverage, each expected in the
 * month it is dated in.
 */
export function expectedInvoices(plan: readonly BillingItem[], invoices: readonly Invoice[]): readonly ExpectedInvoice[] {
  return plannedAgainstInvoiced(plan, invoices)
    .flatMap((match) =>
      match.months.filter((month) => month.open > 0).map((month) => ({ client: match.client, month: month.month, amount: month.open, items: month.items.filter((item) => item.open > 0) })),
    )
    .sort((earlier, later) => earlier.month.localeCompare(later.month) || earlier.client.localeCompare(later.client))
}
