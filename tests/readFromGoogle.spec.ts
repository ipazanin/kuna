import { describe, expect, it, vi } from 'vitest'

import { readFromGoogle } from '../src/features/workbook/application/readFromGoogle'
import type { GoogleWorkbookPorts } from '../src/features/workbook/application/readFromGoogle'
import type { SelectedWorkbook } from '../src/features/workbook/infrastructure/selectedWorkbook'
import type { WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'

const BOOKS: SelectedWorkbook = { id: 'sheet-1', name: 'Books' }

function snapshotOf(workbook: SelectedWorkbook): WorkbookSnapshot {
  return { meta: { spreadsheetId: workbook.id, title: workbook.name, syncedAt: '2026-10-16T08:00:00.000Z', ledgerSheetId: 0 }, ledger: [], categories: [], accounts: [] }
}

function portsWith(overrides: Partial<GoogleWorkbookPorts>): GoogleWorkbookPorts {
  return {
    liveAccessToken: () => null,
    requestAccessToken: vi.fn(async () => 'new-token'),
    selectedWorkbook: () => BOOKS,
    rememberWorkbook: vi.fn(),
    pickSpreadsheet: vi.fn(async () => null),
    readSnapshot: vi.fn(async (_token: string, workbook: SelectedWorkbook) => snapshotOf(workbook)),
    ...overrides,
  }
}

describe('readFromGoogle', () => {
  it('uses a live token without asking Google again', async () => {
    const ports = portsWith({ liveAccessToken: () => 'live-token' })

    await readFromGoogle(ports)

    expect(ports.requestAccessToken).not.toHaveBeenCalled()
    expect(ports.readSnapshot).toHaveBeenCalledWith('live-token', BOOKS)
  })

  it('asks for a token first when none is live, before anything else can delay the popup', async () => {
    const calls: string[] = []
    const ports = portsWith({
      requestAccessToken: async () => {
        calls.push('token')
        return 'new-token'
      },
      selectedWorkbook: () => {
        calls.push('selected')
        return BOOKS
      },
    })

    await readFromGoogle(ports)

    expect(calls).toEqual(['token', 'selected'])
  })

  it('opens the Picker on the first run and remembers the choice', async () => {
    const picked = { id: 'sheet-2', name: 'Picked' }
    const ports = portsWith({ selectedWorkbook: () => null, pickSpreadsheet: vi.fn(async () => picked) })

    const snapshot = await readFromGoogle(ports)

    expect(ports.pickSpreadsheet).toHaveBeenCalledWith('new-token')
    expect(ports.rememberWorkbook).toHaveBeenCalledWith(picked)
    expect(snapshot?.meta.spreadsheetId).toBe('sheet-2')
  })

  it('reads nothing when the Picker is cancelled', async () => {
    const ports = portsWith({ selectedWorkbook: () => null })

    expect(await readFromGoogle(ports)).toBeNull()
    expect(ports.rememberWorkbook).not.toHaveBeenCalled()
    expect(ports.readSnapshot).not.toHaveBeenCalled()
  })

  it('never opens the Picker once a workbook is remembered', async () => {
    const ports = portsWith({})

    await readFromGoogle(ports)

    expect(ports.pickSpreadsheet).not.toHaveBeenCalled()
  })
})
