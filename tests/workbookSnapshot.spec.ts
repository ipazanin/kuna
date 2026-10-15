import { describe, expect, it } from 'vitest'

import { sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'

describe('sheetRowsFromValues', () => {
  it('keys each data row by header and numbers it from sheet row 2', () => {
    const rows = sheetRowsFromValues([
      ['date', 'amount', 'category'],
      [46300, -39.9, 'software'],
      [46298, 4200, 'revenue'],
    ])

    expect(rows).toEqual([
      { sheetRow: 2, cells: { date: 46300, amount: -39.9, category: 'software' } },
      { sheetRow: 3, cells: { date: 46298, amount: 4200, category: 'revenue' } },
    ])
  })

  it('leaves out the cells the API trimmed and the empty ones', () => {
    const rows = sheetRowsFromValues([['date', 'amount', 'category'], [46300, '', 'software'], [46299]])

    expect(rows.map((row) => row.cells)).toEqual([{ date: 46300, category: 'software' }, { date: 46299 }])
  })

  it('keeps sheet row numbers across a blank row, and drops the blank row', () => {
    const rows = sheetRowsFromValues([['date'], [46300], [], [46298]])

    expect(rows.map((row) => row.sheetRow)).toEqual([2, 4])
  })

  it('reads a tab with only a header, or nothing at all, as no rows', () => {
    expect(sheetRowsFromValues([['date', 'amount']])).toEqual([])
    expect(sheetRowsFromValues([])).toEqual([])
  })
})
