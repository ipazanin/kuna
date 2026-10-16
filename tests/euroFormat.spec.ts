import { describe, expect, it } from 'vitest'

import { formatCompactEuros, formatEuros, formatPercent, formatWholeEuros } from '../src/shared/money/euroFormat'

describe('euro formatting', () => {
  it('groups like the Sheet, with the euro sign in front and cents kept', () => {
    expect(formatEuros(123456789)).toBe('€1,234,567.89')
    expect(formatEuros(5)).toBe('€0.05')
  })

  it('writes a negative amount with a true minus sign before the euro sign', () => {
    expect(formatEuros(-98765)).toBe('−€987.65')
  })

  it('drops the sign for magnitudes and adds a plus when asked', () => {
    expect(formatEuros(-412050, 'magnitude')).toBe('€4,120.50')
    expect(formatEuros(31000, 'always')).toBe('+€310.00')
    expect(formatEuros(0, 'always')).toBe('€0.00')
  })

  it('rounds to whole euros and compacts for axis ticks', () => {
    expect(formatWholeEuros(4821049)).toBe('€48,210')
    expect(formatCompactEuros(4821049)).toBe('€48.2k')
    expect(formatCompactEuros(-120000)).toBe('−€1.2k')
  })

  it('formats shares as percentages with the same sign rules', () => {
    expect(formatPercent(0.124, 'always')).toBe('+12.4%')
    expect(formatPercent(-0.05)).toBe('−5%')
  })
})
