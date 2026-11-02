import { describe, expect, it } from 'vitest'

import { dotReach, namedFirst, nearestDotLines } from '../src/shared/charts/chartDots'

describe('the dots a chart marks', () => {
  const categories = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
  const dots = [
    { place: 1, lines: ['Repaid €100.00'] },
    { place: 1, lines: ['New rate 3.85%'] },
    { place: 4, lines: ['Borrowed €50.00'] },
  ]
  const labelOf = (place: number) => `month ${place}`

  it("names every dot at the hovered place, and the nearest place's dots within reach under that place's label", () => {
    const linesOf = nearestDotLines(categories, dots, 1, labelOf)

    expect(linesOf('2026-02')).toEqual(['Repaid €100.00', 'New rate 3.85%'])
    expect(linesOf('2026-04')).toEqual(['month 4', 'Borrowed €50.00'])
    // Two places as near: the earlier one.
    expect(linesOf('2026-03')).toEqual(['month 1', 'Repaid €100.00', 'New rate 3.85%'])
    expect(nearestDotLines(categories, dots, 0, labelOf)('2026-03')).toEqual([])
    expect(linesOf('2027-01')).toEqual([])
  })

  it('reaches about a large dot either side, four times as far on a phone', () => {
    expect([dotReach(300, false), dotReach(300, true), dotReach(30, false)]).toEqual([3, 12, 1])
  })

  it('names the first three entries and sums up the rest in one line', () => {
    expect(namedFirst([1, 2, 3, 4, 5], String, (rest) => `and ${rest.length} more`)).toEqual(['1', '2', '3', 'and 2 more'])
    expect(namedFirst([1, 2], String, () => 'never')).toEqual(['1', '2'])
  })
})
