import { describe, expect, it, vi } from 'vitest'

import type { Workbook } from '../src/apps/company/workbook/domain/workbook'
import { needsReview } from '../src/apps/company/workbook/domain/needsReview'
import { presentedWorkbook } from '../src/apps/company/transactions/domain/presentedWorkbook'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { words } from '../src/apps/company/home/presentation/words'
import { ID_FIELD } from '../src/shared/storage/domain/recordCodec'
import { plural } from '../src/shared/text/translation'

// The menu and the home card take the store's state once, as they load, so the test puts the books in that state.
const store = vi.hoisted(() => ({ state: { workbook: null as Workbook | null, choice: null, status: 'ready' } }))

vi.mock('../src/apps/company/workbook/application/workbookStore', () => ({ useWorkbook: () => store }))
// The specs run without the Vue compiler or Nuxt UI's app, which the sync group's export control and the toasts need.
vi.mock('../src/apps/company/workbook-files/presentation/LocalWorkbookStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => undefined }) }))

const { companyApp } = await import('../src/apps/company/app')
const { COMPANY_HOME_CARD } = await import('../src/apps/company/home/presentation/companyHomeCard')

const SYNCED = '2026-10-16T08:00:00.000Z'

/** The fake books with their first split row left to the AI, so it waits for review in two items. */
function booksWithWaitingSplitRow(): Workbook {
  const document = fakeWorkbookDocument(SYNCED, 'drive')
  const items = document.records.item ?? []
  const ledger = document.records['ledger-row'] ?? []
  const split = ledger.find((row) => items.filter((item) => item.row_id === row[ID_FIELD]).length === 2)
  if (split === undefined) throw new Error('The fake books hold no row split in two items.')
  const waiting = ledger.map((row) => (row === split ? { ...row, flagged_by: 'ai' } : row))
  return readDocument({ id: 'fake', source: 'drive', title: 'Fake workbook', syncedAt: SYNCED }, { ...document, records: { ...document.records, 'ledger-row': waiting } }).workbook
}

function menuCount(): number | undefined {
  const screen = companyApp.menu().find((candidate) => candidate.path === '/company/transactions')
  if (screen === undefined) throw new Error('The Company menu has no Transactions item.')
  return companyApp.menuCount!(screen)?.count
}

describe('a Company row split in two that waits for review', () => {
  it('counts once in the menu and on the home card, though the screens that count items show it twice', () => {
    const books = booksWithWaitingSplitRow()
    store.state.workbook = books

    // The fake books hold two rows that wait already. The split row is the third, and its two items would make it four.
    expect(presentedWorkbook(books).transactions.filter(needsReview)).toHaveLength(4)
    expect(menuCount()).toBe(3)
    expect(COMPANY_HOME_CARD.figures()).toMatchObject({ waiting: plural(words.toReview(3), 3) })
  })
})
