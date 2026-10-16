import { shallowReactive, shallowReadonly } from 'vue'

import { setMoneyFormat } from '../../../shared/money/moneyFormat'
import type { Workbook } from '../domain/workbook'
import { googleWorkbookPorts } from '../infrastructure/googleWorkbookPorts'
import { currentAccessToken, forgetGoogleSignIn, prepareGoogleIdentity, signOutOfGoogle } from '../infrastructure/googleAuth'
import { loadWorkbookChoice, saveWorkbookChoice } from '../infrastructure/workbookChoice'
import type { WorkbookChoice } from '../infrastructure/workbookChoice'
import { openWorkbookCache } from '../infrastructure/workbookCache'
import type { WorkbookCache } from '../infrastructure/workbookCache'
import { readWorkbook } from '../infrastructure/workbookReader'
import type { WorkbookSnapshot, WorkbookTabs } from '../infrastructure/workbookSnapshot'
import { readFromGoogle } from './readFromGoogle'
import type { GoogleSheet } from './readFromGoogle'

export type WorkbookStatus = 'opening' | 'ready' | 'syncing' | 'error'

export interface WorkbookState {
  /** Null until a cached copy, a sync or an import supplies one. */
  readonly workbook: Workbook | null
  /** The tabs the workbook was read from, which an export writes and an edit changes. */
  readonly snapshot: WorkbookSnapshot | null
  /** ISO timestamp of the read the workbook on screen came from, or of its last change in Excel mode. */
  readonly syncedAt: string | null
  /** The workbook this browser shows, or null before one is chosen. */
  readonly choice: WorkbookChoice | null
  readonly status: WorkbookStatus
  readonly error: string | null
}

/** The tabs Excel mode lets the app edit. The ledger only ever arrives whole, from a file. */
export type EditableTabs = Partial<Pick<WorkbookTabs, 'categories' | 'accounts' | 'settings'>>

export interface WorkbookStorePorts {
  loadChoice(): WorkbookChoice | null
  saveChoice(choice: WorkbookChoice | null): void
  openCache(workbookId: string): WorkbookCache
  /** A fresh copy of the given Sheet, or of one the user picks when none is given. Null when cancelled. */
  fetchFromGoogle(sheet: GoogleSheet | null): Promise<WorkbookSnapshot | null>
  /** Loads whatever the next sync's click needs, so the click is not kept waiting. Never called in Excel mode. */
  prepareSync(): void
  /** Whether a Google token kept from an earlier sign-in is still good, so a sync needs no popup. */
  hasLiveAccessToken(): boolean
  /** Forgets the Google token and account kept on this device. */
  forgetGoogleSignIn(): void
  /** Revokes the kept token with Google and forgets the sign-in. */
  signOutOfGoogle(): Promise<void>
  /** A new id for a workbook kept in this browser. */
  newLocalId(): string
  now(): string
  /** Asks the browser not to evict the data. Firefox shows a prompt for it. */
  requestPersistentStorage(): void
}

export interface WorkbookStore {
  readonly state: Readonly<WorkbookState>
  /** Shows the workbook this browser holds, if any. Later calls wait on the first. */
  open(): Promise<void>
  /**
   * Reads the chosen Sheet again and replaces the cache whole. Does nothing in Excel mode. Call it
   * from a click handler unless `canSyncSilently()` holds, since a new token needs a popup.
   */
  sync(): Promise<void>
  /** A Google Sheet is chosen and a kept token is still good, so a sync opens no popup. */
  canSyncSilently(): boolean
  /** Revokes and forgets the Google sign-in. The Sheet stays chosen and its copy stays on screen. */
  signOutOfGoogle(): Promise<void>
  /**
   * Opens the Picker and shows the Sheet chosen there. On a cancel or a failure the previous
   * workbook stays chosen. Leaving Excel mode deletes the workbook it kept in this browser.
   */
  chooseGoogleSheet(): Promise<void>
  /**
   * Makes these tabs the workbook kept in this browser, as an import or a fresh start does, and
   * switches to Excel mode. A workbook already kept here is replaced, and a Google sign-in is forgotten.
   */
  replaceLocalWorkbook(tabs: WorkbookTabs, title: string): Promise<void>
  /** Saves edits to categories, accounts or settings in Excel mode. */
  saveLocalEdits(edits: EditableTabs): Promise<void>
  /** Notes that the workbook on screen was just written to a file. */
  recordExport(): Promise<void>
}

/** Cache first: the copy this browser holds is on screen at once, and a sync or an import replaces it. */
export function createWorkbookStore(ports: WorkbookStorePorts): WorkbookStore {
  const state = shallowReactive<{ -readonly [Field in keyof WorkbookState]: WorkbookState[Field] }>({
    workbook: null,
    snapshot: null,
    syncedAt: null,
    choice: null,
    status: 'opening',
    error: null,
  })

  function show(snapshot: WorkbookSnapshot): void {
    const workbook = readWorkbook(snapshot)
    setMoneyFormat({ currency: workbook.settings.currency, locale: workbook.settings.numberLocale })
    state.snapshot = snapshot
    state.workbook = workbook
    state.syncedAt = snapshot.meta.syncedAt
  }

  function choose(choice: WorkbookChoice | null): void {
    ports.saveChoice(choice)
    state.choice = choice
  }

  async function withCache<Result>(workbookId: string, use: (cache: WorkbookCache) => Promise<Result>): Promise<Result> {
    const cache = ports.openCache(workbookId)
    try {
      return await use(cache)
    } finally {
      cache.close()
    }
  }

  async function keep(snapshot: WorkbookSnapshot): Promise<void> {
    await withCache(snapshot.meta.id, (cache) => cache.replace(snapshot))
    show(snapshot)
  }

  function fail(failure: unknown): void {
    state.status = 'error'
    state.error = failure instanceof Error ? failure.message : String(failure)
  }

  async function showStoredCopy(): Promise<void> {
    try {
      const choice = ports.loadChoice()
      state.choice = choice
      // Excel mode never talks to Google, so it never loads Google's scripts either.
      if (choice?.source !== 'excel') {
        ports.prepareSync()
      }
      const stored = choice === null ? null : await withCache(choice.id, (cache) => cache.read())
      // A sync started meanwhile owns the screen, and its copy is newer than this one.
      if (state.status !== 'opening') {
        return
      }
      if (stored !== null) {
        show(stored)
      }
      state.status = 'ready'
    } catch (failure) {
      if (state.status === 'opening') {
        fail(failure)
      }
    }
  }

  /** A fresh read keeps the export history of the copy it replaces. */
  function withExportHistory(snapshot: WorkbookSnapshot): WorkbookSnapshot {
    const previous = state.snapshot?.meta.id === snapshot.meta.id ? state.snapshot.meta : null
    return previous === null ? snapshot : { ...snapshot, meta: { ...snapshot.meta, lastExportedAt: previous.lastExportedAt } }
  }

  async function readGoogle(sheet: GoogleSheet | null): Promise<void> {
    if (state.status === 'syncing') {
      return
    }
    const previous = state.choice
    state.status = 'syncing'
    state.error = null
    try {
      const snapshot = await ports.fetchFromGoogle(sheet)
      if (snapshot !== null) {
        await keep(withExportHistory(snapshot))
        choose({ source: 'google', id: snapshot.meta.id, name: snapshot.meta.title })
        if (previous?.source === 'excel') {
          await withCache(previous.id, (cache) => cache.delete())
        }
      }
      state.status = 'ready'
    } catch (failure) {
      fail(failure)
    }
  }

  async function underLocalWork(work: () => Promise<void>): Promise<void> {
    state.error = null
    try {
      await work()
      state.status = 'ready'
    } catch (failure) {
      fail(failure)
    }
  }

  let opened: Promise<void> | null = null

  return {
    state: shallowReadonly(state),

    open() {
      opened ??= showStoredCopy()
      return opened
    },

    async sync() {
      if (state.choice?.source === 'excel') {
        return
      }
      await readGoogle(state.choice)
    },

    canSyncSilently() {
      return state.choice?.source === 'google' && ports.hasLiveAccessToken()
    },

    signOutOfGoogle() {
      return ports.signOutOfGoogle()
    },

    chooseGoogleSheet() {
      return readGoogle(null)
    },

    replaceLocalWorkbook(tabs, title) {
      return underLocalWork(async () => {
        const id = state.choice?.source === 'excel' ? state.choice.id : ports.newLocalId()
        const meta = { id, source: 'excel' as const, title, syncedAt: ports.now(), ledgerSheetId: null, lastExportedAt: null, unexportedSince: null }
        await keep({ meta, ...tabs })
        choose({ source: 'excel', id, name: title })
        ports.forgetGoogleSignIn()
        ports.requestPersistentStorage()
      })
    },

    saveLocalEdits(edits) {
      return underLocalWork(async () => {
        const current = state.snapshot
        if (current === null || current.meta.source !== 'excel') {
          throw new Error('Only a workbook kept in this browser can be edited here. Edit a Google Sheet in Google Sheets.')
        }
        const now = ports.now()
        await keep({ ...current, ...edits, meta: { ...current.meta, syncedAt: now, unexportedSince: current.meta.unexportedSince ?? now } })
      })
    },

    recordExport() {
      return underLocalWork(async () => {
        const current = state.snapshot
        if (current !== null) {
          await keep({ ...current, meta: { ...current.meta, lastExportedAt: ports.now(), unexportedSince: null } })
        }
      })
    },
  }
}

const workbookStore = createWorkbookStore({
  loadChoice: loadWorkbookChoice,
  saveChoice: saveWorkbookChoice,
  openCache: openWorkbookCache,
  async fetchFromGoogle(sheet) {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { fakeWorkbookSnapshot } = await import('../infrastructure/fake/fakeWorkbook')
      return fakeWorkbookSnapshot(new Date().toISOString())
    }
    return readFromGoogle(googleWorkbookPorts, sheet)
  },
  prepareSync() {
    if (import.meta.env.VITE_FAKE_WORKBOOK !== 'true') {
      prepareGoogleIdentity().catch(() => {
        // The click loads it again and reports the failure then.
      })
    }
  },
  hasLiveAccessToken: () => currentAccessToken() !== null,
  forgetGoogleSignIn,
  signOutOfGoogle,
  newLocalId: () => `local-${crypto.randomUUID()}`,
  now: () => new Date().toISOString(),
  requestPersistentStorage() {
    navigator.storage?.persist?.().catch(() => {
      // Refused or unsupported: the data stays, but the browser may evict it under pressure.
    })
  },
})

/** The one workbook store the screens share. */
export function useWorkbook(): WorkbookStore {
  return workbookStore
}
