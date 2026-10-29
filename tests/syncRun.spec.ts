import { describe, expect, it } from 'vitest'

import {
  BOOKS_STEP,
  accessLostFrom,
  finishedRun,
  oldestRead,
  pageAccessOf,
  replanned,
  skippedAfter,
  startedRun,
  stepsOf,
  syncControlOf,
  withBooksFailure,
  withStep,
} from '../src/shared/sync/application/syncRun'
import type { AccessNeed, BooksStanding, PageAccess, StepState, SyncRun } from '../src/shared/sync/application/syncRun'

const STARTED = '2026-10-26T07:00:00.000Z'
const FINISHED = '2026-10-26T07:00:05.000Z'
const BOOKS_READ: BooksStanding = { reading: false, syncedAt: FINISHED }

const ENOUGH: PageAccess = { kind: 'enough' }

const DONE: StepState = { kind: 'done', line: 'Up to date', writeId: null, link: null }

const COMPANY = { app: 'company', name: 'Company' } as const

/** The company's books, statements, a mail step that is off, and the accountant, as a run starts them. */
function started(): SyncRun {
  return startedRun(
    [
      {
        ...COMPANY,
        steps: [
          { ...BOOKS_STEP, on: true },
          { id: 'statements', label: 'Statements', scopes: ['drive.readonly'], on: true },
          { id: 'mail', label: 'Mail', scopes: ['gmail.readonly', 'drive.readonly'], on: false },
          { id: 'accountant', label: 'Accountant', scopes: ['drive.readonly'], on: true },
        ],
      },
    ],
    STARTED,
  )
}

const kinds = (run: SyncRun) => stepsOf(run).map((step) => [step.id, step.state.kind])

describe('a sync run', () => {
  it('queues the steps that are on and leaves the others off', () => {
    expect(kinds(started())).toEqual([
      ['books', 'queued'],
      ['statements', 'queued'],
      ['mail', 'off'],
      ['accountant', 'queued'],
    ])
    expect(started().finishedAt).toBeNull()
  })

  it('turns the queued steps on or off again with their scopes once the books are read, and leaves a step the plan does not name as it was', () => {
    const run = replanned(withStep(started(), 'company', 'books', DONE), 'company', [
      { id: 'books', label: 'Books', scopes: ['drive.file'], on: false },
      { id: 'statements', label: 'Statements', scopes: ['drive.file'], on: false },
      { id: 'mail', label: 'Mail', scopes: ['gmail.readonly', 'drive.file'], on: true },
    ])

    expect(kinds(run)).toEqual([
      ['books', 'done'],
      ['statements', 'off'],
      ['mail', 'queued'],
      ['accountant', 'queued'],
    ])
    expect(stepsOf(run).map((step) => step.scopes)).toEqual([['drive.file'], ['drive.file'], ['gmail.readonly', 'drive.file'], ['drive.readonly']])
  })

  it('skips every step still to run after the books failed, and leaves the off ones off', () => {
    const run = skippedAfter(withStep(started(), 'company', 'books', { kind: 'failed', line: 'Google did not answer.', link: null }), 'company', 'books')

    expect(kinds(run)).toEqual([
      ['books', 'failed'],
      ['statements', 'skipped'],
      ['mail', 'off'],
      ['accountant', 'skipped'],
    ])
  })

  it('asks for access for the step Google turned away and the later queued steps of the same scope only', () => {
    const run = accessLostFrom(withStep(withStep(started(), 'company', 'books', DONE), 'company', 'statements', { kind: 'running', line: 'Filing 4 rows' }), 'company', 'statements')

    expect(kinds(run)).toEqual([
      ['books', 'done'],
      ['statements', 'needs-access'],
      ['mail', 'off'],
      ['accountant', 'needs-access'],
    ])
    expect(stepsOf(run)[1]!.state).toEqual({ kind: 'needs-access', scopes: ['drive.readonly'], line: 'Waits for your Drive read access' })
  })

  it('turns a later step that shares any scope with the one Google turned away into Allow access, and names every scope in its line', () => {
    const mailOn = replanned(withStep(started(), 'company', 'books', DONE), 'company', [{ id: 'mail', label: 'Mail', scopes: ['gmail.readonly', 'drive.readonly'], on: true }])
    const run = accessLostFrom(withStep(mailOn, 'company', 'statements', { kind: 'running', line: 'Filing 4 rows' }), 'company', 'statements')

    expect(stepsOf(run)[2]!.state).toEqual({ kind: 'needs-access', scopes: ['gmail.readonly', 'drive.readonly'], line: 'Waits for your Gmail read access and your Drive read access' })
  })
})

describe('a run over two apps', () => {
  /** The company as `started` plans it, then a second app with its books and one step of its own. */
  function twoApps(): SyncRun {
    return startedRun(
      [
        ...started().groups.map((group) => ({ ...group, steps: group.steps.map((step) => ({ ...step, on: step.state.kind === 'queued' })) })),
        {
          app: 'loans',
          name: 'Loans',
          steps: [
            { ...BOOKS_STEP, on: true },
            { id: 'rates', label: 'Rates', scopes: ['drive.readonly'], on: true },
          ],
        },
      ],
      STARTED,
    )
  }

  it('skips the rest of the group whose books failed, and leaves the other group queued', () => {
    const run = skippedAfter(withStep(twoApps(), 'company', 'books', { kind: 'failed', line: 'Google did not answer.', link: null }), 'company', 'books')

    expect(run.groups.map((group) => [group.app, group.steps.map((step) => step.state.kind)])).toEqual([
      ['company', ['failed', 'skipped', 'off', 'skipped']],
      ['loans', ['queued', 'queued']],
    ])
  })

  it('carries a scope Google turned away into the later groups, since the page holds one token', () => {
    const run = accessLostFrom(withStep(twoApps(), 'company', 'statements', { kind: 'running', line: 'Filing 4 rows' }), 'company', 'statements')

    expect(run.groups[1]!.steps.map((step) => step.state.kind)).toEqual(['queued', 'needs-access'])
  })

  it('counts the steps of every group in the running control', () => {
    expect(syncControlOf(withStep(twoApps(), 'company', 'books', DONE), BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'running', label: 'Statements', position: 2, of: 5, line: 'Waiting to start' })
  })

  it('shows a failed read outside a run as the books step of the app it belongs to', () => {
    const run = withBooksFailure(finishedRun(twoApps(), FINISHED), { app: 'loans', name: 'Loans' }, 'The file is gone.', FINISHED)
    const added = withBooksFailure(null, COMPANY, 'The file is gone.', FINISHED)

    expect(run.groups[1]!.steps[0]!.state).toEqual({ kind: 'failed', line: 'The file is gone.', link: null })
    expect(run.groups[0]!.steps[0]!.state.kind).toBe('queued')
    expect(withBooksFailure(added, { app: 'loans', name: 'Loans' }, 'Not found.', FINISHED).groups.map((group) => group.app)).toEqual(['company', 'loans'])
  })

  it('takes the oldest read of the files on Drive, and none while one has no read', () => {
    expect(oldestRead(['2026-10-26T07:00:05.000Z', '2026-10-26T06:00:00.000Z'])).toBe('2026-10-26T06:00:00.000Z')
    expect(oldestRead(['2026-10-26T07:00:05.000Z', null])).toBeNull()
    expect(oldestRead([])).toBeNull()
  })
})

describe('the sync control', () => {
  it('is ready with no read time before the first read', () => {
    expect(syncControlOf(null, { reading: false, syncedAt: null }, ENOUGH, null)).toEqual({ kind: 'ready', syncedAt: null })
  })

  it('names the running step and its place among the steps that are on', () => {
    const books = syncControlOf(started(), BOOKS_READ, ENOUGH, null)
    const statements = syncControlOf(withStep(withStep(started(), 'company', 'books', DONE), 'company', 'statements', { kind: 'running', line: 'Filing 4 rows' }), BOOKS_READ, ENOUGH, null)

    expect(books).toEqual({ kind: 'running', label: 'Books', position: 1, of: 3, line: 'Waiting to start' })
    expect(statements).toEqual({ kind: 'running', label: 'Statements', position: 2, of: 3, line: 'Filing 4 rows' })
  })

  it('shows a read of the books outside a run, such as a find, as running', () => {
    expect(syncControlOf(null, { ...BOOKS_READ, reading: true }, ENOUGH, null)).toEqual({ kind: 'running', label: 'Books', position: 1, of: 1, line: 'Reading the file' })
  })

  it('offers Allow access before the problems, with the steps that lack it', () => {
    const run = finishedRun(withStep(accessLostFrom(withStep(started(), 'company', 'books', DONE), 'company', 'statements'), 'company', 'books', { kind: 'failed', line: 'x', link: null }), FINISHED)

    expect(syncControlOf(run, BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'allow-access', scopes: ['drive.readonly'], labels: ['Statements', 'Accountant'], failure: null })
  })

  it('counts the steps that failed or wait for you as problems, and is ready otherwise', () => {
    const waits: StepState = { kind: 'waits', line: '1 statement was not filed.', writeId: null, link: { label: 'Import', to: '/company/transactions?tab=import' } }
    const problems = finishedRun(
      withStep(withStep(withStep(started(), 'company', 'books', DONE), 'company', 'statements', waits), 'company', 'accountant', { kind: 'failed', line: 'No folder.', link: null }),
      FINISHED,
    )
    const clean = finishedRun(withStep(withStep(withStep(started(), 'company', 'books', DONE), 'company', 'statements', DONE), 'company', 'accountant', DONE), FINISHED)

    expect(syncControlOf(problems, BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'problems', count: 2, labels: ['Statements', 'Accountant'] })
    expect(syncControlOf(clean, BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'ready', syncedAt: FINISHED })
  })

  it('shows a failed read of the books outside a run as the books step of a run', () => {
    const run = withBooksFailure(null, COMPANY, 'The file is gone.', FINISHED)

    expect(kinds(run)).toEqual([['books', 'failed']])
    expect(syncControlOf(run, BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'problems', count: 1, labels: ['Books'] })
    expect(kinds(withBooksFailure(finishedRun(withStep(started(), 'company', 'books', DONE), FINISHED), COMPANY, 'The file is gone.', FINISHED))[0]).toEqual(['books', 'failed'])
  })
})

describe("what the page's Google token lacks", () => {
  const NEEDS: readonly AccessNeed[] = [
    { scope: 'drive.file', label: 'Books' },
    { scope: 'drive.readonly', label: 'Statements' },
    { scope: 'drive.readonly', label: 'Accountant' },
    { scope: 'gmail.compose', label: 'Invoicing' },
  ]

  it('is enough while the token carries every need, or while the page asked nothing yet', () => {
    expect(pageAccessOf(NEEDS, ['drive.file', 'drive.readonly', 'gmail.compose'], null)).toEqual(ENOUGH)
    expect(pageAccessOf(NEEDS, null, null)).toEqual(ENOUGH)
  })

  it('names the needs a partial grant left out, such as Drive read unticked', () => {
    expect(pageAccessOf(NEEDS, ['drive.file', 'gmail.compose'], null)).toEqual({ kind: 'lacking', needs: NEEDS.slice(1, 3) })
  })

  it('asks for a sign-in when Google said the person is not signed in, and for every need after any other refusal', () => {
    expect(pageAccessOf(NEEDS, null, 'login_required')).toEqual({ kind: 'sign-in' })
    expect(pageAccessOf(NEEDS, null, 'interaction_required')).toEqual({ kind: 'lacking', needs: NEEDS })
    expect(pageAccessOf(NEEDS, null, 'access_denied')).toEqual({ kind: 'lacking', needs: NEEDS })
  })

  it('shows in the control as Sign in to Google or Allow access, once with each scope and name, after the steps that lost access', () => {
    const run = finishedRun(withStep(accessLostFrom(withStep(started(), 'company', 'books', DONE), 'company', 'statements'), 'company', 'books', DONE), FINISHED)

    expect(syncControlOf(null, BOOKS_READ, { kind: 'sign-in' }, null)).toEqual({ kind: 'sign-in', failure: null })
    expect(syncControlOf(run, BOOKS_READ, pageAccessOf(NEEDS, ['drive.file'], null), null)).toEqual({
      kind: 'allow-access',
      scopes: ['drive.readonly', 'gmail.compose'],
      labels: ['Statements', 'Accountant', 'Invoicing'],
      failure: null,
    })
  })

  it('says why the last ask gave no token while it offers Sign in to Google or Allow access, and only then', () => {
    const closed = "Google's window was closed before access was allowed."

    expect(syncControlOf(null, BOOKS_READ, { kind: 'sign-in' }, closed)).toEqual({ kind: 'sign-in', failure: closed })
    expect(syncControlOf(null, BOOKS_READ, { kind: 'lacking', needs: NEEDS }, closed)).toMatchObject({ kind: 'allow-access', failure: closed })
    expect(syncControlOf(null, BOOKS_READ, ENOUGH, closed)).toEqual({ kind: 'ready', syncedAt: FINISHED })
  })

  it('leaves a running sync as it is', () => {
    expect(syncControlOf(started(), BOOKS_READ, { kind: 'sign-in' }, null)).toMatchObject({ kind: 'running' })
  })
})
