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
  withAccessLine,
  withBooksFailure,
  withStep,
} from '../src/features/sync/domain/syncRun'
import type { AccessNeed, BooksStanding, PageAccess, StepState, SyncRun } from '../src/features/sync/domain/syncRun'

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
      { id: 'statements', label: 'Statements', scope: 'drive.readonly', on: true },
      { id: 'mail', label: 'Mail', scope: 'drive.file', on: false },
      { id: 'accountant', label: 'Accountant', scope: 'drive.readonly', on: true },
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

  it('turns the queued steps on or off again once the books are read', () => {
    const run = replanned(withStep(started(), 'books', DONE), (id) => id === 'mail')

    expect(kinds(run)).toEqual([
      ['books', 'done'],
      ['statements', 'off'],
      ['mail', 'queued'],
      ['accountant', 'off'],
    ])
  })

  it('skips every step still to run after the books failed, and leaves the off ones off', () => {
    const run = skippedAfter(withStep(started(), 'books', { kind: 'failed', line: 'Google did not answer.' }), 'books')

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
    expect(run.steps[1]!.state).toEqual({ kind: 'needs-access', scope: 'drive.readonly', line: 'Waits for your Drive read access' })
  })

  it('says why Google gave no token on every step that needs access', () => {
    const run = withAccessLine(accessLostFrom(started(), 'statements'), 'Drive read access was not granted.')

    expect(run.steps.filter((step) => step.state.kind === 'needs-access').map((step) => 'line' in step.state && step.state.line)).toEqual([
      'Drive read access was not granted.',
      'Drive read access was not granted.',
    ])
  })
})

describe('the sync control', () => {
  it('finds the file while none on Drive is chosen, even with a copy on screen', () => {
    expect(syncControlOf(null, { chosen: false, reading: false, syncedAt: null }, ENOUGH)).toEqual({ kind: 'find' })
    expect(syncControlOf(null, { chosen: false, reading: false, syncedAt: FINISHED }, ENOUGH)).toEqual({ kind: 'find' })
    expect(syncControlOf(null, { chosen: true, reading: false, syncedAt: null }, ENOUGH)).toEqual({ kind: 'ready', syncedAt: null })
  })

  it('names the running step and its place among the steps that are on', () => {
    const books = syncControlOf(started(), BOOKS_READ, ENOUGH)
    const statements = syncControlOf(withStep(withStep(started(), 'books', DONE), 'statements', { kind: 'running', line: 'Filing 4 rows' }), BOOKS_READ, ENOUGH)

    expect(books).toEqual({ kind: 'running', label: 'Books', position: 1, of: 3, line: 'Waiting to start' })
    expect(statements).toEqual({ kind: 'running', label: 'Statements', position: 2, of: 3, line: 'Filing 4 rows' })
  })

  it('shows a read of the books outside a run, such as a find, as running', () => {
    expect(syncControlOf(null, { ...BOOKS_READ, reading: true }, ENOUGH)).toEqual({ kind: 'running', label: 'Books', position: 1, of: 1, line: 'Reading the file' })
  })

  it('offers Allow access before the problems, with the steps that lack it', () => {
    const run = finishedRun(withStep(accessLostFrom(withStep(started(), 'books', DONE), 'statements'), 'books', { kind: 'failed', line: 'x' }), FINISHED)

    expect(syncControlOf(run, BOOKS_READ, ENOUGH)).toEqual({ kind: 'allow-access', scopes: ['drive.readonly'], labels: ['Statements', 'Accountant'] })
  })

  it('counts the steps that failed or wait for you as problems, and is ready otherwise', () => {
    const waits: StepState = { kind: 'waits', line: '1 statement was not filed.', writeId: null, link: { label: 'Import', to: '/transactions?tab=import' } }
    const problems = finishedRun(withStep(withStep(withStep(started(), 'books', DONE), 'statements', waits), 'accountant', { kind: 'failed', line: 'No folder.' }), FINISHED)
    const clean = finishedRun(withStep(withStep(withStep(started(), 'books', DONE), 'statements', DONE), 'accountant', DONE), FINISHED)

    expect(syncControlOf(problems, BOOKS_READ, ENOUGH)).toEqual({ kind: 'problems', count: 2, labels: ['Statements', 'Accountant'] })
    expect(syncControlOf(clean, BOOKS_READ, ENOUGH)).toEqual({ kind: 'ready', syncedAt: FINISHED })
  })

  it('shows a failed read of the books outside a run as the books step of a run', () => {
    const run = withBooksFailure(null, 'The file is gone.', FINISHED)

    expect(kinds(run)).toEqual([['books', 'failed']])
    expect(syncControlOf(run, BOOKS_READ, ENOUGH)).toEqual({ kind: 'problems', count: 1, labels: ['Books'] })
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

    expect(syncControlOf(null, BOOKS_READ, { kind: 'sign-in' })).toEqual({ kind: 'sign-in' })
    expect(syncControlOf(run, BOOKS_READ, pageAccessOf(NEEDS, ['drive.file'], null))).toEqual({
      kind: 'allow-access',
      scopes: ['drive.readonly', 'gmail.compose'],
      labels: ['Statements', 'Accountant', 'Invoicing'],
    })
  })

  it('leaves a running sync and a file not chosen yet as they are', () => {
    expect(syncControlOf(started(), BOOKS_READ, { kind: 'sign-in' })).toMatchObject({ kind: 'running' })
    expect(syncControlOf(null, { ...BOOKS_READ, chosen: false }, { kind: 'lacking', needs: NEEDS })).toEqual({ kind: 'find' })
  })
})
