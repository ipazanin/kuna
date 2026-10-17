import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { openWorkbookCache } from '../src/features/workbook/infrastructure/workbookCache'
import type { WorkbookCache } from '../src/features/workbook/infrastructure/workbookCache'
import type { SheetRow, WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'

const opened: WorkbookCache[] = []

function cacheFor(spreadsheetId: string): WorkbookCache {
  const cache = openWorkbookCache(spreadsheetId)
  opened.push(cache)
  return cache
}

function ledgerRow(sheetRow: number, amount: number): SheetRow {
  return { sheetRow, cells: { date: 46300, account: 'operating', amount } }
}

function snapshotOf(workbookId: string, ledger: SheetRow[], syncedAt = '2026-10-15T08:00:00.000Z'): WorkbookSnapshot {
  return {
    meta: { id: workbookId, source: 'google', title: 'Test workbook', syncedAt, ledgerSheetId: 7, lastExportedAt: null, unexportedSince: null },
    ledger,
    categories: [{ sheetRow: 2, cells: { category: 'revenue', bucket: 'income' } }],
    accounts: [{ sheetRow: 2, cells: { account: 'operating', currency: 'EUR' } }],
    settings: [{ sheetRow: 2, cells: { key: 'currency', value: 'EUR' } }],
    rules: [{ sheetRow: 2, cells: { rule: 'own-account', order: 100, enabled: true, counterparty_is_own: true } }],
  }
}

afterEach(async () => {
  for (const cache of opened.splice(0)) {
    await cache.delete()
  }
})

describe('workbook cache', () => {
  it('reads nothing before the first sync', async () => {
    expect(await cacheFor('never-synced').read()).toBeNull()
  })

  it('reads back what was written, rows in sheet order', async () => {
    const cache = cacheFor('sheet-a')
    await cache.replace(snapshotOf('sheet-a', [ledgerRow(3, -40), ledgerRow(2, 4200)]))

    const read = await cache.read()

    expect(read?.meta).toEqual({
      id: 'sheet-a',
      source: 'google',
      title: 'Test workbook',
      syncedAt: '2026-10-15T08:00:00.000Z',
      ledgerSheetId: 7,
      lastExportedAt: null,
      unexportedSince: null,
    })
    expect(read?.ledger.map((row) => row.sheetRow)).toEqual([2, 3])
    expect(read?.categories).toHaveLength(1)
    expect(read?.accounts[0]?.cells.currency).toBe('EUR')
    expect(read?.settings[0]?.cells).toEqual({ key: 'currency', value: 'EUR' })
  })

  it('replaces the whole copy, so rows gone from the Sheet are gone from the cache', async () => {
    const cache = cacheFor('sheet-b')
    await cache.replace(snapshotOf('sheet-b', [ledgerRow(2, 1), ledgerRow(3, 2), ledgerRow(4, 3)]))

    await cache.replace(snapshotOf('sheet-b', [ledgerRow(2, 9)], '2026-10-16T08:00:00.000Z'))

    const read = await cache.read()
    expect(read?.ledger).toEqual([ledgerRow(2, 9)])
    expect(read?.meta.syncedAt).toBe('2026-10-16T08:00:00.000Z')
  })

  it('keeps each spreadsheet in its own database', async () => {
    await cacheFor('sheet-c').replace(snapshotOf('sheet-c', [ledgerRow(2, 1)]))
    await cacheFor('sheet-d').replace(snapshotOf('sheet-d', [ledgerRow(2, 2), ledgerRow(3, 3)]))

    expect((await cacheFor('sheet-c').read())?.ledger).toHaveLength(1)
    expect((await cacheFor('sheet-d').read())?.ledger).toHaveLength(2)
  })

  it('refuses a snapshot of another spreadsheet and keeps the old copy', async () => {
    const cache = cacheFor('sheet-e')
    await cache.replace(snapshotOf('sheet-e', [ledgerRow(2, 1)]))

    await expect(cache.replace(snapshotOf('sheet-other', []))).rejects.toThrow(/sheet-other/)
    expect((await cache.read())?.ledger).toHaveLength(1)
  })

  it('opens a copy cached before the settings tab and Excel mode existed', async () => {
    const name = 'ledgerboard-workbook-sheet-old'
    const legacy = new Dexie(name)
    legacy.version(1).stores({ meta: 'key', ledger: 'sheetRow', categories: 'sheetRow', accounts: 'sheetRow' })
    await legacy.table('meta').put({ key: 'workbook', spreadsheetId: 'sheet-old', title: 'Old', syncedAt: '2026-10-01T06:00:00.000Z' })
    await legacy.table('ledger').put(ledgerRow(2, 5))
    legacy.close()

    const read = await cacheFor('sheet-old').read()

    expect(read?.meta).toEqual({
      id: 'sheet-old',
      source: 'google',
      title: 'Old',
      syncedAt: '2026-10-01T06:00:00.000Z',
      ledgerSheetId: null,
      lastExportedAt: null,
      unexportedSince: null,
    })
    expect(read?.ledger).toEqual([ledgerRow(2, 5)])
    expect(read?.settings).toEqual([])
  })

  it('reads nothing after the copy is deleted', async () => {
    const cache = cacheFor('sheet-f')
    await cache.replace(snapshotOf('sheet-f', [ledgerRow(2, 1)]))

    await cache.delete()

    expect(await cacheFor('sheet-f').read()).toBeNull()
  })
})
