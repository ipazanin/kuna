// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IBKR_FLEX_RECIPE } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { MAIL_READING_DATABASE_PREFIX } from '../src/apps/investments/mail/infrastructure/mailReadingCache'
import { mailReportStep } from '../src/apps/investments/mail/presentation/useMailReports'
import { MAIL_READER_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordWrites } from '../src/shared/storage/presentation/useRecordWrites'
import { account, book } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const shown = vi.hoisted(() => ({ books: null as unknown, searches: [] as string[] }))

vi.mock('../src/apps/investments/workbook/application/investmentsStore', () => ({ useInvestmentsBooks: () => shown.books }))
vi.mock('../src/apps/investments/holdings/presentation/usePortfolio', () => ({ usePortfolio: () => ({ sources: { value: null } }) }))
vi.mock('../src/apps/investments/prices/presentation/usePrices', () => ({ usePrices: () => ({ fetchRates: async () => {} }) }))
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

const BOOKS_ID = 'local-under-test'

afterEach(async () => {
  shown.searches.length = 0
  await Dexie.delete(`${MAIL_READING_DATABASE_PREFIX}${BOOKS_ID}`)
})

/** Investments books kept in this browser, whose broker account takes IBKR's mailed report from 1 June 2026, with the reader on. */
function browserBooks() {
  const mailed = book({
    accounts: [account('broker', 'Broker', [{ source: 'mail', from: civil('2026-06-01') }])],
    mailReaders: [{ id: recordIdOf(MAIL_READER_RECORDS, 'ibkr'), recipe: IBKR_FLEX_RECIPE.id, on: true, senders: ['reports@broker.example.com'], subject: '', contents: '', since: null, leftOut: [] }],
  })
  return { state: { choice: { source: 'browser', id: BOOKS_ID, name: 'Investments' }, workbook: { book: mailed }, writes: [] } }
}

/** The step only writes to stop the mail, which this spec never does. */
const NO_WRITES = {} satisfies Partial<RecordWrites>

describe("Investments' report mail step, for books kept in this browser", () => {
  it("searches IBKR's mail and keeps the reading under the books' own id", async () => {
    shown.books = browserBooks()
    const step = mailReportStep(NO_WRITES as RecordWrites)

    const result = await step.run(() => {}, '2026-11-28T08:00:00.000Z', 'due')

    expect(shown.searches).toHaveLength(1)
    expect(shown.searches[0]).toContain('reports@broker.example.com')
    expect(result.kind).toBe('done')
    expect(await Dexie.getDatabaseNames()).toContain(`${MAIL_READING_DATABASE_PREFIX}${BOOKS_ID}`)
    expect(step.needsNoDrive).toBe(true)
  })
})
