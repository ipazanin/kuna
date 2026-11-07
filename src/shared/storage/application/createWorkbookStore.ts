import { shallowReactive, shallowReadonly } from 'vue'

import { backoff } from '../../google/googleApi'
import { BooksAlreadyOnDrive } from './booksAlreadyOnDrive'
import { DriveFileMissing } from './driveFileMissing'
import { changesOf, checkWrite, isUndoable, receiptOf, undoOf } from './recordWrites'
import type { RecordChange, StorageView } from './recordStorage'
import type { CheckedWrite, RuledChange, WriteReceipt } from './recordWrites'
import type { UnitOfWork } from './repository'
import type { CopyMeta, CopyStorage, DriveFileBeside, DriveFileLookup, DriveFilePlace, DriveMovePlan, PickedFolder, WorkbookCache, WorkbookChoice, WorkbookCopy } from './workbookPorts'
import { words } from './words'
import { shownCopyOf } from './writeQueue'
import type { QueuedWrite, WriteOptions } from './writeQueue'
import { trackWrite } from './writesInFlight'
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
  /** What names it to `saving(key)`, which its undo carries too, so the control that started it spins again. */
  readonly keys: readonly string[]
  /** Whether a one-tap control's value carried it, so its toast needs no line under the title. */
  readonly shownAtOnce: boolean
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

/** What an app reads from a copy: the records it holds of each kind and the workbook they make. */
export interface BooksRead {
  readonly records: unknown
  readonly workbook: unknown
}

/** What a write would meet on the copy on screen: ready to be made, nothing to change, or the reason it would be refused. */
export type WriteCheck = { readonly status: 'ready'; readonly checked: CheckedWrite } | { readonly status: 'nothingToChange' } | { readonly status: 'refused'; readonly reason: string }

export interface WorkbookState<Books extends BooksRead, Copy extends WorkbookCopy> {
  /** What the screen shows, the copy with the queued changes marked shown at once made on top of it. Null until a cached copy, a sync or an import supplies one. */
  readonly workbook: Books['workbook'] | null
  /** What the screen shows of each kind, the copy with the queued changes marked shown at once made on top of it, records the domain refuses among them, which the editors show as stored. */
  readonly records: Books['records'] | null
  /** What the file holds, which the cache keeps and an export writes. */
  readonly snapshot: Copy | null
  /** ISO timestamp of the read the workbook on screen came from, or of its last change to a workbook kept in this browser. */
  readonly syncedAt: string | null
  /** The workbook this browser shows, or null before one is chosen. */
  readonly choice: WorkbookChoice | null
  readonly status: WorkbookStatus
  readonly error: string | null
  /** True once a read or a write found the chosen Drive file in the bin or gone, until a read finds it again or another file is chosen. */
  readonly missing: boolean
  /** The writes of this file waiting their turn or running, in the order they were asked for. */
  readonly waiting: readonly QueuedWrite[]
  /** Every write this page made, newest first. */
  readonly writes: readonly SessionWrite[]
}

/** How `dropWorkbook` goes about it. */
export interface DropOptions {
  /** Runs before anything is dropped, and a failure of it throws with nothing dropped. No sync or write starts until it is all over, so it must not wait for one of this file. */
  readonly first?: () => Promise<void>
  /** Leaves a Drive file where it is, and only this browser forgets it and its copy. */
  readonly keepDriveFile?: boolean
}

export interface WorkbookStorePorts<Books extends BooksRead, Copy extends WorkbookCopy, Contents> {
  loadChoice(): WorkbookChoice | null
  saveChoice(choice: WorkbookChoice | null): void
  openCache(workbookId: string): WorkbookCache<Copy>
  /**
   * The chosen Drive file as it is now, `held` itself while the file has not changed. Asks Google
   * for a token first when the page holds none, so call it from a click unless it holds one.
   */
  readDriveFile(choice: WorkbookChoice, held: Copy | null): Promise<Copy>
  /**
   * The books on Drive: with `find` the file the app marked, or the one picked when the search finds
   * none, and with `pick` the one picked. Refuses a backup and another app's file. Null when cancelled.
   */
  findDriveFile(lookup: DriveFileLookup): Promise<Copy | null>
  /** A folder the person picks in the Picker, opened at My Drive, under this title. Null when cancelled. */
  pickDriveFolder(title: string): Promise<PickedFolder | null>
  /**
   * The app's subfolder of the Kuna folder, each made when missing, with a new Kuna folder in `parentId`, or at the top of My Drive for
   * null. Throws `BooksAlreadyOnDrive`, making nothing, when Drive already holds the file the app marked as its books.
   */
  driveHomeOfApp(parentId: string | null): Promise<string>
  /** Whether Drive already holds the Kuna folder, null while the page holds no token, so that stays unknown. */
  hasKunaFolder(): Promise<boolean | null>
  /** Makes a folder of this name beside the file, unless the app made one there before. */
  folderBesideFile(fileId: string, name: string): Promise<void>
  /** What a move of the file into the Kuna folder would take and leave, changing nothing. */
  planMoveIntoKuna(fileId: string, beside: DriveFileBeside): Promise<DriveMovePlan>
  /** Moves the file into the app's subfolder of the Kuna folder, as `moveDriveDocument` says, and gives the names that stayed because theirs was taken. */
  moveIntoKuna(fileId: string, beside: DriveFileBeside, parentId: string | null): Promise<readonly string[]>
  /** The move is over, so the file stops offering to finish it. */
  finishMoveIntoKuna(fileId: string): Promise<void>
  /**
   * Creates the app's file in the folder, holding these contents, reads it back and throws unless it
   * holds the same records. Throws `BooksAlreadyOnDrive`, making nothing, when Drive already holds the
   * file the app marked as its books.
   */
  createDriveFile(folderId: string, contents: Contents): Promise<Copy>
  /** Where the Drive file sits and its newest backup, or null while the page holds no token, since asking for one needs a click. */
  driveFilePlace(fileId: string): Promise<DriveFilePlace | null>
  /** Moves the Drive file to the bin, from which the person can restore it for 30 days. `drive.file` allows it for a file the app made or was given in the Picker, and Drive only for its owner. */
  trashDriveFile(fileId: string): Promise<void>
  /** How many backups Kuna made of the file are on Drive, or null while the page holds no token, since asking for one needs a click. */
  countBackups(fileId: string): Promise<number | null>
  /** Moves every backup Kuna made of the file to the bin, trying them all, and throws naming those that did not go. */
  trashBackups(fileId: string): Promise<void>
  /** Loads whatever the next sync's click needs, so the click is not kept waiting. Never called for a workbook kept in this browser. */
  prepareSync(): void
  /** Whether the page's Google token is still good, so a sync needs no popup. */
  hasLiveAccessToken(): boolean
  /** Runs once a workbook is kept in this browser in place of the one before. The app decides whether the page's Google sign-in goes with it. */
  keptInBrowser(): void
  /** A new id for a workbook kept in this browser. */
  newLocalId(): string
  now(): string
  /** Waits before a write starts again on a file that moved since its read. */
  pause(milliseconds: number): Promise<void>
  /** Asks the browser not to evict the data. Firefox shows a prompt for it. */
  requestPersistentStorage(): void
  /** The records a copy holds and the workbook they make. */
  read(copy: Copy): Books
  /** The copy with these changes made on it, with nothing stored. Throws `WorkbookWriteRefused` when one no longer applies. */
  withChanges(copy: Copy, changes: readonly RecordChange[]): Copy
  /** What a write's checks read of a copy, with nothing stored and no request to Drive. */
  viewOf(copy: Copy): StorageView
  /** Keeps what an import or a fresh start gives as the workbook of this browser, in place of any it held, and gives its copy. */
  keepInBrowser(meta: CopyMeta, contents: Contents): Promise<Copy>
  /** Deletes the workbook kept in this browser under this id. */
  forgetBrowserWorkbook(workbookId: string): Promise<void>
  /** The storage a write of the copy's workbook goes through. Asks Google for a token first when none is kept, so call it before anything else awaits. */
  openStorage(copy: Copy): Promise<CopyStorage<Copy>>
}

export interface WorkbookStore<Books extends BooksRead, Copy extends WorkbookCopy = WorkbookCopy, Contents = unknown> {
  readonly state: Readonly<WorkbookState<Books, Copy>>
  /** Shows the workbook this browser holds, if any. Later calls wait on the first. */
  open(): Promise<void>
  /**
   * Reads the chosen Drive file again when it changed and replaces the cache whole. Does nothing
   * for a workbook kept in this browser. Call it from a click handler unless `canSyncSilently()`
   * holds, since a new token needs a popup.
   */
  sync(): Promise<void>
  /** A Drive file is chosen and the page's token is still good, so a sync opens no popup. */
  canSyncSilently(): boolean
  /**
   * Shows the books on Drive, found by the app's mark or picked, as `lookup` says. On a cancel or a
   * failure the previous workbook stays chosen. Leaving a workbook kept in this browser deletes it.
   * Throws `WorkbookWriteRefused` while anything of the file is queued, since the Picker needs the tap.
   */
  chooseDriveFile(lookup: DriveFileLookup): Promise<void>
  /** A folder the person picks, as `WorkbookStorePorts.pickDriveFolder` says. */
  pickDriveFolder(title: string): Promise<PickedFolder | null>
  /** The app's subfolder of the Kuna folder, as `WorkbookStorePorts.driveHomeOfApp` says. */
  driveHomeOfApp(parentId: string | null): Promise<string>
  /** Whether Drive already holds the Kuna folder, as `WorkbookStorePorts.hasKunaFolder` says. */
  hasKunaFolder(): Promise<boolean | null>
  /** Makes a folder of this name beside the chosen Drive file. Does nothing for a workbook kept in this browser. */
  folderBesideFile(name: string): Promise<void>
  /** What a move of the chosen Drive file into the Kuna folder would take and leave, read from the file as it is now, or null for a workbook kept in this browser. */
  planMoveIntoKuna(beside: () => DriveFileBeside): Promise<DriveMovePlan | null>
  /**
   * Moves the chosen Drive file into the app's subfolder of the Kuna folder, with a new Kuna folder in `parentId`, or at the top of My Drive
   * for null. It reads the file first, so what goes along comes from the settings as they are now, not as this device last saw them. No write or
   * sync runs meanwhile: `WorkbookWriteRefused` says so while anything is queued, and what comes after waits. The file keeps its id, so this and every other device keep reading
   * it. `afterMove` writes what the move changed in the settings, before the move counts as over, so a failure there can be pressed again. Gives the
   * names that stayed because theirs was taken.
   */
  moveIntoKuna(beside: () => DriveFileBeside, parentId: string | null, afterMove?: () => Promise<void>): Promise<readonly string[]>
  /**
   * Keeps the contents, an opened file's, a fresh start's or the workbook kept in this browser, in a
   * new file in the folder, and shows that file once it reads back with the same records. Leaving a
   * workbook kept in this browser deletes it. On a failure the previous workbook stays chosen.
   * Throws `BooksAlreadyOnDrive`, changing nothing, when Drive already holds the app's file, and
   * `WorkbookWriteRefused` while anything of the file is queued.
   */
  keepOnDrive(folderId: string, contents: Contents): Promise<void>
  /** Where the chosen Drive file sits and its newest backup. Null for a workbook kept in this browser, or while the page holds no token. */
  driveFilePlace(): Promise<DriveFilePlace | null>
  /**
   * Trashes the Drive file or deletes the workbook kept in this browser under this id, and chooses
   * none, as a first run that starts over. Does nothing unless that workbook is the one chosen, and
   * throws `WorkbookWriteRefused` while anything of the file is queued. A failure throws, and the
   * workbook stays chosen and on screen as it was. A file already trashed when only the copy failed to
   * go counts as missing. Resolves to whether the workbook was dropped.
   */
  dropWorkbook(workbookId: string, options?: DropOptions): Promise<boolean>
  /** How many backups Kuna made of the chosen Drive file are on Drive. Null for a workbook kept in this browser, or when that is not known without a sign-in or a working read. */
  backupsOnDrive(): Promise<number | null>
  /** Moves the backups Kuna made of the chosen Drive file to the bin. Does nothing for another workbook, and throws `WorkbookWriteRefused` while anything of the file is queued. The file stays chosen either way. */
  trashBackups(workbookId: string): Promise<void>
  /** Another tab dropped the workbook, so this one shows none either, as a first run, once the file's jobs ahead of it are over. */
  forgottenElsewhere(): Promise<void>
  /** Another tab chose a file, such as by setting the app up, so this one shows it too from the copy this browser holds, once the file's jobs ahead of it are over. */
  chosenElsewhere(): Promise<void>
  /**
   * Makes this the workbook kept in this browser, as an import or a fresh start does, and chooses
   * it. A workbook already kept here is replaced.
   */
  replaceLocalWorkbook(contents: Contents, title: string): Promise<void>
  /** Notes that the workbook on screen was just written to a file. */
  recordExport(): Promise<void>
  /**
   * Writes the records the work adds, changes, repairs and removes through its repositories, as one
   * write, after the file's jobs ahead of it: a fresh read of the kinds it touches and the kinds their checks read, each record found by
   * its identity and refused when it changed since the app read it, the domain checks of every kind,
   * one apply, and a read back that every record holds what was written. When the file moved since
   * the read, the write starts again from a fresh read, at most three times. Returns what Undo puts
   * back, or null when nothing differed. Throws `WorkbookWriteRefused` when it writes nothing.
   */
  write(title: string, work: (unit: UnitOfWork) => void, options?: WriteOptions): Promise<WriteReceipt | null>
  /**
   * Runs the checks `write` runs first, on the copy on screen, and makes nothing: no queued write, no change on screen, no request and no
   * Undo. Gives the checked write, or the reason `write` would throw `WorkbookWriteRefused`. The file may still have moved by the time a real write reads it.
   */
  check(title: string, work: (unit: UnitOfWork) => void): Promise<WriteCheck>
  /**
   * Puts back what a write of this session changed, through the checks of its kinds. A removed
   * record comes back with the same identity. Refused for a write `canUndo` rules out.
   */
  undo(write: SessionWrite): Promise<void>
  /** Resolves once nothing of the file is queued or running. */
  settled(): Promise<void>
}

/** How often a write starts again on a file another device saved since the write's read. */
const MOVED_RETRIES = 3

/** Cache first: the copy this browser holds is on screen at once, and a sync or an import replaces it. */
export function createWorkbookStore<Books extends BooksRead, Copy extends WorkbookCopy, Contents>(ports: WorkbookStorePorts<Books, Copy, Contents>): WorkbookStore<Books, Copy, Contents> {
  const state = shallowReactive<{ -readonly [Field in keyof WorkbookState<Books, Copy>]: WorkbookState<Books, Copy>[Field] }>({
    workbook: null,
    records: null,
    snapshot: null,
    syncedAt: null,
    choice: null,
    status: 'opening',
    error: null,
    missing: false,
    waiting: [],
    writes: [],
  })

  /** The file's jobs, one at a time in the order they were asked for, since a write, a read and a move each work from what the one before left. */
  let lane: Promise<unknown> = Promise.resolve()
  let jobsInLane = 0

  function inLane<Result>(job: () => Promise<Result>): Promise<Result> {
    jobsInLane += 1
    const run = lane.then(job).finally(() => {
      jobsInLane -= 1
    })
    lane = run.catch(() => {})
    return run
  }

  function refuseWhileAnythingQueued(): void {
    if (jobsInLane > 0) {
      throw new WorkbookWriteRefused(words.busy)
    }
  }

  let nextWriteId = 1
  /** Writes up to this id were queued on top of a write shown at once that then failed, so a refusal of them has that for its reason. */
  let madeOnFailedWriteUpTo = 0
  let googleAsk: Promise<unknown> | null = null
  let syncInLane: Promise<void> | null = null

  /**
   * Opens the file's storage straight away, since a Google popup opens only during the tap and a save may wait longer than that.
   * A tap while an ask is open shares it, so two popups never open.
   */
  function askDuringTap(copy: Copy): Promise<unknown> {
    if (googleAsk === null) {
      const ask = ports.openStorage(copy)
      const over = (): void => {
        googleAsk = null
      }
      ask.then(over, over)
      googleAsk = ask
    }
    return googleAsk
  }

  function shownCopy(copy: Copy): Copy {
    return shownCopyOf(copy, state.waiting, ports.withChanges)
  }

  /** The one place the screen changes: the file's copy, read with the queued changes marked shown at once on top of it. They never reach the cache. */
  function show(copy: Copy): void {
    const { records, workbook } = ports.read(shownCopy(copy))
    state.snapshot = copy
    state.records = records
    state.workbook = workbook
    state.syncedAt = copy.meta.syncedAt
  }

  function choose(choice: WorkbookChoice | null): void {
    ports.saveChoice(choice)
    state.choice = choice
    state.missing = false
  }

  async function withCache<Result>(workbookId: string, use: (cache: WorkbookCache<Copy>) => Promise<Result>): Promise<Result> {
    const cache = ports.openCache(workbookId)
    try {
      return await use(cache)
    } finally {
      cache.close()
    }
  }

  /** Keeps what the file holds and shows it. `landed` is a write the copy now answers for, which leaves the queue as the copy reaches the screen, so its change is never made twice. */
  async function keep(copy: Copy, landed: QueuedWrite | null = null): Promise<void> {
    await withCache(copy.meta.id, (cache) => cache.replace(copy))
    if (landed !== null) leaveQueue(landed)
    show(copy)
  }

  function showNone(): void {
    state.snapshot = null
    state.records = null
    state.workbook = null
    state.syncedAt = null
    state.status = 'ready'
    state.error = null
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

  /**
   * Shows the copy a read of Drive gives, the chosen file or one found or made there, and chooses it. Leaving a workbook
   * kept in this browser deletes it. Only a read of the chosen file can find that file missing.
   */
  async function readDrive(read: () => Promise<Copy | null>, ofChosen = false): Promise<void> {
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
      if (failure instanceof BooksAlreadyOnDrive) {
        state.status = 'ready'
        throw failure
      }
      if (ofChosen) {
        state.missing = failure instanceof DriveFileMissing
      }
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
  async function refreshAfterFailedWrite(storage: CopyStorage<Copy>, failed: QueuedWrite): Promise<void> {
    try {
      await storage.readAgain()
      const snapshot = state.snapshot
      if (snapshot !== null) {
        await keep(readBack(storage, snapshot), failed)
      }
    } catch {
      // The next sync reads the file whole.
    }
  }

  function leaveQueue(queued: QueuedWrite): void {
    state.waiting = state.waiting.filter((waiting) => waiting !== queued)
  }

  /** The books on screen, or a refusal when there are none to write to. */
  function booksToWrite(): Copy {
    const current = state.snapshot
    if (current === null || state.choice === null || state.choice.id !== current.meta.id) {
      throw new WorkbookWriteRefused(words.noBooks)
    }
    return current
  }

  /** The checks every write meets first, against the copy on screen with the queued changes made on it. Null when nothing differs. */
  function checkOnScreen(current: Copy, title: string, changes: readonly RuledChange[], undoing: boolean): Promise<CheckedWrite | null> {
    return checkWrite(ports.viewOf(shownCopy(current)), title, changes, { undoing })
  }

  /**
   * Queues a write at the tap. A write with no books on screen is refused straight away, and so is one shown at once that the checks refuse on what
   * the screen shows. That check reads only memory and finishes in microtasks, so the next tap cannot pass it, and the change never reaches the screen.
   */
  function writeRecords(title: string, changes: readonly RuledChange[], undid: WriteReceipt | null, keys: readonly string[], shownAtOnce: boolean): Promise<WriteReceipt | null> {
    return trackWrite(async () => {
      const current = booksToWrite()
      if (shownAtOnce && (await checkOnScreen(current, title, changes, undid !== null)) === null) {
        return null
      }
      const queued: QueuedWrite = { id: nextWriteId++, title, keys, shownAtOnce, workbookId: current.meta.id, changes, undid }
      const asked = askDuringTap(current)
      state.waiting = [...state.waiting, queued]
      if (shownAtOnce) show(state.snapshot ?? current)
      return inLane(() => writeInTurn(queued, asked))
    })
  }

  /**
   * Every write the same way, once its turn comes: checked on a fresh read, written, read back into the
   * copy on screen, checked again, then added to the session's writes. A write the file's home finds
   * moved since its read starts again from a fresh read. A write that may have reached a Drive file and
   * then failed reads it again where it can.
   */
  async function writeInTurn(queued: QueuedWrite, asked: Promise<unknown>): Promise<WriteReceipt | null> {
    const { title, changes, undid, keys, shownAtOnce } = queued
    const options = { undoing: undid !== null }
    let storage: CopyStorage<Copy> | null = null
    let sent = false
    const current = state.snapshot
    try {
      await asked
      if (current === null || state.choice?.id !== queued.workbookId || current.meta.id !== queued.workbookId) {
        throw new WorkbookWriteRefused(words.noBooks)
      }
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
          await keep(readBack(storage, state.snapshot ?? current), queued)
          const receipt = receiptOf(checked, after)
          state.writes = [{ receipt, undid, id: state.writes.length + 1, at: ports.now(), workbookId: current.meta.id, keys, shownAtOnce }, ...state.writes]
          return receipt
        }
        sent = false
        if (retry === MOVED_RETRIES) {
          throw new WorkbookWriteRefused(words.savedElsewhere)
        }
        await ports.pause(backoff(retry))
      }
    } catch (failure) {
      // A write finds the file in the bin or gone as a read does, so the screens show it the same way.
      if (failure instanceof DriveFileMissing) {
        fail(failure)
        state.missing = true
      }
      if (sent && storage !== null && current?.meta.source === 'drive') {
        await refreshAfterFailedWrite(storage, queued)
      }
      const madeOnFailedWrite = queued.id <= madeOnFailedWriteUpTo && failure instanceof WorkbookWriteRefused
      if (shownAtOnce) {
        madeOnFailedWriteUpTo = nextWriteId - 1
      }
      throw madeOnFailedWrite ? new WorkbookWriteRefused(words.nothingWritten(words.madeOnFailedWrite)) : failure
    } finally {
      if (state.waiting.includes(queued)) {
        leaveQueue(queued)
        if (shownAtOnce && state.snapshot !== null) show(state.snapshot)
      }
    }
  }

  /** Reads the chosen Drive file again, and throws when that fails, so what follows never works from what this device last saw. */
  async function readChosenNow(choice: WorkbookChoice): Promise<void> {
    await readDrive(() => ports.readDriveFile(choice, state.snapshot?.meta.id === choice.id ? state.snapshot : null), true)
    if (state.status === 'error') throw new Error(state.error ?? words.busy)
  }

  let opened: Promise<void> | null = null

  return {
    state: shallowReadonly(state) as Readonly<WorkbookState<Books, Copy>>,

    open() {
      opened ??= showStoredCopy()
      return opened
    },

    sync() {
      syncInLane ??= inLane(async () => {
        const choice = state.choice
        if (choice?.source === 'drive') {
          await readDrive(() => ports.readDriveFile(choice, state.snapshot?.meta.id === choice.id ? state.snapshot : null), true)
        }
      }).finally(() => {
        syncInLane = null
      })
      return syncInLane
    },

    canSyncSilently() {
      return state.choice?.source === 'drive' && ports.hasLiveAccessToken()
    },

    async chooseDriveFile(lookup) {
      refuseWhileAnythingQueued()
      await inLane(() => readDrive(() => ports.findDriveFile(lookup)))
    },

    pickDriveFolder(title) {
      return ports.pickDriveFolder(title)
    },

    driveHomeOfApp(parentId) {
      return ports.driveHomeOfApp(parentId)
    },

    hasKunaFolder() {
      return ports.hasKunaFolder()
    },

    async folderBesideFile(name) {
      const choice = state.choice
      if (choice?.source === 'drive') await ports.folderBesideFile(choice.id, name)
    },

    async planMoveIntoKuna(beside) {
      const choice = state.choice
      if (choice?.source !== 'drive') return null
      await inLane(() => readChosenNow(choice))
      return ports.planMoveIntoKuna(choice.id, beside())
    },

    async moveIntoKuna(beside, parentId, afterMove) {
      const choice = state.choice
      if (choice?.source !== 'drive') {
        return []
      }
      refuseWhileAnythingQueued()
      const left = await inLane(async () => {
        await readChosenNow(choice)
        return ports.moveIntoKuna(choice.id, beside(), parentId)
      })
      await afterMove?.()
      await ports.finishMoveIntoKuna(choice.id)
      return left
    },

    async keepOnDrive(folderId, contents) {
      refuseWhileAnythingQueued()
      await inLane(() => readDrive(() => ports.createDriveFile(folderId, contents)))
    },

    async driveFilePlace() {
      const choice = state.choice
      return choice?.source === 'drive' ? ports.driveFilePlace(choice.id) : null
    },

    async dropWorkbook(workbookId, { first, keepDriveFile = false } = {}) {
      const choice = state.choice
      if (choice?.id !== workbookId) {
        return false
      }
      refuseWhileAnythingQueued()
      return inLane(async () => {
        await first?.()
        const trashing = choice.source === 'drive' && !keepDriveFile
        if (trashing) {
          await ports.trashDriveFile(choice.id)
          state.missing = true
        } else if (choice.source === 'browser') {
          await ports.forgetBrowserWorkbook(choice.id)
        }
        try {
          await withCache(choice.id, (cache) => cache.delete())
        } catch (failure) {
          const reason = failure instanceof Error ? failure.message : String(failure)
          throw new Error(trashing ? words.binnedCopyLeft(reason) : words.copyLeft(reason))
        }
        choose(null)
        showNone()
        return true
      })
    },

    async backupsOnDrive() {
      const choice = state.choice
      return choice?.source === 'drive' ? ports.countBackups(choice.id).catch(() => null) : null
    },

    async trashBackups(workbookId) {
      const choice = state.choice
      if (choice?.id !== workbookId || choice.source !== 'drive') return
      refuseWhileAnythingQueued()
      await inLane(() => ports.trashBackups(choice.id))
    },

    forgottenElsewhere() {
      return inLane(async () => {
        const held = state.choice
        if (held === null) return
        // A sync of this tab may have named the file again since the other tab forgot it, and a file set up there since is left alone.
        const stored = ports.loadChoice()
        if (stored === null || stored.id === held.id) ports.saveChoice(null)
        await withCache(held.id, (cache) => cache.delete()).catch(() => {
          // The other tab deleted it, and this is only for a copy a sync here made since.
        })
        state.choice = null
        state.missing = false
        showNone()
      })
    },

    chosenElsewhere() {
      return inLane(async () => {
        const stored = ports.loadChoice()
        if (stored === null || stored.id === state.choice?.id) return
        try {
          const copy = await withCache(stored.id, (cache) => cache.read())
          state.choice = stored
          state.missing = false
          if (copy === null) showNone()
          else show(copy)
          state.status = 'ready'
        } catch (failure) {
          fail(failure)
        }
      })
    },

    replaceLocalWorkbook(contents, title) {
      return inLane(() =>
        underLocalWork(async () => {
          const id = state.choice?.source === 'browser' ? state.choice.id : ports.newLocalId()
          await keep(await ports.keepInBrowser({ id, source: 'browser', title, syncedAt: ports.now(), lastExportedAt: null, unexportedSince: null }, contents))
          choose({ source: 'browser', id, name: title })
          ports.keptInBrowser()
          ports.requestPersistentStorage()
        }),
      )
    },

    recordExport() {
      const exported = state.snapshot
      return inLane(() =>
        underLocalWork(async () => {
          const current = state.snapshot
          if (current !== null) {
            // A save that landed after the export is not in the exported file, so it still counts as not exported.
            await keep({ ...current, meta: { ...current.meta, lastExportedAt: ports.now(), unexportedSince: current === exported ? null : current.meta.unexportedSince } })
          }
        }),
      )
    },

    async write(title, work, options) {
      return await writeRecords(title, changesOf(work), null, options?.key === undefined ? [] : [options.key], options?.shownAtOnce === true)
    },

    async check(title, work) {
      try {
        const checked = await checkOnScreen(booksToWrite(), title, changesOf(work), false)
        return checked === null ? { status: 'nothingToChange' } : { status: 'ready', checked }
      } catch (failure) {
        if (failure instanceof WorkbookWriteRefused) {
          return { status: 'refused', reason: failure.message }
        }
        throw failure
      }
    },

    async undo(write) {
      if (!canUndo(write, state.writes) || state.waiting.some((queued) => queued.undid === write.receipt)) {
        throw new WorkbookWriteRefused(words.notUndoable)
      }
      await writeRecords(words.undone, undoOf(write.receipt), write.receipt, [`undo-${write.id}`, ...write.keys], true)
    },

    async settled() {
      let seen: Promise<unknown>
      do {
        seen = lane
        await seen
      } while (seen !== lane)
    },
  }
}
