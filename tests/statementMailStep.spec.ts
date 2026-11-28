// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { statementMailStep } from '../src/apps/company/mail/presentation/useMailSync'
import { useRecordWrites } from '../src/shared/storage/presentation/useRecordWrites'
import { browserHarness, driveHarness, forgetCaches, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'

const shown = vi.hoisted(() => ({ store: null as unknown, searches: [] as string[] }))

vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => {} }) }))
vi.mock('../src/apps/company/workbook/application/workbookStore', () => ({ useWorkbook: () => shown.store }))
vi.mock('../src/shared/google/googleAuth', async (importOriginal) => ({ ...(await importOriginal<object>()), currentToken: () => 'token' }))
vi.mock('../src/shared/mail/infrastructure/gmailMailbox', () => ({
  gmailMailbox: () => ({
    search: async (query: string) => {
      shown.searches.push(query)
      return { ids: [], next: null }
    },
    message: async () => {
      throw new Error('The search found no mail to read.')
    },
    attachment: async () => {
      throw new Error('The search found no mail to read.')
    },
  }),
}))

const used = new Set<string>()

afterEach(async () => {
  shown.searches.length = 0
  await forgetCaches(used)
})

/** The harness's books with the main account taking the bank's statement mail from 1 June 2026, and the bank's sender named. */
function mailedGrids(): Record<string, CellValue[][]> {
  const grids = workbookGrids()
  return {
    ...grids,
    accounts: [
      ['account', 'iban', 'rows_from', 'starts_on'],
      ['main', 'XX00FAKE0000000001', 'mail', 46174],
    ],
    settings: [...grids.settings!, ['statements_mail_from', 'statements@bank.example.com'], ['statements_mail_subject', 'Izvadak']],
  }
}

describe.each([
  ['a file on Drive', driveHarness],
  ['books kept in this browser', browserHarness],
] as const)('the statement mail step, for %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it("searches the bank's statement mail", async () => {
    const { store } = await harnessOf(used, mailedGrids())
    shown.store = store
    const step = statementMailStep(useRecordWrites(store))

    const result = await step.run(() => {}, '2026-11-28T08:00:00.000Z', 'due')

    expect(shown.searches).toHaveLength(1)
    expect(shown.searches[0]).toContain('statements@bank.example.com')
    expect(result.kind).toBe('done')
    expect(step.needsNoDrive).toBe(true)
  })
})
