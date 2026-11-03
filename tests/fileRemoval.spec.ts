import { describe, expect, it } from 'vitest'

import { removeInvestmentsFile } from '../src/apps/investments/settings/application/fileRemoval'
import type { FileRemovalPorts, RemovalStep } from '../src/apps/investments/settings/application/fileRemoval'
import { words as storageWords } from '../src/shared/storage/application/words'
import type { WorkbookChoice } from '../src/shared/storage/application/workbookPorts'

const ON_DRIVE: WorkbookChoice = { source: 'drive', id: 'file-1', name: 'kuna-investments.json' }
const IN_BROWSER: WorkbookChoice = { source: 'browser', id: 'local-1', name: 'Investments file' }

/**
 * Ports that note each call in order, and fail the steps named in `failing`. A file refused by the drop says so instead
 * of throwing. `syncOver` holds the wait for a sync under way, and `syncing` says whether one runs as the file is taken.
 */
function portsOf({
  failing = [],
  refused = null,
  syncOver = Promise.resolve(),
  syncing = () => false,
}: { failing?: readonly RemovalStep[]; refused?: string | null; syncOver?: Promise<void>; syncing?: () => boolean } = {}) {
  const calls: string[] = []
  const fail = (step: RemovalStep): void => {
    if (failing.includes(step)) throw new Error(`Drive refused ${step}.`)
  }
  const ports: FileRemovalPorts = {
    async deleteKeysFiles(id) {
      calls.push(`delete keys of ${id}`)
      fail('keys')
    },
    async trashPricesFiles(id) {
      calls.push(`trash prices beside ${id}`)
      fail('prices-file')
    },
    async dropFile(id, first) {
      calls.push(`drop ${id} starts`)
      await first()
      calls.push(`drop ${id}`)
      return refused
    },
    async forgetPricesCopy(id) {
      calls.push(`forget prices copy of ${id}`)
      fail('prices-copy')
    },
    async withoutPrices(work) {
      calls.push('prices stopped')
      try {
        return await work()
      } finally {
        calls.push('prices go on')
      }
    },
    async syncsOver() {
      await syncOver
      calls.push('syncs over')
    },
    syncing,
  }
  return { ports, calls }
}

describe('removing the Investments file', () => {
  it('on Drive deletes the keys files, then trashes the prices files, then drops the file, then forgets its prices here, with no price fetch meanwhile', async () => {
    const { ports, calls } = portsOf()

    const report = await removeInvestmentsFile(ports, ON_DRIVE)

    expect(calls).toEqual(['prices stopped', 'syncs over', 'drop file-1 starts', 'delete keys of file-1', 'trash prices beside file-1', 'drop file-1', 'forget prices copy of file-1', 'prices go on'])
    expect(report).toEqual({
      removed: true,
      steps: [
        { step: 'keys', outcome: { kind: 'done' } },
        { step: 'prices-file', outcome: { kind: 'done' } },
        { step: 'file', outcome: { kind: 'done' } },
        { step: 'prices-copy', outcome: { kind: 'done' } },
      ],
    })
  })

  it('in this browser drops the file, then forgets its prices here, and asks nothing of Drive', async () => {
    const { ports, calls } = portsOf()

    const report = await removeInvestmentsFile(ports, IN_BROWSER)

    expect(calls).toEqual(['prices stopped', 'syncs over', 'drop local-1 starts', 'drop local-1', 'forget prices copy of local-1', 'prices go on'])
    expect(report.steps.map(({ step }) => step)).toEqual(['file', 'prices-copy'])
    expect(report.removed).toBe(true)
  })

  it('stops at a refused keys delete, before the prices file or the file is touched, so the file stays open and Remove can run again', async () => {
    const { ports, calls } = portsOf({ failing: ['keys'] })

    const report = await removeInvestmentsFile(ports, ON_DRIVE)

    expect(calls).toEqual(['prices stopped', 'syncs over', 'drop file-1 starts', 'delete keys of file-1', 'prices go on'])
    expect(report).toEqual({
      removed: false,
      steps: [
        { step: 'keys', outcome: { kind: 'failed', message: 'Drive refused keys.' } },
        { step: 'prices-file', outcome: { kind: 'not-run' } },
        { step: 'file', outcome: { kind: 'not-run' } },
        { step: 'prices-copy', outcome: { kind: 'not-run' } },
      ],
    })
  })

  it('stops at a refused prices trash with the keys files already deleted and the file still chosen', async () => {
    const { ports, calls } = portsOf({ failing: ['prices-file'] })

    const report = await removeInvestmentsFile(ports, ON_DRIVE)

    expect(calls).not.toContain('drop file-1')
    expect(report.removed).toBe(false)
    expect(report.steps.map(({ outcome }) => outcome.kind)).toEqual(['done', 'failed', 'not-run', 'not-run'])
  })

  it('reports the file not dropped, with the reason the drop gives, and leaves the prices kept here alone', async () => {
    const { ports, calls } = portsOf({ refused: '500 from Drive.' })

    const report = await removeInvestmentsFile(ports, ON_DRIVE)

    expect(calls).not.toContain('forget prices copy of file-1')
    expect(report.removed).toBe(false)
    expect(report.steps[2]).toEqual({ step: 'file', outcome: { kind: 'failed', message: '500 from Drive.' } })
    expect(report.steps[3]).toEqual({ step: 'prices-copy', outcome: { kind: 'not-run' } })
  })

  it('puts a refusal before any step, such as a sync under way, on the file itself', async () => {
    const { ports } = portsOf()
    const busy: FileRemovalPorts = {
      ...ports,
      async dropFile() {
        throw new Error('Another change or a sync is still running.')
      },
    }

    const report = await removeInvestmentsFile(busy, ON_DRIVE)

    expect(report.removed).toBe(false)
    expect(report.steps.map(({ step, outcome }) => [step, outcome.kind])).toEqual([
      ['keys', 'not-run'],
      ['prices-file', 'not-run'],
      ['file', 'failed'],
      ['prices-copy', 'not-run'],
    ])
  })

  it('waits for a sync under way, whose Keys step could write the keys file again, before it touches anything', async () => {
    let over: () => void = () => {}
    const { ports, calls } = portsOf({ syncOver: new Promise<void>((resolve) => (over = resolve)) })

    const removal = removeInvestmentsFile(ports, ON_DRIVE)
    await Promise.resolve()

    expect(calls).toEqual(['prices stopped'])
    over()
    expect((await removal).removed).toBe(true)
    expect(calls.indexOf('syncs over')).toBeLessThan(calls.indexOf('delete keys of file-1'))
  })

  it('refuses with nothing deleted when a sync started after the wait, as the file is taken, and puts the refusal on the file', async () => {
    const { ports, calls } = portsOf({ syncing: () => true })

    const report = await removeInvestmentsFile(ports, ON_DRIVE)

    expect(calls).toEqual(['prices stopped', 'syncs over', 'drop file-1 starts', 'prices go on'])
    expect(report).toEqual({
      removed: false,
      steps: [
        { step: 'keys', outcome: { kind: 'not-run' } },
        { step: 'prices-file', outcome: { kind: 'not-run' } },
        { step: 'file', outcome: { kind: 'failed', message: storageWords.busy } },
        { step: 'prices-copy', outcome: { kind: 'not-run' } },
      ],
    })
  })

  it('counts the file removed when only the prices kept here could not be deleted, and says so', async () => {
    const { ports } = portsOf({ failing: ['prices-copy'] })

    const report = await removeInvestmentsFile(ports, IN_BROWSER)

    expect(report).toEqual({
      removed: true,
      steps: [
        { step: 'file', outcome: { kind: 'done' } },
        { step: 'prices-copy', outcome: { kind: 'failed', message: 'Drive refused prices-copy.' } },
      ],
    })
  })
})
