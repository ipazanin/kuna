import { describe, expect, it, vi } from 'vitest'

import { readFromGoogle } from '../src/features/workbook/application/readFromGoogle'
import type { GoogleSheet, GoogleWorkbookPorts } from '../src/features/workbook/application/readFromGoogle'
import { EMPTY_TABS } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'

const BOOKS: GoogleSheet = { id: 'sheet-1', name: 'Books' }

function snapshotOf(sheet: GoogleSheet): WorkbookSnapshot {
  return {
    meta: { id: sheet.id, source: 'google', title: sheet.name, syncedAt: '2026-10-16T08:00:00.000Z', ledgerSheetId: 0, lastExportedAt: null, unexportedSince: null, missingTabs: [] },
    ...EMPTY_TABS,
  }
}

function portsWith(overrides: Partial<GoogleWorkbookPorts>): GoogleWorkbookPorts {
  return {
    liveAccessToken: () => null,
    requestAccessToken: vi.fn(async () => 'new-token'),
    pickSpreadsheet: vi.fn(async () => null),
    readSnapshot: vi.fn(async (_token: string, sheet: GoogleSheet) => snapshotOf(sheet)),
    ...overrides,
  }
}

describe('readFromGoogle', () => {
  it('uses a live token without asking Google again', async () => {
    const ports = portsWith({ liveAccessToken: () => 'live-token' })

    await readFromGoogle(ports, BOOKS)

    expect(ports.requestAccessToken).not.toHaveBeenCalled()
    expect(ports.readSnapshot).toHaveBeenCalledWith('live-token', BOOKS)
  })

  it('asks for a token first when none is live, before the Picker can delay the popup', async () => {
    const calls: string[] = []
    const ports = portsWith({
      requestAccessToken: async () => {
        calls.push('token')
        return 'new-token'
      },
      pickSpreadsheet: async () => {
        calls.push('picker')
        return BOOKS
      },
    })

    await readFromGoogle(ports, null)

    expect(calls).toEqual(['token', 'picker'])
  })

  it('opens the Picker when no Sheet is given and reads the one picked', async () => {
    const picked = { id: 'sheet-2', name: 'Picked' }
    const ports = portsWith({ pickSpreadsheet: vi.fn(async () => picked) })

    const snapshot = await readFromGoogle(ports, null)

    expect(ports.pickSpreadsheet).toHaveBeenCalledWith('new-token')
    expect(snapshot?.meta.id).toBe('sheet-2')
  })

  it('reads nothing when the Picker is cancelled', async () => {
    const ports = portsWith({})

    expect(await readFromGoogle(ports, null)).toBeNull()
    expect(ports.readSnapshot).not.toHaveBeenCalled()
  })

  it('never opens the Picker for a Sheet it is given', async () => {
    const ports = portsWith({})

    await readFromGoogle(ports, BOOKS)

    expect(ports.pickSpreadsheet).not.toHaveBeenCalled()
  })
})
