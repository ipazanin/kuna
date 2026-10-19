import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { ACCOUNT_ROWS, ASSET_ROWS, CATEGORY_ROWS, GRANT_ROWS, YEAR_END_ROWS } from '../src/features/settings/application/workbookTabRows'
import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import { createWorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { WorkbookStorePorts } from '../src/features/workbook/application/workbookStore'
import { openWorkbookCache } from '../src/features/workbook/infrastructure/workbookCache'
import type { WorkbookChoice } from '../src/features/workbook/infrastructure/workbookChoice'
import type { WorkbookSnapshot, WorkbookTabs } from '../src/features/workbook/infrastructure/workbookSnapshot'

const used = new Set<string>()

function tabsOf(amounts: number[]): WorkbookTabs {
  return {
    ledger: amounts.map((amount, index) => ({
      sheetRow: index + 2,
      cells: { date: 46300 - index, account: 'main', amount, balance: 100, category: 'revenue' },
    })),
    categories: [{ sheetRow: 2, cells: { category: 'revenue', family: 'income', bucket: 'income' } }],
    accounts: [{ sheetRow: 2, cells: { account: 'main', iban: 'XX00FAKE0001' } }],
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
  }
}

function snapshotOf(id: string, syncedAt: string, amounts: number[], title = 'Books'): WorkbookSnapshot {
  return {
    meta: { id, source: 'google', title, syncedAt, ledgerSheetId: 0, lastExportedAt: null, unexportedSince: null, missingTabs: [] },
    ...tabsOf(amounts),
  }
}

interface Harness {
  readonly ports: WorkbookStorePorts
  readonly chosen: () => WorkbookChoice | null
  /** Moves the clock the store reads. */
  readonly setNow: (iso: string) => void
}

function harness(initial: WorkbookChoice | null, fetchFromGoogle: WorkbookStorePorts['fetchFromGoogle'] = async () => null): Harness {
  let remembered = initial
  let now = '2026-10-16T09:00:00.000Z'
  let nextLocal = 0
  if (initial !== null) {
    used.add(initial.id)
  }
  return {
    chosen: () => remembered,
    setNow: (iso) => {
      now = iso
    },
    ports: {
      loadChoice: () => remembered,
      saveChoice: (choice) => {
        remembered = choice
      },
      openCache: (id) => {
        used.add(id)
        return openWorkbookCache(id)
      },
      fetchFromGoogle,
      prepareSync: () => {},
      hasLiveAccessToken: () => false,
      forgetGoogleSignIn: () => {},
      signOutOfGoogle: async () => {},
      newLocalId: () => `local-${(nextLocal += 1)}`,
      now: () => now,
      requestPersistentStorage: () => {},
      googleWriter: async () => {
        throw new Error('This spec never writes to Google.')
      },
    },
  }
}

async function seedCache(snapshot: WorkbookSnapshot): Promise<void> {
  used.add(snapshot.meta.id)
  const cache = openWorkbookCache(snapshot.meta.id)
  await cache.replace(snapshot)
  cache.close()
}

async function storedCopy(id: string): Promise<WorkbookSnapshot | null> {
  const cache = openWorkbookCache(id)
  try {
    return await cache.read()
  } finally {
    cache.close()
  }
}

afterEach(async () => {
  for (const id of used) {
    await openWorkbookCache(id).delete()
  }
  used.clear()
})

const BOOKS: WorkbookChoice = { source: 'google', id: 'books', name: 'Books' }

describe('workbook store with a Google Sheet', () => {
  it('shows the cached copy on open, with the time it was synced, before any sync', async () => {
    await seedCache(snapshotOf('books', '2026-10-15T06:00:00.000Z', [7200, -150]))
    const store = createWorkbookStore(
      harness(BOOKS, async () => {
        throw new Error('open must not sync')
      }).ports,
    )

    await store.open()

    expect(store.state.status).toBe('ready')
    expect(store.state.syncedAt).toBe('2026-10-15T06:00:00.000Z')
    expect(store.state.workbook?.transactions.map((transaction) => transaction.amount)).toEqual([720000, -15000])
  })

  it('opens empty when this browser has never chosen a workbook', async () => {
    const store = createWorkbookStore(harness(null).ports)

    await store.open()

    expect(store.state).toMatchObject({ status: 'ready', workbook: null, syncedAt: null, choice: null, error: null })
  })

  it('opens once however many screens ask', async () => {
    let reads = 0
    const { ports } = harness(null)
    const store = createWorkbookStore({
      ...ports,
      loadChoice: () => {
        reads += 1
        return null
      },
    })

    await Promise.all([store.open(), store.open(), store.open()])

    expect(reads).toBe(1)
  })

  it('replaces the cache and the screen wholesale on sync, keeping the export history', async () => {
    const cached = snapshotOf('books', '2026-10-15T06:00:00.000Z', [1, 2, 3])
    await seedCache({ ...cached, meta: { ...cached.meta, lastExportedAt: '2026-10-10T12:00:00.000Z' } })
    const store = createWorkbookStore(harness(BOOKS, async () => snapshotOf('books', '2026-10-16T06:00:00.000Z', [9])).ports)
    await store.open()

    await store.sync()

    expect(store.state.syncedAt).toBe('2026-10-16T06:00:00.000Z')
    expect(store.state.workbook?.transactions).toHaveLength(1)
    const stored = await storedCopy('books')
    expect(stored?.ledger).toHaveLength(1)
    expect(stored?.meta.lastExportedAt).toBe('2026-10-10T12:00:00.000Z')
  })

  it('keeps what is on screen when the Picker is cancelled on the first run', async () => {
    const store = createWorkbookStore(harness(null).ports)
    await store.open()

    await store.sync()

    expect(store.state).toMatchObject({ status: 'ready', workbook: null, choice: null, error: null })
  })

  it('reports a failed sync and keeps the cached copy on screen', async () => {
    await seedCache(snapshotOf('books', '2026-10-15T06:00:00.000Z', [5]))
    const store = createWorkbookStore(
      harness(BOOKS, async () => {
        throw new Error('403 from /v4/spreadsheets: The caller does not have permission')
      }).ports,
    )
    await store.open()

    await store.sync()

    expect(store.state.status).toBe('error')
    expect(store.state.error).toMatch(/^403/)
    expect(store.state.workbook?.transactions).toHaveLength(1)
  })

  it('keeps the chosen Sheet when choosing another one is cancelled', async () => {
    await seedCache(snapshotOf('books', '2026-10-15T06:00:00.000Z', [5]))
    const { ports, chosen } = harness(BOOKS)
    const store = createWorkbookStore(ports)
    await store.open()

    await store.chooseGoogleSheet()

    expect(store.state).toMatchObject({ status: 'ready', choice: BOOKS, error: null })
    expect(chosen()).toEqual(BOOKS)
    expect(store.state.workbook?.transactions).toHaveLength(1)
  })

  it('shows the newly chosen Sheet once the Picker returns one', async () => {
    const pickedFor: (string | null)[] = []
    const store = createWorkbookStore(
      harness(BOOKS, async (sheet) => {
        pickedFor.push(sheet?.id ?? null)
        return snapshotOf('new', '2026-10-16T06:00:00.000Z', [1, 2], 'New books')
      }).ports,
    )
    await store.open()

    await store.chooseGoogleSheet()

    expect(pickedFor).toEqual([null])
    expect(store.state.choice).toEqual({ source: 'google', id: 'new', name: 'New books' })
    expect(store.state.workbook?.id).toBe('new')
  })
})

describe('workbook store in Excel mode', () => {
  it('keeps an imported workbook under its own id and reads it back on the next start', async () => {
    const first = harness(null)
    const store = createWorkbookStore(first.ports)
    await store.open()

    await store.replaceLocalWorkbook(tabsOf([10, 20]), 'Studio')

    expect(store.state.choice).toEqual({ source: 'excel', id: 'local-1', name: 'Studio' })
    expect(store.state.workbook).toMatchObject({ source: 'excel', id: 'local-1', title: 'Studio' })
    const reopened = createWorkbookStore(harness(first.chosen()).ports)
    await reopened.open()
    expect(reopened.state.workbook?.transactions).toHaveLength(2)
    expect(reopened.state.snapshot?.meta).toMatchObject({ source: 'excel', lastExportedAt: null, unexportedSince: null, missingTabs: [] })
  })

  it('forgets the Google sign-in when a workbook kept in this browser replaces a Sheet', async () => {
    await seedCache(snapshotOf('books', '2026-10-15T06:00:00.000Z', [7200]))
    const { ports } = harness(BOOKS)
    let forgotten = 0
    const store = createWorkbookStore({ ...ports, hasLiveAccessToken: () => true, forgetGoogleSignIn: () => (forgotten += 1) })
    await store.open()
    expect(store.canSyncSilently()).toBe(true)

    await store.replaceLocalWorkbook(tabsOf([10]), 'Studio')

    expect(forgotten).toBe(1)
    expect(store.canSyncSilently()).toBe(false)
  })

  it('replaces the workbook it keeps rather than adding a second one', async () => {
    const { ports } = harness(null)
    const store = createWorkbookStore(ports)
    await store.open()
    await store.replaceLocalWorkbook(tabsOf([10, 20]), 'Studio')

    await store.replaceLocalWorkbook(tabsOf([30]), 'Studio again')

    expect(store.state.workbook?.id).toBe('local-1')
    expect((await storedCopy('local-1'))?.ledger).toHaveLength(1)
  })

  it('saves row changes, marks them unexported from the first one, and clears that on export', async () => {
    const { ports, setNow } = harness(null)
    const store = createWorkbookStore(ports)
    await store.open()
    await store.replaceLocalWorkbook(tabsOf([10]), 'Studio')
    const revenue = rowCellsOf(store.state.snapshot!.categories[0]!, CATEGORY_ROWS.columns)

    setNow('2026-10-17T09:00:00.000Z')
    await store.changeRows(CATEGORY_ROWS, { added: [], changed: [{ sheetRow: 2, before: revenue, after: { ...revenue, label: 'Sales' } }], removed: [] })
    setNow('2026-10-18T09:00:00.000Z')
    await store.changeRows(ACCOUNT_ROWS, { added: [{ account: 'savings', iban: '' }], changed: [], removed: [] })

    expect(store.state.workbook?.categories[0]?.label).toBe('Sales')
    expect(store.state.workbook?.accounts.map((account) => account.slug)).toEqual(['main', 'savings'])
    expect(store.state.snapshot?.meta).toMatchObject({ syncedAt: '2026-10-18T09:00:00.000Z', unexportedSince: '2026-10-17T09:00:00.000Z' })

    setNow('2026-10-19T09:00:00.000Z')
    await store.recordExport()

    expect((await storedCopy('local-1'))?.meta).toMatchObject({ lastExportedAt: '2026-10-19T09:00:00.000Z', unexportedSince: null })
  })

  it('adds grants, assets and year-end lines in Excel mode, and keeps them in this browser', async () => {
    const { ports } = harness(null)
    const store = createWorkbookStore(ports)
    await store.open()
    await store.replaceLocalWorkbook(tabsOf([10]), 'Studio')

    await store.changeRows(GRANT_ROWS, { added: [{ grant: 'startup', received: 45809, amount: 5000, fixed_part: 2000, variable_part: 3000 }], changed: [], removed: [] })
    await store.changeRows(ASSET_ROWS, { added: [{ asset: 'Laptop', bought: 45809, cost_net: 1519.2, group: 'computers', funded_by: 'startup' }], changed: [], removed: [] })
    await store.changeRows(YEAR_END_ROWS, { added: [{ year: 2025, statement: 'pl', line: 'sales', amount: 46800 }], changed: [], removed: [] })

    expect(store.state.workbook?.assets.map((asset) => asset.fundedBy)).toEqual(['startup'])
    expect(store.state.workbook?.grants).toHaveLength(1)
    expect(store.state.workbook?.yearEndLines).toHaveLength(1)
    expect(store.state.workbook?.problems).toEqual([])
    expect((await storedCopy('local-1'))?.assets).toHaveLength(1)
  })

  it('never syncs a workbook kept in this browser with Google', async () => {
    let fetched = false
    const { ports } = harness(null, async () => {
      fetched = true
      return null
    })
    const store = createWorkbookStore(ports)
    await store.open()
    await store.replaceLocalWorkbook(tabsOf([10]), 'Studio')

    await store.sync()

    expect(fetched).toBe(false)
  })

  it('deletes the local workbook once a Google Sheet replaces it, and only then', async () => {
    let answer: WorkbookSnapshot | null = null
    const { ports } = harness(null, async () => answer)
    const store = createWorkbookStore(ports)
    await store.open()
    await store.replaceLocalWorkbook(tabsOf([10]), 'Studio')

    await store.chooseGoogleSheet()
    expect(store.state.choice?.source).toBe('excel')
    expect(await storedCopy('local-1')).not.toBeNull()

    answer = snapshotOf('books', '2026-10-16T06:00:00.000Z', [1])
    await store.chooseGoogleSheet()

    expect(store.state.choice).toEqual(BOOKS)
    expect(await storedCopy('local-1')).toBeNull()
  })
})
