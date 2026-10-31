import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { fetchingLine } from '../src/apps/investments/prices/presentation/fetchingLine'

const NOW = Date.parse('2026-10-31T10:00:00.000Z')

describe('the line a fetch under way shows under the header', () => {
  it('counts the series and says about how long the pacing still needs, from a minute on', () => {
    expect(fetchingLine({ asked: 9, of: 25, leftMilliseconds: 125_000, pause: null }, NOW)).toBe('Fetching prices: 9 of 25, about 2 minutes left')
    expect(fetchingLine({ asked: 9, of: 25, leftMilliseconds: 60_000, pause: null }, NOW)).toBe('Fetching prices: 9 of 25, about a minute left')
    expect(fetchingLine({ asked: 24, of: 25, leftMilliseconds: 10_000, pause: null }, NOW)).toBe('Fetching prices: 24 of 25')
    expect(fetchingLine({ asked: 0, of: null, leftMilliseconds: 0, pause: null }, NOW)).toBe('Fetching prices')
  })

  it('names the vendor whose minute is used up and counts its pause down, leaving out a gap too short to read', () => {
    const pause = { vendor: 'Twelve Data', perMinute: 8, until: '2026-10-31T10:00:40.000Z' }
    expect(fetchingLine({ asked: 9, of: 25, leftMilliseconds: 160_000, pause }, NOW)).toBe('Fetching prices: 9 of 25. Twelve Data allows 8 a minute, waiting 40 seconds.')
    expect(fetchingLine({ asked: 9, of: 25, leftMilliseconds: 160_000, pause }, NOW + 36_000)).toBe('Fetching prices: 9 of 25. Twelve Data allows 8 a minute, waiting 4 seconds.')
    const gap = { vendor: 'Alpha Vantage', perMinute: 5, until: '2026-10-31T10:00:01.500Z' }
    expect(fetchingLine({ asked: 3, of: 4, leftMilliseconds: 1_500, pause: gap }, NOW)).toBe('Fetching prices: 3 of 4')
  })
})
