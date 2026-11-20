import { describe, expect, it } from 'vitest'

import { mailSourcesOf, sourcesOn } from '../src/shared/sync/application/mailSources'
import type { MailGroup } from '../src/shared/sync/application/mailSources'
import type { MailSource, SyncStep } from '../src/shared/sync/application/sync'
import { BOOKS_STEP, startedRun, withStep } from '../src/shared/sync/application/syncRun'
import type { SyncRun } from '../src/shared/sync/application/syncRun'

const STARTED = '2026-11-20T07:00:00.000Z'

function source(to: string): MailSource {
  return { link: { label: 'See the list', to }, stop: async () => {} }
}

function step(id: string, on: boolean, readsMail?: MailSource): SyncStep {
  return {
    id,
    label: id,
    scopes: () => [],
    startLine: 'Starting',
    on: () => on,
    ...(readsMail === undefined ? {} : { readsMail }),
    run: async () => ({ kind: 'done', line: 'Up to date', writeId: null, link: null }),
  }
}

const COMPANY: MailGroup = { app: 'company', name: 'Company', steps: [step('mail', true, source('/company/settings#mail')), step('secrets', true)] }
const INVESTMENTS: MailGroup = { app: 'investments', name: 'Investments', steps: [step('prices', true), step('ibkr-mail', false, source('/investments/settings#mail'))] }
const LOANS: MailGroup = { app: 'loans', name: 'Loans', steps: [step('secrets', true)] }

/** A run in which Company's mail step filed a statement. */
function ranCompanyMail(): SyncRun {
  const run = startedRun(
    [
      {
        app: 'company',
        name: 'Company',
        steps: [
          { ...BOOKS_STEP, on: true, leftOutWhenOff: false },
          { id: 'mail', label: 'mail', scopes: ['gmail.readonly'], on: true, leftOutWhenOff: false },
        ],
      },
    ],
    STARTED,
  )
  return withStep(run, 'company', 'mail', { kind: 'done', line: 'Filed statement 028, 4 rows', writeId: null, link: null })
}

describe('the mail sources on Kuna settings', () => {
  it('lists each step that reads mail under its app, off ones included, and leaves out an app that reads none', () => {
    const apps = mailSourcesOf([COMPANY, LOANS, INVESTMENTS], null)
    expect(apps.map((app) => [app.app, app.sources.map((row) => [row.id, row.standing.kind])])).toEqual([
      ['company', [['mail', 'not-run']]],
      ['investments', [['ibkr-mail', 'off']]],
    ])
  })

  it('shows the line a source left in this page run, and none while it has not run', () => {
    const [company] = mailSourcesOf([COMPANY], ranCompanyMail())
    const standing = company!.sources[0]!.standing
    expect(standing.kind === 'ran' && standing.step.state.kind === 'done' ? standing.step.state.line : null).toBe('Filed statement 028, 4 rows')
  })

  it('reads a source that its app switched off since the run as off', () => {
    const switchedOff: MailGroup = { ...COMPANY, steps: [step('mail', false, source('/company/settings#mail'))] }
    expect(mailSourcesOf([switchedOff], ranCompanyMail())[0]!.sources[0]!.standing).toEqual({ kind: 'off' })
  })

  it('stops only the sources that read mail now, each with its app', () => {
    expect(sourcesOn(mailSourcesOf([COMPANY, INVESTMENTS], null)).map((row) => [row.app, row.id])).toEqual([['company', 'mail']])
    expect(sourcesOn(mailSourcesOf([INVESTMENTS], null))).toEqual([])
  })
})
