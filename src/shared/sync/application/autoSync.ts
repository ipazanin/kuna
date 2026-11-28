import type { BooksRead, WorkbookStore } from '../../storage/application/createWorkbookStore'
import { oldestRead } from './syncRun'

/** An automatic sync waits this long after the last read or attempt, so returning to the tab does not refetch every time. */
export const AUTO_SYNC_INTERVAL_MS = 10 * 60_000

export interface AutoSyncMoment {
  /** Epoch milliseconds. */
  readonly now: number
  /** The device switch for auto-sync. */
  readonly switchedOn: boolean
  /** Some books a sync runs are opening or being read. */
  readonly busy: boolean
  /** A sync now would open no popup and lack no access. */
  readonly silent: boolean
  readonly online: boolean
  /** ISO timestamp of the oldest read on screen among the files on Drive a sync runs, or null while one has none or none is on Drive. */
  readonly syncedAt: string | null
  /** Epoch milliseconds of the last automatic attempt, which may have failed. */
  readonly lastAttemptAt: number | null
}

/** Whether to sync without a click now: only while this device has it on, with no popup needed, and at most once per interval. */
export function autoSyncDue(moment: AutoSyncMoment): boolean {
  if (!moment.switchedOn || !moment.silent || !moment.online || moment.busy) {
    return false
  }
  const syncedAt = moment.syncedAt === null ? Number.NEGATIVE_INFINITY : Date.parse(moment.syncedAt)
  const latest = Math.max(syncedAt, moment.lastAttemptAt ?? Number.NEGATIVE_INFINITY)
  return moment.now - latest >= AUTO_SYNC_INTERVAL_MS
}

export interface AutoSyncPorts {
  /** Every app's books, wherever each one is kept. */
  readonly stores: readonly Pick<WorkbookStore<BooksRead>, 'state' | 'open'>[]
  /** The books the page's sync runs now. */
  synced(): readonly Pick<WorkbookStore<BooksRead>, 'state'>[]
  /** Whether the page's sync would open no popup and lack no access now. */
  canSyncSilently(): boolean
  /** The page's sync. */
  sync(): Promise<void>
  /** The device switch for auto-sync. */
  switchedOn(): boolean
  now(): number
  online(): boolean
  /** Calls back whenever the page becomes visible again. Returns the function that stops it. */
  onVisible(callback: () => void): () => void
}

/** Syncs once every stored copy is open and again on each return to the page, when due. Returns the function that stops it. */
export function startAutoSync(ports: AutoSyncPorts): () => void {
  let lastAttemptAt: number | null = null
  let stopped = false

  async function syncWhenDue(): Promise<void> {
    const now = ports.now()
    const synced = ports.synced()
    const due = autoSyncDue({
      now,
      switchedOn: ports.switchedOn(),
      busy: synced.some((store) => store.state.status === 'opening' || store.state.status === 'syncing'),
      silent: ports.canSyncSilently(),
      online: ports.online(),
      // Books kept in this browser are never read, so only the files on Drive say when the books were last read.
      syncedAt: oldestRead(synced.filter((store) => store.state.choice?.source === 'drive').map((store) => store.state.syncedAt)),
      lastAttemptAt,
    })
    if (stopped || !due) {
      return
    }
    lastAttemptAt = now
    await ports.sync()
  }

  void Promise.all(ports.stores.map((store) => store.open())).then(syncWhenDue)
  const stopWatching = ports.onVisible(() => void syncWhenDue())
  return () => {
    stopped = true
    stopWatching()
  }
}
