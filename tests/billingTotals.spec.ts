import { describe, expect, it } from 'vitest'

import { billingTotals } from '../src/apps/company/billingPlan/domain/billingTotals'
import { euros } from './fixtures/ledger'
import { invoiceOf, planRow } from './fixtures/billingPlan'

describe('billingTotals', () => {
  const plan = [
    planRow('Monthly Fee', '2025-11-30', 5000),
    planRow('Monthly Fee', '2025-12-31', 5000),
    planRow('Bonus', '2026-01-01', 2500.5),
    planRow('Monthly Fee', '2026-01-31', 5000),
    planRow('Workshop', '2026-01-20', 900, 'south'),
  ]
  const invoices = [
    invoiceOf('1-1-25', 5000, '2025-11-30'),
    invoiceOf('1-1-26', 12500.5, '2026-01-21'),
    invoiceOf('S-1', 1200, '2026-02-02', 'south'),
  ]

  it('sums every plan row and every invoice, and calls the difference not invoiced', () => {
    const all = billingTotals(plan, invoices)

    expect(all.planned).toBe(euros(18400.5))
    expect(all.invoiced).toBe(euros(18700.5))
    expect(all.notInvoiced).toBe(euros(-300))
  })

  it('counts plan rows by the year of their date and invoices by the year they were issued', () => {
    const all = billingTotals(plan, invoices)

    // The December fee is planned in 2025 and invoiced in 2026, on the January invoice.
    expect(all.years).toEqual([
      { year: 2025, planned: euros(10000), invoiced: euros(5000) },
      { year: 2026, planned: euros(8400.5), invoiced: euros(13700.5) },
    ])
  })

  it('is all zero for an empty plan and no invoices', () => {
    expect(billingTotals([], [])).toEqual({ planned: 0, invoiced: 0, notInvoiced: 0, years: [] })
  })
})
