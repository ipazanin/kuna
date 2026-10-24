import { describe, expect, it } from 'vitest'

import { syncStateOf } from '../src/features/workbook/presentation/syncState'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'

const workbook = readSnapshot({
  meta: { id: 'sheet', source: 'drive', title: 'Books', syncedAt: '2026-10-16T06:00:00.000Z', lastExportedAt: null, unexportedSince: null },
  ledger: [],
  categories: [],
  accounts: [],
  settings: [],
  rules: [],
  invoices: [],
  clients: [],
  'outgoing-plan': [],
  'owner-advances': [],
  assets: [],
  grants: [],
  'year-end': [],
  plan: [],
  scenarios: [],
  splits: [],
  dismissed: [],
}).workbook
const choice = { source: 'drive' as const, id: 'sheet', name: 'Books' }

describe('syncStateOf', () => {
  it('asks for a Sheet when this browser has neither a copy nor a chosen Sheet', () => {
    expect(syncStateOf({ status: 'ready', workbook: null, choice: null })).toBe('first-run')
    expect(syncStateOf({ status: 'opening', workbook: null, choice: null })).toBe('first-run')
  })

  it('offers a sync once a Sheet is chosen, even before its first copy arrives', () => {
    expect(syncStateOf({ status: 'ready', workbook: null, choice })).toBe('ready')
    expect(syncStateOf({ status: 'opening', workbook: null, choice })).toBe('ready')
  })

  it('keeps showing the copy on screen after the file was forgotten for a new pick', () => {
    expect(syncStateOf({ status: 'ready', workbook, choice: null })).toBe('ready')
  })

  it('reports syncing and errors whatever is on screen', () => {
    expect(syncStateOf({ status: 'syncing', workbook: null, choice: null })).toBe('syncing')
    expect(syncStateOf({ status: 'error', workbook: null, choice: null })).toBe('error')
    expect(syncStateOf({ status: 'error', workbook, choice })).toBe('error')
  })
})
