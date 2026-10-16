import { shallowReactive, shallowReadonly } from 'vue'

import type { Workbook } from '../domain/workbook'
import { googleWorkbookPorts } from '../infrastructure/googleWorkbookPorts'
import { prepareGoogleIdentity } from '../infrastructure/googleAuth'
import { forgetSelectedWorkbook, loadSelectedWorkbook } from '../infrastructure/selectedWorkbook'
import type { SelectedWorkbook } from '../infrastructure/selectedWorkbook'
import { openWorkbookCache } from '../infrastructure/workbookCache'
import type { WorkbookCache } from '../infrastructure/workbookCache'
import { readWorkbook } from '../infrastructure/workbookReader'
import type { WorkbookSnapshot } from '../infrastructure/workbookSnapshot'
import { readFromGoogle } from './readFromGoogle'

export type WorkbookStatus = 'opening' | 'ready' | 'syncing' | 'error'

export interface WorkbookState {
  /** Null until a cached copy or a sync supplies one. */
  readonly workbook: Workbook | null
  /** ISO timestamp of the read the workbook on screen came from. */
  readonly syncedAt: string | null
  /** The Sheet this browser reads, or null before one is chosen. */
  readonly sheet: SelectedWorkbook | null
  readonly status: WorkbookStatus
  readonly error: string | null
}

export interface WorkbookStorePorts {
  selectedWorkbook(): SelectedWorkbook | null
  forgetWorkbook(): void
  openCache(spreadsheetId: string): WorkbookCache
  /** A fresh copy of the workbook, or null when the user cancelled choosing one. */
  fetchSnapshot(): Promise<WorkbookSnapshot | null>
  /** Loads whatever the next sync's click needs, so the click is not kept waiting. */
  prepareSync(): void
}

export interface WorkbookStore {
  readonly state: Readonly<WorkbookState>
  /** Shows the cached copy, if this browser has one. Later calls wait on the first. */
  open(): Promise<void>
  /** Reads the workbook again and replaces the cache whole. Call it from the Sync button's click handler. */
  sync(): Promise<void>
  /**
   * Forgets the chosen Sheet and syncs, which opens the Picker. The workbook on screen stays
   * until another one is read. Call it from a click handler, as with sync.
   */
  chooseAnotherSheet(): Promise<void>
}

/** Cache first: the copy this browser holds is on screen at once, and a sync replaces it. Read only. */
export function createWorkbookStore(ports: WorkbookStorePorts): WorkbookStore {
  const state = shallowReactive<{ -readonly [Field in keyof WorkbookState]: WorkbookState[Field] }>({
    workbook: null,
    syncedAt: null,
    sheet: null,
    status: 'opening',
    error: null,
  })

  function show(snapshot: WorkbookSnapshot): void {
    state.workbook = readWorkbook(snapshot)
    state.syncedAt = snapshot.meta.syncedAt
  }

  async function withCache<Result>(spreadsheetId: string, use: (cache: WorkbookCache) => Promise<Result>): Promise<Result> {
    const cache = ports.openCache(spreadsheetId)
    try {
      return await use(cache)
    } finally {
      cache.close()
    }
  }

  async function showCachedCopy(): Promise<void> {
    ports.prepareSync()
    try {
      const selected = ports.selectedWorkbook()
      state.sheet = selected
      const cached = selected === null ? null : await withCache(selected.id, (cache) => cache.read())
      // A sync started meanwhile owns the screen, and its copy is newer than this one.
      if (state.status !== 'opening') {
        return
      }
      if (cached !== null) {
        show(cached)
      }
      state.status = 'ready'
    } catch (failure) {
      if (state.status === 'opening') {
        state.status = 'error'
        state.error = messageOf(failure)
      }
    }
  }

  async function sync(): Promise<void> {
    if (state.status === 'syncing') {
      return
    }
    state.status = 'syncing'
    state.error = null
    try {
      const snapshot = await ports.fetchSnapshot()
      if (snapshot !== null) {
        await withCache(snapshot.meta.spreadsheetId, (cache) => cache.replace(snapshot))
        show(snapshot)
      }
      state.status = 'ready'
    } catch (failure) {
      state.status = 'error'
      state.error = messageOf(failure)
    } finally {
      // The Picker may have remembered a Sheet, or been cancelled after the old one was forgotten.
      state.sheet = ports.selectedWorkbook()
    }
  }

  let opened: Promise<void> | null = null

  return {
    state: shallowReadonly(state),

    open() {
      opened ??= showCachedCopy()
      return opened
    },

    sync,

    async chooseAnotherSheet() {
      if (state.status === 'syncing') {
        return
      }
      ports.forgetWorkbook()
      state.sheet = null
      await sync()
    },
  }
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}

const workbookStore = createWorkbookStore({
  selectedWorkbook: loadSelectedWorkbook,
  forgetWorkbook: forgetSelectedWorkbook,
  openCache: openWorkbookCache,
  async fetchSnapshot() {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { fakeWorkbookSnapshot } = await import('../infrastructure/fake/fakeWorkbook')
      return fakeWorkbookSnapshot(new Date().toISOString())
    }
    return readFromGoogle(googleWorkbookPorts)
  },
  prepareSync() {
    if (import.meta.env.VITE_FAKE_WORKBOOK !== 'true') {
      prepareGoogleIdentity().catch(() => {
        // The click loads it again and reports the failure then.
      })
    }
  },
})

/** The one workbook store the screens share. */
export function useWorkbook(): WorkbookStore {
  return workbookStore
}
