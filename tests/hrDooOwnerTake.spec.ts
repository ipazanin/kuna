import { describe, expect, it } from 'vitest'

import { ownerCost } from '../src/packs/hr-doo/domain/ownerCost'
import { netPayPerMonth, ownerTake, ownerTakeByMonth } from '../src/packs/hr-doo/domain/ownerTake'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { withPackBuckets, PACK_CATEGORIES } from './fixtures/hrDooCategories'
import type { Period } from '../src/features/filters/domain/filterState'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'

const transactions = withPackBuckets(
  ledger([
    { date: '2026-07-04', amount: 9000, category: 'revenue' },
    { date: '2026-07-12', amount: -1100, category: 'salary-net' },
    { date: '2026-07-12', amount: -460, category: 'payroll-contributions' },
    { date: '2026-07-12', amount: -94, category: 'payroll-tax' },
    { date: '2026-08-05', amount: -3000, category: 'owner-loan-out' },
    { date: '2026-08-12', amount: -1100, category: 'salary-net' },
    { date: '2026-08-20', amount: -212.5, category: 'reimbursement-to-owner' },
    { date: '2026-08-28', amount: -1650, category: 'corporate-income-tax' },
    { date: '2026-09-02', amount: 1000, category: 'owner-loan-repaid' },
    { date: '2026-09-02', amount: 40, category: 'reimbursement-from-owner' },
    { date: '2026-09-18', amount: -4000, category: 'dividend' },
    { date: '2026-09-18', amount: -400, category: 'dividend-tax' },
    { date: '2026-10-01', amount: -1100, category: 'salary-net' },
  ]),
)
const window = windowOf('2026-07-04', '2026-10-01')
const lastThree = { preset: 'l3' } as const

function days(from: string, to: string): Period {
  return { preset: 'custom', range: { from: civil(from), to: civil(to) } }
}

describe('owner take', () => {
  it('sums the owner-pay bucket with loans net of repayments, by category in the tab’s order', () => {
    const take = ownerTake(transactions, PACK_CATEGORIES, lastThree, window)

    expect(take.total.amount).toBe(euros(1100 + 3000 + 1100 - 1000 + 4000))
    expect(take.byCategory.map((line) => [line.category, line.amount.amount])).toEqual([
      ['salary-net', euros(2200)],
      ['dividend', euros(4000)],
      ['owner-loan-out', euros(3000)],
      ['owner-loan-repaid', euros(-1000)],
    ])
    expect(take.total.drill.filters).toEqual({ period: lastThree, buckets: ['owner-pay'] })
    expect(take.withoutLoans.amount).toBe(euros(2200 + 4000))
    expect(take.withoutLoans.drill.filters.categories).not.toContain('owner-loan-out')
  })

  it('lists reimbursements beside owner pay, paid to the owner read positive, and leaves them out of the total', () => {
    const take = ownerTake(transactions, PACK_CATEGORIES, lastThree, window)

    expect(take.reimbursements.map((line) => [line.category, line.amount.amount])).toEqual([
      ['reimbursement-to-owner', euros(212.5)],
      ['reimbursement-from-owner', euros(-40)],
    ])
  })

  it('splits owner pay by month for the chart of draws', () => {
    const months = ownerTakeByMonth(transactions, PACK_CATEGORIES, ['2026-08', '2026-09'] as MonthKey[], window)

    expect(months.map((month) => [month.month, month.byCategory['owner-loan-out']?.amount, month.byCategory['owner-loan-repaid']?.amount, month.total.amount])).toEqual([
      ['2026-08', euros(3000), euros(0), euros(4100)],
      ['2026-09', euros(0), euros(-1000), euros(3000)],
    ])
  })
})

describe('net pay per month', () => {
  it('divides the take without loans by the months of a rolling period', () => {
    const take = ownerTake(transactions, PACK_CATEGORIES, lastThree, window)

    // July to September: salary 2,200 and dividend 4,000, the 2,000 of loans left out, over 3 months.
    expect(netPayPerMonth(take, lastThree, window)).toEqual({ perMonth: euros(2066.67), months: 3 })
  })

  it('counts each month the ledger covers only in part as a whole month', () => {
    const allTime = { preset: 'all' } as const
    const take = ownerTake(transactions, PACK_CATEGORIES, allTime, window)

    // July from the 4th and October so far count as one month each: 7,300 over 4 months.
    expect(netPayPerMonth(take, allTime, window)).toEqual({ perMonth: euros(1825), months: 4 })
  })

  it('has no figure for a period outside the ledger', () => {
    const outside = days('2025-01-01', '2025-03-31')

    expect(netPayPerMonth(ownerTake(transactions, PACK_CATEGORIES, outside, window), outside, window)).toBeNull()
  })
})

describe('gross cost of the owner', () => {
  it('adds the taxes with the owner-pay-tax role and leaves corporate income tax out', () => {
    const cost = ownerCost(transactions, PACK_CATEGORIES, lastThree, window)

    expect(cost.take.amount).toBe(euros(8200))
    expect(cost.taxOnPay.amount).toBe(euros(460 + 94 + 400))
    expect(cost.gross.amount).toBe(euros(8200 + 954))
    expect(cost.grossWithoutLoans).toBe(euros(6200 + 954))
    // 6,200 without the 2,000 of loans, over 6,200 plus 954 of tax on it.
    expect(cost.netShare).toBeCloseTo(6200 / 7154, 10)
    expect(cost.netShare?.toFixed(3)).toBe('0.867')
    expect(cost.taxOnPay.drill.filters.categories).toEqual(['payroll-contributions', 'payroll-tax', 'dividend-tax'])
  })

  it('reads a take of 60,000 on a gross cost of 100,000 as 60%', () => {
    const rows = withPackBuckets(
      ledger([
        { date: '2026-03-10', amount: -60000, category: 'salary-net' },
        { date: '2026-03-10', amount: -40000, category: 'payroll-contributions' },
        { date: '2026-03-20', amount: -5000, category: 'owner-loan-out' },
      ]),
    )
    const cost = ownerCost(rows, PACK_CATEGORIES, { preset: 'all' }, windowOf('2026-03-10', '2026-03-20'))

    expect([cost.gross.amount, cost.grossWithoutLoans, cost.netShare]).toEqual([euros(105000), euros(100000), 0.6])
  })

  it('has no share when nothing was paid to the owner', () => {
    const cost = ownerCost(transactions, PACK_CATEGORIES, days('2026-07-01', '2026-07-03'), window)

    expect(cost.netShare).toBeNull()
  })
})
