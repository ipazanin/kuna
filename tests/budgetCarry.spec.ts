import { describe, expect, it } from 'vitest'

import { budgetMonths, leftToSpend, limitRuns, limitsUnrated } from '../src/apps/spending/budgets/domain/budgetCarry'
import type { CategoryMonth } from '../src/apps/spending/budgets/domain/budgetCarry'
import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures'
import type { Budget } from '../src/apps/spending/workbook/domain/budget'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { ZERO } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import { euros, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, REVOLUT_USD, ROWS, budget, category, row } from './fixtures/spending'
import { NO_RATES } from '../src/shared/money/rateBook'

const FOOD = category('Food').id

/** Each month's spending of Food, as the table gives it, and nothing in any other month or category. */
function spent(table: Readonly<Record<string, number>>): (category: RecordId, month: MonthKey) => CategoryMonth {
  return (limited, month) => ({ spent: limited === FOOD && table[month] !== undefined ? euros(table[month]) : ZERO, unrated: 0 })
}

/** Each figure of the category's month, or null when it has no limit that month. */
function monthOf(budgets: readonly Budget[], table: Readonly<Record<string, number>>, asked: string) {
  const found = budgetMonths(budgets, spent(table), month(asked)).find((entry) => entry.category === FOOD)
  return found === undefined ? null : { limit: found.limit, carriedIn: found.carriedIn, available: found.available, spent: found.spent, left: found.left }
}

function figures(limit: number, carriedIn: number, available: number, spentSoFar: number, left: number) {
  return { limit: euros(limit), carriedIn: euros(carriedIn), available: euros(available), spent: euros(spentSoFar), left: euros(left) }
}

describe('a limit with carry-over', () => {
  const food = [budget(1, 'Food', '2026-09', 400)]
  const worked = { '2026-09': 350, '2026-10': 480, '2026-11': 48.8 }

  it("carries the worked example's three months: +€50.00 out of September, −€30.00 out of October, and €370.00 available in November", () => {
    expect(monthOf(food, worked, '2026-09')).toEqual(figures(400, 0, 400, 350, 50))
    expect(monthOf(food, worked, '2026-10')).toEqual(figures(400, 50, 450, 480, -30))
    // 370.00 available less 48.80 spent so far.
    expect(monthOf(food, worked, '2026-11')).toEqual(figures(400, -30, 370, 48.8, 321.2))
  })

  it('has no limit before its first month', () => {
    expect(monthOf(food, worked, '2026-08')).toBeNull()
  })

  it('ends with a budget of zero, carries nothing past it, and starts a later budget from nothing', () => {
    const ended = [...food, budget(2, 'Food', '2026-11', 0), budget(3, 'Food', '2027-01', 300)]
    const table = { ...worked, '2026-11': 60, '2026-12': 75, '2027-01': 100 }

    expect(monthOf(ended, table, '2026-11')).toBeNull()
    expect(monthOf(ended, table, '2026-12')).toBeNull()
    expect(monthOf(ended, table, '2027-01')).toEqual(figures(300, 0, 300, 100, 200))
    expect(limitRuns(ended, FOOD)).toEqual([
      { from: '2026-09', until: '2026-11' },
      { from: '2027-01', until: null },
    ])
  })

  it('keeps the carry when a new amount starts from a month', () => {
    const raised = [...food, budget(2, 'Food', '2026-10', 500)]

    expect(monthOf(raised, worked, '2026-10')).toEqual(figures(500, 50, 550, 480, 70))
    // 50.00 + 500.00 − 480.00 carried into November, with its limit still 500.00.
    expect(monthOf(raised, worked, '2026-11')).toEqual(figures(500, 70, 570, 48.8, 521.2))
    expect(limitRuns(raised, FOOD)).toEqual([{ from: '2026-09', until: null }])
  })

  it('keeps a carry below zero until later months make it up', () => {
    const table = { '2026-09': 600, '2026-10': 300, '2026-11': 250 }

    expect(monthOf(food, table, '2026-10')).toEqual(figures(400, -200, 200, 300, -100))
    expect(monthOf(food, table, '2026-11')).toEqual(figures(400, -100, 300, 250, 50))
  })

  it('adds what is left of every limit of the month for the home card', () => {
    const months = budgetMonths(
      [...food, budget(2, 'Transport', '2026-10', 100)],
      (limited, asked) => (limited === FOOD ? spent(worked)(limited, asked) : { spent: euros(asked === '2026-10' ? 120 : 30), unrated: 0 }),
      month('2026-11'),
    )

    // Food 370.00 − 48.80 = 321.20, and Transport 100.00 − 20.00 carried in − 30.00 = 50.00.
    expect(leftToSpend(months)).toEqual(euros(371.2))
  })
})

describe('what a limit counts as spent', () => {
  function spentOn(budgets: readonly Budget[], path: string, rows = ROWS): Money | undefined {
    return spendingFigures({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: rows, budgets, items: [] }, RATES)
      .limitsIn(month('2026-10'))
      .find((entry) => entry.category === category(path).id)?.spent
  }

  it("counts a group's children with it: October's groceries, restaurants and coffee on Food", () => {
    // 350.00 + 90.00 + 36.00.
    expect(spentOn([budget(1, 'Food', '2026-10', 400)], 'Food')).toEqual(euros(476))
  })

  it('counts a child alone, without its siblings', () => {
    expect(spentOn([budget(1, 'Food/Restaurants', '2026-10', 150)], 'Food/Restaurants')).toEqual(euros(90))
  })

  it('takes a refund off what was spent', () => {
    const refund = row(OTP, '2026-10-18', 20, 'Food/Groceries', { payee: 'Corner market' })

    expect(spentOn([budget(1, 'Food', '2026-10', 400)], 'Food', [...ROWS, refund])).toEqual(euros(456))
  })

  it('counts a dollar row in euros at its own day’s rate', () => {
    expect(spentOn([budget(1, 'Travel', '2026-10', 50)], 'Travel')).toEqual(euros(27.78))
  })
})

describe('the rows a limit counts as nothing', () => {
  const hotel = row(REVOLUT_USD, '2026-10-20', -400, 'Travel/Accommodation', { payee: 'Hotel' })
  const book = { accounts: ACCOUNTS, categories: CATEGORIES, transactions: [...ROWS, hotel], budgets: [budget(1, 'Travel', '2026-10', 500)], items: [] }

  it('says a dollar row the rates do not reach counts as nothing in its month, and in the months its carry reaches', () => {
    const figures = spendingFigures(book, NO_RATES)
    const [october] = figures.limitsIn(month('2026-10'))
    const [november] = figures.limitsIn(month('2026-11'))

    // The $30.00 diner and the $400.00 hotel both sit on Travel in October, and neither is in euros.
    expect([october!.spent, october!.unrated, october!.unratedCarried]).toEqual([euros(0), 2, 0])
    expect([november!.unrated, november!.unratedCarried]).toEqual([0, 2])
    expect(limitsUnrated([october!])).toBe(2)
  })

  it('counts every row once the rates reach them', () => {
    expect(limitsUnrated(spendingFigures(book, RATES).limitsIn(month('2026-11')))).toBe(0)
  })
})
