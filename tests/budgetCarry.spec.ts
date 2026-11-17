import { describe, expect, it } from 'vitest'

import { budgetMonths, leftToSpend, limitRuns, limitsUnrated, setAsideForYearly } from '../src/apps/spending/budgets/domain/budgetCarry'
import type { CategoryMonth } from '../src/apps/spending/budgets/domain/budgetCarry'
import { spendingFigures } from '../src/apps/spending/analytics/domain/spendingFigures'
import type { Budget } from '../src/apps/spending/workbook/domain/budget'
import { addMonths } from '../src/shared/calendar/monthKey'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { ZERO } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import { euros, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, REVOLUT_USD, ROWS, budget, category, row, bookItems } from './fixtures/spending'
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
    return spendingFigures({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: rows, budgets, items: bookItems(rows) }, RATES)
      .limitsIn(month('2026-10'))
      .find((entry) => entry.category === category(path).id)?.spent
  }

  it("counts a group's children with it: October's groceries, a dinner out and coffee on Food", () => {
    // 350.00 + 90.00 + 36.00.
    expect(spentOn([budget(1, 'Food', '2026-10', 400)], 'Food')).toEqual(euros(476))
  })

  it('counts a child alone, without its siblings', () => {
    // 90.00 + 36.00, without the groceries.
    expect(spentOn([budget(1, 'Food/Eating out', '2026-10', 150)], 'Food/Eating out')).toEqual(euros(126))
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
  const book = { accounts: ACCOUNTS, categories: CATEGORIES, transactions: [...ROWS, hotel], budgets: [budget(1, 'Travel', '2026-10', 500)], items: bookItems([...ROWS, hotel]) }

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

describe('a yearly cost', () => {
  const insurance = (amount = 600): Budget => ({ ...budget(1, 'Food', '2026-12', amount), due: month('2027-06') })

  /** What the cost sets aside in each month from December to the month asked, as the carry gives it. */
  function setAside(budgets: readonly Budget[], table: Readonly<Record<string, number>>, until: string): Money[] {
    const months: Money[] = []
    for (let at = month('2026-12'); at <= month(until); at = addMonths(at, 1)) months.push(budgetMonths(budgets, spent(table), at).find((entry) => entry.category === FOOD)!.limit)
    return months
  }

  it('catches up from a start seven months before it is due, so June holds exactly €600.00', () => {
    // €600.00 over December to June is €85.71 a month, each month spreading what is still missing over the months left.
    expect(setAside([insurance()], {}, '2027-06')).toEqual([85.71, 85.72, 85.71, 85.72, 85.71, 85.72, 85.71].map(euros))
    expect(monthOf([insurance()], {}, '2027-06')?.available).toBe(euros(600))
  })

  it('leaves €0.00 after a €600.00 payment in June and sets aside a twelfth from July, the next due month a year on', () => {
    const paid = { '2027-06': 600 }

    expect(monthOf([insurance()], paid, '2027-06')?.left).toBe(ZERO)
    expect(monthOf([insurance()], paid, '2027-07')).toEqual(figures(50, 0, 50, 0, 50))
    expect(budgetMonths([insurance()], spent(paid), month('2027-07'))[0]?.yearly).toEqual({ amount: euros(600), due: '2028-06', paidEarly: false })
  })

  it('carries a €650.00 payment €50.00 short into July, which the next twelve months make up', () => {
    const july = monthOf([insurance()], { '2027-06': 650 }, '2027-07')

    // €650.00 missing over July to June is €54.17 a month.
    expect(july).toEqual(figures(54.17, -50, 4.17, 0, 4.17))
  })

  it('spreads only what is missing when the cost rises in March', () => {
    const raised = [insurance(), { ...budget(2, 'Food', '2027-03', 660), due: month('2027-06') }]

    // December to February set aside €257.14, so March to June spread the €402.86 still missing of €660.00.
    expect(setAside(raised, {}, '2027-06').slice(3)).toEqual([100.72, 100.71, 100.72, 100.71].map(euros))
    expect(monthOf(raised, {}, '2027-06')?.available).toBe(euros(660))
  })

  it('leaves its money out of what is left to spend, and gives it as set aside', () => {
    const budgets = [insurance(), budget(2, 'Food/Groceries', '2026-12', 300)]
    const months = budgetMonths(budgets, () => ({ spent: ZERO, unrated: 0 }), month('2026-12'))

    expect(leftToSpend(months)).toBe(euros(300))
    expect(setAsideForYearly(months)).toBe(euros(85.71))
  })

  it('starts a new run when a monthly limit becomes a yearly cost, so nothing carries between them', () => {
    const switched = [budget(1, 'Food', '2026-09', 400), { ...budget(2, 'Food', '2026-12', 600), due: month('2027-06') }]

    expect(limitRuns(switched, FOOD)).toEqual([
      { from: '2026-09', until: '2026-12' },
      { from: '2026-12', until: null },
    ])
    expect(monthOf(switched, { '2026-09': 100 }, '2026-12')?.carriedIn).toBe(ZERO)
  })

  it('keeps a monthly limit without a yearly key, as it read before yearly costs', () => {
    expect(budgetMonths([budget(1, 'Food', '2026-09', 400)], spent({}), month('2026-09'))[0]).not.toHaveProperty('yearly')
  })
})

describe('a yearly cost paid before or after its due month', () => {
  const insurance: Budget = { ...budget(1, 'Food', '2025-11', 360), due: month('2026-10') }

  function yearlyOf(table: Readonly<Record<string, number>>, asked: string) {
    return budgetMonths([insurance], spent(table), month(asked)).find((entry) => entry.category === FOOD)?.yearly
  }

  it('counts a payment in late September as the year paid from the money set aside, sets nothing aside in October, and starts the twelfths again in November', () => {
    const paid = { '2026-09': 360 }

    // November to August set aside €300.00, so September sets aside the €60.00 the year still lacks.
    expect(monthOf([insurance], paid, '2026-09')).toEqual(figures(60, 300, 360, 360, 0))
    expect(yearlyOf(paid, '2026-09')).toEqual({ amount: euros(360), due: '2026-10', paidEarly: true })
    expect(monthOf([insurance], paid, '2026-10')).toEqual(figures(0, 0, 0, 0, 0))
    expect(yearlyOf(paid, '2026-10')).toEqual({ amount: euros(360), due: '2027-10', paidEarly: false })
    expect(setAsideForYearly(budgetMonths([insurance], spent(paid), month('2026-10')))).toBe(ZERO)
    expect(monthOf([insurance], paid, '2026-11')).toEqual(figures(30, 0, 30, 0, 30))
  })

  it('counts a payment two months early, in August, as the year paid, and sets nothing aside in September or October', () => {
    const paid = { '2026-08': 360 }

    // November to July set aside €270.00, so August sets aside the €90.00 the year still lacks.
    expect(monthOf([insurance], paid, '2026-08')).toEqual(figures(90, 270, 360, 360, 0))
    expect(yearlyOf(paid, '2026-08')?.paidEarly).toBe(true)
    expect(monthOf([insurance], paid, '2026-09')).toEqual(figures(0, 0, 0, 0, 0))
    expect(monthOf([insurance], paid, '2026-10')).toEqual(figures(0, 0, 0, 0, 0))
    expect(monthOf([insurance], paid, '2026-11')).toEqual(figures(30, 0, 30, 0, 30))
  })

  it('keeps a payment three months early, in July, as an overspent month, which August to October make up so October holds €360.00 again', () => {
    const paid = { '2026-07': 360 }

    expect(monthOf([insurance], paid, '2026-07')).toEqual(figures(30, 240, 270, 360, -90))
    expect(yearlyOf(paid, '2026-07')?.paidEarly).toBe(false)
    // €450.00 missing over August to October is €150.00 a month.
    expect(monthOf([insurance], paid, '2026-10')).toEqual(figures(150, 210, 360, 0, 360))
    expect(monthOf([insurance], paid, '2026-11')).toEqual(figures(0, 360, 360, 0, 360))
  })

  it('keeps a purchase in September that fits in what is set aside as spending, which October makes up', () => {
    const bought = { '2026-09': 20 }

    expect(yearlyOf(bought, '2026-09')?.paidEarly).toBe(false)
    expect(monthOf([insurance], bought, '2026-10')).toEqual(figures(50, 310, 360, 0, 360))
  })

  it('pays a late payment in November from what October held, and spreads the next year over December to October', () => {
    const paid = { '2026-11': 360 }

    expect(monthOf([insurance], paid, '2026-10')).toEqual(figures(30, 330, 360, 0, 360))
    expect(monthOf([insurance], paid, '2026-11')).toEqual(figures(0, 360, 360, 360, 0))
    expect(yearlyOf(paid, '2026-11')).toEqual({ amount: euros(360), due: '2027-10', paidEarly: false })
    // €360.00 over the eleven months December to October is €32.73 a month.
    expect(monthOf([insurance], paid, '2026-12')).toEqual(figures(32.73, 0, 32.73, 0, 32.73))
  })
})
