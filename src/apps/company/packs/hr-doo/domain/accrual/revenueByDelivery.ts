import { civilDate } from '../../../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'
import { lastDayOf, monthKey, monthsFrom, yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import type { Invoice } from '../../../../workbook/domain/workbook'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { spreadByDays } from './daySpread'
import type { DaySpread } from './daySpread'

/** One invoice's part of the year. */
export interface InvoiceRevenue {
  readonly invoice: Invoice
  /** False when the tab gives no delivery period and the issue date stands for it. */
  readonly periodGiven: boolean
  readonly delivered: DateRange
  /** What the invoice delivered in the year, built from its months. */
  readonly revenue: TracedFigure
  /** What it delivered before or after the year. */
  readonly outsideYear: Money
}

export interface MonthRevenue {
  readonly month: MonthKey
  readonly revenue: TracedFigure
}

/**
 * A month of the year that no invoice delivers in, while a later invoice exists. Whether that
 * invoice holds the month's work is for the owner to say, so it is listed and never moved.
 */
export interface UninvoicedMonth {
  readonly month: MonthKey
  /** The first invoice issued after the month ended. */
  readonly nextInvoice: Invoice
}

export interface DeliveredRevenue {
  readonly year: number
  readonly total: TracedFigure
  /** January to December. */
  readonly months: readonly MonthRevenue[]
  /** Every invoice that delivered in the year, in the order the tab holds them. */
  readonly invoices: readonly InvoiceRevenue[]
  /** From the first month any invoice delivers in, or January when one delivered before the year. */
  readonly uninvoicedMonths: readonly UninvoicedMonth[]
}

interface PlacedInvoice {
  readonly invoice: Invoice
  readonly delivered: DateRange
  readonly spread: DaySpread
}

/**
 * Revenue recognised in the year by delivery period, so an invoice issued in January for December
 * work counts in December. An invoice spread over several months is split by its days. The amount
 * counts as revenue as it stands, which holds for invoices that carry no Croatian VAT.
 */
export function revenueByDelivery(invoices: readonly Invoice[], year: number, rules: RuleSource = ruleValue): DeliveredRevenue {
  const accrual = rules('hr.acc.accrual-basis', civilDate(year, 1, 1)).citation
  const placed = invoices.map((invoice): PlacedInvoice => {
    const delivered = invoice.deliveryPeriod ?? { from: invoice.issued, to: invoice.issued }
    return { invoice, delivered, spread: spreadByDays(invoice.amount, delivered) }
  })

  const inYear = placed.flatMap(({ invoice, delivered, spread }) => {
    const periodGiven = invoice.deliveryPeriod !== null
    const parts = spread.shares
      .filter((share) => yearOfMonth(share.month) === year)
      .map((share): MonthRevenue => ({
        month: share.month,
        revenue: tracedFigure(
          periodGiven ? `Invoice ${invoice.number}, ${share.days} of ${spread.totalDays} delivery days` : `Invoice ${invoice.number}, on its issue date with no delivery period`,
          share.amount,
          'invoices',
          [accrual],
        ),
      }))
    if (parts.length === 0) {
      return []
    }
    const revenue = figureOf(`Invoice ${invoice.number} delivered in ${year}`, parts, accrual)
    const entry: InvoiceRevenue = { invoice, periodGiven, delivered, revenue, outsideYear: subtractMoney(invoice.amount, revenue.amount) }
    return [{ entry, parts }]
  })

  const months = monthsFrom(monthKey(year, 1), monthKey(year, 12)).map((month): MonthRevenue => {
    const parts = inYear.flatMap((invoice) => invoice.parts.filter((part) => part.month === month))
    return { month, revenue: figureOf(`Revenue delivered in ${monthLabel(month)}`, parts, accrual) }
  })
  const monthsWithRevenue = months.filter((entry) => entry.revenue.steps.length > 0)

  return {
    year,
    total: figureOf(`Revenue delivered in ${year}`, monthsWithRevenue, accrual),
    months,
    invoices: inYear.map((invoice) => invoice.entry),
    uninvoicedMonths: uninvoicedMonths(placed, year),
  }
}

function figureOf(label: string, parts: readonly MonthRevenue[], accrual: RuleCitation): TracedFigure {
  const steps = parts.map((part) => part.revenue)
  return tracedFigure(label, sumMoney(steps.map((step) => step.amount)), 'invoices', [accrual], steps)
}

function uninvoicedMonths(placed: readonly PlacedInvoice[], year: number): readonly UninvoicedMonth[] {
  if (placed.length === 0) {
    return []
  }
  const delivered = new Set(placed.flatMap((entry) => entry.spread.shares.map((share) => share.month)))
  const firstDelivered = [...delivered].sort()[0]
  const january = monthKey(year, 1)
  const start = firstDelivered > january ? firstDelivered : january
  return monthsFrom(start, monthKey(year, 12)).flatMap((month) => {
    if (delivered.has(month)) {
      return []
    }
    const monthEnd = lastDayOf(month)
    const nextInvoice = placed
      .map((entry) => entry.invoice)
      .filter((invoice) => invoice.issued > monthEnd)
      .reduce<Invoice | null>((first, invoice) => (first === null || invoice.issued < first.issued ? invoice : first), null)
    return nextInvoice === null ? [] : [{ month, nextInvoice }]
  })
}
