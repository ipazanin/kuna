import 'fake-indexeddb/auto'
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

function snapshotOf(spreadsheetId: string, ledger: SheetRow[], syncedAt = '2026-10-15T08:00:00.000Z'): WorkbookSnapshot {
  return {
    meta: { spreadsheetId, title: 'Test workbook', syncedAt },
    ledger,
    categories: [{ sheetRow: 2, cells: { category: 'revenue', bucket: 'income' } }],
    accounts: [{ sheetRow: 2, cells: { account: 'operating', currency: 'EUR' } }],
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

    expect(read?.meta).toEqual({ spreadsheetId: 'sheet-a', title: 'Test workbook', syncedAt: '2026-10-15T08:00:00.000Z' })
    expect(read?.ledger.map((row) => row.sheetRow)).toEqual([2, 3])
    expect(read?.categories).toHaveLength(1)
    expect(read?.accounts[0]?.cells.currency).toBe('EUR')
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

  it('reads nothing after the copy is deleted', async () => {
    const cache = cacheFor('sheet-f')
    await cache.replace(snapshotOf('sheet-f', [ledgerRow(2, 1)]))

    await cache.delete()

    expect(await cacheFor('sheet-f').read()).toBeNull()
  })
})
