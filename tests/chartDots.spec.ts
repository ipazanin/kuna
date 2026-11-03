import { describe, expect, it } from 'vitest'

import { dotLinesAt, namedFirst, scatterDots, snappedDot } from '../src/shared/charts/chartDots'
import type { ChartOption } from '../src/shared/charts/echarts'

describe('the dots a chart marks', () => {
  const categories = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
  const dots = [
    { place: 1, lines: ['Repaid €100.00'] },
    { place: 1, lines: ['New rate 3.85%'] },
    { place: 4, lines: ['Borrowed €50.00'] },
  ]

  it('names every dot at the hovered place, in the order the dots come, and nothing at a place with none', () => {
    const linesOf = dotLinesAt(categories, dots)

    expect(linesOf('2026-02')).toEqual(['Repaid €100.00', 'New rate 3.85%'])
    expect(linesOf('2026-05')).toEqual(['Borrowed €50.00'])
    expect(linesOf('2026-03')).toEqual([])
    expect(linesOf('2027-01')).toEqual([])
  })

  it('finds every dot of the scatter series with its value and offset, and none of a line', () => {
    const option: ChartOption = {
      series: [
        { type: 'line', data: [1, 2, 3, 4] },
        { type: 'scatter', data: ['-', 2, '-', 4] },
        { type: 'scatter', data: ['-', { value: 2, symbolOffset: [6, 0] }, 3, '-'] },
      ],
    }

    expect(scatterDots(option)).toEqual([
      { series: 1, place: 1, value: 2, offset: [0, 0] },
      { series: 1, place: 3, value: 4, offset: [0, 0] },
      { series: 2, place: 1, value: 2, offset: [6, 0] },
      { series: 2, place: 2, value: 3, offset: [0, 0] },
    ])
  })

  it('moves the pointer onto the nearest dot within 12 px of its centre, a tap on a phone within 22 px, and keeps a pointer above the line on its own place', () => {
    const centres = [
      { place: 10, x: 100, y: 50 },
      { place: 14, x: 130, y: 50 },
    ]
    const placeAt = (x: number, y: number, phone: boolean) => snappedDot({ x, y }, centres, phone)?.place ?? null

    expect(placeAt(112, 50, false)).toBe(10)
    expect(placeAt(113, 50, false)).toBe(null)
    expect(placeAt(119, 50, false)).toBe(14)
    // 9 across and 9 down is 12.7 px from the centre.
    expect(placeAt(109, 59, false)).toBe(null)
    expect(placeAt(100, 20, true)).toBe(null)
    // Two dots as near: the one that comes first.
    expect(placeAt(115, 50, true)).toBe(10)
    expect(placeAt(78, 50, true)).toBe(10)
    expect(placeAt(77, 50, true)).toBe(null)
  })

  it('names the first three entries and sums up the rest in one line', () => {
    expect(namedFirst([1, 2, 3, 4, 5], String, (rest) => `and ${rest.length} more`)).toEqual(['1', '2', '3', 'and 2 more'])
    expect(namedFirst([1, 2], String, () => 'never')).toEqual(['1', '2'])
  })
})
