import { describe, expect, it } from 'vitest'

import { syncStateOf } from '../src/features/workbook/presentation/syncState'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'

const workbook = readWorkbook({
  meta: { spreadsheetId: 'sheet', title: 'Books', syncedAt: '2026-10-16T06:00:00.000Z', ledgerSheetId: 0 },
  ledger: [],
  categories: [],
  accounts: [],
})
const sheet = { id: 'sheet', name: 'Books' }

describe('syncStateOf', () => {
  it('asks for a Sheet when this browser has neither a copy nor a chosen Sheet', () => {
    expect(syncStateOf({ status: 'ready', workbook: null, sheet: null })).toBe('first-run')
    expect(syncStateOf({ status: 'opening', workbook: null, sheet: null })).toBe('first-run')
  })

  it('offers a sync once a Sheet is chosen, even before its first copy arrives', () => {
    expect(syncStateOf({ status: 'ready', workbook: null, sheet })).toBe('ready')
    expect(syncStateOf({ status: 'opening', workbook: null, sheet })).toBe('ready')
  })

  it('keeps showing the copy on screen after the Sheet was forgotten for a new pick', () => {
    expect(syncStateOf({ status: 'ready', workbook, sheet: null })).toBe('ready')
  })

  it('reports syncing and errors whatever is on screen', () => {
    expect(syncStateOf({ status: 'syncing', workbook: null, sheet: null })).toBe('syncing')
    expect(syncStateOf({ status: 'error', workbook: null, sheet: null })).toBe('error')
    expect(syncStateOf({ status: 'error', workbook, sheet })).toBe('error')
  })
})
