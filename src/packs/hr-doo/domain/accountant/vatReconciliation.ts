import { drillToTransactions } from '../../../../features/filters/domain/drillTarget'
import type { Invoice } from '../../../../features/workbook/domain/workbook'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { vatPosition } from '../accrual/accrualBalanceSheet'
import { accrualBookings } from '../accrual/accrualBookings'
import type { HrDooWorkbook } from '../hrDooPart'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import { tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import type { VatReturn, VatSale } from './vatReturn'

/** Why a sales line does not close on the invoices tab. Null when it does. */
export type SaleProblem = 'no-invoice' | 'other-amount' | 'delivered-in-another-month' | null

interface SaleCheck {
  readonly sale: VatSale
  /** The invoice with the line's number. */
  readonly invoice: Invoice | null
  readonly problem: SaleProblem
}

export interface FiledVatPeriod {
  readonly kind: 'filed'
  readonly period: MonthKey
  readonly vatReturn: VatReturn
  /** The return's carry turned round, so it reads as ours does: positive while the state owes the company. */
  readonly theirCarry: Money
  /** The input VAT of every booking to the end of the period, less the VAT refunded and paid by then. */
  readonly ourCarry: TracedFigure
  readonly carryHolds: boolean
  readonly sales: readonly SaleCheck[]
  readonly salesHold: boolean
}

export type VatPeriod = FiledVatPeriod | { readonly kind: 'not-filed'; readonly period: MonthKey }

/**
 * Each month's VAT return against the books. The carry closes when the VAT position through the
 * month equals what the return carries forward. The VAT settlements count as booked, as the
 * balance sheet counts them, so a refund lowers what the state still owes. A sales line closes on the
 * invoice with its number when the amount is the same and the work was delivered in the month. A
 * month without a return is not filed, and the next return's carry still closes, since the
 * position counts from the first booking.
 */
export function vatPeriods(workbook: HrDooWorkbook, returns: readonly VatReturn[], months: readonly MonthKey[], rules: RuleSource = ruleValue): VatPeriod[] {
  const bookings = accrualBookings(workbook, rules)
  const settlementCategories = categoriesWithRole(workbook.categories, PACK_ROLES.vatSettlement)
  const vatCategories = workbook.categories.filter((category) => category.vat !== 'none').map((category) => category.slug)
  return months.map((period): VatPeriod => {
    const vatReturn = returns.find((candidate) => candidate.period === period)
    if (vatReturn === undefined) {
      return { kind: 'not-filed', period }
    }
    const lastDay = lastDayOf(period)
    const firstDay = workbook.transactions.reduce((earliest, row) => (row.date < earliest ? row.date : earliest), lastDay)
    const toPeriodEnd = { preset: 'custom' as const, range: { from: firstDay, to: lastDay } }
    const settledRows = workbook.transactions.filter((row) => settlementCategories.includes(row.category) && row.date <= lastDay)
    const settled = withDrill(
      tracedFigure('VAT refunded less VAT paid to the end of the period', sumMoney(settledRows.map((row) => row.amount)), 'ledger', []),
      drillToTransactions({ period: toPeriodEnd, categories: settlementCategories }),
    )
    const ourCarry = withDrill(vatPosition(bookings, period, settled), drillToTransactions({ period: toPeriodEnd, categories: [...vatCategories, ...settlementCategories] }))
    const theirCarry = negateMoney(vatReturn.carriedForward)
    const sales = vatReturn.salesOutsideEu.map((sale) => saleCheck(sale, period, workbook.invoices))
    return {
      kind: 'filed',
      period,
      vatReturn,
      theirCarry,
      ourCarry,
      carryHolds: ourCarry.amount === theirCarry,
      sales,
      salesHold: sales.every((check) => check.problem === null),
    }
  })
}

/**
 * The months to set against the books: from the first return filed to the last, leaving out the
 * filed months whose return could not be read, so a month between them without a file is not filed.
 */
export function vatMonthsOf(filed: readonly MonthKey[], returns: readonly VatReturn[]): MonthKey[] {
  const sorted = [...filed].sort()
  const first = sorted[0]
  const last = sorted.at(-1)
  if (first === undefined || last === undefined) return []
  return monthsFrom(first, last).filter((month) => !sorted.includes(month) || returns.some((vatReturn) => vatReturn.period === month))
}

function saleCheck(sale: VatSale, period: MonthKey, invoices: readonly Invoice[]): SaleCheck {
  const invoice = invoices.find((candidate) => candidate.number === sale.invoiceNumber) ?? null
  const problem: SaleProblem =
    invoice === null
      ? 'no-invoice'
      : invoice.amount !== sale.amount
        ? 'other-amount'
        : monthOf(invoice.deliveryPeriod?.from ?? invoice.issued) !== period
          ? 'delivered-in-another-month'
          : null
  return { sale, invoice, problem }
}
