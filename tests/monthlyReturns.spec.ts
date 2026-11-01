import { describe, expect, it } from 'vitest'

import { monthlyReturns } from '../src/apps/investments/performance/domain/monthlyReturns'
import type { ReturnAgainstIndex } from '../src/apps/investments/performance/domain/monthlyReturns'
import type { GrowthPoint } from '../src/apps/investments/performance/domain/portfolioPerformance'
import { civil } from './fixtures/ledger'

function line(points: readonly (readonly [string, number, number | null])[]): GrowthPoint[] {
  return points.map(([date, portfolio, benchmark]) => ({ date: civil(date), portfolio, benchmark }))
}

function rounded(figures: ReturnAgainstIndex): (number | null)[] {
  return [figures.portfolio, figures.benchmark, figures.gap].map((share) => (share === null ? null : Math.round(share * 1e6) / 1e6))
}

describe('monthly returns', () => {
  const quarter = line([
    ['2024-12-31', 100, 100],
    ['2025-01-31', 102, 101],
    ['2025-02-28', 99.96, 102.01],
    ['2025-03-31', 104.958, 103.0301],
  ])

  it('reads each month over the one before and chains the year', () => {
    const [year] = monthlyReturns(quarter)

    expect(year?.months.map((month) => [month.month, Math.round(month.portfolio * 1e6) / 1e6])).toEqual([
      ['2025-01', 0.02],
      ['2025-02', -0.02],
      ['2025-03', 0.05],
    ])
    expect(Math.round(year!.portfolio * 1e6) / 1e6).toBe(0.04958)
  })

  it('gives the gap to an index up 1% a month in points, and the quarter as the difference of the chained returns', () => {
    const [year] = monthlyReturns(quarter)

    expect(year?.months.map(rounded)).toEqual([
      [0.02, 0.01, 0.01],
      [-0.02, 0.01, -0.03],
      [0.05, 0.01, 0.04],
    ])
    // 4.958% less 3.0301%, not the 2.0 points the monthly gaps add up to.
    expect(rounded(year!)).toEqual([0.04958, 0.030301, 0.019279])
  })

  it('starts the first month on the first day and splits the years', () => {
    const years = monthlyReturns(
      line([
        ['2024-11-15', 100, null],
        ['2024-11-30', 101, null],
        ['2024-12-31', 99.99, null],
        ['2025-01-20', 102.9897, null],
      ]),
    )

    expect(years.map((year) => [year.year, year.months.map((month) => month.month), Math.round(year.portfolio * 1e6) / 1e6, year.benchmark, year.gap])).toEqual([
      [2024, ['2024-11', '2024-12'], -0.0001, null, null],
      [2025, ['2025-01'], 0.03, null, null],
    ])
  })
})
