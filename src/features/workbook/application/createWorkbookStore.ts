import { shallowReactive, shallowReadonly } from 'vue'

import { setMoneyFormat } from '../../../shared/money/moneyFormat'
import type { WorkbookRecords } from '../domain/readWorkbook'
import type { Workbook } from '../domain/workbook'
import { changesOf, checkWrite, isUndoable, receiptOf, undoOf } from './recordWrites'
import type { RuledChange, WriteReceipt } from './recordWrites'
import type { UnitOfWork } from './repository'
import type { CopyMeta, CopyStorage, DriveFileLookup, DriveFilePlace, WorkbookCache, WorkbookChoice, WorkbookCopy } from './workbookPorts'
import { WorkbookWriteRefused } from './workbookWriteRefused'

export type WorkbookStatus = 'opening' | 'ready' | 'syncing' | 'error'

/** One write this page made to a workbook. Held in memory, so a reload forgets it. */
export interface SessionWrite {
  /** Counts up from 1 for each write of the page. */
  readonly id: number
  /** ISO timestamp of when the write finished. */
  readonly at: string
  readonly workbookId: string
  readonly receipt: WriteReceipt
  /** The receipt of the write this one undid, or null. */
  readonly undid: WriteReceipt | null
}

/** Whether the write put back what an earlier one of the session changed. */
export function isUndo(write: SessionWrite): boolean {
  return write.undid !== null
}

/** Whether a later write of the session put back what this one changed. */
export function wasUndone(write: SessionWrite, writes: readonly SessionWrite[]): boolean {
  return writes.some((later) => later.undid === write.receipt)
}

/** Whether Undo can put back what a write changed: records of kinds that keep Undo, unless it is an undo itself or was undone since. */
export function canUndo(write: SessionWrite, writes: readonly SessionWrite[]): boolean {
  return isUndoable(write.receipt) && !isUndo(write) && !wasUndone(write, writes)
}

export interface WorkbookState<Copy extends WorkbookCopy> {
  /** Null until a cached copy, a sync or an import supplies one. */
  readonly workbook: Workbook | null
  /** What the workbook holds of each kind, records the domain refuses among them, which the editors show as stored. */
  readonly records: WorkbookRecords | null
  /** The copy the workbook was read from, which an export writes. */
  readonly snapshot: Copy | null
  /** ISO timestamp of the read the workbook on screen came from, or of its last change to a workbook kept in this browser. */
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

export interface WorkbookStorePorts<Copy extends WorkbookCopy, Contents> {
  loadChoice(): WorkbookChoice | null
  saveChoice(choice: WorkbookChoice | null): void
  openCache(workbookId: string): WorkbookCache<Copy>
  /**
   * The chosen Drive file as it is now, `held` itself while the file has not changed. Asks Google
   * for a token first when none is kept, so call it from a click unless a token is kept.
   */
  readDriveFile(choice: WorkbookChoice, held: Copy | null): Promise<Copy>
  /**
   * The books on Drive: with `find` the file the app marked, or the one picked when the search finds
   * none, and with `pick` the one picked. Refuses a backup and another app's file. Null when cancelled.
   */
  findDriveFile(lookup: DriveFileLookup): Promise<Copy | null>
  /**
   * Creates the app's file in a Drive folder the person picks, holding these contents, reads it
   * back and throws unless it holds the same records. Null when cancelled.
   */
  createDriveFile(contents: Contents): Promise<Copy | null>
  /** Where the Drive file sits and its newest backup, or null while no token is kept, since asking for one needs a click. */
  driveFilePlace(fileId: string): Promise<DriveFilePlace | null>
  /** Loads whatever the next sync's click needs, so the click is not kept waiting. Never called for a workbook kept in this browser. */
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
  /** Waits before a write starts again on a file that moved since its read. */
  pause(milliseconds: number): Promise<void>
  /** Asks the browser not to evict the data. Firefox shows a prompt for it. */
  requestPersistentStorage(): void
  /** The records a copy holds and the workbook they make. */
  read(copy: Copy): { readonly records: WorkbookRecords; readonly workbook: Workbook }
  /** Keeps what an import or a fresh start gives as the workbook of this browser, in place of any it held, and gives its copy. */
  keepInBrowser(meta: CopyMeta, contents: Contents): Promise<Copy>
  /** Deletes the workbook kept in this browser under this id. */
  forgetBrowserWorkbook(workbookId: string): Promise<void>
  /** The storage a write of the copy's workbook goes through. Asks Google for a token first when none is kept, so call it before anything else awaits. */
  openStorage(copy: Copy): Promise<CopyStorage<Copy>>
}

export interface WorkbookStore<Copy extends WorkbookCopy, Contents = unknown> {
  readonly state: Readonly<WorkbookState<Copy>>
  /** Shows the workbook this browser holds, if any. Later calls wait on the first. */
  open(): Promise<void>
  /**
   * Reads the chosen Drive file again when it changed and replaces the cache whole. Does nothing
   * for a workbook kept in this browser. Call it from a click handler unless `canSyncSilently()`
   * holds, since a new token needs a popup.
   */
  sync(): Promise<void>
  /** A Drive file is chosen and a kept token is still good, so a sync opens no popup. */
  canSyncSilently(): boolean
  /** Revokes and forgets the Google sign-in. The file stays chosen and its copy stays on screen. */
  signOutOfGoogle(): Promise<void>
  /**
   * Shows the books on Drive, found by the app's mark or picked, as `lookup` says. On a cancel or a
   * failure the previous workbook stays chosen. Leaving a workbook kept in this browser deletes it.
   */
  chooseDriveFile(lookup: DriveFileLookup): Promise<void>
  /**
   * Keeps the contents, an opened file's, a fresh start's or the workbook kept in this browser, in a
   * new file in a Drive folder the person picks, and shows that file once it reads back with the
   * same records. Leaving a workbook kept in this browser deletes it. On a cancel or a failure the
   * previous workbook stays chosen.
   */
  keepOnDrive(contents: Contents): Promise<void>
  /** Where the chosen Drive file sits and its newest backup. Null for a workbook kept in this browser, or while no token is kept. */
  driveFilePlace(): Promise<DriveFilePlace | null>
  /**
   * Makes this the workbook kept in this browser, as an import or a fresh start does, and chooses
   * it. A workbook already kept here is replaced, and a Google sign-in is forgotten.
   */
  replaceLocalWorkbook(contents: Contents, title: string): Promise<void>
  /** Notes that the workbook on screen was just written to a file. */
  recordExport(): Promise<void>
  /**
   * Writes the records the work adds, changes, repairs and removes through its repositories, as one
   * write: a fresh read of the kinds it touches and the kinds their checks read, each record found by
   * its identity and refused when it changed since the app read it, the domain checks of every kind,
   * one apply, and a read back that every record holds what was written. When the file moved since
   * the read, the write starts again from a fresh read, at most three times. Returns what Undo puts
   * back, or null when nothing differed. Throws `WorkbookWriteRefused` when it writes nothing.
   */
  write(title: string, work: (unit: UnitOfWork) => void): Promise<WriteReceipt | null>
  /**
   * Puts back what a write of this session changed, through the checks of its kinds. A removed
   * record comes back with the same identity. Refused for a write `canUndo` rules out.
   */
  undo(write: SessionWrite): Promise<void>
}

/** How often a write starts again on a file another device saved since the write's read. */
const MOVED_RETRIES = 3

/** Google's backoff for a request that may succeed later: 1, 2 and 4 seconds, each with up to a second more at random. */
function backoff(retry: number): number {
  return 2 ** retry * 1000 + Math.floor(Math.random() * 1000)
}

/** Cache first: the copy this browser holds is on screen at once, and a sync or an import replaces it. */
export function createWorkbookStore<Copy extends WorkbookCopy, Contents>(ports: WorkbookStorePorts<Copy, Contents>): WorkbookStore<Copy, Contents> {
  const state = shallowReactive<{ -readonly [Field in keyof WorkbookState<Copy>]: WorkbookState<Copy>[Field] }>({
    workbook: null,
    records: null,
    snapshot: null,
    syncedAt: null,
    choice: null,
    status: 'opening',
    error: null,
    writing: false,
    writes: [],
  })

  function show(copy: Copy): void {
    const { records, workbook } = ports.read(copy)
    setMoneyFormat({ currency: workbook.settings.currency, locale: workbook.settings.numberLocale })
    state.snapshot = copy
    state.records = records
    state.workbook = workbook
    state.syncedAt = copy.meta.syncedAt
  }

  function choose(choice: WorkbookChoice | null): void {
    ports.saveChoice(choice)
    state.choice = choice
  }

  async function withCache<Result>(workbookId: string, use: (cache: WorkbookCache<Copy>) => Promise<Result>): Promise<Result> {
    const cache = ports.openCache(workbookId)
    try {
      return await use(cache)
    } finally {
      cache.close()
    }
  }

  async function keep(copy: Copy): Promise<void> {
    await withCache(copy.meta.id, (cache) => cache.replace(copy))
    show(copy)
  }

  function fail(failure: unknown): void {
    state.status = 'error'
    state.error = failure instanceof Error ? failure.message : String(failure)
  }

  async function showStoredCopy(): Promise<void> {
    try {
      const choice = ports.loadChoice()
      state.choice = choice
      // A workbook kept in this browser never talks to Google, so it never loads Google's scripts either.
      if (choice?.source !== 'browser') {
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
  function withExportHistory(copy: Copy): Copy {
    const previous = state.snapshot?.meta.id === copy.meta.id ? state.snapshot.meta : null
    return previous === null ? copy : { ...copy, meta: { ...copy.meta, lastExportedAt: previous.lastExportedAt } }
  }

  /** Shows the copy a read of Drive gives, the chosen file or one found or made there, and chooses it. Leaving a workbook kept in this browser deletes it. */
  async function readDrive(read: () => Promise<Copy | null>): Promise<void> {
    if (state.status === 'syncing' || state.writing) {
      return
    }
    const previous = state.choice
    state.status = 'syncing'
    state.error = null
    try {
      const copy = await read()
      if (copy !== null) {
        await keep(withExportHistory(copy))
        choose({ source: 'drive', id: copy.meta.id, name: copy.meta.title })
        if (previous?.source === 'browser') {
          await withCache(previous.id, (cache) => cache.delete())
          await ports.forgetBrowserWorkbook(previous.id)
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

  /** The copy on screen with what the storage read back. A workbook kept in this browser was changed just now, and that change is not exported yet. */
  function readBack(storage: CopyStorage<Copy>, copy: Copy): Copy {
    const read = storage.readBack(copy)
    if (read.meta.source !== 'browser') {
      return read
    }
    const now = ports.now()
    return { ...read, meta: { ...read.meta, syncedAt: now, unexportedSince: read.meta.unexportedSince ?? now } }
  }

  /** A write that failed part way may still have changed the Drive file, so the copy on screen is read again where possible. */
  async function refreshAfterFailedWrite(storage: CopyStorage<Copy>): Promise<void> {
    try {
      await storage.readAgain()
      const snapshot = state.snapshot
      if (snapshot !== null) {
        await keep(readBack(storage, snapshot))
      }
    } catch {
      // The next sync reads the file whole.
    }
  }

  /**
   * Every write the same way: checked on a fresh read, written, read back into the copy on screen,
   * checked again, then added to the session's writes. A write the file's home finds moved since
   * its read starts again from a fresh read. A write that may have reached a Drive file and then
   * failed reads it again where it can.
   */
  async function writeRecords(title: string, changes: readonly RuledChange[], undid: WriteReceipt | null): Promise<WriteReceipt | null> {
    const current = state.snapshot
    if (current === null || state.choice === null || state.choice.id !== current.meta.id) {
      throw new WorkbookWriteRefused('There is no workbook on screen to change.')
    }
    if (state.writing || state.status === 'syncing') {
      throw new WorkbookWriteRefused('Another change or a sync is still running. Try again when it finishes.')
    }
    const options = { undoing: undid !== null }
    state.writing = true
    let storage: CopyStorage<Copy> | null = null
    let sent = false
    try {
      for (let retry = 0; ; retry += 1) {
        storage = await ports.openStorage(current)
        const checked = await checkWrite(storage, title, changes, options)
        if (checked === null) {
          return null
        }
        sent = true
        const applied = await storage.apply(
          checked.changes.map(({ change }) => change),
          async (other) => {
            await checkWrite(other, title, changes, options)
          },
        )
        if (applied === 'applied') {
          const after = await storage.read(checked.kinds)
          await keep(readBack(storage, state.snapshot ?? current))
          const receipt = receiptOf(checked, after)
          state.writes = [{ receipt, undid, id: state.writes.length + 1, at: ports.now(), workbookId: current.meta.id }, ...state.writes]
          return receipt
        }
        sent = false
        if (retry === MOVED_RETRIES) {
          throw new WorkbookWriteRefused('Nothing was written. Another device kept saving the workbook during this change. Sync and try again.')
        }
        await ports.pause(backoff(retry))
      }
    } catch (failure) {
      if (sent && storage !== null && current.meta.source === 'drive') {
        await refreshAfterFailedWrite(storage)
      }
      throw failure
    } finally {
      state.writing = false
    }
  }

  let opened: Promise<void> | null = null

  return {
    state: shallowReadonly(state) as Readonly<WorkbookState<Copy>>,

    open() {
      opened ??= showStoredCopy()
      return opened
    },

    async sync() {
      const choice = state.choice
      if (choice?.source !== 'drive') {
        return
      }
      await readDrive(() => ports.readDriveFile(choice, state.snapshot?.meta.id === choice.id ? state.snapshot : null))
    },

    canSyncSilently() {
      return state.choice?.source === 'drive' && ports.hasLiveAccessToken()
    },

    signOutOfGoogle() {
      return ports.signOutOfGoogle()
    },

    chooseDriveFile(lookup) {
      return readDrive(() => ports.findDriveFile(lookup))
    },

    keepOnDrive(contents) {
      return readDrive(() => ports.createDriveFile(contents))
    },

    async driveFilePlace() {
      const choice = state.choice
      return choice?.source === 'drive' ? ports.driveFilePlace(choice.id) : null
    },

    replaceLocalWorkbook(contents, title) {
      return underLocalWork(async () => {
        const id = state.choice?.source === 'browser' ? state.choice.id : ports.newLocalId()
        await keep(await ports.keepInBrowser({ id, source: 'browser', title, syncedAt: ports.now(), lastExportedAt: null, unexportedSince: null }, contents))
        choose({ source: 'browser', id, name: title })
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

    async write(title, work) {
      return await writeRecords(title, changesOf(work), null)
    },

    async undo(write) {
      if (!canUndo(write, state.writes)) {
        throw new WorkbookWriteRefused('This change cannot be undone from here.')
      }
      await writeRecords('Undone', undoOf(write.receipt), write.receipt)
    },
  }
}
