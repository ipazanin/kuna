// @vitest-environment jsdom
import { nextTick, shallowReactive } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { AppContribution } from '../src/shared/app/appContribution'
import type { GoogleScope } from '../src/shared/google/googleScopes'
import { loadNeededScopes } from '../src/shared/google/googleSession'
import type { SyncStep } from '../src/shared/sync/application/sync'
import type { AppSyncGroup } from '../src/shared/sync/presentation/pageSync'
import { startPageSync } from '../src/shared/sync/presentation/pageSync'

type FakeApp = Pick<AppContribution, 'id' | 'name' | 'syncGroup'>

/** An app whose file is on Drive, in this browser or not chosen, and whose books need these scopes once they are on screen. */
function appOf(id: string, source: 'drive' | 'browser' | null, scopes: readonly GoogleScope[], syncedAt: string | null = '2026-10-28T08:00:00.000Z', steps: readonly SyncStep[] = []) {
  const state = shallowReactive({
    choice: source === null ? null : { source, id: `${id}-file`, name: `kuna-${id}.json` },
    workbook: null as unknown,
    records: null,
    snapshot: null,
    syncedAt,
    status: 'ready' as const,
    error: null,
    missing: false,
    waiting: [],
    writes: [],
  })
  const group: AppSyncGroup = {
    store: { state: state as AppSyncGroup['store']['state'], open: async () => {}, sync: async () => {}, canSyncSilently: () => false, savedByNewerApp: () => false },
    steps: () => steps,
    needs: () => [{ scope: 'drive.file', label: 'Books' }, ...(state.workbook === null ? [] : scopes.map((scope) => ({ scope, label: id })))],
    undo: async () => {},
    exportControl: {},
    fileCard: `/${id}/settings?tab=books`,
  }
  const app: FakeApp = { id, name: id[0]!.toUpperCase() + id.slice(1), syncGroup: () => group }
  return { app, state }
}

/** A step of the books on screen, on unless `on` says otherwise, that needs these scopes. */
function stepOf(id: string, scopes: readonly GoogleScope[], needsNoDrive: boolean, on = true, ran: string[] = []): SyncStep {
  return {
    id,
    label: id,
    scopes: () => scopes,
    startLine: '',
    on: () => on,
    needsNoDrive,
    run: async () => {
      ran.push(id)
      return { kind: 'done', line: '', writeId: null, link: null }
    },
  }
}

const ratesStep = stepOf('rates', ['drive.file'], false)
const keysStep = stepOf('secrets', ['drive.appdata'], false)
const mailStep = stepOf('mail', ['gmail.readonly'], true)

beforeEach(() => {
  localStorage.clear()
})

describe('the scopes the page token carries', () => {
  it('joins what every app with its file on Drive needs, each scope once', async () => {
    const company = appOf('company', 'drive', ['drive.appdata', 'gmail.readonly'])
    const loans = appOf('loans', 'drive', ['gmail.compose', 'drive.appdata'])
    company.state.workbook = {}
    loans.state.workbook = {}

    startPageSync([company.app, loans.app])
    await nextTick()

    expect(loadNeededScopes()).toEqual(['drive.file', 'drive.appdata', 'gmail.readonly', 'gmail.compose'])
  })

  it('takes from books kept in this browser only the scopes of the steps that need no Drive, so neither their file nor their keys or rates', async () => {
    const loans = appOf('loans', 'drive', ['drive.appdata'])
    const company = appOf('company', 'browser', ['drive.appdata', 'gmail.compose'], null, [ratesStep, keysStep, mailStep])
    loans.state.workbook = {}
    company.state.workbook = {}

    startPageSync([loans.app, company.app])
    await nextTick()

    expect(loadNeededScopes()).toEqual(['drive.file', 'drive.appdata', 'gmail.readonly'])
  })

  it('asks for Gmail read alone while the only books are kept in this browser and read the mail', async () => {
    const company = appOf('company', 'browser', [], null, [ratesStep, keysStep, mailStep])
    company.state.workbook = {}

    startPageSync([company.app])
    await nextTick()

    expect(loadNeededScopes()).toEqual(['gmail.readonly'])
  })

  it('waits until every app on Drive has its books on screen, so a file still opening leaves no scope out', async () => {
    const company = appOf('company', 'drive', ['gmail.readonly'])
    const loans = appOf('loans', 'drive', ['drive.appdata'])
    company.state.workbook = {}

    startPageSync([company.app, loans.app])
    await nextTick()
    expect(loadNeededScopes()).toBeNull()

    loans.state.workbook = {}
    await nextTick()
    expect(loadNeededScopes()).toEqual(['drive.file', 'drive.appdata', 'gmail.readonly'])
  })
})

describe('the control over several files', () => {
  it('shows the oldest read among the files on Drive', () => {
    const company = appOf('company', 'drive', [], '2026-10-28T08:00:00.000Z')
    const loans = appOf('loans', 'drive', [], '2026-10-28T06:30:00.000Z')

    expect(startPageSync([company.app, loans.app]).control.value).toEqual({ kind: 'ready', syncedAt: '2026-10-28T06:30:00.000Z' })
  })
})

describe('a file in the bin or gone', () => {
  it("fails its books step with the store's words and a link to the app's file card, where the file is found again or replaced", () => {
    const loans = appOf('loans', 'drive', [])
    const state = loans.state as unknown as { status: string; error: string | null; missing: boolean }
    state.status = 'error'
    state.error = 'The file is in the Drive bin.'
    state.missing = true

    const run = startPageSync([loans.app]).run.value

    expect(run?.groups[0]?.steps[0]?.state).toEqual({ kind: 'failed', line: 'The file is in the Drive bin.', link: { label: 'Settings', to: '/loans/settings?tab=books' } })
  })

  it('offers no link for a read that failed for another reason', () => {
    const loans = appOf('loans', 'drive', [])
    const state = loans.state as unknown as { status: string; error: string | null }
    state.status = 'error'
    state.error = '500 from Drive.'

    expect(startPageSync([loans.app]).run.value?.groups[0]?.steps[0]?.state).toEqual({ kind: 'failed', line: '500 from Drive.', link: null })
  })
})

describe('whether a sync carries the keys', () => {
  it('holds only while an app with a file on Drive lists the Keys step, as Loans and Assets do not', () => {
    const loans = appOf('loans', 'drive', [])
    const company = appOf('company', 'browser', [], undefined, [keysStep])
    company.state.workbook = {}
    const page = startPageSync([loans.app, company.app])
    expect(page.keysSync.value).toBe(false)
    company.state.choice = { source: 'drive', id: 'company-file', name: 'kuna-company.json' }
    expect(page.keysSync.value).toBe(true)
  })
})

describe('which books a sync runs', () => {
  it('runs a file on Drive, and books kept in this browser only once on screen with a step on that needs no Drive', () => {
    const loans = appOf('loans', 'drive', [])
    const company = appOf('company', 'browser', [], null, [ratesStep, stepOf('mail', ['gmail.readonly'], true, false)])
    const investments = appOf('investments', 'browser', [], null, [mailStep])
    const page = startPageSync([loans.app, company.app, investments.app])

    expect(page.syncedGroups().map((group) => group.app)).toEqual(['loans'])
    investments.state.workbook = {}
    company.state.workbook = {}
    expect(page.syncedGroups().map((group) => group.app)).toEqual(['loans', 'investments'])
    loans.state.choice = { source: 'browser', id: 'loans-file', name: 'kuna-loans.json' }
    expect(page.syncedGroups().map((group) => group.app)).toEqual(['investments'])
    expect(page.syncs.value).toBe(true)
    investments.state.choice = null
    expect(page.syncs.value).toBe(false)
  })

  it('syncs books kept in this browser without a tap only while the page holds every scope their steps need, and books on Drive while their store holds a live token', () => {
    const company = appOf('company', 'browser', [], null, [mailStep])
    company.state.workbook = {}
    expect(startPageSync([company.app]).canSyncSilently()).toBe(false)

    const searching = appOf('company', 'browser', [], null, [stepOf('mail', [], true)])
    searching.state.workbook = {}
    expect(startPageSync([searching.app]).canSyncSilently()).toBe(true)

    const loans = appOf('loans', 'drive', [])
    expect(startPageSync([loans.app]).canSyncSilently()).toBe(false)
    loans.app.syncGroup().store.canSyncSilently = () => true
    expect(startPageSync([loans.app]).canSyncSilently()).toBe(true)
  })

  it('runs for books kept in this browser a books step that reads nothing, then only their steps that need no Drive', async () => {
    const ran: string[] = []
    const company = appOf('company', 'browser', [], null, [
      stepOf('rates', ['drive.file'], false, true, ran),
      stepOf('secrets', ['drive.appdata'], false, true, ran),
      stepOf('mail', [], true, true, ran),
    ])
    let read = 0
    company.app.syncGroup().store.sync = async () => {
      read += 1
    }
    company.state.workbook = {}
    const page = startPageSync([company.app])

    await page.sync()

    expect(read).toBe(0)
    expect(ran).toEqual(['mail'])
    // With no file on Drive to say when the books were read, the control says when the last sync ended.
    expect(page.control.value).toEqual({ kind: 'ready', syncedAt: page.run.value?.finishedAt })
    expect(page.run.value?.groups[0]?.steps.map((step) => [step.id, step.state])).toEqual([
      ['books', { kind: 'done', line: 'Kept in this browser', writeId: null, link: null }],
      ['mail', { kind: 'done', line: '', writeId: null, link: null }],
    ])
  })
})
