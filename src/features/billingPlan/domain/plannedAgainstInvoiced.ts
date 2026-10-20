import type { CivilDate } from '../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthOf } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { moneyFromCents, subtractMoney, sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { settleOpenRows } from '../../../shared/money/settleOpenRows'
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
  /** What each invoice billed above the plan rows it could reach, a rounding difference among them, in issue order. */
  readonly withoutPlan: readonly InvoiceShare[]
}

/**
 * The plan rows of each client against the invoices that billed them. An invoice lists a month's
 * items together with items left over from before, and may bill next month's fee ahead, so no
 * invoice belongs to one row. Instead each client's invoices, in issue order, take the client's
 * rows. An invoice first fills the rows dated up to the end of the month it was issued in: the
 * fewest open rows it equals exactly, or else the rows oldest first, by date and then tab order,
 * the way Receivables lets payments fill invoices. What is left, when it is a fee billed ahead of
 * at least one euro, reaches on to the rows of the next month in the same way. A smaller remainder
 * is a rounding difference, invoiced above the plan, so a cent never part fills a later month.
 * What an invoice cannot place is invoiced with no plan row and is not carried to later rows, and
 * an invoice of zero or less places nothing.
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

/** The least an invoice's remainder must be to bill next month's rows ahead. Less is a rounding difference. */
const AHEAD_AT_LEAST = moneyFromCents(100)

function matchClient(client: string, plan: readonly BillingItem[], invoices: readonly Invoice[]): ClientBillingMatch {
  const rows = [...plan].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sheetRow - later.sheetRow)
  const register = [...invoices].sort((earlier, later) => earlier.issued.localeCompare(later.issued) || earlier.sheetRow - later.sheetRow)
  const shares: InvoiceShare[][] = rows.map(() => [])
  const open: Money[] = rows.map((row) => row.amount)
  const withoutPlan: InvoiceShare[] = []
  /** Places what is left of an invoice on the open rows dated up to `reach`, and returns what it could not place. */
  const place = (invoice: Invoice, amount: Money, reach: CivilDate): Money => {
    const inReach = (index: number) => rows[index]!.date <= reach
    return settleOpenRows(open, amount, inReach, inReach).reduce((left, { index, applied }) => {
      open[index] = subtractMoney(open[index]!, applied)
      shares[index]!.push({ invoice, amount: applied })
      return subtractMoney(left, applied)
    }, amount)
  }
  for (const invoice of register) {
    const issuedIn = monthOf(invoice.issued)
    let left = place(invoice, invoice.amount, lastDayOf(issuedIn))
    if (left >= AHEAD_AT_LEAST) {
      left = place(invoice, left, lastDayOf(addMonths(issuedIn, 1)))
    }
    if (left !== 0) {
      withoutPlan.push({ invoice, amount: left })
    }
  }
  const items = rows.map((row, index): MatchedBillingItem => ({ row, invoiced: subtractMoney(row.amount, open[index]!), open: open[index]!, invoices: shares[index]! }))
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
