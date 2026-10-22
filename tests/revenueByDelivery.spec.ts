import { describe, expect, it } from 'vitest'

import type { Invoice } from '../src/features/workbook/domain/workbook'
import { revenueByDelivery } from '../src/packs/hr-doo/domain/accrual/revenueByDelivery'
import { addMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { INVOICE_RECORDS } from '../src/features/workbook/domain/recordKind'

interface InvoiceSpec {
  readonly number: string
  readonly amount: number
  readonly issued: string
  readonly delivered?: readonly [string, string]
}

function invoice(spec: InvoiceSpec, row: number): Invoice {
  return {
    number: spec.number,
    client: 'example-client',
    item: 'Consulting',
    amount: euros(spec.amount),
    issued: civil(spec.issued),
    due: null,
    deliveryPeriod: spec.delivered === undefined ? null : { from: civil(spec.delivered[0]), to: civil(spec.delivered[1]) },
    id: recordIdOf(INVOICE_RECORDS, `row-${row + 2}`),
  }
}

function invoices(specs: readonly InvoiceSpec[]): Invoice[] {
  return specs.map(invoice)
}

describe('revenueByDelivery', () => {
  it('places an invoice without a delivery period on its issue date', () => {
    const revenue = revenueByDelivery(invoices([{ number: '1-1-25', amount: 5000, issued: '2025-11-28' }]), 2025)

    expect(revenue.total.amount).toBe(euros(5000))
    expect(revenue.months.find((month) => month.month === '2025-11')?.revenue.amount).toBe(euros(5000))
    expect(revenue.invoices[0].periodGiven).toBe(false)
    expect(revenue.total.rules.map((citation) => citation.ruleId)).toEqual(['hr.acc.accrual-basis'])
  })

  it('counts December work invoiced in January in December, and only once across the two years', () => {
    // Delivered 1.12.2025 to 31.1.2026, 62 days, of which 31 in December: half of 6,200.00 each year.
    const register = invoices([{ number: '1-1-26', amount: 6200, issued: '2026-01-20', delivered: ['2025-12-01', '2026-01-31'] }])
    const closingYear = revenueByDelivery(register, 2025)
    const nextYear = revenueByDelivery(register, 2026)

    expect(closingYear.months[11].revenue.amount).toBe(euros(3100))
    expect(closingYear.invoices[0].outsideYear).toBe(euros(3100))
    expect(closingYear.months[11].revenue.steps[0].label).toBe('Invoice 1-1-26, 31 of 62 delivery days')
    expect(nextYear.months[0].revenue.amount).toBe(euros(3100))
    expect(addMoney(closingYear.total.amount, nextYear.total.amount)).toBe(euros(6200))
  })

  it('lists a month no invoice delivers in, with the next invoice that may hold its work', () => {
    const register = invoices([
      { number: '1-1-25', amount: 4000, issued: '2025-10-30', delivered: ['2025-10-01', '2025-10-31'] },
      { number: '2-1-25', amount: 4200, issued: '2025-11-28', delivered: ['2025-11-01', '2025-11-30'] },
      { number: '1-1-26', amount: 12000, issued: '2026-01-21', delivered: ['2026-01-01', '2026-01-31'] },
    ])
    const revenue = revenueByDelivery(register, 2025)

    expect(revenue.total.amount).toBe(euros(8200))
    expect(revenue.uninvoicedMonths.map((gap) => [gap.month, gap.nextInvoice.number])).toEqual([['2025-12', '1-1-26']])
  })

  it('asks nothing about months before the first delivery or after the last invoice', () => {
    const register = invoices([
      { number: '1-1-26', amount: 4000, issued: '2026-06-30', delivered: ['2026-06-01', '2026-06-30'] },
      { number: '2-1-26', amount: 4000, issued: '2026-07-31', delivered: ['2026-07-01', '2026-07-31'] },
    ])

    expect(revenueByDelivery(register, 2026).uninvoicedMonths).toEqual([])
  })

  it('gives twelve empty months for a year with no invoices', () => {
    const revenue = revenueByDelivery([], 2026)

    expect(revenue.total.amount).toBe(euros(0))
    expect(revenue.months).toHaveLength(12)
    expect(revenue.invoices).toEqual([])
    expect(revenue.uninvoicedMonths).toEqual([])
  })
})
