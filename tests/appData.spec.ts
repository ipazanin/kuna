import { describe, expect, it } from 'vitest'

import { placesHeld, removeAppData, withPlace } from '../src/shared/storage/application/appData'
import type { DataBeside, DataPlace, DataRemovalPorts, RemovalStep } from '../src/shared/storage/application/appData'
import { words as storageWords } from '../src/shared/storage/application/words'
import type { WorkbookChoice } from '../src/shared/storage/application/workbookPorts'

const ON_DRIVE: WorkbookChoice = { source: 'drive', id: 'file-1', name: 'kuna-investments.json' }
const IN_BROWSER: WorkbookChoice = { source: 'browser', id: 'local-1', name: 'Investments file' }
const BOTH: readonly DataPlace[] = ['drive-file', 'browser-copy']
const COPY: readonly DataPlace[] = ['browser-copy']

/** Ports that note each call in order. `failing` fails those steps, and `refused` is what the drop throws once `first` has run. */
function portsOf({
  failing = [],
  refused = null,
  syncOver = Promise.resolve(),
  syncing = () => false,
  withBeside = true,
}: { failing?: readonly RemovalStep[]; refused?: string | null; syncOver?: Promise<void>; syncing?: () => boolean; withBeside?: boolean } = {}) {
  const calls: string[] = []
  const fail = (step: RemovalStep): void => {
    if (failing.includes(step)) throw new Error(`Drive refused ${step}.`)
  }
  const beside: DataBeside = {
    fileName: 'beside.json',
    async trashFiles(id) {
      calls.push(`trash beside ${id}`)
      fail('beside-file')
    },
    async forgetCopy(id) {
      calls.push(`forget beside copy of ${id}`)
      fail('beside-copy')
    },
    async whileStopped(work) {
      calls.push('stopped')
      try {
        return await work()
      } finally {
        calls.push('go on')
      }
    },
  }
  const ports: DataRemovalPorts = {
    async trashBackups(id) {
      calls.push(`trash backups of ${id}`)
      fail('backups')
    },
    async dropFile(id, { first, keepDriveFile }) {
      calls.push(`drop ${id} starts`)
      await first?.()
      if (refused !== null) throw new Error(refused)
      calls.push(keepDriveFile ? `forget ${id} here` : `drop ${id}`)
      return true
    },
    async syncsOver() {
      await syncOver
      calls.push('syncs over')
    },
    syncing,
    beside: withBeside ? beside : null,
    forgetOnThisDevice(id) {
      calls.push(`forget device state of ${id}`)
    },
  }
  return { ports, calls }
}

describe('what a delete offers', () => {
  it('offers the browser copy for a file kept only in this browser', () => {
    expect(placesHeld(IN_BROWSER, false)).toEqual(COPY)
  })

  it('offers the Drive file and the copy for a file on Drive', () => {
    expect(placesHeld(ON_DRIVE, false)).toEqual(BOTH)
  })

  it('offers only the copy once the Drive file is in the bin or gone', () => {
    expect(placesHeld(ON_DRIVE, true)).toEqual(COPY)
  })

  it('offers nothing with no file on this device', () => {
    expect(placesHeld(null, false)).toEqual([])
  })

  it('takes the copy along with the Drive file, and leaves it ticked when the Drive file is unticked', () => {
    expect(withPlace(COPY, 'drive-file', true)).toEqual(BOTH)
    expect(withPlace(BOTH, 'drive-file', false)).toEqual(COPY)
    expect(withPlace(BOTH, 'browser-copy', false)).toEqual(BOTH)
    expect(withPlace(COPY, 'browser-copy', false)).toEqual([])
    expect(withPlace([], 'browser-copy', true)).toEqual(COPY)
  })
})

describe('removing an app’s data', () => {
  it('on Drive trashes what is beside the file, then drops the file, then forgets what is kept here, with nothing fetched meanwhile', async () => {
    const { ports, calls } = portsOf()

    const report = await removeAppData(ports, ON_DRIVE, BOTH)

    expect(calls).toEqual(['stopped', 'syncs over', 'drop file-1 starts', 'trash beside file-1', 'drop file-1', 'forget device state of file-1', 'forget beside copy of file-1', 'go on'])
    expect(report.removed).toBe(true)
    expect(report.steps.map(({ step, outcome }) => [step, outcome.kind])).toEqual([
      ['beside-file', 'done'],
      ['drive-file', 'done'],
      ['beside-copy', 'done'],
    ])
  })

  it('leaves the Drive file and what is beside it when only the copy goes', async () => {
    const { ports, calls } = portsOf()

    const report = await removeAppData(ports, ON_DRIVE, COPY)

    expect(calls).not.toContain('trash beside file-1')
    expect(calls).toContain('forget file-1 here')
    expect(report.steps.map(({ step }) => step)).toEqual(['browser-copy', 'beside-copy'])
  })

  it('in this browser drops the file and what is kept beside it, and no Drive step runs', async () => {
    const { ports, calls } = portsOf()

    const report = await removeAppData(ports, IN_BROWSER, COPY)

    expect(calls).not.toContain('trash beside local-1')
    expect(report.steps.map(({ step }) => step)).toEqual(['browser-file', 'beside-copy'])
    expect(report.removed).toBe(true)
  })

  it('runs an app with nothing beside its file with only the file step', async () => {
    const { ports } = portsOf({ withBeside: false })

    const report = await removeAppData(ports, ON_DRIVE, BOTH)

    expect(report.steps.map(({ step }) => step)).toEqual(['drive-file'])
  })

  it('removes nothing when nothing was chosen', async () => {
    const { ports, calls } = portsOf()

    expect(await removeAppData(ports, ON_DRIVE, [])).toEqual({ steps: [], removed: false })
    expect(calls).toEqual([])
  })

  it('reports a refused trash on the file, and forgets nothing here', async () => {
    const { ports, calls } = portsOf({ refused: 'Drive would not bin it.' })

    const report = await removeAppData(ports, ON_DRIVE, BOTH)

    expect(report.removed).toBe(false)
    expect(report.steps.find(({ step }) => step === 'drive-file')?.outcome).toEqual({ kind: 'failed', message: 'Drive would not bin it.' })
    expect(report.steps.find(({ step }) => step === 'beside-copy')?.outcome).toEqual({ kind: 'not-run' })
    expect(calls).not.toContain('forget device state of file-1')
    expect(calls).not.toContain('forget beside copy of file-1')
  })

  it('stops when what is beside the file fails, leaving the file chosen', async () => {
    const { ports, calls } = portsOf({ failing: ['beside-file'] })

    const report = await removeAppData(ports, ON_DRIVE, BOTH)

    expect(report.removed).toBe(false)
    expect(calls).not.toContain('drop file-1')
    expect(report.steps.map(({ step, outcome }) => [step, outcome.kind])).toEqual([
      ['beside-file', 'failed'],
      ['drive-file', 'not-run'],
      ['beside-copy', 'not-run'],
    ])
  })

  it('counts the file as removed when only what is kept beside it stays, and says so', async () => {
    const { ports } = portsOf({ failing: ['beside-copy'] })

    const report = await removeAppData(ports, ON_DRIVE, BOTH)

    expect(report.removed).toBe(true)
    expect(report.steps.at(-1)?.outcome).toEqual({ kind: 'failed', message: 'Drive refused beside-copy.' })
  })

  it('bins the backups before anything else, since forgetting the file forgets the id that finds them', async () => {
    const { ports, calls } = portsOf()

    const report = await removeAppData(ports, ON_DRIVE, BOTH, true)

    expect(calls.indexOf('trash backups of file-1')).toBeLessThan(calls.indexOf('trash beside file-1'))
    expect(report.steps.map(({ step }) => step)).toEqual(['backups', 'beside-file', 'drive-file', 'beside-copy'])
    expect(report.removed).toBe(true)
  })

  it('leaves the backups alone unless they were ticked', async () => {
    const { ports, calls } = portsOf()

    await removeAppData(ports, ON_DRIVE, BOTH)

    expect(calls).not.toContain('trash backups of file-1')
  })

  it('bins only the backups when nothing else was chosen, and the file stays', async () => {
    const { ports, calls } = portsOf()

    const report = await removeAppData(ports, ON_DRIVE, [], true)

    expect(calls).toContain('trash backups of file-1')
    expect(calls).not.toContain('drop file-1 starts')
    expect(calls).not.toContain('forget device state of file-1')
    expect(report.steps.map(({ step, outcome }) => [step, outcome.kind])).toEqual([['backups', 'done']])
    expect(report.removed).toBe(false)
  })

  it('stops at failed backups with the file still chosen, so the delete can run again', async () => {
    const { ports, calls } = portsOf({ failing: ['backups'] })

    const report = await removeAppData(ports, ON_DRIVE, BOTH, true)

    expect(report.removed).toBe(false)
    expect(calls).not.toContain('drop file-1 starts')
    expect(report.steps.map(({ step, outcome }) => [step, outcome.kind])).toEqual([
      ['backups', 'failed'],
      ['beside-file', 'not-run'],
      ['drive-file', 'not-run'],
      ['beside-copy', 'not-run'],
    ])
  })

  it('has no backups to bin for a file kept in this browser', async () => {
    const { ports, calls } = portsOf()

    const report = await removeAppData(ports, IN_BROWSER, COPY, true)

    expect(calls).not.toContain('trash backups of local-1')
    expect(report.steps.map(({ step }) => step)).toEqual(['browser-file', 'beside-copy'])
  })

  it('refuses the backups too while a sync started meanwhile', async () => {
    const { ports, calls } = portsOf({ syncing: () => true })

    const report = await removeAppData(ports, ON_DRIVE, BOTH, true)

    expect(calls).not.toContain('trash backups of file-1')
    expect(report.steps[0]?.outcome).toEqual({ kind: 'failed', message: storageWords.busy })
  })

  it('waits for a sync under way before it starts', async () => {
    let over: () => void = () => {}
    const { ports, calls } = portsOf({ syncOver: new Promise<void>((resolve) => (over = resolve)) })

    const removal = removeAppData(ports, ON_DRIVE, BOTH)
    await Promise.resolve()
    expect(calls).toEqual(['stopped'])
    over()

    expect((await removal).removed).toBe(true)
  })

  it('is refused with nothing done when a sync started meanwhile', async () => {
    const { ports, calls } = portsOf({ syncing: () => true })

    const report = await removeAppData(ports, ON_DRIVE, BOTH)

    expect(report.removed).toBe(false)
    expect(report.steps.find(({ step }) => step === 'drive-file')?.outcome).toEqual({ kind: 'failed', message: storageWords.busy })
    expect(calls).not.toContain('trash beside file-1')
  })
})
