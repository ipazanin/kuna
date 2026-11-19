import { describe, expect, it } from 'vitest'

import { percentFromBasisPoints, percentFromWhole } from '../src/shared/money/percent'
import { isShared, partChangeDoubt, partShown, typedPart, typedPartChange } from '../src/shared/money/yourPart'
import { civil } from './fixtures/ledger'

describe('typedPart', () => {
  it.each([
    ['50', 5000],
    ['0.8', 80],
    ['0,8', 80],
    ['33.33', 3333],
    ['33,33 %', 3333],
    ['100', 10_000],
    [' 12.5% ', 1250],
  ])('reads %s as %i basis points', (text, points) => {
    expect(typedPart(text)).toBe(percentFromBasisPoints(points))
  })

  it.each(['', '0', '0.00', '100.01', '120', '33.333', '-5', 'half', '1,000'])('reads %s as no part', (text) => {
    expect(typedPart(text)).toBeNull()
  })
})

describe('partShown', () => {
  it('shows a part so typedPart reads it back, and nothing for all of it', () => {
    expect(typedPart(partShown(percentFromBasisPoints(3333)))).toBe(percentFromBasisPoints(3333))
    expect(partShown(percentFromBasisPoints(80))).toMatch(/^0[.,]8$/)
    expect(partShown(undefined)).toBe('')
  })
})

describe('partChangeDoubt', () => {
  it('doubts a change from before the start, then one from a day already taken', () => {
    expect(partChangeDoubt(civil('2020-01-01'), civil('2020-05-04'), true)).toBe('before-start')
    expect(partChangeDoubt(civil('2021-01-01'), civil('2020-05-04'), true)).toBe('same-day')
    expect(partChangeDoubt(civil('2021-01-01'), null, false)).toBeNull()
  })
})

describe('typedPartChange', () => {
  const others = [{ id: 'share-a', from: civil('2023-01-01') }]

  it('keeps the day and the part', () => {
    expect(typedPartChange({ from: '2026-03-01', share: '100' }, civil('2020-05-04'), others, null).change).toEqual({ from: civil('2026-03-01'), share: percentFromWhole(100) })
  })

  it('finds a missing day, one before the start, one another change is from, and no part', () => {
    expect(typedPartChange({ from: 'soon', share: '50' }, null, others, null).faults.from).toBe('no-date')
    expect(typedPartChange({ from: '2020-05-03', share: '50' }, civil('2020-05-04'), others, null).faults.from).toBe('before-start')
    expect(typedPartChange({ from: '2023-01-01', share: '50' }, null, others, null).faults.from).toBe('same-day')
    expect(typedPartChange({ from: '2023-01-01', share: '50' }, null, others, 'share-a').faults.from).toBeNull()
    expect(typedPartChange({ from: '2026-03-01', share: '0' }, null, others, null)).toMatchObject({ faults: { share: 'no-part' }, change: null })
  })
})

describe('isShared', () => {
  it('is shared with a part under all of it from the start or any dated change, and not with no part or a part of all of it', () => {
    const change = { from: civil('2026-03-01'), share: percentFromWhole(100) }
    expect(isShared(percentFromWhole(50), [])).toBe(true)
    expect(isShared(undefined, [change])).toBe(true)
    expect(isShared(undefined, [])).toBe(false)
    expect(isShared(percentFromWhole(100), [])).toBe(false)
  })
})
