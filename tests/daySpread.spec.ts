import { describe, expect, it } from 'vitest'

import { spreadByDays } from '../src/apps/company/packs/hr-doo/domain/accrual/daySpread'
import { sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'

describe('spreadByDays', () => {
  it('gives every month the range touches its days, and the shares add up to the whole', () => {
    const spread = spreadByDays(euros(100), { from: civil('2026-01-31'), to: civil('2026-03-01') })

    expect(spread.totalDays).toBe(30)
    expect(spread.shares.map((share) => [share.month, share.days])).toEqual([
      ['2026-01', 1],
      ['2026-02', 28],
      ['2026-03', 1],
    ])
    expect(sumMoney(spread.shares.map((share) => share.amount))).toBe(euros(100))
  })

  it('rounds the running total, so no cent is lost', () => {
    // 100.00 over 3 days: the running totals are 33.33, 66.67 and 100.00, so March holds 66.67.
    const thirds = spreadByDays(euros(100), { from: civil('2026-03-30'), to: civil('2026-04-01') })
    expect(thirds.shares.map((share) => share.amount)).toEqual([euros(66.67), euros(33.33)])
  })
})
