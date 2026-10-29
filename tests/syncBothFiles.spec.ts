// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loansApp } from '../src/apps/loans/app'
import { useLoansBooks } from '../src/apps/loans/workbook/application/loansStore'
import { seedFakeLoans } from '../src/apps/loans/workbook/infrastructure/fake/seedFakeLoans'
import { useWorkbook } from '../src/apps/company/workbook/application/workbookStore'
import { seedFakeWorkbook } from '../src/apps/company/workbook/infrastructure/fake/seedFakeWorkbook'
import type { AppContribution } from '../src/shared/app/appContribution'
import { fakeDriveSession } from '../src/shared/storage/infrastructure/fake/fakeDriveSession'
import type { SyncStep } from '../src/shared/sync/application/sync'
import { BOOKS_STEP } from '../src/shared/sync/application/syncRun'
import { startPageSync } from '../src/shared/sync/presentation/pageSync'
import type { PageSync } from '../src/shared/sync/presentation/pageSync'

// The specs run without the Vue compiler or Nuxt UI's app, which the sync group's export control and the toasts need.
vi.mock('../src/apps/loans/workbook/presentation/LocalLoansStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => {} }) }))

/** A step of the company's after its books, which notes each run. */
const statements: SyncStep & { runs: number } = {
  id: 'statements',
  label: 'Statements',
  scopes: () => ['drive.file'],
  startLine: 'Reading statements',
  on: () => true,
  runs: 0,
  async run() {
    statements.runs += 1
    return { kind: 'done', line: 'Nothing new', writeId: null, link: null }
  },
}

/** The company app as the page's sync sees it: its own books on the fake Drive, then the step. */
const companyApp: Pick<AppContribution, 'id' | 'name' | 'syncGroup'> = {
  id: 'company',
  name: 'Company',
  syncGroup: () => ({
    store: useWorkbook(),
    steps: () => [statements],
    needs: () => [{ scope: 'drive.file', label: BOOKS_STEP.label }],
    undo: async () => {},
    findDriveFile: async () => {},
    exportControl: {},
  }),
}

/** Each group's steps of the last run, by app, as `[step, state]`. */
function stepsOf(sync: PageSync): Record<string, [string, string][]> {
  return Object.fromEntries((sync.run.value?.groups ?? []).map((group) => [group.app, group.steps.map((planned) => [planned.id, planned.state.kind])]))
}

/** Another device leaves the file as something no Kuna app reads, so its next read fails. */
function breakFile(fileId: string): void {
  fakeDriveSession().editOutside(fileId, 'not a Kuna file')
}

let sync: PageSync

beforeAll(async () => {
  vi.stubEnv('VITE_FAKE_WORKBOOK', 'true')
  await seedFakeWorkbook(null, () => null)
  await seedFakeLoans('drive')
  sync = startPageSync([companyApp, loansApp])
  await Promise.all([useWorkbook().open(), useLoansBooks().open()])
})

beforeEach(() => {
  statements.runs = 0
})

// One fake Drive holds both files, as it does for a page of the fake build, so each case builds on the one before.
describe('one sync over the company file and the Loans file on the fake Drive', () => {
  it('reads both files, the company group first', async () => {
    await sync.sync()

    expect(stepsOf(sync)).toEqual({
      company: [
        ['books', 'done'],
        ['statements', 'done'],
      ],
      loans: [['books', 'done']],
    })
    expect(statements.runs).toBe(1)
  })

  it("skips only the company's steps when the company file cannot be read", async () => {
    const companyFile = useWorkbook().state.choice!.id
    const good = await fakeDriveSession().download(companyFile)
    breakFile(companyFile)

    await sync.sync()

    expect(stepsOf(sync)).toEqual({
      company: [
        ['books', 'failed'],
        ['statements', 'skipped'],
      ],
      loans: [['books', 'done']],
    })
    expect(statements.runs).toBe(0)
    expect(sync.control.value).toMatchObject({ kind: 'problems', count: 1 })
    fakeDriveSession().editOutside(companyFile, good)
  })

  it("runs the company's steps when only the Loans file cannot be read", async () => {
    const loansFile = useLoansBooks().state.choice!.id
    breakFile(loansFile)

    await sync.sync()

    expect(stepsOf(sync)).toEqual({
      company: [
        ['books', 'done'],
        ['statements', 'done'],
      ],
      loans: [['books', 'failed']],
    })
    expect(statements.runs).toBe(1)
  })
})
