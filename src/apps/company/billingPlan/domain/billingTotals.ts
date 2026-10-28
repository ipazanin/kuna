import { yearOf } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { BillingItem } from '../../workbook/domain/billingPlan'
import type { Invoice } from '../../workbook/domain/workbook'

export interface BillingYear {
  readonly year: number
  /** Plan rows dated in the year. */
  readonly planned: Money
  /** Invoices issued in the year. */
  readonly invoiced: Money
}

export interface BillingTotals {
  readonly planned: Money
  readonly invoiced: Money
  /** Planned less invoiced. Negative when the invoices hold more than the plan. */
  readonly notInvoiced: Money
  /** Every year a plan row or an invoice falls in, oldest first. */
  readonly years: readonly BillingYear[]
}

/** What the plan holds against what was invoiced, over all clients. */
export function billingTotals(plan: readonly BillingItem[], invoices: readonly Invoice[]): BillingTotals {
  const byYear = new Map<number, { planned: Money; invoiced: Money }>()
  const yearEntry = (year: number) => {
    const entry = byYear.get(year) ?? { planned: ZERO, invoiced: ZERO }
    byYear.set(year, entry)
    return entry
  }
  let planned = ZERO
  let invoiced = ZERO
  for (const row of plan) {
    planned = addMoney(planned, row.amount)
    const entry = yearEntry(yearOf(row.date))
    entry.planned = addMoney(entry.planned, row.amount)
  }
  for (const invoice of invoices) {
    invoiced = addMoney(invoiced, invoice.amount)
    const entry = yearEntry(yearOf(invoice.issued))
    entry.invoiced = addMoney(entry.invoiced, invoice.amount)
  }
  return {
    planned,
    invoiced,
    notInvoiced: subtractMoney(planned, invoiced),
    years: [...byYear].sort(([earlier], [later]) => earlier - later).map(([year, entry]) => ({ year, ...entry })),
  }
}
