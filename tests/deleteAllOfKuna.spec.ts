import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

import { readSavedChat, saveChat } from '../src/shared/ai/application/savedChat'
import type { AppData, DataPlace, HeldData } from '../src/shared/storage/application/appData'
import { words as storageWords } from '../src/shared/storage/application/words'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { deleteAllOfKuna, forgetBrowserSettings, nameTyped, picksStillHeld } from '../src/shell/settings/deleteAllOfKuna'
import type { KunaDeletionPorts } from '../src/shell/settings/deleteAllOfKuna'

const forgotten = vi.hoisted(() => [] as string[])
vi.mock('../src/shared/app/kunaStart', () => ({ forgetKunaStart: () => forgotten.push('start') }))
vi.mock('../src/shared/ai/application/assistSettings', () => ({ forgetAssistChoices: () => forgotten.push('assistant') }))
vi.mock('../src/shared/google/googleAuth', () => ({ forgetGoogleSignIn: () => forgotten.push('google sign-in') }))
vi.mock('../src/shared/sync/infrastructure/autoSyncSwitch', () => ({ switchAutoSync: () => forgotten.push('auto sync') }))

function appOf(id: string, source: HeldData['source'], { busy = false, refused = null }: { busy?: boolean; refused?: string | null } = {}, calls: string[] = []): AppData {
  let held: HeldData | null = { source, fileName: `kuna-${id}.json`, places: source === 'drive' ? ['drive-file', 'browser-copy'] : ['browser-copy'], besideFileName: null, canBackUp: true, busy }
  return {
    id,
    name: id,
    held: () => held,
    backUp: async () => `${id}.json`,
    backupsOnDrive: async () => null,
    async remove(places: readonly DataPlace[], withBackups = false) {
      calls.push(`remove ${id} ${places.join()}${withBackups ? ' and backups' : ''}`)
      if (refused !== null) return { steps: [{ step: 'drive-file', outcome: { kind: 'failed', message: refused } }], removed: false }
      held = null
      return { steps: [{ step: 'drive-file', outcome: { kind: 'done' } }], removed: true }
    },
  }
}

function portsOf(calls: string[], { syncing = false, googleFails = false }: { syncing?: boolean; googleFails?: boolean } = {}): KunaDeletionPorts {
  return {
    syncsOver: async () => {
      calls.push('syncs over')
    },
    syncing: () => syncing,
    forgetBrowserKeys: () => {
      calls.push('browser keys')
    },
    async deleteGoogleKeys() {
      calls.push('google keys')
      if (googleFails) throw new Error('Drive answered 500.')
    },
    async forgetBrowserSettings() {
      calls.push('settings')
    },
  }
}

describe('deleting all of Kuna', () => {
  it('keeps what the person unticked after a failure, and drops only what no longer exists', () => {
    const untickedKept = appOf('company', 'drive')
    const refused = appOf('investments', 'drive')
    const gone = { id: 'loans', held: () => null }
    const fellInBin = { id: 'assets', held: () => ({ ...refused.held()!, places: ['browser-copy'] as const }) }

    expect(
      picksStillHeld({ company: [], investments: ['drive-file', 'browser-copy'], loans: ['browser-copy'], assets: ['drive-file', 'browser-copy'] }, [untickedKept, refused, gone, fellInBin]),
    ).toEqual({ company: [], investments: ['drive-file', 'browser-copy'], assets: ['browser-copy'] })
  })

  it('needs the name typed, whatever a phone keyboard does to its case or a space', () => {
    expect(nameTyped('Kuna', 'Kuna')).toBe(true)
    expect(nameTyped(' kuna ', 'Kuna')).toBe(true)
    expect(nameTyped('', 'Kuna')).toBe(false)
    expect(nameTyped('Kun', 'Kuna')).toBe(false)
    expect(nameTyped('Kuna!', 'Kuna')).toBe(false)
  })

  it('removes each app, then what they share, the Google keys before the sign-in goes', async () => {
    const calls: string[] = []
    const company = appOf('company', 'drive', {}, calls)
    const loans = appOf('loans', 'browser', {}, calls)

    const report = await deleteAllOfKuna(
      portsOf(calls),
      [
        { data: company, places: ['drive-file', 'browser-copy'], backups: false },
        { data: loans, places: ['browser-copy'], backups: false },
      ],
      ['google-keys', 'browser-keys', 'browser-settings'],
    )

    expect(calls).toEqual(['syncs over', 'remove company drive-file,browser-copy', 'remove loans browser-copy', 'google keys', 'browser keys', 'settings'])
    expect(report.complete).toBe(true)
  })

  it('hands each app whether its backups go too', async () => {
    const calls: string[] = []

    await deleteAllOfKuna(portsOf(calls), [{ data: appOf('company', 'drive', {}, calls), places: [], backups: true }], [])

    expect(calls).toContain('remove company  and backups')
  })

  it('leaves the Google keys alone unless they were ticked', async () => {
    const calls: string[] = []

    await deleteAllOfKuna(portsOf(calls), [], ['browser-settings'])

    expect(calls).not.toContain('google keys')
  })

  it('goes on after one app fails, and the report names the failure', async () => {
    const calls: string[] = []
    const refused = appOf('company', 'drive', { refused: 'Only its owner can.' }, calls)
    const loans = appOf('loans', 'browser', {}, calls)

    const report = await deleteAllOfKuna(
      portsOf(calls),
      [
        { data: refused, places: ['drive-file', 'browser-copy'], backups: false },
        { data: loans, places: ['browser-copy'], backups: false },
      ],
      [],
    )

    expect(calls).toContain('remove loans browser-copy')
    expect(report.complete).toBe(false)
    expect(report.apps[0]?.report.removed).toBe(false)
    expect(refused.held()).not.toBeNull()
    expect(loans.held()).toBeNull()
  })

  it('reports a shared thing that failed', async () => {
    const calls: string[] = []

    const report = await deleteAllOfKuna(portsOf(calls, { googleFails: true }), [], ['google-keys', 'browser-keys'])

    expect(report.shared).toEqual([
      { thing: 'google-keys', failure: 'Drive answered 500.' },
      { thing: 'browser-keys', failure: null },
    ])
    expect(report.complete).toBe(false)
  })

  it('refuses with nothing done while a save waits', async () => {
    const calls: string[] = []
    const busy = appOf('company', 'drive', { busy: true }, calls)

    await expect(deleteAllOfKuna(portsOf(calls), [{ data: busy, places: ['browser-copy'], backups: false }], ['browser-keys'])).rejects.toThrow(new WorkbookWriteRefused(storageWords.busy))

    expect(calls).toEqual(['syncs over'])
  })

  it('refuses with nothing done when a sync started again', async () => {
    const calls: string[] = []

    await expect(deleteAllOfKuna(portsOf(calls, { syncing: true }), [], ['browser-keys'])).rejects.toBeInstanceOf(WorkbookWriteRefused)

    expect(calls).toEqual(['syncs over'])
  })

  it("forgets this browser's settings and the chat it saved, and keeps the Google sign-in while an app keeps a file on Drive", async () => {
    await saveChat({
      lines: [{ role: 'user', at: Date.now(), text: 'Made-up question', note: false, chips: [], strayFigure: false, failure: null, proposals: [] }],
      spent: { dollars: 0, unknown: false, any: false },
    })
    expect(await readSavedChat()).not.toBeNull()
    forgotten.splice(0)

    await forgetBrowserSettings(true)

    expect(await readSavedChat()).toBeNull()
    expect(forgotten).toEqual(['start', 'assistant', 'auto sync'])
    await forgetBrowserSettings(false)
    expect(forgotten).toContain('google sign-in')
  })
})
