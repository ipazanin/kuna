import type { WorkbookStatus, WorkbookStore } from './createWorkbookStore'
import type { WorkbookCopy } from './workbookPorts'

/** An automatic sync waits this long after the last read or attempt, so returning to the tab does not refetch every time. */
export const AUTO_SYNC_INTERVAL_MS = 10 * 60_000

export interface AutoSyncMoment {
  /** Epoch milliseconds. */
  readonly now: number
  readonly status: WorkbookStatus
  /** A file on Drive is chosen and a kept token is still good. */
  readonly silent: boolean
  readonly online: boolean
  /** ISO timestamp of the read on screen, or null. */
  readonly syncedAt: string | null
  /** Epoch milliseconds of the last automatic attempt, which may have failed. */
  readonly lastAttemptAt: number | null
}

/** Whether to sync without a click now: only with no popup needed, and at most once per interval. */
export function autoSyncDue(moment: AutoSyncMoment): boolean {
  if (!moment.silent || !moment.online || moment.status === 'opening' || moment.status === 'syncing') {
    return false
  }
  const syncedAt = moment.syncedAt === null ? Number.NEGATIVE_INFINITY : Date.parse(moment.syncedAt)
  const latest = Math.max(syncedAt, moment.lastAttemptAt ?? Number.NEGATIVE_INFINITY)
  return moment.now - latest >= AUTO_SYNC_INTERVAL_MS
}

export interface AutoSyncPorts {
  readonly store: Pick<WorkbookStore<WorkbookCopy>, 'state' | 'open' | 'canSyncSilently'>
  /** The whole sync: the file read and whatever follows it. */
  sync(): Promise<void>
  now(): number
  online(): boolean
  /** Calls back whenever the page becomes visible again. Returns the function that stops it. */
  onVisible(callback: () => void): () => void
}

/** Syncs once the stored copy is open and again on each return to the page, when due. Returns the function that stops it. */
export function startAutoSync(ports: AutoSyncPorts): () => void {
  const { store } = ports
  let lastAttemptAt: number | null = null
  let stopped = false

  async function syncWhenDue(): Promise<void> {
    const now = ports.now()
    const due = autoSyncDue({
      now,
      status: store.state.status,
      silent: store.canSyncSilently(),
      online: ports.online(),
      syncedAt: store.state.syncedAt,
      lastAttemptAt,
    })
    if (stopped || !due) {
      return
    }
    lastAttemptAt = now
    await ports.sync()
  }

  void store.open().then(syncWhenDue)
  const stopWatching = ports.onVisible(() => void syncWhenDue())
  return () => {
    stopped = true
    stopWatching()
  }
}
