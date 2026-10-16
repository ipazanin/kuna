import { describe, expect, it, vi } from 'vitest'

import { AUTO_SYNC_INTERVAL_MS, autoSyncDue, startAutoSync } from '../src/features/workbook/application/autoSync'
import type { AutoSyncMoment, AutoSyncPorts } from '../src/features/workbook/application/autoSync'
import type { WorkbookStatus } from '../src/features/workbook/application/workbookStore'

const NOW = Date.parse('2026-10-16T09:00:00.000Z')
const MINUTE = 60_000

const DUE: AutoSyncMoment = { now: NOW, status: 'ready', silent: true, online: true, syncedAt: null, lastAttemptAt: null }

describe('autoSyncDue', () => {
  it('syncs a Sheet with a live token and no copy yet', () => {
    expect(autoSyncDue(DUE)).toBe(true)
  })

  it('waits ten minutes after the copy on screen was read', () => {
    const syncedNineMinutesAgo = new Date(NOW - 9 * MINUTE).toISOString()
    const syncedTenMinutesAgo = new Date(NOW - AUTO_SYNC_INTERVAL_MS).toISOString()

    expect(autoSyncDue({ ...DUE, syncedAt: syncedNineMinutesAgo })).toBe(false)
    expect(autoSyncDue({ ...DUE, syncedAt: syncedTenMinutesAgo })).toBe(true)
  })

  it('waits ten minutes after an automatic attempt, even one that failed', () => {
    expect(autoSyncDue({ ...DUE, status: 'error', lastAttemptAt: NOW - 2 * MINUTE })).toBe(false)
    expect(autoSyncDue({ ...DUE, status: 'error', lastAttemptAt: NOW - 11 * MINUTE })).toBe(true)
  })

  it('never syncs without a live token, offline, or while the store is busy', () => {
    expect(autoSyncDue({ ...DUE, silent: false })).toBe(false)
    expect(autoSyncDue({ ...DUE, online: false })).toBe(false)
    expect(autoSyncDue({ ...DUE, status: 'opening' })).toBe(false)
    expect(autoSyncDue({ ...DUE, status: 'syncing' })).toBe(false)
  })
})

describe('startAutoSync', () => {
  function harness(silent: boolean) {
    let now = NOW
    let showPage: () => void = () => {}
    const state: { status: WorkbookStatus; syncedAt: string | null } = { status: 'ready', syncedAt: null }
    const sync = vi.fn(async () => {
      state.syncedAt = new Date(now).toISOString()
    })
    const ports: AutoSyncPorts = {
      store: {
        state: state as AutoSyncPorts['store']['state'],
        open: async () => {},
        sync,
        canSyncSilently: () => silent,
      },
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

  it('stops listening once stopped', async () => {
    const { ports, sync, advance, showPage } = harness(true)

    const stop = startAutoSync(ports)
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    stop()
    advance(20 * MINUTE)
    showPage()

    expect(sync).toHaveBeenCalledTimes(1)
  })
})
