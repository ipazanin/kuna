import { describe, expect, it } from 'vitest'

import { monthlyProfitAndLoss } from '../src/features/trends/domain/monthlyProfitAndLoss'
import { euros, ledger, windowOf } from './fixtures/ledger'

const rows = ledger([
  { date: '2025-09-15', amount: 1000, category: 'revenue' },
  ...['2025-10', '2025-11', '2025-12', '2026-01', '2026-02'].flatMap((month, index) => [
    { date: `${month}-04`, amount: 3000 + index * 300, category: 'revenue' },
    { date: `${month}-12`, amount: -1200, category: 'salary-net' },
  ]),
  // March has no rows.
  { date: '2026-04-20', amount: -600, category: 'accounting' },
  { date: '2026-05-03', amount: -50, category: 'ai-services' },
])
const window = windowOf('2025-09-15', '2026-05-03')

describe('monthlyProfitAndLoss', () => {
  const series = monthlyProfitAndLoss(rows, window)

  it('lists every month from the first to the newest, a dry month as zero', () => {
    expect(series.map((month) => month.month)).toEqual([
      '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
    ])
    expect(series[6].lines.net.amount).toBe(0)
  })

  it('marks the opening part-month and the month still filling up as incomplete', () => {
    expect(series.filter((month) => !month.complete).map((month) => month.month)).toEqual(['2025-09', '2026-05'])
  })

  it('carries cost, net and owner earns per month, and net cumulatively', () => {
    expect(series[1].lines).toMatchObject({
      income: { amount: euros(3000) },
      cost: { amount: euros(1200) },
      net: { amount: euros(1800) },
      ownerEarns: { amount: euros(3000) },
    })
    expect(series.map((month) => month.cumulativeNet)).toEqual(
      [1000, 2800, 4900, 7300, 10000, 13000, 13000, 12400, 12350].map(euros),
    )
  })

  it('averages three months only when all three are complete', () => {
    expect(series.slice(0, 3).map((month) => month.rolling3)).toEqual([null, null, null])
    // October to December: income 3000, 3300, 3600 and 1200 of cost each month
    expect(series[3].rolling3).toEqual({ income: euros(3300), cost: euros(1200), net: euros(2100) })
    expect(series[8].rolling3).toBeNull()
    expect(series.every((month) => month.rolling12 === null)).toBe(true)
  })

  it('links each month’s lines to that month’s rows', () => {
    expect(series[2].lines.ownerPay.drill).toEqual({
      filters: { period: { preset: 'custom', range: { from: '2025-11-01', to: '2025-11-30' } }, buckets: ['owner-pay'] },
    })
  })
})
