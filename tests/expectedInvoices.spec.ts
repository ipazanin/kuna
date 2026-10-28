import { describe, expect, it } from 'vitest'

import { expectedInvoices } from '../src/apps/company/billingPlan/domain/expectedInvoices'
import { euros } from './fixtures/ledger'
import { invoiceOf, planRow } from './fixtures/billingPlan'

describe('expectedInvoices', () => {
  const plan = [
    planRow('Monthly Fee', '2026-08-31', 5000, 'north', 'August fee'),
    planRow('Monthly Fee', '2026-09-30', 5000, 'north', 'September fee'),
    planRow('Subscription', '2026-09-30', 200, 'north', 'September subscription'),
    planRow('Plane Tickets', '2026-10-12', 310, 'north', 'October ticket'),
    planRow('Monthly Fee', '2026-10-31', 5000, 'north', 'October fee'),
    planRow('Workshop', '2026-10-15', 900, 'south', 'Workshop'),
  ]
  const invoices = [invoiceOf('8-1-26', 5000, '2026-08-20'), invoiceOf('9-1-26', 5100, '2026-09-21'), invoiceOf('10-1-26', 5410, '2026-10-20')]

  it('expects the rows after what the invoices billed, in the month each is dated, client by client', () => {
    const expected = expectedInvoices(plan, invoices.slice(0, 2))

    expect(expected.map((invoice) => [invoice.month, invoice.client, invoice.amount])).toEqual([
      ['2026-09', 'north', euros(100)],
      ['2026-10', 'north', euros(5310)],
      ['2026-10', 'south', euros(900)],
    ])
    expect(expected[0]?.items.map((item) => [item.row.description, item.open])).toEqual([['September subscription', euros(100)]])
  })

  it('leaves out what a later invoice billed', () => {
    const expected = expectedInvoices(plan, invoices)

    expect(expected.map((invoice) => [invoice.month, invoice.client, invoice.amount])).toEqual([['2026-10', 'south', euros(900)]])
  })

  it('expects nothing once every row is billed', () => {
    expect(expectedInvoices(plan.slice(0, 1), invoices.slice(0, 1))).toEqual([])
  })
})
