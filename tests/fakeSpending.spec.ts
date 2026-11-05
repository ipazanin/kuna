import { describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures'
import { revolutStatement } from '../src/apps/spending/statements/domain/revolutStatement'
import { reviewCount, reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import { SAMPLE_REVOLUT_FILE_NAME, sampleRefusedCsv, sampleRevolutCsv } from '../src/apps/spending/statements/infrastructure/fake/sampleRevolutFiles'
import { readFirstSheet } from '../src/shared/xlsx/sheetGrids'
import { fakeSpendingDocument, fakeStarterDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import type { FakeSpendingSet } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { monthOf } from '../src/shared/calendar/monthKey'
import { NO_RATES } from '../src/shared/money/rateBook'
import { civil, euros } from './fixtures/ledger'

const SAVED_AT = '2026-11-04T09:00:00.000Z'

function bookOf(document: WorkbookDocument) {
  return SPENDING_DOCUMENT.read({
    meta: { id: 'fake', source: 'browser', title: 'kuna-spending.json', syncedAt: SAVED_AT, lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document,
  }).workbook
}

const SETS: readonly FakeSpendingSet[] = ['sample', 'foreign', 'over', 'statements']

describe("the fake build's Spending sets", () => {
  it.each(SETS.flatMap((set) => ['2026-11-04', '2026-12-01', '2027-03-31'].map((day) => [set, day] as const)))('read the %s set on %s with no problems', (set, day) => {
    expect(bookOf(fakeSpendingDocument(SAVED_AT, set, civil(day))).problems).toEqual([])
  })

  it("leave the sample's four accounts on the day with the worked example's balances, whatever the day", () => {
    for (const day of [civil('2026-11-04'), civil('2026-12-01')]) {
      const book = bookOf(fakeSpendingDocument(SAVED_AT, 'sample', day))

      expect(book.accounts.map((account) => [account.name, accountBalance(account, book.transactions, day)])).toEqual([
        ['OTP current', euros(1_850)],
        ['Revolut EUR', euros(320.5)],
        ['Revolut USD', euros(170)],
        ['Cash', euros(64)],
      ])
    }
  })

  it("carry Food's limit as the worked example does, −€30.00 into the day's month, in the sample", () => {
    const day = civil('2026-11-04')
    const book = bookOf(fakeSpendingDocument(SAVED_AT, 'sample', day))

    expect(spendingFigures(book, NO_RATES).limitsIn(monthOf(day))).toMatchObject([{ limit: euros(400), carriedIn: euros(-30), available: euros(370) }])
  })

  it('overspend both limits of the over set in the month before the day', () => {
    const book = bookOf(fakeSpendingDocument(SAVED_AT, 'over', civil('2026-11-04')))

    expect(
      spendingFigures(book, NO_RATES)
        .limitsIn(monthOf(civil('2026-10-04')))
        .map((limit) => limit.left < 0),
    ).toEqual([true, true])
  })

  it.each(['2026-11-04', '2026-12-01', '2027-03-31'])('wait in the statements set with five rows, a pair, two lone legs and offers on %s', (day) => {
    const book = bookOf(fakeSpendingDocument(SAVED_AT, 'statements', civil(day)))
    const queue = reviewQueue(book, civil(day))

    expect(reviewCount(book)).toBe(5)
    expect(queue.pairs).toHaveLength(1)
    expect(queue.loneLegs).toHaveLength(2)
    expect(queue.wantingSavings).toBe(1)
    expect(queue.waiting.filter((waiting) => waiting.maybeTyped !== null).map((waiting) => waiting.row.payee)).toEqual(['Old Town Bookshop'])
    expect(queue.waiting.filter((waiting) => waiting.maybeTransfer !== null).map((waiting) => waiting.row.payee)).toEqual(['Top-up by card', 'Card top-up'])
  })

  it.each(['2026-11-04', '2026-12-01', '2027-03-31'])("read the sample Revolut export through the csv path as the statements set's dry run on %s", async (day) => {
    const book = bookOf(fakeSpendingDocument(SAVED_AT, 'statements', civil(day)))
    const reading = revolutStatement(await readFirstSheet(sampleRevolutCsv(civil(day))), SAMPLE_REVOLUT_FILE_NAME, book)
    if (!('statement' in reading)) throw new Error(reading.refusal)

    const run = statementDryRun(book, reading.statement, civil(day))

    expect(reading.statement.notes).toEqual([
      '1 pending row left out. It comes with the next export.',
      '1 reverted or declined row left out.',
      '2 savings rows left out, since no Revolut savings account keeps EUR.',
    ])
    expect(run).toMatchObject({ newRows: 8, alreadyIn: 1, filled: 1 })
    expect(run.notes).toContain('1 pocket move counts as a transfer and waits for a Revolut savings account.')
    expect(run.added.map((row) => row.payee)).toEqual([
      'Top-up from OTP',
      'Fuel station abroad',
      'Revolut',
      'Corner market',
      'Exchanged to USD',
      'Exchanged from EUR',
      'Pocket Summer trip',
      'Unknown shop',
    ])
  })

  it('refuse the sample export without its Fee column', async () => {
    const book = bookOf(fakeSpendingDocument(SAVED_AT, 'statements', civil('2026-11-04')))

    expect(revolutStatement(await readFirstSheet(sampleRefusedCsv(civil('2026-11-04'))), SAMPLE_REVOLUT_FILE_NAME, book)).toEqual({ refusal: 'The file has no Fee column' })
  })

  it('hold only the dollar account and its row in the foreign set', () => {
    const book = bookOf(fakeSpendingDocument(SAVED_AT, 'foreign', civil('2026-11-04')))

    expect(book.accounts.map((account) => account.currency)).toEqual(['USD'])
    expect(book.transactions).toHaveLength(1)
    expect(book.budgets).toEqual([])
  })

  it('make a new file on the fake Drive with the starter categories alone', () => {
    const book = bookOf(fakeStarterDocument(SAVED_AT))

    expect([book.problems, book.accounts, book.transactions, book.budgets]).toEqual([[], [], [], []])
    expect(book.categories).toHaveLength(59)
  })
})
