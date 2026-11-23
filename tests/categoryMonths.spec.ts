import { describe, expect, it } from 'vitest'

import { averageMonth, averagedMonths, firstWholeMonthOf } from '../src/apps/spending/analytics/domain/averageMonth'
import { categoryMonths } from '../src/apps/spending/analytics/domain/categoryMonths'
import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { monthTotals } from '../src/apps/spending/analytics/domain/monthTotals'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { NO_RATES } from '../src/shared/money/rateBook'
import { civil, euros, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, category, row, wholeItems } from './fixtures/spending'

/** Groceries of 100 in each month from November 2025 to October 2026 and 400 in October 2024, with 30 of eating out in March. */
const transactions = [
  row(OTP, '2024-10-05', -400, 'Food/Groceries'),
  ...Array.from({ length: 12 }, (_, place) => row(OTP, `${place < 2 ? 2025 : 2026}-${String(((place + 10) % 12) + 1).padStart(2, '0')}-05`, -100, 'Food/Groceries')),
  row(OTP, '2026-03-09', -30, 'Food/Eating out'),
  row(OTP, '2026-11-02', -25, 'Food/Groceries'),
]
const rows = countedRows({ sharedCosts: [], accounts: ACCOUNTS, transactions, items: wholeItems(transactions) }, NO_RATES)
const totalsOf = (asked: MonthKey) => monthTotals(rows, CATEGORIES, asked)

describe("a category's months", () => {
  it('count each month as Overview does, a group with its children', () => {
    expect(categoryMonths(totalsOf, category('Food'), [month('2026-02'), month('2026-03')]).map((counted) => counted.counted)).toEqual([euros(100), euros(130)])
    expect(categoryMonths(totalsOf, category('Food/Groceries'), [month('2026-03')])[0]!.counted).toEqual(euros(100))
  })

  it('count what was spent with no category', () => {
    expect(categoryMonths(totalsOf, null, [month('2026-03')])[0]!.counted).toEqual(euros(130))
  })
})

describe('an average month', () => {
  it("looks back over the last 12 whole months, leaving the day's month and anything older out", () => {
    const groceries = averageMonth(totalsOf, category('Food/Groceries'), civil('2026-11-10'), firstWholeMonthOf(rows))

    // Twelve months of 100. October 2024's 400 is thirteen months back and more, and November 2026's 25 is the month so far.
    expect(groceries.average).toEqual(euros(100))
    expect(groceries.months.map((counted) => counted.month)).toEqual(averagedMonths(civil('2026-11-10'), month('2024-10')))
    expect([groceries.thisMonth.counted, groceries.daysGone, groceries.daysInMonth]).toEqual([euros(25), 10, 30])
  })

  it('averages the whole months a younger book has', () => {
    expect(averagedMonths(civil('2026-11-10'), month('2026-08'))).toEqual([month('2026-08'), month('2026-09'), month('2026-10')])
    expect(averagedMonths(civil('2026-11-10'), month('2026-11'))).toEqual([])
    expect(averageMonth(totalsOf, null, civil('2026-11-10'), month('2026-11')).average).toBeNull()
  })

  it('leaves out the part month a book starts in', () => {
    expect(firstWholeMonthOf([{ day: civil('2026-08-14') }, { day: civil('2026-09-03') }])).toEqual(month('2026-09'))
    expect(firstWholeMonthOf([{ day: civil('2026-08-01') }])).toEqual(month('2026-08'))
    expect(firstWholeMonthOf([])).toBeNull()
  })

  it("takes the twelve months before the day's", () => {
    expect(averagedMonths(civil('2026-11-10'), month('2020-01'))).toEqual(
      Array.from({ length: 12 }, (_, place) => month(`${place < 2 ? 2025 : 2026}-${String(((place + 10) % 12) + 1).padStart(2, '0')}`)),
    )
  })
})
