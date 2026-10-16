import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { createWorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { WorkbookStorePorts } from '../src/features/workbook/application/workbookStore'
import { openWorkbookCache } from '../src/features/workbook/infrastructure/workbookCache'
import type { SelectedWorkbook } from '../src/features/workbook/infrastructure/selectedWorkbook'
import type { WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'

const used = new Set<string>()

function snapshotOf(spreadsheetId: string, syncedAt: string, amounts: number[]): WorkbookSnapshot {
  return {
    meta: { spreadsheetId, title: 'Books', syncedAt, ledgerSheetId: 0 },
    ledger: amounts.map((amount, index) => ({
      sheetRow: index + 2,
      cells: { date: 46300 - index, account: 'main', amount, balance: 100, category: 'revenue' },
    })),
    categories: [{ sheetRow: 2, cells: { category: 'revenue', family: 'income', bucket: 'income' } }],
    accounts: [{ sheetRow: 2, cells: { account: 'main', iban: 'XX00FAKE0001' } }],
  }
}

function portsFor(selected: SelectedWorkbook | null, fetchSnapshot: WorkbookStorePorts['fetchSnapshot']): WorkbookStorePorts {
  if (selected !== null) {
    used.add(selected.id)
  }
  return {
    selectedWorkbook: () => selected,
    forgetWorkbook: () => {},
    openCache: (spreadsheetId) => {
      used.add(spreadsheetId)
      return openWorkbookCache(spreadsheetId)
    },
    fetchSnapshot,
    prepareSync: () => {},
  }
}

async function seedCache(snapshot: WorkbookSnapshot): Promise<void> {
  used.add(snapshot.meta.spreadsheetId)
  const cache = openWorkbookCache(snapshot.meta.spreadsheetId)
  await cache.replace(snapshot)
  cache.close()
}

afterEach(async () => {
  for (const spreadsheetId of used) {
    await openWorkbookCache(spreadsheetId).delete()
  }
  used.clear()
})

describe('workbook store', () => {
  it('shows the cached copy on open, with the time it was synced, before any sync', async () => {
    await seedCache(snapshotOf('cached', '2026-10-15T06:00:00.000Z', [7200, -150]))
    const store = createWorkbookStore(portsFor({ id: 'cached', name: 'Books' }, async () => {
      throw new Error('open must not sync')
    }))

    await store.open()

    expect(store.state.status).toBe('ready')
    expect(store.state.syncedAt).toBe('2026-10-15T06:00:00.000Z')
    expect(store.state.workbook?.transactions.map((transaction) => transaction.amount)).toEqual([720000, -15000])
  })

  it('opens empty when this browser has never synced', async () => {
    const store = createWorkbookStore(portsFor(null, async () => null))

    await store.open()

    expect(store.state).toMatchObject({ status: 'ready', workbook: null, syncedAt: null, sheet: null, error: null })
  })

  it('opens once however many screens ask', async () => {
    let reads = 0
    const store = createWorkbookStore({
      ...portsFor(null, async () => null),
      selectedWorkbook: () => {
        reads += 1
        return null
      },
    })

    await Promise.all([store.open(), store.open(), store.open()])

    expect(reads).toBe(1)
  })

  it('replaces the cache and the screen wholesale on sync', async () => {
    await seedCache(snapshotOf('books', '2026-10-15T06:00:00.000Z', [1, 2, 3]))
    const store = createWorkbookStore(portsFor({ id: 'books', name: 'Books' }, async () => snapshotOf('books', '2026-10-16T06:00:00.000Z', [9])))
    await store.open()

    await store.sync()

    expect(store.state.syncedAt).toBe('2026-10-16T06:00:00.000Z')
    expect(store.state.workbook?.transactions).toHaveLength(1)
    const cache = openWorkbookCache('books')
    expect((await cache.read())?.ledger).toHaveLength(1)
    cache.close()
  })

  it('keeps what is on screen when the Picker is cancelled', async () => {
    const store = createWorkbookStore(portsFor(null, async () => null))
    await store.open()

    await store.sync()

    expect(store.state).toMatchObject({ status: 'ready', workbook: null, error: null })
  })

  it('reports a failed sync and keeps the cached copy on screen', async () => {
    await seedCache(snapshotOf('kept', '2026-10-15T06:00:00.000Z', [5]))
    const store = createWorkbookStore(portsFor({ id: 'kept', name: 'Books' }, async () => {
      throw new Error('403 from /v4/spreadsheets: The caller does not have permission')
    }))
    await store.open()

    await store.sync()

    expect(store.state.status).toBe('error')
    expect(store.state.error).toMatch(/^403/)
    expect(store.state.workbook?.transactions).toHaveLength(1)
  })

  it('forgets the chosen Sheet and syncs, keeping the old workbook on screen if the Picker is cancelled', async () => {
    await seedCache(snapshotOf('old', '2026-10-15T06:00:00.000Z', [5]))
    let remembered: SelectedWorkbook | null = { id: 'old', name: 'Old books' }
    const store = createWorkbookStore({
      ...portsFor(remembered, async () => null),
      selectedWorkbook: () => remembered,
      forgetWorkbook: () => {
        remembered = null
      },
    })
    await store.open()
    expect(store.state.sheet).toEqual({ id: 'old', name: 'Old books' })

    await store.chooseAnotherSheet()

    expect(store.state).toMatchObject({ status: 'ready', sheet: null, error: null })
    expect(store.state.workbook?.transactions).toHaveLength(1)
  })

  it('shows the newly chosen Sheet once the Picker returns one', async () => {
    let remembered: SelectedWorkbook | null = { id: 'old', name: 'Old books' }
    const store = createWorkbookStore({
      ...portsFor(remembered, async () => {
        remembered = { id: 'new', name: 'New books' }
        used.add('new')
        return snapshotOf('new', '2026-10-16T06:00:00.000Z', [1, 2])
      }),
      selectedWorkbook: () => remembered,
      forgetWorkbook: () => {
        remembered = null
      },
    })
    await store.open()

    await store.chooseAnotherSheet()

    expect(store.state.sheet).toEqual({ id: 'new', name: 'New books' })
    expect(store.state.workbook?.spreadsheetId).toBe('new')
  })
})
