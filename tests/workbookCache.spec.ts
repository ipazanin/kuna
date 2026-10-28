import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import type { WorkbookCache } from '../src/shared/storage/application/workbookPorts'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { openWorkbookCache } from '../src/shared/storage/infrastructure/workbookCache'

const opened: WorkbookCache<DocumentCopy>[] = []

function cacheFor(workbookId: string): WorkbookCache<DocumentCopy> {
  const cache = openWorkbookCache(workbookId)
  opened.push(cache)
  return cache
}

function ledgerRow(amount: string): DocumentRecord {
  return { date: '2026-10-05', account: 'operating', amount, balance: amount, id: `row-${amount}` }
}

function copyOf(workbookId: string, ledger: DocumentRecord[], revision = 'rev-1', syncedAt = '2026-10-15T08:00:00.000Z'): DocumentCopy {
  return {
    meta: { id: workbookId, source: 'drive', title: 'ledgerboard-company.json', syncedAt, lastExportedAt: null, unexportedSince: null },
    revision,
    document: {
      app: 'company',
      schema: { core: 1, 'hr-doo': 1 },
      savedAt: syncedAt,
      records: {
        'ledger-row': ledger,
        setting: [{ key: 'currency', value: 'EUR' }],
        'hr-doo.year-end-line': [{ year: '2025', statement: 'tax', line: 'rate', amount: '0.1', id: 'line-1' }],
        'a-later-kind': [{ field: { nested: true } }],
      },
    },
  }
}

afterEach(async () => {
  for (const cache of opened.splice(0)) {
    await cache.delete()
  }
})

describe('workbook cache', () => {
  it('reads nothing before the first read', async () => {
    expect(await cacheFor('never-read').read()).toBeNull()
  })

  it('reads back the document whole with its revision', async () => {
    const cache = cacheFor('file-a')
    const copy = copyOf('file-a', [ledgerRow('-40.00'), ledgerRow('4200.00')])
    await cache.replace(copy)

    expect(await cache.read()).toEqual(copy)
  })

  it('replaces the whole copy, so records gone from the file are gone from the cache', async () => {
    const cache = cacheFor('file-b')
    await cache.replace(copyOf('file-b', [ledgerRow('1.00'), ledgerRow('2.00')]))

    await cache.replace(copyOf('file-b', [ledgerRow('9.00')], 'rev-2', '2026-10-16T08:00:00.000Z'))

    const read = await cache.read()
    expect(read?.document.records['ledger-row']).toEqual([ledgerRow('9.00')])
    expect(read?.revision).toBe('rev-2')
    expect(read?.meta.syncedAt).toBe('2026-10-16T08:00:00.000Z')
  })

  it('keeps each workbook in its own database', async () => {
    await cacheFor('file-c').replace(copyOf('file-c', [ledgerRow('1.00')]))
    await cacheFor('file-d').replace(copyOf('file-d', [ledgerRow('2.00'), ledgerRow('3.00')]))

    expect((await cacheFor('file-c').read())?.document.records['ledger-row']).toHaveLength(1)
    expect((await cacheFor('file-d').read())?.document.records['ledger-row']).toHaveLength(2)
  })

  it('refuses a copy of another workbook and keeps the old copy', async () => {
    const cache = cacheFor('file-e')
    await cache.replace(copyOf('file-e', [ledgerRow('1.00')]))

    await expect(cache.replace(copyOf('file-other', []))).rejects.toThrow(/file-other/)
    expect((await cache.read())?.document.records['ledger-row']).toHaveLength(1)
  })

  it('reads nothing after the copy is deleted', async () => {
    const cache = cacheFor('file-f')
    await cache.replace(copyOf('file-f', [ledgerRow('1.00')]))

    await cache.delete()

    expect(await cacheFor('file-f').read()).toBeNull()
  })

  it('opens a database that held the tabs of a Sheet, and reads nothing from it', async () => {
    const old = new Dexie('ledgerboard-workbook-sheet-g')
    old.version(8).stores({ meta: 'key', ledger: 'sheetRow' })
    await old.table('meta').put({ key: 'workbook', id: 'sheet-g' })
    old.close()

    const cache = cacheFor('sheet-g')

    expect(await cache.read()).toBeNull()
    await cache.replace(copyOf('sheet-g', [ledgerRow('5.00')]))
    expect((await cache.read())?.revision).toBe('rev-1')
  })
})
