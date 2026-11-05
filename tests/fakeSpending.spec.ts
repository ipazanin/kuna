import { describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures'
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

const SETS: readonly FakeSpendingSet[] = ['sample', 'foreign', 'over']

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
