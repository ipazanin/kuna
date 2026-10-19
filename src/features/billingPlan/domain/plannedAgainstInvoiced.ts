import { addMonths, lastDayOf, monthOf } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { ZERO, addMoney, subtractMoney, sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { BillingItem } from '../../workbook/domain/billingPlan'
import type { Invoice } from '../../workbook/domain/workbook'

/** The part of one invoice that billed one plan row, or that no plan row took. */
export interface InvoiceShare {
  readonly invoice: Invoice
  readonly amount: Money
}

export interface MatchedBillingItem {
  readonly row: BillingItem
  readonly invoiced: Money
  /** What is still to invoice of it, never negative. */
  readonly open: Money
  /** The invoices that billed it, in issue order. */
  readonly invoices: readonly InvoiceShare[]
}

export interface BillingMonth {
  readonly month: MonthKey
  /** The plan rows dated in the month. */
  readonly planned: Money
  /** What invoices billed of those rows, whenever they were issued. */
  readonly invoiced: Money
  readonly open: Money
  /** Oldest first. */
  readonly items: readonly MatchedBillingItem[]
}

export interface ClientBillingMatch {
  readonly client: string
  /** Every month a plan row of the client is dated in, oldest first. */
  readonly months: readonly BillingMonth[]
  /** What each invoice billed beyond the plan rows it could reach, in issue order. */
  readonly withoutPlan: readonly InvoiceShare[]
}

/**
 * The plan rows of each client against the invoices that billed them. An invoice lists a month's
 * items together with items left over from before, and may bill next month's fee ahead, so no
 * invoice belongs to one row. Instead each client's invoices, in issue order, take the client's
 * rows oldest first, by date and then tab order, the way Receivables lets payments fill invoices.
 * An invoice reaches rows dated up to the end of the month after the one it was issued in. What it
 * cannot place there is invoiced with no plan row and is not carried to later rows, and an invoice
 * of zero or less places nothing.
 */
export function plannedAgainstInvoiced(plan: readonly BillingItem[], invoices: readonly Invoice[]): readonly ClientBillingMatch[] {
  const clients = [...new Set([...plan.map((row) => row.client), ...invoices.map((invoice) => invoice.client)])].sort()
  return clients.map((client) =>
    matchClient(
      client,
      plan.filter((row) => row.client === client),
      invoices.filter((invoice) => invoice.client === client),
    ),
  )
}

function matchClient(client: string, plan: readonly BillingItem[], invoices: readonly Invoice[]): ClientBillingMatch {
  const rows = [...plan].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sheetRow - later.sheetRow)
  const register = [...invoices].sort((earlier, later) => earlier.issued.localeCompare(later.issued) || earlier.sheetRow - later.sheetRow)
  const shares: InvoiceShare[][] = rows.map(() => [])
  const filled: Money[] = rows.map(() => ZERO)
  const withoutPlan: InvoiceShare[] = []
  let next = 0
  for (const invoice of register) {
    const reach = lastDayOf(addMonths(monthOf(invoice.issued), 1))
    let left = invoice.amount
    while (left > 0 && next < rows.length && rows[next]!.date <= reach) {
      const open = subtractMoney(rows[next]!.amount, filled[next]!)
      const taken = left < open ? left : open
      filled[next] = addMoney(filled[next]!, taken)
      shares[next]!.push({ invoice, amount: taken })
      left = subtractMoney(left, taken)
      if (filled[next] === rows[next]!.amount) {
        next += 1
      }
    }
    if (left !== 0) {
      withoutPlan.push({ invoice, amount: left })
    }
  }
  const items = rows.map((row, index): MatchedBillingItem => ({ row, invoiced: filled[index]!, open: subtractMoney(row.amount, filled[index]!), invoices: shares[index]! }))
  return { client, months: monthsOf(items), withoutPlan }
}

function monthsOf(items: readonly MatchedBillingItem[]): BillingMonth[] {
  const byMonth = new Map<MonthKey, MatchedBillingItem[]>()
  for (const item of items) {
    const month = monthOf(item.row.date)
    byMonth.set(month, [...(byMonth.get(month) ?? []), item])
  }
  return [...byMonth].map(([month, monthItems]) => ({
    month,
    planned: sumMoney(monthItems.map((item) => item.row.amount)),
    invoiced: sumMoney(monthItems.map((item) => item.invoiced)),
    open: sumMoney(monthItems.map((item) => item.open)),
    items: monthItems,
  }))
}
