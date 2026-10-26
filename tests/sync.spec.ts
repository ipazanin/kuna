import { describe, expect, it, vi } from 'vitest'

import { createSync } from '../src/features/sync/application/sync'
import type { SyncPorts, SyncStep } from '../src/features/sync/application/sync'
import { BOOKS_STEP, syncControlOf } from '../src/features/sync/domain/syncRun'
import type { StepResult, SyncScope } from '../src/features/sync/domain/syncRun'
import type { Workbook } from '../src/features/workbook/domain/workbook'
import { GoogleApiError } from '../src/shared/google/googleApi'

const AT = '2026-10-26T07:00:00.000Z'
const DONE: StepResult = { kind: 'done', line: 'Nothing new', writeId: null, link: null }

/** A workbook the steps never read, since each fake step says itself whether it is on. */
const BOOKS = {} as Workbook

interface FakeStep extends SyncStep {
  readonly runs: ReturnType<typeof vi.fn>
}

function step(id: string, scope: SyncScope, run: (report: (line: string) => void) => Promise<StepResult> = async () => DONE, on = () => true): FakeStep {
  const runs = vi.fn(run)
  return { id, label: id[0]!.toUpperCase() + id.slice(1), scope, startLine: `Starting ${id}`, on, run: runs, runs }
}

/** A sync over fake steps, with each scope granted or withheld, and the books on screen once read. */
function harness(options: { readonly steps: readonly FakeStep[]; readonly books?: FakeStep; readonly grants?: Partial<Record<SyncScope, boolean>> }) {
  const grants: Record<SyncScope, boolean> = { 'drive.file': true, 'drive.readonly': true, ...options.grants }
  const books = options.books ?? step(BOOKS_STEP.id, BOOKS_STEP.scope)
  let idle: Promise<void> = Promise.resolve()
  const ports: SyncPorts = {
    books,
    steps: () => options.steps,
    workbook: () => BOOKS,
    granted: (scope) => grants[scope],
    askForAccess: vi.fn(async (scopes: readonly SyncScope[]) => {
      for (const scope of scopes) grants[scope] = true
    }),
    whenIdle: () => idle,
    now: () => AT,
  }
  const sync = createSync(ports)
  return {
    sync,
    ports,
    books,
    states: () => sync.state.run?.steps.map((candidate) => [candidate.id, candidate.state.kind]),
    control: () => syncControlOf(sync.state.run, { chosen: true, reading: false, syncedAt: AT }),
    holdUntil(save: Promise<void>) {
      idle = save
    },
  }
}

describe('a sync', () => {
  it('reads the books, then runs every step that is on, in order', async () => {
    const order: string[] = []
    const statements = step('statements', 'drive.readonly', async () => (order.push('statements'), DONE))
    const accountant = step('accountant', 'drive.readonly', async () => (order.push('accountant'), DONE))
    const { sync, states, control, books } = harness({ steps: [statements, accountant] })

    await sync.sync()

    expect(books.runs).toHaveBeenCalledOnce()
    expect(order).toEqual(['statements', 'accountant'])
    expect(states()).toEqual([
      ['books', 'done'],
      ['statements', 'done'],
      ['accountant', 'done'],
    ])
    expect(sync.state.run?.finishedAt).toBe(AT)
    expect(control()).toEqual({ kind: 'ready', syncedAt: AT })
  })

  it('lets the other steps finish when one fails, and counts it as a problem', async () => {
    const statements = step('statements', 'drive.readonly', async () => {
      throw new Error('The statements folder could not be read.')
    })
    const accountant = step('accountant', 'drive.readonly')
    const { sync, states, control } = harness({ steps: [statements, accountant] })

    await sync.sync()

    expect(accountant.runs).toHaveBeenCalledOnce()
    expect(states()).toEqual([
      ['books', 'done'],
      ['statements', 'failed'],
      ['accountant', 'done'],
    ])
    expect(sync.state.run?.steps[1]?.state).toEqual({ kind: 'failed', line: 'The statements folder could not be read.' })
    expect(control()).toEqual({ kind: 'problems', count: 1, labels: ['Statements'] })
  })

  it('skips every later step when the books cannot be read', async () => {
    const books = step('books', 'drive.file', async () => ({ kind: 'failed', line: 'Google did not answer.' }))
    const statements = step('statements', 'drive.readonly')
    const { sync, states, control } = harness({ books, steps: [statements] })

    await sync.sync()

    expect(statements.runs).not.toHaveBeenCalled()
    expect(states()).toEqual([
      ['books', 'failed'],
      ['statements', 'skipped'],
    ])
    expect(control()).toEqual({ kind: 'problems', count: 1, labels: ['Books'] })
  })

  it('runs no step whose scope the page lacks, offers Allow access, and syncs once Google gives it', async () => {
    const statements = step('statements', 'drive.readonly')
    const accountant = step('accountant', 'drive.readonly')
    const { sync, states, control, ports } = harness({ steps: [statements, accountant], grants: { 'drive.readonly': false } })

    await sync.sync()

    expect(statements.runs).not.toHaveBeenCalled()
    expect(states()).toEqual([
      ['books', 'done'],
      ['statements', 'needs-access'],
      ['accountant', 'needs-access'],
    ])
    expect(control()).toEqual({ kind: 'allow-access', scopes: ['drive.readonly'], labels: ['Statements', 'Accountant'] })

    await sync.allowAccess()

    expect(ports.askForAccess).toHaveBeenCalledWith(['drive.readonly'])
    expect(statements.runs).toHaveBeenCalledOnce()
    expect(control()).toEqual({ kind: 'ready', syncedAt: AT })
  })

  it('keeps Allow access with why when Google gives no token, and syncs nothing', async () => {
    const statements = step('statements', 'drive.readonly')
    const { sync, ports, books } = harness({ steps: [statements], grants: { 'drive.readonly': false } })
    await sync.sync()
    vi.mocked(ports.askForAccess).mockRejectedValueOnce(new Error('Drive read access was not granted.'))

    await sync.allowAccess()

    expect(books.runs).toHaveBeenCalledOnce()
    expect(sync.state.run?.steps[1]?.state).toEqual({ kind: 'needs-access', scope: 'drive.readonly', line: 'Drive read access was not granted.' })
  })

  it('turns a step Google refuses mid-way, and the later steps of its scope, into Allow access, and runs the rest', async () => {
    const statements = step('statements', 'drive.readonly', async (report) => {
      report('Filing 4 rows')
      throw new GoogleApiError('https://www.googleapis.com/drive/v3/files', 401, '{"error":{"code":401}}')
    })
    const accountant = step('accountant', 'drive.readonly')
    const mail = step('mail', 'drive.file')
    const { sync, states, control } = harness({ steps: [statements, accountant, mail] })

    await sync.sync()

    expect(accountant.runs).not.toHaveBeenCalled()
    expect(mail.runs).toHaveBeenCalledOnce()
    expect(states()).toEqual([
      ['books', 'done'],
      ['statements', 'needs-access'],
      ['accountant', 'needs-access'],
      ['mail', 'done'],
    ])
    expect(control()).toMatchObject({ kind: 'allow-access', labels: ['Statements', 'Accountant'] })
  })

  it('waits for a save under way, then syncs once for every tap during it', async () => {
    const statements = step('statements', 'drive.readonly')
    const { sync, books, holdUntil } = harness({ steps: [statements] })
    let saved: () => void = () => {}
    holdUntil(new Promise<void>((resolve) => (saved = resolve)))

    const first = sync.sync()
    const second = sync.sync()
    await Promise.resolve()

    expect(books.runs).not.toHaveBeenCalled()
    expect(second).toBe(first)

    saved()
    await first

    expect(books.runs).toHaveBeenCalledOnce()
    expect(statements.runs).toHaveBeenCalledOnce()
  })

  it('leaves a step its setting turns off off, uncounted, and turns them on or off again as the books just read say', async () => {
    let statementsOn = true
    let seen: unknown = null
    const harnessed = harness({
      books: step('books', 'drive.file', async () => {
        seen = harnessed.control()
        statementsOn = false
        return DONE
      }),
      steps: [step('statements', 'drive.readonly', undefined, () => statementsOn), step('accountant', 'drive.readonly', undefined, () => false)],
    })

    await harnessed.sync.sync()

    expect(seen).toEqual({ kind: 'running', label: 'Books', position: 1, of: 2, line: 'Starting books' })
    expect(harnessed.states()).toEqual([
      ['books', 'done'],
      ['statements', 'off'],
      ['accountant', 'off'],
    ])
  })

  it('shows the line a step reports while it runs', async () => {
    let seen: unknown = null
    const harnessed = harness({
      steps: [
        step('statements', 'drive.readonly', async (report) => {
          report('Filing 4 rows')
          seen = harnessed.control()
          return { kind: 'waits', line: '1 statement was not filed.', writeId: 3, link: { label: 'Import', to: '/transactions?tab=import' } }
        }),
      ],
    })

    await harnessed.sync.sync()

    expect(seen).toEqual({ kind: 'running', label: 'Statements', position: 2, of: 2, line: 'Filing 4 rows' })
    expect(harnessed.sync.state.run?.steps[1]?.state).toMatchObject({ kind: 'waits', writeId: 3 })
    expect(harnessed.control()).toEqual({ kind: 'problems', count: 1, labels: ['Statements'] })
  })
})
