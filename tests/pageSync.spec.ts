// @vitest-environment jsdom
import { nextTick, shallowReactive } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { AppContribution } from '../src/shared/app/appContribution'
import type { GoogleScope } from '../src/shared/google/googleScopes'
import { loadNeededScopes } from '../src/shared/google/googleSession'
import type { AppSyncGroup } from '../src/shared/sync/presentation/pageSync'
import { startPageSync } from '../src/shared/sync/presentation/pageSync'

type FakeApp = Pick<AppContribution, 'id' | 'name' | 'syncGroup'>

/** An app whose file is on Drive, in this browser or not chosen, and whose books need these scopes once they are on screen. */
function appOf(id: string, source: 'drive' | 'browser' | null, scopes: readonly GoogleScope[], syncedAt: string | null = '2026-10-28T08:00:00.000Z') {
  const state = shallowReactive({
    choice: source === null ? null : { source, id: `${id}-file`, name: `kuna-${id}.json` },
    workbook: null as unknown,
    records: null,
    snapshot: null,
    syncedAt,
    status: 'ready' as const,
    error: null,
    missing: false,
    writing: false,
    writes: [],
  })
  const group: AppSyncGroup = {
    store: { state: state as AppSyncGroup['store']['state'], open: async () => {}, sync: async () => {}, canSyncSilently: () => false },
    steps: () => [],
    needs: () => [{ scope: 'drive.file', label: 'Books' }, ...(state.workbook === null ? [] : scopes.map((scope) => ({ scope, label: id })))],
    undo: async () => {},
    exportControl: {},
    fileCard: `/${id}/settings?tab=books`,
  }
  const app: FakeApp = { id, name: id[0]!.toUpperCase() + id.slice(1), syncGroup: () => group }
  return { app, state }
}

beforeEach(() => {
  localStorage.clear()
})

describe('the scopes the page token carries', () => {
  it('joins what every app with its file on Drive needs, each scope once', async () => {
    const company = appOf('company', 'drive', ['drive.readonly', 'gmail.readonly'])
    const loans = appOf('loans', 'drive', ['gmail.compose', 'drive.readonly'])
    company.state.workbook = {}
    loans.state.workbook = {}

    startPageSync([company.app, loans.app])
    await nextTick()

    expect(loadNeededScopes()).toEqual(['drive.file', 'drive.readonly', 'gmail.readonly', 'gmail.compose'])
  })

  it('leaves out an app whose file is kept in this browser', async () => {
    const company = appOf('company', 'drive', ['drive.readonly'])
    const loans = appOf('loans', 'browser', ['gmail.compose'])
    company.state.workbook = {}
    loans.state.workbook = {}

    startPageSync([company.app, loans.app])
    await nextTick()

    expect(loadNeededScopes()).toEqual(['drive.file', 'drive.readonly'])
  })

  it('waits until every app on Drive has its books on screen, so a file still opening leaves no scope out', async () => {
    const company = appOf('company', 'drive', ['gmail.readonly'])
    const loans = appOf('loans', 'drive', ['drive.readonly'])
    company.state.workbook = {}

    startPageSync([company.app, loans.app])
    await nextTick()
    expect(loadNeededScopes()).toBeNull()

    loans.state.workbook = {}
    await nextTick()
    expect(loadNeededScopes()).toEqual(['drive.file', 'drive.readonly', 'gmail.readonly'])
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
