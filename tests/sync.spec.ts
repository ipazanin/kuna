import { describe, expect, it, vi } from 'vitest'

import { GoogleApiError } from '../src/shared/google/googleApi'
import type { GoogleScope } from '../src/shared/google/googleScopes'
import { createSync } from '../src/shared/sync/application/sync'
import type { SyncGroup, SyncPorts, SyncStep } from '../src/shared/sync/application/sync'
import { BOOKS_STEP, stepsOf, syncControlOf } from '../src/shared/sync/application/syncRun'
import type { PageAccess, StepResult } from '../src/shared/sync/application/syncRun'

const AT = '2026-10-26T07:00:00.000Z'
const DONE: StepResult = { kind: 'done', line: 'Nothing new', writeId: null, link: null }

interface FakeStep extends SyncStep {
  readonly runs: ReturnType<typeof vi.fn>
}

function step(id: string, scope: GoogleScope, run: (report: (line: string) => void) => Promise<StepResult> = async () => DONE, on = () => true): FakeStep {
  const runs = vi.fn(run)
  return { id, label: id[0]!.toUpperCase() + id.slice(1), scopes: () => [scope], startLine: `Starting ${id}`, on, run: runs, runs }
}

/** A sync over the fake steps of one app, or of the groups given, with each scope granted or withheld. `leaves` asks Google by leaving the page, as a phone does. */
function harness(options: {
  readonly steps?: readonly FakeStep[]
  readonly books?: FakeStep
  readonly groups?: readonly SyncGroup[]
  readonly grants?: Partial<Record<GoogleScope, boolean>>
  readonly leaves?: boolean
}) {
  const grants: Record<GoogleScope, boolean> = { 'drive.file': true, 'drive.readonly': true, 'gmail.readonly': true, 'gmail.compose': true, ...options.grants }
  const books = options.books ?? step(BOOKS_STEP.id, 'drive.file')
  let idle: Promise<void> = Promise.resolve()
  const company: SyncGroup = { app: 'company', name: 'Company', books, steps: () => options.steps ?? [], whenIdle: () => idle }
  const ports: SyncPorts = {
    groups: () => options.groups ?? [company],
    granted: (scope) => grants[scope],
    askForAccess: vi.fn(async (scopes: readonly GoogleScope[]) => {
      for (const scope of scopes) grants[scope] = true
    }),
    asksByLeaving: () => options.leaves ?? false,
    now: () => AT,
  }
  const sync = createSync(ports)
  return {
    sync,
    ports,
    books,
    states: () => stepsOf(sync.state.run).map((candidate) => [candidate.id, candidate.state.kind]),
    control: (access: PageAccess = { kind: 'enough' }) => syncControlOf(sync.state.run, { chosen: true, reading: false, syncedAt: AT }, access, sync.state.askFailure),
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
    expect(stepsOf(sync.state.run)[1]?.state).toEqual({ kind: 'failed', line: 'The statements folder could not be read.', link: null })
    expect(control()).toEqual({ kind: 'problems', count: 1, labels: ['Statements'] })
  })

  it('skips every later step when the books cannot be read', async () => {
    const books = step('books', 'drive.file', async () => ({ kind: 'failed', line: 'Google did not answer.', link: null }))
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
    expect(control()).toEqual({ kind: 'allow-access', scopes: ['drive.readonly'], labels: ['Statements', 'Accountant'], failure: null })

    await sync.allowAccess()

    expect(ports.askForAccess).toHaveBeenCalledWith(['drive.readonly'])
    expect(statements.runs).toHaveBeenCalledOnce()
    expect(control()).toEqual({ kind: 'ready', syncedAt: AT })
  })

  it('keeps Allow access with why when Google gives no token, and syncs nothing', async () => {
    const statements = step('statements', 'drive.readonly')
    const { sync, ports, books, control } = harness({ steps: [statements], grants: { 'drive.readonly': false } })
    await sync.sync()
    vi.mocked(ports.askForAccess).mockRejectedValueOnce(new Error('Drive read access was not granted.'))

    await sync.allowAccess()

    expect(books.runs).toHaveBeenCalledOnce()
    expect(stepsOf(sync.state.run)[1]?.state).toEqual({ kind: 'needs-access', scopes: ['drive.readonly'], line: 'Waits for your Drive read access' })
    expect(control()).toMatchObject({ kind: 'allow-access', failure: 'Drive read access was not granted.' })
  })

  it('says why an Allow access before any sync gave no token, and forgets it once a tap gets one', async () => {
    const lacking: PageAccess = { kind: 'lacking', needs: [{ scope: 'drive.readonly', label: 'Statements' }] }
    const { sync, ports, books, control } = harness({ steps: [step('statements', 'drive.readonly')] })
    vi.mocked(ports.askForAccess).mockRejectedValueOnce(new Error("Google's window was closed before access was allowed."))

    await sync.allowAccess()

    expect(books.runs).not.toHaveBeenCalled()
    expect(sync.state.run).toBeNull()
    expect(control(lacking)).toEqual({ kind: 'allow-access', scopes: ['drive.readonly'], labels: ['Statements'], failure: "Google's window was closed before access was allowed." })

    await sync.allowAccess()

    expect(books.runs).toHaveBeenCalledOnce()
    expect(sync.state.askFailure).toBeNull()
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

  it('asks for the scopes the books just read give a step, such as the books file’s alone for a folder the app made beside them', async () => {
    let booksRead = false
    const statements = { ...step('statements', 'drive.readonly'), scopes: () => (booksRead ? (['drive.file'] as const) : (['drive.readonly'] as const)) }
    const harnessed = harness({
      books: step('books', 'drive.file', async () => {
        booksRead = true
        return DONE
      }),
      steps: [statements],
      grants: { 'drive.readonly': false },
    })

    await harnessed.sync.sync()

    expect(statements.runs).toHaveBeenCalledOnce()
    expect(stepsOf(harnessed.sync.state.run)[1]).toMatchObject({ id: 'statements', scopes: ['drive.file'], state: { kind: 'done' } })
  })

  it('shows the line a step reports while it runs', async () => {
    let seen: unknown = null
    const harnessed = harness({
      steps: [
        step('statements', 'drive.readonly', async (report) => {
          report('Filing 4 rows')
          seen = harnessed.control()
          return { kind: 'waits', line: '1 statement was not filed.', writeId: 3, link: { label: 'Import', to: '/company/transactions?tab=import' } }
        }),
      ],
    })

    await harnessed.sync.sync()

    expect(seen).toEqual({ kind: 'running', label: 'Statements', position: 2, of: 2, line: 'Filing 4 rows' })
    expect(stepsOf(harnessed.sync.state.run)[1]?.state).toMatchObject({ kind: 'waits', writeId: 3 })
    expect(harnessed.control()).toEqual({ kind: 'problems', count: 1, labels: ['Statements'] })
  })
})

describe('a sync over several apps', () => {
  function group(app: string, books: FakeStep, steps: readonly FakeStep[]): SyncGroup {
    return { app, name: app[0]!.toUpperCase() + app.slice(1), books, steps: () => steps, whenIdle: async () => {} }
  }

  it("runs each app's group in turn, and skips only the steps of the app whose books could not be read", async () => {
    const order: string[] = []
    const noted =
      (id: string, result: StepResult = DONE) =>
      async () => (order.push(id), result)
    const companyBooks = step('books', 'drive.file', noted('company books', { kind: 'failed', line: 'Google did not answer.', link: null }))
    const statements = step('statements', 'drive.readonly', noted('statements'))
    const loansBooks = step('books', 'drive.file', noted('loans books'))
    const rates = step('rates', 'drive.readonly', noted('rates'))
    const { sync, control } = harness({ groups: [group('company', companyBooks, [statements]), group('loans', loansBooks, [rates])] })

    await sync.sync()

    expect(order).toEqual(['company books', 'loans books', 'rates'])
    expect(statements.runs).not.toHaveBeenCalled()
    expect(sync.state.run?.groups.map((candidate) => [candidate.app, candidate.name, candidate.steps.map((planned) => [planned.id, planned.state.kind])])).toEqual([
      [
        'company',
        'Company',
        [
          ['books', 'failed'],
          ['statements', 'skipped'],
        ],
      ],
      [
        'loans',
        'Loans',
        [
          ['books', 'done'],
          ['rates', 'done'],
        ],
      ],
    ])
    expect(control()).toEqual({ kind: 'problems', count: 1, labels: ['Books'] })
  })

  it('never starts a group before the one ahead of it has finished', async () => {
    let companyDone: () => void = () => {}
    const companyBooks = step('books', 'drive.file', () => new Promise<StepResult>((resolve) => (companyDone = () => resolve(DONE))))
    const loansBooks = step('books', 'drive.file')
    const { sync } = harness({ groups: [group('company', companyBooks, []), group('loans', loansBooks, [])] })

    const running = sync.sync()
    await vi.waitFor(() => expect(companyBooks.runs).toHaveBeenCalledOnce())

    expect(loansBooks.runs).not.toHaveBeenCalled()
    companyDone()
    await running
    expect(loansBooks.runs).toHaveBeenCalledOnce()
  })
})

describe('a save that switches on what needs more Google access', () => {
  /** A save that notes when it runs among the asks, and resolves to whether it went through. */
  function saving(order: string[], went = true) {
    return vi.fn(async () => {
      order.push('save')
      return went
    })
  }

  it('only saves when it switches on nothing new', async () => {
    const order: string[] = []
    const { sync, ports, books } = harness({ steps: [step('mail', 'gmail.readonly')] })

    await sync.saveAllowing([], saving(order))

    expect(order).toEqual(['save'])
    expect(ports.askForAccess).not.toHaveBeenCalled()
    expect(books.runs).not.toHaveBeenCalled()
  })

  it('asks before the save where Google opens a popup, then syncs the step it switched on', async () => {
    const mail = step('mail', 'gmail.readonly')
    const { sync, ports, states } = harness({ steps: [mail], grants: { 'gmail.readonly': false } })
    const save = saving([])

    await sync.saveAllowing(['gmail.readonly'], save)

    expect(ports.askForAccess).toHaveBeenCalledWith(['gmail.readonly'])
    expect(vi.mocked(ports.askForAccess).mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[0]!)
    expect(states()).toEqual([
      ['books', 'done'],
      ['mail', 'done'],
    ])
  })

  it('still saves when the popup gives no token, says why, and syncs nothing', async () => {
    const order: string[] = []
    const { sync, ports, books } = harness({ steps: [step('mail', 'gmail.readonly')], grants: { 'gmail.readonly': false } })
    vi.mocked(ports.askForAccess).mockRejectedValueOnce(new Error("The browser blocked Google's window."))

    await sync.saveAllowing(['gmail.readonly'], saving(order))

    expect(order).toEqual(['save'])
    expect(books.runs).not.toHaveBeenCalled()
    expect(sync.state.askFailure).toBe("The browser blocked Google's window.")
  })

  it('saves before the ask where the ask leaves the page, and asks nothing after a save that did not go through', async () => {
    const order: string[] = []
    const { sync, ports } = harness({ steps: [step('mail', 'gmail.readonly')], grants: { 'gmail.readonly': false }, leaves: true })
    vi.mocked(ports.askForAccess).mockImplementation(async () => {
      order.push('ask')
    })

    await sync.saveAllowing(['gmail.readonly'], saving(order, false))
    await sync.saveAllowing(['gmail.readonly'], saving(order))

    expect(order).toEqual(['save', 'save', 'ask'])
  })
})
