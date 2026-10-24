import { describe, expect, it } from 'vitest'

import { effectiveTaxRate } from '../src/packs/hr-doo/domain/effectiveTaxRate'
import { payrollCadence } from '../src/packs/hr-doo/domain/payrollCadence'
import { bookingOfAdvance } from '../src/features/workbook/domain/workbook'
import { taxByType, typicalMonthlyAmount } from '../src/packs/hr-doo/domain/taxByType'
import { withPackBuckets, PACK_CATEGORIES } from './fixtures/hrDooCategories'
import type { Period } from '../src/features/filters/domain/filterState'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { OWNER_ADVANCE_RECORDS } from '../src/packs/hr-doo/domain/hrDooKinds'

const transactions = withPackBuckets(
  ledger([
    { date: '2026-05-04', amount: 6000, category: 'revenue' },
    { date: '2026-05-12', amount: -250, category: 'payroll-contributions' },
    { date: '2026-05-12', amount: -210, category: 'payroll-contributions' },
    { date: '2026-05-12', amount: -90, category: 'payroll-tax' },
    { date: '2026-06-04', amount: 6000, category: 'revenue' },
    { date: '2026-06-09', amount: 5000, category: 'grant-income' },
    { date: '2026-06-09', amount: 180, category: 'tax-refund' },
    { date: '2026-06-12', amount: -500, category: 'payroll-contributions' },
    { date: '2026-06-12', amount: -100, category: 'payroll-tax' },
    { date: '2026-06-20', amount: -150, category: 'accounting' },
    { date: '2026-08-04', amount: 6000, category: 'revenue' },
    { date: '2026-08-12', amount: -480, category: 'payroll-contributions' },
    { date: '2026-08-28', amount: -1650, category: 'corporate-income-tax' },
    { date: '2026-09-04', amount: 6000, category: 'revenue' },
    { date: '2026-10-02', amount: 3000, category: 'revenue' },
  ]),
)
const window = windowOf('2026-05-04', '2026-10-02')
const allTime = { preset: 'all' } as const

function days(from: string, to: string): Period {
  return { preset: 'custom', range: { from: civil(from), to: civil(to) } }
}

describe('tax by type', () => {
  it('lists the taxes-bucket categories that moved in the tab’s order, a refund netting against its month', () => {
    const taxes = taxByType(transactions, PACK_CATEGORIES, allTime, window)

    expect(taxes.types.map((type) => [type.category, type.total.amount])).toEqual([
      ['payroll-contributions', euros(1440)],
      ['payroll-tax', euros(190)],
      ['corporate-income-tax', euros(1650)],
      ['tax-refund', euros(-180)],
    ])
    const june = taxes.months.find((month) => month.month === '2026-06')
    expect(june?.byCategory['tax-refund']?.amount).toBe(euros(-180))
    expect(june?.total.amount).toBe(euros(500 + 100 - 180))
    expect(taxes.months.map((month) => month.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
  })

  it('takes the typical month as the median of the months with a payment', () => {
    expect(typicalMonthlyAmount([euros(100), euros(0), euros(301)])).toBe(euros(200.5))
    expect(typicalMonthlyAmount([euros(0)])).toBeNull()
  })
})

describe('effective tax rate', () => {
  it('is net taxes over client revenue, with a refund lowering the taxes and a grant left out of the base', () => {
    const rate = effectiveTaxRate(transactions, PACK_CATEGORIES, { preset: 'l3' }, window)

    // July to September: 480 + 1650 of tax against 12,000 of revenue.
    expect(rate.netTaxes.amount).toBe(euros(2130))
    expect(rate.revenue.amount).toBe(euros(12000))
    expect(rate.rate).toBeCloseTo(2130 / 12000, 10)

    const withRefund = effectiveTaxRate(transactions, PACK_CATEGORIES, days('2026-06-01', '2026-06-30'), window)
    expect(withRefund.netTaxes.amount).toBe(euros(420))
    expect(withRefund.rate).toBeCloseTo(420 / 6000, 10)
  })

  it('has no rate without revenue', () => {
    const rate = effectiveTaxRate(transactions, PACK_CATEGORIES, days('2026-05-05', '2026-05-31'), window)

    expect(rate.rate).toBeNull()
  })
})

describe('payroll cadence', () => {
  it('follows the watched categories of the taxes bucket only', () => {
    expect(payrollCadence(transactions, PACK_CATEGORIES, window).map((cadence) => cadence.category)).toEqual(['payroll-contributions'])
  })

  it('counts a month paid when the owner paid the tax privately', () => {
    const paidPrivately = bookingOfAdvance({ date: civil('2026-07-15'), amount: euros(90), description: 'Paid privately', category: 'payroll-contributions', family: 'taxes', bucket: 'taxes', ownerShare: null, id: recordIdOf(OWNER_ADVANCE_RECORDS, 'row-2') })
    const [cadence] = payrollCadence([...transactions, paidPrivately], PACK_CATEGORIES, window)

    expect(cadence?.months.find((month) => month.month === '2026-07')?.state).toBe('paid')
  })

  it('marks each month paid or missing, and the month still running as not yet due and uncounted', () => {
    const [cadence] = payrollCadence(transactions, PACK_CATEGORIES, window)

    expect(cadence?.months.map((month) => [month.month, month.state])).toEqual([
      ['2026-05', 'paid'],
      ['2026-06', 'paid'],
      ['2026-07', 'missing'],
      ['2026-08', 'paid'],
      ['2026-09', 'missing'],
      ['2026-10', 'not-yet-due'],
    ])
    expect([cadence?.monthsPaid, cadence?.monthsElapsed, cadence?.monthsMissed]).toEqual([3, 5, 2])
    expect(cadence?.typicalMonth).toBe(euros(490))
  })

  it('drills a missed month to the months on either side of it', () => {
    const [cadence] = payrollCadence(transactions, PACK_CATEGORIES, window)

    expect(cadence?.months[2]?.amount.drill.filters).toEqual({
      period: { preset: 'custom', range: { from: '2026-06-01', to: '2026-08-31' } },
      categories: ['payroll-contributions'],
    })
  })
})
