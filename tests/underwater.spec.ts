import { describe, expect, it } from 'vitest'

import type { GrowthPoint } from '../src/apps/investments/performance/domain/portfolioPerformance'
import { largestFall } from '../src/apps/investments/performance/domain/riskFigures'
import { underwater } from '../src/apps/investments/performance/domain/underwater'
import { civil } from './fixtures/ledger'

function line(points: readonly (readonly [string, number, number | null])[]): GrowthPoint[] {
  return points.map(([date, portfolio, benchmark]) => ({ date: civil(date), portfolio, benchmark }))
}

describe('the line below its peak', () => {
  const months = line([
    ['2025-01-31', 100, null],
    ['2025-02-28', 120, null],
    ['2025-03-31', 90, null],
    ['2025-04-30', 110, null],
    ['2025-05-31', 130, null],
    ['2025-06-30', 104, null],
  ])

  it('reads each point against the running peak, with the deepest, the one now and the longest stretch', () => {
    const below = underwater(months)

    expect(below?.points.map((point) => Math.round(point.below * 1e4) / 1e4)).toEqual([0, 0, -0.25, -0.0833, 0, -0.2])
    expect(below?.deepest).toBe(-0.25)
    expect(below?.deepest).toBe(largestFall(months.map((point) => point.portfolio)))
    expect(Math.round(below!.now * 1e9) / 1e9).toBe(-0.2)
    expect(below?.longest).toEqual({ from: civil('2025-02-28'), to: civil('2025-05-31'), days: 92, regained: true })
  })

  it('runs a stretch not yet regained to the last day', () => {
    const below = underwater(line([...months.slice(0, 3).map((point) => [point.date, point.portfolio, null] as const), ['2025-08-31', 95, null]]))

    expect(below?.longest).toEqual({ from: civil('2025-02-28'), to: civil('2025-08-31'), days: 184, regained: false })
  })

  it('has no stretch for a line that never fell, and nothing for a single point', () => {
    expect(
      underwater(
        line([
          ['2025-01-31', 100, null],
          ['2025-02-28', 101, null],
        ]),
      )?.longest,
    ).toBeNull()
    expect(underwater(months.slice(0, 1))).toBeNull()
  })
})
