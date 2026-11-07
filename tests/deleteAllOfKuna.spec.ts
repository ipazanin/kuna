import { describe, expect, it } from 'vitest'

import type { AppData, DataPlace, HeldData } from '../src/shared/storage/application/appData'
import { words as storageWords } from '../src/shared/storage/application/words'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { deleteAllOfKuna, nameTyped } from '../src/shell/settings/deleteAllOfKuna'
import type { KunaDeletionPorts } from '../src/shell/settings/deleteAllOfKuna'

function appOf(id: string, source: HeldData['source'], { busy = false, refused = null }: { busy?: boolean; refused?: string | null } = {}, calls: string[] = []): AppData {
  let held: HeldData | null = { source, fileName: `kuna-${id}.json`, places: source === 'drive' ? ['drive-file', 'browser-copy'] : ['browser-copy'], besideFileName: null, canBackUp: true, busy }
  return {
    id,
    name: id,
    held: () => held,
    backUp: async () => `${id}.json`,
    async remove(places: readonly DataPlace[]) {
      calls.push(`remove ${id} ${places.join()}`)
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
    forgetBrowserSettings() {
      calls.push('settings')
    },
  }
}

describe('deleting all of Kuna', () => {
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
        { data: company, places: ['drive-file', 'browser-copy'] },
        { data: loans, places: ['browser-copy'] },
      ],
      ['google-keys', 'browser-keys', 'browser-settings'],
    )

    expect(calls).toEqual(['syncs over', 'remove company drive-file,browser-copy', 'remove loans browser-copy', 'google keys', 'browser keys', 'settings'])
    expect(report.complete).toBe(true)
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
        { data: refused, places: ['drive-file', 'browser-copy'] },
        { data: loans, places: ['browser-copy'] },
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

    await expect(deleteAllOfKuna(portsOf(calls), [{ data: busy, places: ['browser-copy'] }], ['browser-keys'])).rejects.toThrow(new WorkbookWriteRefused(storageWords.busy))

    expect(calls).toEqual(['syncs over'])
  })

  it('refuses with nothing done when a sync started again', async () => {
    const calls: string[] = []

    await expect(deleteAllOfKuna(portsOf(calls, { syncing: true }), [], ['browser-keys'])).rejects.toBeInstanceOf(WorkbookWriteRefused)

    expect(calls).toEqual(['syncs over'])
  })
})
