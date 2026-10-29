import { describe, expect, it, vi } from 'vitest'

import { AUTO_SYNC_INTERVAL_MS, autoSyncDue, startAutoSync } from '../src/shared/sync/application/autoSync'
import type { AutoSyncMoment, AutoSyncPorts } from '../src/shared/sync/application/autoSync'
import type { WorkbookStatus } from '../src/shared/storage/application/createWorkbookStore'

const NOW = Date.parse('2026-10-16T09:00:00.000Z')
const MINUTE = 60_000

const DUE: AutoSyncMoment = { now: NOW, switchedOn: true, busy: false, silent: true, online: true, syncedAt: null, lastAttemptAt: null }

describe('autoSyncDue', () => {
  it('syncs a file on Drive with a live token and no copy yet', () => {
    expect(autoSyncDue(DUE)).toBe(true)
  })

  it('waits ten minutes after the copy on screen was read', () => {
    const syncedNineMinutesAgo = new Date(NOW - 9 * MINUTE).toISOString()
    const syncedTenMinutesAgo = new Date(NOW - AUTO_SYNC_INTERVAL_MS).toISOString()

    expect(autoSyncDue({ ...DUE, syncedAt: syncedNineMinutesAgo })).toBe(false)
    expect(autoSyncDue({ ...DUE, syncedAt: syncedTenMinutesAgo })).toBe(true)
  })

  it('waits ten minutes after an automatic attempt, even one that failed', () => {
    expect(autoSyncDue({ ...DUE, lastAttemptAt: NOW - 2 * MINUTE })).toBe(false)
    expect(autoSyncDue({ ...DUE, lastAttemptAt: NOW - 11 * MINUTE })).toBe(true)
  })

  it('never syncs on a device that switched it off, without a live token, offline, or while a store is busy', () => {
    expect(autoSyncDue({ ...DUE, switchedOn: false })).toBe(false)
    expect(autoSyncDue({ ...DUE, silent: false })).toBe(false)
    expect(autoSyncDue({ ...DUE, online: false })).toBe(false)
    expect(autoSyncDue({ ...DUE, busy: true })).toBe(false)
  })
})

describe('startAutoSync', () => {
  type Store = AutoSyncPorts['stores'][number]

  /** A store with its file on Drive, or in this browser, read at `syncedAt`. */
  function storeOf(silent: boolean, syncedAt: string | null = null, source: 'drive' | 'browser' = 'drive') {
    const state: { status: WorkbookStatus; syncedAt: string | null; choice: { source: 'drive' | 'browser'; id: string; name: string } } = {
      status: 'ready',
      syncedAt,
      choice: { source, id: 'file', name: 'kuna.json' },
    }
    return { state, store: { state: state as unknown as Store['state'], open: async () => {}, canSyncSilently: () => silent && source === 'drive' } }
  }

  function harness(silent: boolean, switchedOn = true) {
    let now = NOW
    let showPage: () => void = () => {}
    const { state, store } = storeOf(silent)
    const sync = vi.fn(async () => {
      state.syncedAt = new Date(now).toISOString()
    })
    const ports: AutoSyncPorts = {
      stores: [store],
      sync,
      switchedOn: () => switchedOn,
      now: () => now,
      online: () => true,
      onVisible: (callback) => {
        showPage = callback
        return () => {
          showPage = () => {}
        }
      },
    }
    return {
      ports,
      sync,
      advance: (milliseconds: number) => {
        now += milliseconds
      },
      showPage: () => showPage(),
    }
  }

  it('syncs on open, skips a return to the tab within ten minutes, and syncs on a later one', async () => {
    const { ports, sync, advance, showPage } = harness(true)

    const stop = startAutoSync(ports)
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    advance(4 * MINUTE)
    showPage()
    advance(7 * MINUTE)
    showPage()
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2))
    stop()

    expect(sync).toHaveBeenCalledTimes(2)
  })

  it('leaves the Sync button to the user when no token is kept', async () => {
    const { ports, sync, showPage } = harness(false)

    const stop = startAutoSync(ports)
    await Promise.resolve()
    showPage()
    stop()

    expect(sync).not.toHaveBeenCalled()
  })

  it('leaves the open and every return to the tab to the Sync button on a device that switched it off', async () => {
    const { ports, sync, advance, showPage } = harness(true, false)

    const stop = startAutoSync(ports)
    await Promise.resolve()
    advance(20 * MINUTE)
    showPage()
    stop()

    expect(sync).not.toHaveBeenCalled()
  })

  it('stops listening once stopped', async () => {
    const { ports, sync, advance, showPage } = harness(true)

    const stop = startAutoSync(ports)
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    stop()
    advance(20 * MINUTE)
    showPage()

    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('syncs once the oldest read among the files on Drive is due, and leaves a file kept in this browser out', async () => {
    const at = (minutesAgo: number) => new Date(NOW - minutesAgo * MINUTE).toISOString()
    const syncsOf = async (stores: readonly Store[]) => {
      const sync = vi.fn(async () => {})
      const stop = startAutoSync({ stores, sync, switchedOn: () => true, now: () => NOW, online: () => true, onVisible: () => () => {} })
      await new Promise((resolve) => setTimeout(resolve, 0))
      stop()
      return sync.mock.calls.length
    }

    expect(await syncsOf([storeOf(true, at(2)).store, storeOf(true, at(30)).store])).toBe(1)
    expect(await syncsOf([storeOf(true, at(2)).store, storeOf(true, at(30), 'browser').store])).toBe(0)
  })
})
