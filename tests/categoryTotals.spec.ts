import { describe, expect, it } from 'vitest'

import { categoryTotals, outsideProfitAndLossTotals } from '../src/apps/company/spending/domain/categoryTotals'
import { euros, ledger, windowOf } from './fixtures/ledger'

const rows = ledger([
  { date: '2026-07-04', amount: 8000, category: 'revenue' },
  { date: '2026-07-05', amount: 2000, category: 'grant-income' },
  { date: '2026-07-06', amount: -100, category: 'client-refund' },
  { date: '2026-07-12', amount: -3000, category: 'owner-loan-out' },
  { date: '2026-07-14', amount: -1000, category: 'equipment' },
  { date: '2026-08-01', amount: 1000, category: 'owner-loan-repaid' },
  { date: '2026-08-02', amount: -400, category: 'reimbursement-to-owner' },
  { date: '2026-08-03', amount: -5000, category: 'internal-transfer' },
  { date: '2026-08-04', amount: -87.36, category: 'zzz-test' },
  { date: '2026-10-01', amount: -1, category: 'travel' },
])
const window = windowOf('2026-07-04', '2026-10-01')
const thirdQuarter = { preset: 'quarter', year: 2026, quarter: 3 } as const

describe('categoryTotals', () => {
  const totals = categoryTotals(rows, thirdQuarter, window)

  it('shares each category within its own direction: income over income, cost over cost', () => {
    // income 9900, cost 3000 (loan out 3000, equipment 1000, repaid -1000)
    expect(totals.map((total) => [total.category, total.direction, total.amount.amount, total.share])).toEqual([
      ['revenue', 'income', euros(8000), 8000 / 9900],
      ['grant-income', 'income', euros(2000), 2000 / 9900],
      ['client-refund', 'income', euros(-100), -100 / 9900],
      ['owner-loan-out', 'cost', euros(3000), 1],
      ['equipment', 'cost', euros(1000), 1000 / 3000],
      ['owner-loan-repaid', 'cost', euros(-1000), -1000 / 3000],
    ])
  })

  it('leaves out financing, neutral and unclassified rows, and the part-month', () => {
    expect(totals.map((total) => total.category)).not.toContain('reimbursement-to-owner')
    expect(totals.map((total) => total.category)).not.toContain('internal-transfer')
    expect(totals.map((total) => total.category)).not.toContain('zzz-test')
    expect(totals.map((total) => total.category)).not.toContain('travel')
  })

  it('links each category to its rows in the period', () => {
    expect(totals[4].amount.drill).toEqual({ filters: { period: thirdQuarter, categories: ['equipment'] } })
  })
})

describe('outsideProfitAndLossTotals', () => {
  it('lists financing categories signed as booked, with no share, and nothing else', () => {
    const outside = outsideProfitAndLossTotals(rows, thirdQuarter, window)

    expect(outside.map((total) => [total.category, total.family, total.amount.amount])).toEqual([
      ['reimbursement-to-owner', 'owner', euros(-400)],
    ])
    expect(outside[0]?.amount.drill.filters).toEqual({ period: thirdQuarter, categories: ['reimbursement-to-owner'] })
  })
})
