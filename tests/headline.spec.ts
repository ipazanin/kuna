import { describe, expect, it } from 'vitest'

import { headline, runwayInWords } from '../src/features/overview/domain/headline'
import { monthlyProfitAndLoss } from '../src/features/trends/domain/monthlyProfitAndLoss'
import { euros, ledger, windowOf } from './fixtures/ledger'

describe('headline', () => {
  it('tells what the newest complete month brought in and took out', () => {
    const rows = ledger([
      { date: '2026-08-04', amount: 7000, category: 'revenue' },
      { date: '2026-09-04', amount: 7126, category: 'revenue' },
      { date: '2026-09-12', amount: -2817, category: 'travel' },
      { date: '2026-10-02', amount: 50, category: 'revenue' },
    ])
    const months = monthlyProfitAndLoss(rows, windowOf('2026-08-01', '2026-10-02'))

    expect(headline(months, 24.6)).toMatchObject({
      month: '2026-09',
      cameIn: { amount: euros(7126) },
      wentOut: { amount: euros(2817) },
      loss: null,
      cashLasts: 'about 2 years',
    })
  })

  it('says a loss plainly', () => {
    const rows = ledger([
      { date: '2026-09-04', amount: 1000, category: 'revenue' },
      { date: '2026-09-12', amount: -2500, category: 'travel' },
      { date: '2026-10-02', amount: 50, category: 'revenue' },
    ])
    const months = monthlyProfitAndLoss(rows, windowOf('2026-09-01', '2026-10-02'))

    expect(headline(months, 3.2)?.loss).toBe(euros(1500))
  })

  it('has nothing to say before the first complete month', () => {
    const rows = ledger([{ date: '2026-10-02', amount: 50, category: 'revenue' }])
    expect(headline(monthlyProfitAndLoss(rows, windowOf('2026-10-02', '2026-10-02')), null)).toBeNull()
  })
})

describe('runwayInWords', () => {
  it('speaks in months up to a year and a half, then in years', () => {
    expect(runwayInWords(0.4)).toBe('less than a month')
    expect(runwayInWords(1.2)).toBe('about a month')
    expect(runwayInWords(7.6)).toBe('about 8 months')
    expect(runwayInWords(24.6)).toBe('about 2 years')
    expect(runwayInWords(null)).toBeNull()
  })
})
