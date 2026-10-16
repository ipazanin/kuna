import { describe, expect, it } from 'vitest'

import { findTable, rowLabelled, tileValue, valueBeside } from '../scripts/support/sheetFigures.mjs'

const GRID = [
  ['Title', null, null, null],
  ['Cash on hand', null, 'Runway', null],
  [1234.5, null, 8.9, null],
  [null, null, null, null],
  ['Year', 2025, null, null],
  [null, 'Month', 'Total', 'By account', null],
  [null, '', '', 'ERSTE', 'OTP'],
  [null, '2026-10', 10, 10, 0],
  [null, '2026-09', 12, '', 12],
  [null, '', '', null, ''],
  [null, 'reserved row past the table', null, null, null],
]

describe('sheet figures', () => {
  it('reads a tile’s value from under its label, and a picker’s from beside it', () => {
    expect(tileValue(GRID, 'Runway')).toBe(8.9)
    expect(tileValue(GRID, 'Cash on hand')).toBe(1234.5)
    expect(valueBeside(GRID, 'Year')).toBe(2025)
    expect(tileValue(GRID, 'Absent')).toBeUndefined()
  })

  it('finds a table by its headers and stops at the first blank row', () => {
    const table = findTable(GRID, ['Month', 'Total', 'By account'], 4)

    expect(table?.rows).toEqual([
      ['', '', 'ERSTE', 'OTP'],
      ['2026-10', 10, 10, 0],
      ['2026-09', 12, '', 12],
    ])
    expect(rowLabelled(table, '2026-09')).toEqual(['2026-09', 12, '', 12])
    expect(findTable(GRID, ['Month', 'Income'])).toBeNull()
  })
})
