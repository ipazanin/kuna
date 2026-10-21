import { shallowReactive, shallowReadonly } from 'vue'

import { setMoneyFormat } from '../../../shared/money/moneyFormat'
import { undoOf } from '../../review/domain/verdictChanges'
import type { LedgerVerdictChange, VerdictReceipt } from '../../review/domain/verdictChanges'
import type { RulesTabChange } from '../../rules/domain/rulesTabChange'
import { undoOfRows } from '../domain/rowChanges'
import type { TabRowsChange, TabRowsReceipt } from '../domain/rowChanges'
import type { Workbook } from '../domain/workbook'
import { googleWorkbookPorts, readSnapshotFrom, sheetsValuesForWriting } from '../infrastructure/googleWorkbookPorts'
import { googleWorkbookWriter } from '../infrastructure/googleWorkbookWriter'
import { localWorkbookWriter } from '../infrastructure/localWorkbookWriter'
import { currentAccessToken, forgetGoogleSignIn, prepareGoogleIdentity, signOutOfGoogle } from '../infrastructure/googleAuth'
import { loadWorkbookChoice, saveWorkbookChoice } from '../infrastructure/workbookChoice'
import type { WorkbookChoice } from '../infrastructure/workbookChoice'
import { openWorkbookCache } from '../infrastructure/workbookCache'
import type { WorkbookCache } from '../infrastructure/workbookCache'
import { readWorkbook } from '../infrastructure/workbookReader'
import { WORKBOOK_TABS } from '../infrastructure/workbookSnapshot'
import type { WorkbookSnapshot, WorkbookTab, WorkbookTabs } from '../infrastructure/workbookSnapshot'
import { readFromGoogle } from './readFromGoogle'
import type { GoogleSheet } from './readFromGoogle'
import { planRowsChange, verifyRowsChange } from './tabRowWrites'
import type { TabRowRules } from './tabRowWrites'
import { WorkbookWriteRefused, hasEdits } from './workbookWriter'
import type { FreshTabs, TabEdits, WorkbookWriter } from './workbookWriter'
import { planRulesChange, planSettingsChange, planVerdicts, verifyRulesChange, verifySettingsChange, verifyVerdicts } from './writePlans'
import type { SettingChange } from './writePlans'

export type WorkbookStatus = 'opening' | 'ready' | 'syncing' | 'error'

interface WrittenAt {
  /** Counts up from 1 for each write of the page. */
  readonly id: number
  /** ISO timestamp of when the write finished. */
  readonly at: string
  readonly workbookId: string
}

/** What one write changed. */
export type WrittenChange =
  | {
      readonly kind: 'ledger'
      /** What the rows held before, exactly, for Undo. */
      readonly receipt: VerdictReceipt
      /** The receipt of the write this one undid, or null. */
      readonly undid: VerdictReceipt | null
    }
  | { readonly kind: 'rules'; readonly change: RulesTabChange }
  | { readonly kind: 'settings'; readonly changes: readonly SettingChange[] }
  | {
      readonly kind: 'rows'
      /** The tab's rules, which the write's Undo goes through again. */
      readonly rules: TabRowRules
      readonly receipt: TabRowsReceipt
      /** The receipt of the write this one undid, or null. */
      readonly undid: TabRowsReceipt | null
    }

/** One write this page made to a workbook. Held in memory, so a reload forgets it. */
export type SessionWrite = WrittenAt & WrittenChange

/** Whether the write put back what an earlier one of the session changed. */
export function isUndo(write: SessionWrite): boolean {
  switch (write.kind) {
    case 'ledger':
    case 'rows':
      return write.undid !== null
    case 'rules':
    case 'settings':
      return false
  }
}

/** Whether a later write of the session put back what this one changed. */
export function wasUndone(write: SessionWrite, writes: readonly SessionWrite[]): boolean {
  switch (write.kind) {
    case 'ledger':
      return writes.some((later) => later.kind === 'ledger' && later.undid === write.receipt)
    case 'rows':
      return writes.some((later) => later.kind === 'rows' && later.undid === write.receipt)
    case 'rules':
    case 'settings':
      return false
  }
}

/**
 * Whether Undo can put back what a write changed: a ledger write, or rows added, changed or deleted
 * on a tab, unless it is an undo itself or was undone since. Rules and settings have no undo.
 */
export function canUndo(write: SessionWrite, writes: readonly SessionWrite[]): boolean {
  return write.kind !== 'rules' && write.kind !== 'settings' && !isUndo(write) && !wasUndone(write, writes)
}

/**
 * Why Undo would put a write's deleted rows back on the wrong row, or null when it would not. Undo
 * puts each one back on the row it stood on, which is only right while every row above it is the
 * same, so a later write of the session that added or deleted a row above them, and is still in
 * place, stops it. A later write and its own undo cancel out.
 */
function undoOrderRefusal(write: SessionWrite, writes: readonly SessionWrite[]): string | null {
  if (write.kind !== 'rows' || write.receipt.removed.length === 0) {
    return null
  }
  const tab = write.rules.tab
  const deleted = write.receipt.removed.map((row) => row.sheetRow)
  // Where the first row below every deleted row stands once they are gone. A row deleted from there
  // down leaves the places alone, and so does one added further down. One added on that very row
  // may belong above a deleted row, so it counts.
  const firstBelow = Math.max(...deleted) - deleted.length + 1
  const later = writes.find((other) => {
    if (other.id <= write.id || other.workbookId !== write.workbookId || other.kind !== 'rows' || other.rules.tab !== tab || wasUndone(other, writes)) return false
    const undid = other.undid === null ? undefined : writes.find((candidate) => candidate.kind === 'rows' && candidate.receipt === other.undid)
    if (undid !== undefined && undid.id > write.id) return false
    return other.receipt.added.some((row) => row.sheetRow <= firstBelow) || other.receipt.removed.some((row) => row.sheetRow < firstBelow)
  })
  if (later === undefined) {
    return null
  }
  const reason = `A later change to the ${tab} tab added or deleted rows above the ones this would put back, so they would land on the wrong rows.`
  return canUndo(later, writes) ? `${reason} Undo the later change first.` : `${reason} Put them back in the workbook by hand.`
}

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
  /** True while a change is being written, during which no sync starts and no other change is taken. */
  readonly writing: boolean
  /** Every write this page made, newest first. */
  readonly writes: readonly SessionWrite[]
}

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
  /** Writes to the given Sheet. Asks for a token first when none is kept, so call it before anything else awaits. */
  googleWriter(spreadsheetId: string): Promise<WorkbookWriter>
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
  /** Notes that the workbook on screen was just written to a file. */
  recordExport(): Promise<void>
  /**
   * Sets `category` and `flagged_by` on ledger rows, each found again by its key on a fresh read,
   * then reads the tabs back into the copy on screen. Returns what Undo puts back. Throws
   * `WorkbookWriteRefused` with the reason when it writes nothing.
   */
  setVerdicts(changes: readonly LedgerVerdictChange[]): Promise<VerdictReceipt>
  /** Puts back what the receipt's write replaced, through the same checks, refused if anything changed the rows since. */
  undoVerdicts(receipt: VerdictReceipt): Promise<VerdictReceipt>
  /** Adds or edits rules rows, refused unless the whole tab then passes the Apps Script's check. */
  changeRules(change: RulesTabChange): Promise<void>
  /** Sets settings rows by key, adding a row for a key the tab lacks. */
  changeSettings(changes: readonly SettingChange[]): Promise<void>
  /**
   * Adds, changes and deletes rows of one tab in one write, each row found again as the app read
   * it and the tab checked by its rules. With `addMissingTab`, once the person agreed, a Google
   * Sheet without the tab gets it with the template's header first. Returns what Undo puts back,
   * or null when nothing differed.
   */
  changeRows(rules: TabRowRules, change: TabRowsChange, addMissingTab?: boolean): Promise<TabRowsReceipt | null>
  /** Puts back what a write of this session changed, through that write's own checks. Refused for a write `canUndo` rules out, and while `undoOrderRefusal` gives a reason. */
  undo(write: SessionWrite): Promise<void>
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
    writing: false,
    writes: [],
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
    if (state.status === 'syncing' || state.writing) {
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

  /** The copy on screen with the tabs just read back from the workbook written to, and which of the requested ones it lacks. */
  function withTabsReadBack(snapshot: WorkbookSnapshot, after: FreshTabs, requested: readonly WorkbookTab[]): WorkbookSnapshot {
    const tabs = Object.fromEntries(Object.entries(after).map(([tab, read]) => [tab, read.rows]))
    if (snapshot.meta.source !== 'excel') {
      const missingTabs = WORKBOOK_TABS.filter((tab) => after[tab] === undefined && (requested.includes(tab) || snapshot.meta.missingTabs.includes(tab)))
      return { ...snapshot, ...tabs, meta: { ...snapshot.meta, missingTabs } }
    }
    const now = ports.now()
    return { ...snapshot, ...tabs, meta: { ...snapshot.meta, syncedAt: now, unexportedSince: snapshot.meta.unexportedSince ?? now } }
  }

  /**
   * Every write the same way: read the tabs fresh, plan on that read, write, read back, keep what
   * was read, check it holds what was written, then add it to the session's writes. In Excel mode
   * the reads and writes go to a working copy, which only replaces the stored workbook once it is
   * complete.
   */
  async function writeThrough<Plan extends { readonly edits: TabEdits }>(
    tabs: readonly WorkbookTab[],
    plan: (fresh: FreshTabs) => Plan,
    verify: (after: FreshTabs, planned: Plan) => void,
    written?: (planned: Plan) => WrittenChange,
  ): Promise<Plan> {
    const current = state.snapshot
    if (current === null || state.choice === null || state.choice.id !== current.meta.id) {
      throw new WorkbookWriteRefused('There is no workbook on screen to change.')
    }
    if (state.writing || state.status === 'syncing') {
      throw new WorkbookWriteRefused('Another change or a sync is still running. Try again when it finishes.')
    }
    state.writing = true
    let sent = false
    try {
      const writer = current.meta.source === 'excel' ? localWorkbookWriter(current) : await ports.googleWriter(current.meta.id)
      const fresh = await writer.read(tabs)
      const planned = plan(fresh)
      if (!hasEdits(planned.edits)) {
        return planned
      }
      sent = true
      await writer.write(planned.edits, fresh)
      const after = await writer.read(tabs)
      await keep(withTabsReadBack(state.snapshot ?? current, after, tabs))
      verify(after, planned)
      if (written !== undefined) {
        state.writes = [{ ...written(planned), id: state.writes.length + 1, at: ports.now(), workbookId: current.meta.id }, ...state.writes]
      }
      return planned
    } catch (failure) {
      if (sent && current.meta.source === 'google') {
        await refreshAfterFailedWrite(current.meta.id, tabs)
      }
      throw failure
    } finally {
      state.writing = false
    }
  }

  /** A write that failed part way may still have changed the Sheet, so the copy on screen is read again where possible. */
  async function refreshAfterFailedWrite(spreadsheetId: string, tabs: readonly WorkbookTab[]): Promise<void> {
    try {
      const after = await (await ports.googleWriter(spreadsheetId)).read(tabs)
      const snapshot = state.snapshot
      if (snapshot !== null) {
        await keep(withTabsReadBack(snapshot, after, tabs))
      }
    } catch {
      // The next sync reads the Sheet whole.
    }
  }

  async function writeVerdicts(changes: readonly LedgerVerdictChange[], undid: VerdictReceipt | null): Promise<VerdictReceipt> {
    const planned = await writeThrough(['ledger', 'categories'], (fresh) => planVerdicts(fresh, changes), verifyVerdicts, ({ receipt }) => ({ kind: 'ledger', receipt, undid }))
    return planned.receipt
  }

  async function writeRows(rules: TabRowRules, change: TabRowsChange, undid: TabRowsReceipt | null, addMissingTab = false): Promise<TabRowsReceipt | null> {
    let receipt = null as TabRowsReceipt | null
    await writeThrough(
      [rules.tab, ...rules.reads],
      (fresh) => planRowsChange(fresh, rules, change, addMissingTab),
      (after, planned) => {
        receipt = verifyRowsChange(after, rules, planned)
      },
      () => ({ kind: 'rows', rules, receipt: receipt!, undid }),
    )
    return receipt
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
        const meta = { id, source: 'excel' as const, title, syncedAt: ports.now(), ledgerSheetId: null, lastExportedAt: null, unexportedSince: null, missingTabs: [] }
        await keep({ meta, ...tabs })
        choose({ source: 'excel', id, name: title })
        ports.forgetGoogleSignIn()
        ports.requestPersistentStorage()
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

    setVerdicts(changes) {
      return writeVerdicts(changes, null)
    },

    undoVerdicts(receipt) {
      return writeVerdicts(undoOf(receipt), receipt)
    },

    async changeRules(change) {
      await writeThrough(
        ['rules', 'categories', 'clients'],
        (fresh) => ({ edits: planRulesChange(fresh, change) }),
        (after) => verifyRulesChange(after, change),
        () => ({ kind: 'rules', change }),
      )
    },

    async changeSettings(changes) {
      await writeThrough(
        ['settings'],
        (fresh) => ({ edits: planSettingsChange(fresh, changes) }),
        (after) => verifySettingsChange(after, changes),
        () => ({ kind: 'settings', changes }),
      )
    },

    changeRows(rules, change, addMissingTab = false) {
      return writeRows(rules, change, null, addMissingTab)
    },

    async undo(write) {
      if (!canUndo(write, state.writes)) {
        throw new WorkbookWriteRefused('This change cannot be undone from here.')
      }
      switch (write.kind) {
        case 'ledger':
          await writeVerdicts(undoOf(write.receipt), write.receipt)
          return
        case 'rows': {
          const refusal = undoOrderRefusal(write, state.writes)
          if (refusal !== null) {
            throw new WorkbookWriteRefused(refusal)
          }
          await writeRows(write.rules, undoOfRows(write.receipt), write.receipt)
          return
        }
      }
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
      const { fakeGoogleSheet, fakeSheetsSession } = await import('../infrastructure/fake/fakeSheets')
      return readSnapshotFrom(fakeSheetsSession(), fakeGoogleSheet)
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
  async googleWriter(spreadsheetId) {
    // Inline, as above: the fake build writes to a Sheet held in memory for the session.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { fakeSheetsSession } = await import('../infrastructure/fake/fakeSheets')
      return googleWorkbookWriter(fakeSheetsSession())
    }
    return googleWorkbookWriter(await sheetsValuesForWriting(spreadsheetId))
  },
})

/** The one workbook store the screens share. */
export function useWorkbook(): WorkbookStore {
  return workbookStore
}
