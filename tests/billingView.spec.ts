// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { billingTotals } from '../src/features/billingPlan/domain/billingTotals'
import { expectedInvoices } from '../src/features/billingPlan/domain/expectedInvoices'
import { itemStatistics } from '../src/features/billingPlan/domain/itemStatistics'
import { plannedAgainstInvoiced } from '../src/features/billingPlan/domain/plannedAgainstInvoiced'
import { billingView } from '../src/features/billingPlan/presentation/billingView'
import { chartTokens } from '../src/shared/charts/chartTokens'
import type { BillingItem } from '../src/features/workbook/domain/billingPlan'
import type { Invoice } from '../src/features/workbook/domain/workbook'
import { invoiceOf, planRow } from './fixtures/billingPlan'

function viewOf(plan: readonly BillingItem[], invoices: readonly Invoice[], year: number) {
  const figures = {
    totals: billingTotals(plan, invoices),
    matches: plannedAgainstInvoiced(plan, invoices),
    statistics: itemStatistics(plan),
    expected: expectedInvoices(plan, invoices),
    fill: { kind: 'rows' as const, rows: [] },
  }
  return billingView(figures, { clients: [], invoices }, year, chartTokens())
}

describe('billingView', () => {
  it('lists the year’s plan rows newest date first, in the tab’s order within a date', () => {
    const plan = [
      planRow('Monthly Fee', '2026-08-31', 5000, 'north', 'August fee'),
      planRow('Monthly Fee', '2026-09-30', 5000, 'north', 'September fee'),
      planRow('Subscription', '2026-09-30', 200, 'north', 'September subscription'),
      planRow('Plane Tickets', '2026-09-12', 140, 'north', 'September ticket'),
      planRow('Monthly Fee', '2025-12-31', 5000, 'north', 'December fee'),
    ]
    const view = viewOf(plan, [invoiceOf('8-1-26', 10000, '2026-08-20')], 2026)

    expect(view.rows.map((row) => row.description)).toEqual(['September fee', 'September subscription', 'September ticket', 'August fee'])
    expect(view.rowsSummary).toBe('4 rows, 3 not invoiced yet')
  })

  it('sums the year in one line and names its largest item', () => {
    const plan = [
      planRow('Monthly Fee', '2026-08-31', 5000, 'north', 'August fee'),
      planRow('Monthly Fee', '2026-09-30', 5000, 'north', 'September fee'),
      planRow('Subscription', '2026-09-30', 200, 'north', 'September subscription'),
    ]
    const view = viewOf(plan, [invoiceOf('8-1-26', 5000, '2026-09-02')], 2026)

    expect(view.yearLine).toEqual({ planned: 1020000, invoiced: 500000, notInvoiced: 520000, rowCount: 3, openRowCount: 2, issuedInYear: 1 })
    expect(view.monthsSummary).toBe('1 of 2 months invoiced, €5,200 not invoiced yet')
    expect(view.itemsSummary).toBe('2 items in 2026, Monthly Fee the largest at 98%')
  })
})
