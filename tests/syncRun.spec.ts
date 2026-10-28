import { describe, expect, it } from 'vitest'

import {
  BOOKS_STEP,
  accessLostFrom,
  finishedRun,
  pageAccessOf,
  replanned,
  skippedAfter,
  startedRun,
  syncControlOf,
  withBooksFailure,
  withStep,
} from '../src/apps/company/sync/domain/syncRun'
import type { AccessNeed, BooksStanding, PageAccess, StepState, SyncRun } from '../src/apps/company/sync/domain/syncRun'

const STARTED = '2026-10-26T07:00:00.000Z'
const FINISHED = '2026-10-26T07:00:05.000Z'
const BOOKS_READ: BooksStanding = { chosen: true, reading: false, syncedAt: FINISHED }

const ENOUGH: PageAccess = { kind: 'enough' }

const DONE: StepState = { kind: 'done', line: 'Up to date', writeId: null, link: null }

/** Books, statements, a mail step that is off, and the accountant, as a run starts them. */
function started(): SyncRun {
  return startedRun(
    [
      { ...BOOKS_STEP, on: true },
      { id: 'statements', label: 'Statements', scopes: ['drive.readonly'], on: true },
      { id: 'mail', label: 'Mail', scopes: ['gmail.readonly', 'drive.readonly'], on: false },
      { id: 'accountant', label: 'Accountant', scopes: ['drive.readonly'], on: true },
    ],
    STARTED,
  )
}

const kinds = (run: SyncRun) => run.steps.map((step) => [step.id, step.state.kind])

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
    const run = replanned(withStep(started(), 'books', DONE), [
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
    expect(run.steps.map((step) => step.scopes)).toEqual([['drive.file'], ['drive.file'], ['gmail.readonly', 'drive.file'], ['drive.readonly']])
  })

  it('skips every step still to run after the books failed, and leaves the off ones off', () => {
    const run = skippedAfter(withStep(started(), 'books', { kind: 'failed', line: 'Google did not answer.', link: null }), 'books')

    expect(kinds(run)).toEqual([
      ['books', 'failed'],
      ['statements', 'skipped'],
      ['mail', 'off'],
      ['accountant', 'skipped'],
    ])
  })

  it('asks for access for the step Google turned away and the later queued steps of the same scope only', () => {
    const run = accessLostFrom(withStep(withStep(started(), 'books', DONE), 'statements', { kind: 'running', line: 'Filing 4 rows' }), 'statements')

    expect(kinds(run)).toEqual([
      ['books', 'done'],
      ['statements', 'needs-access'],
      ['mail', 'off'],
      ['accountant', 'needs-access'],
    ])
    expect(run.steps[1]!.state).toEqual({ kind: 'needs-access', scopes: ['drive.readonly'], line: 'Waits for your Drive read access' })
  })

  it('turns a later step that shares any scope with the one Google turned away into Allow access, and names every scope in its line', () => {
    const mailOn = replanned(withStep(started(), 'books', DONE), [{ id: 'mail', label: 'Mail', scopes: ['gmail.readonly', 'drive.readonly'], on: true }])
    const run = accessLostFrom(withStep(mailOn, 'statements', { kind: 'running', line: 'Filing 4 rows' }), 'statements')

    expect(run.steps[2]!.state).toEqual({ kind: 'needs-access', scopes: ['gmail.readonly', 'drive.readonly'], line: 'Waits for your Gmail read access and your Drive read access' })
  })
})

describe('the sync control', () => {
  it('finds the file while none on Drive is chosen, even with a copy on screen', () => {
    expect(syncControlOf(null, { chosen: false, reading: false, syncedAt: null }, ENOUGH, null)).toEqual({ kind: 'find' })
    expect(syncControlOf(null, { chosen: false, reading: false, syncedAt: FINISHED }, ENOUGH, null)).toEqual({ kind: 'find' })
    expect(syncControlOf(null, { chosen: true, reading: false, syncedAt: null }, ENOUGH, null)).toEqual({ kind: 'ready', syncedAt: null })
  })

  it('names the running step and its place among the steps that are on', () => {
    const books = syncControlOf(started(), BOOKS_READ, ENOUGH, null)
    const statements = syncControlOf(withStep(withStep(started(), 'books', DONE), 'statements', { kind: 'running', line: 'Filing 4 rows' }), BOOKS_READ, ENOUGH, null)

    expect(books).toEqual({ kind: 'running', label: 'Books', position: 1, of: 3, line: 'Waiting to start' })
    expect(statements).toEqual({ kind: 'running', label: 'Statements', position: 2, of: 3, line: 'Filing 4 rows' })
  })

  it('shows a read of the books outside a run, such as a find, as running', () => {
    expect(syncControlOf(null, { ...BOOKS_READ, reading: true }, ENOUGH, null)).toEqual({ kind: 'running', label: 'Books', position: 1, of: 1, line: 'Reading the file' })
  })

  it('offers Allow access before the problems, with the steps that lack it', () => {
    const run = finishedRun(withStep(accessLostFrom(withStep(started(), 'books', DONE), 'statements'), 'books', { kind: 'failed', line: 'x', link: null }), FINISHED)

    expect(syncControlOf(run, BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'allow-access', scopes: ['drive.readonly'], labels: ['Statements', 'Accountant'], failure: null })
  })

  it('counts the steps that failed or wait for you as problems, and is ready otherwise', () => {
    const waits: StepState = { kind: 'waits', line: '1 statement was not filed.', writeId: null, link: { label: 'Import', to: '/company/transactions?tab=import' } }
    const problems = finishedRun(withStep(withStep(withStep(started(), 'books', DONE), 'statements', waits), 'accountant', { kind: 'failed', line: 'No folder.', link: null }), FINISHED)
    const clean = finishedRun(withStep(withStep(withStep(started(), 'books', DONE), 'statements', DONE), 'accountant', DONE), FINISHED)

    expect(syncControlOf(problems, BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'problems', count: 2, labels: ['Statements', 'Accountant'] })
    expect(syncControlOf(clean, BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'ready', syncedAt: FINISHED })
  })

  it('shows a failed read of the books outside a run as the books step of a run', () => {
    const run = withBooksFailure(null, 'The file is gone.', FINISHED)

    expect(kinds(run)).toEqual([['books', 'failed']])
    expect(syncControlOf(run, BOOKS_READ, ENOUGH, null)).toEqual({ kind: 'problems', count: 1, labels: ['Books'] })
    expect(kinds(withBooksFailure(finishedRun(withStep(started(), 'books', DONE), FINISHED), 'The file is gone.', FINISHED))[0]).toEqual(['books', 'failed'])
  })
})

describe('what the page\'s Google token lacks', () => {
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
    const run = finishedRun(withStep(accessLostFrom(withStep(started(), 'books', DONE), 'statements'), 'books', DONE), FINISHED)

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

  it('leaves a running sync and a file not chosen yet as they are', () => {
    expect(syncControlOf(started(), BOOKS_READ, { kind: 'sign-in' }, null)).toMatchObject({ kind: 'running' })
    expect(syncControlOf(null, { ...BOOKS_READ, chosen: false }, { kind: 'lacking', needs: NEEDS }, null)).toEqual({ kind: 'find' })
  })
})
