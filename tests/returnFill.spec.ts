import { describe, expect, it } from 'vitest'

import { returnFill } from '../src/apps/investments/performance/presentation/returnFill'

describe("a return's tint", () => {
  it("steps a month's return up at 2% and 5%", () => {
    expect(returnFill(0.02, 'month')).toBe('bg-gain-1')
    expect(returnFill(0.0201, 'month')).toBe('bg-gain-2')
    expect(returnFill(0.05, 'month')).toBe('bg-gain-2')
    expect(returnFill(0.08, 'month')).toBe('bg-gain-3')
    expect(returnFill(-0.01, 'month')).toBe('bg-loss-1')
    expect(returnFill(-0.04, 'month')).toBe('bg-loss-2')
    expect(returnFill(-0.06, 'month')).toBe('bg-loss-3')
  })

  it("steps a year's return up at 10% and 25%", () => {
    expect(returnFill(0.1, 'year')).toBe('bg-gain-1')
    expect(returnFill(0.18, 'year')).toBe('bg-gain-2')
    expect(returnFill(0.2849, 'year')).toBe('bg-gain-3')
    expect(returnFill(-0.09, 'year')).toBe('bg-loss-1')
    expect(returnFill(-0.25, 'year')).toBe('bg-loss-2')
    expect(returnFill(-0.3, 'year')).toBe('bg-loss-3')
  })

  it('leaves a return that shows as 0.00% untinted', () => {
    expect(returnFill(0, 'year')).toBeNull()
    expect(returnFill(0.00004, 'month')).toBeNull()
    expect(returnFill(-0.00004, 'year')).toBeNull()
    expect(returnFill(0.00005, 'month')).toBe('bg-gain-1')
  })
})
