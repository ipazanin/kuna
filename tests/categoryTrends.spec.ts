import { describe, expect, it } from 'vitest'

import { categoryTrends, trendOf, TREND_FLOOR } from '../src/apps/spending/analytics/domain/categoryTrends'
import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { monthTotals } from '../src/apps/spending/analytics/domain/monthTotals'
import { addMonths } from '../src/shared/calendar/monthKey'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { negateMoney, subtractMoney } from '../src/shared/money/money'
import { NO_RATES } from '../src/shared/money/rateBook'
import { shareFromRatio as share } from '../src/shared/money/percent'
import { civil, euros, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, category, row, wholeItems } from './fixtures/spending'

const DAY = civil('2026-11-10')

/** One row a month under the category for each amount, the last in October 2026. */
function monthly(path: string, amounts: readonly number[]) {
  return amounts.map((amount, place) => row(OTP, `${addMonths(month('2026-11'), place - amounts.length)}-05`, -amount, path))
}

function trendsOf(transactions: ReturnType<typeof monthly>) {
  const rows = countedRows({ sharedCosts: [], accounts: ACCOUNTS, transactions, items: wholeItems(transactions) }, NO_RATES)
  return categoryTrends(
    (asked: MonthKey) => monthTotals(rows, CATEGORIES, asked),
    CATEGORIES,
    DAY,
    month(
      transactions
        .map((entry) => entry.date)
        .sort()[0]!
        .slice(0, 7),
    ),
  )
}

describe("a category's trend", () => {
  it('grows when the last three months average at least 10 percent and 25 EUR a month above the twelve before', () => {
    const groceries = trendsOf(monthly('Food/Groceries', [...Array(12).fill(250), 280, 280, 280])).find((trend) => trend.category.id === category('Food/Groceries').id)!

    expect([groceries.before, groceries.recent, groceries.change, groceries.trend]).toEqual([euros(250), euros(280), euros(30), 'growing'])
  })

  it('shrinks the same way, and a group counts its children', () => {
    const trends = trendsOf(monthly('Transport/Fuel', [...Array(12).fill(120), 80, 80, 80]))

    expect(trends.find((trend) => trend.category.id === category('Transport').id)?.trend).toBe('shrinking')
    expect(trends.find((trend) => trend.category.id === category('Food').id)).toBeUndefined()
  })

  it('stays steady below either floor', () => {
    // 10 percent of 400 is 40, so 30 more a month is steady. 20 more on 100 is 20 percent but under 25 EUR.
    expect(trendsOf(monthly('Food/Groceries', [...Array(12).fill(400), 430, 430, 430]))[0]!.trend).toBe('steady')
    expect(trendsOf(monthly('Food/Groceries', [...Array(12).fill(100), 120, 120, 120]))[0]!.trend).toBe('steady')
  })

  it('moves at each floor exactly', () => {
    expect(trendOf(TREND_FLOOR, share(0.1))).toBe('growing')
    expect(trendOf(negateMoney(TREND_FLOOR), share(-0.1))).toBe('shrinking')
    expect(trendOf(subtractMoney(TREND_FLOOR, euros(0.01)), share(0.5))).toBe('steady')
    expect(trendOf(TREND_FLOOR, share(0.0999))).toBe('steady')
    expect(trendOf(TREND_FLOOR, null)).toBe('growing')
  })

  it('shows none for a book with under six whole months', () => {
    expect(trendsOf(monthly('Food/Groceries', [100, 100, 100, 100, 500]))).toEqual([])
    expect(trendsOf(monthly('Food/Groceries', [100, 100, 100, 500, 500, 500])).length).toBeGreaterThan(0)
  })
})
