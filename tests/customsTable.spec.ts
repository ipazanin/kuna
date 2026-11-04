import { describe, expect, it } from 'vitest'

import { CUSTOMS_TABLE, customsEstimate } from '../src/apps/assets/carValue/domain/customsTable'
import { civil, euros } from './fixtures/ledger'

describe('the customs table of NN 1/2017', () => {
  it('has 56 rows from first registration to 180 months, each starting where the one before ends', () => {
    expect(CUSTOMS_TABLE).toHaveLength(56)
    expect(CUSTOMS_TABLE[0]).toEqual({ from: 0, to: 1, share: 9600 })
    expect(CUSTOMS_TABLE.at(-1)).toEqual({ from: 168, to: 180, share: 1932 })
    expect(CUSTOMS_TABLE.slice(1).every((row, place) => row.from === CUSTOMS_TABLE[place]!.to)).toBe(true)
  })

  it('estimates a car bought new for 30,000.00 at 57.90% after 33 months', () => {
    // 30,000.00 × 57.90% = 17,370.00, since 15 Jan 2024 to 4 Nov 2026 is 33 whole months, in "32 do 34 mjeseci".
    expect(customsEstimate(euros(30_000), civil('2024-01-15'), civil('2024-01-15'), civil('2026-11-04'))).toEqual({ cents: euros(17_370), onDay: { months: 33, share: 5790 }, whenBought: null })
  })

  it('moves to the next row on the day its lower bound is reached, and starts at 96%', () => {
    expect(customsEstimate(euros(30_000), civil('2024-01-15'), civil('2024-01-15'), civil('2026-11-15')).onDay).toEqual({ months: 34, share: 5648 })
    expect(customsEstimate(euros(30_000), civil('2024-01-15'), civil('2024-01-15'), civil('2024-02-14'))).toEqual({ cents: euros(28_800), onDay: { months: 0, share: 9600 }, whenBought: null })
  })

  it('counts only what a car bought used lost since it was bought', () => {
    // Bought at 24 months for 20,000.00 and seen at 36: 20,000.00 × 55.06 ÷ 63.58 = 17,319.91.
    expect(customsEstimate(euros(20_000), civil('2024-01-15'), civil('2022-01-15'), civil('2025-01-15'))).toEqual({
      cents: euros(17_319.91),
      onDay: { months: 36, share: 5506 },
      whenBought: { months: 24, share: 6358 },
    })
  })

  it('holds the last row after 180 months', () => {
    expect(customsEstimate(euros(30_000), civil('2010-01-01'), civil('2010-01-01'), civil('2026-11-04'))).toMatchObject({ cents: euros(5_796), onDay: { months: 202, share: 1932 } })
  })

  it('counts a month from the 31st to the last day of a shorter month', () => {
    expect(customsEstimate(euros(10_000), civil('2025-01-31'), civil('2025-01-31'), civil('2025-02-27')).onDay.months).toBe(0)
    expect(customsEstimate(euros(10_000), civil('2025-01-31'), civil('2025-01-31'), civil('2025-02-28')).onDay.months).toBe(1)
  })
})
