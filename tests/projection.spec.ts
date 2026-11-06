import { describe, expect, it } from 'vitest'

import { projection } from '../src/apps/investments/income/domain/projection'
import { shareFromPercent } from '../src/shared/money/percent'
import { euros } from './fixtures/ledger'

describe('the projection', () => {
  it('grows €100,000.00 with €500.00 a month at 5% over 20 years to €468,232.01', () => {
    const projected = projection(euros(100000), euros(500), shareFromPercent(5), 20)
    expect(projected.end).toBe(euros(468232.01))
    expect(projected.years).toHaveLength(21)
    expect(projected.years[0]).toEqual({ year: 0, value: euros(100000) })
    // 3.5% of the end is €16,388.12 a year, €1,365.68 a month. 4% is €18,729.28, €1,560.77 a month.
    expect(projected.withdrawals).toEqual([
      { rate: 0.035, yearly: euros(16388.12), monthly: euros(1365.68) },
      { rate: 0.04, yearly: euros(18729.28), monthly: euros(1560.77) },
    ])
  })

  it('adds each saving at its month end, so a year at 0% adds twelve of them', () => {
    expect(projection(euros(1000), euros(100), shareFromPercent(0), 1).end).toBe(euros(2200))
  })

  it('compounds a year at the yearly rate when nothing is saved', () => {
    expect(projection(euros(1000), euros(0), shareFromPercent(5), 1).end).toBe(euros(1050))
  })

  it('ends at the value now over no years', () => {
    expect(projection(euros(1000), euros(100), shareFromPercent(5), 0)).toMatchObject({ end: euros(1000), years: [{ year: 0, value: euros(1000) }] })
  })
})
