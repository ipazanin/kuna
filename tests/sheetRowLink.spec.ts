import { describe, expect, it } from 'vitest'

import { sheetRowLink } from '../src/features/workbook/infrastructure/sheetRowLink'

describe('sheetRowLink', () => {
  it('opens the ledger tab by its id on the row the transaction was read from', () => {
    expect(sheetRowLink('abc-123', 918273, 42)).toBe('https://docs.google.com/spreadsheets/d/abc-123/edit#gid=918273&range=A42')
  })

  it('gives no link without the tab id, since the Sheet would open on another tab', () => {
    expect(sheetRowLink('abc-123', null, 42)).toBeNull()
  })
})
