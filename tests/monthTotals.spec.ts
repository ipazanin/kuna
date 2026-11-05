import { describe, expect, it } from 'vitest'

import { monthFlow } from '../src/apps/spending/analytics/domain/monthFlow'
import { categoryTotal, monthTotals } from '../src/apps/spending/analytics/domain/monthTotals'
import { euroRows } from '../src/apps/spending/rates/domain/euroRows'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { RateBook } from '../src/shared/money/rateBook'
import { euros, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, REVOLUT_EUR, REVOLUT_USD, ROWS, category, row, transactionId } from './fixtures/spending'

function totalsOf(rows: readonly Transaction[], asked: string, rates: RateBook = RATES) {
  return monthTotals(euroRows({ accounts: ACCOUNTS, transactions: rows }, rates), CATEGORIES, month(asked))
}

describe("a month's totals", () => {
  it("puts each of October's rows on its side: spending, income and saved, in euros", () => {
    const october = totalsOf(ROWS, '2026-10')

    // Spent: 600.00 rent + 27.78 for $30.00 + 350.00 + 90.00 + 650.00 + 36.00 + 89.50.
    expect([october.spent, october.income, october.saved, october.unrated]).toEqual([euros(1_843.28), euros(2_400), euros(300), 0])
  })

  it('counts each category on itself and each group with its children', () => {
    const october = totalsOf(ROWS, '2026-10')

    expect(october.byCategory.get(category('Food/Groceries').id)).toEqual(euros(350))
    expect(october.byCategory.get(category('Food').id)).toBeUndefined()
    // 350.00 + 90.00 + 36.00.
    expect(october.byGroup.get(category('Food').id)).toEqual(euros(476))
    expect(categoryTotal(october, category('Food'))).toEqual({ counted: euros(476), unrated: 0 })
    expect(categoryTotal(october, category('Food/Coffee'))).toEqual({ counted: euros(36), unrated: 0 })
    expect(categoryTotal(october, category('Health'))).toEqual({ counted: euros(0), unrated: 0 })
    expect(october.byGroup.get(category('Income').id)).toEqual(euros(2_400))
    expect(october.byGroup.get(category('Saved to investments').id)).toEqual(euros(300))
  })

  it('takes a refund off spending', () => {
    const october = totalsOf([...ROWS, row(OTP, '2026-10-18', 20, 'Food/Groceries')], '2026-10')

    expect([october.spent, october.byGroup.get(category('Food').id)]).toEqual([euros(1_823.28), euros(456)])
  })

  it('keeps a transfer, money for the company both ways and a row waiting on review out of every figure', () => {
    const [out, into] = [transactionId(11), transactionId(12)]
    const outside = [
      row(OTP, '2026-10-21', -500, 'Between my accounts', { id: out, pair: into }),
      row(REVOLUT_EUR, '2026-10-21', 500, 'Between my accounts', { id: into, pair: out }),
      row(REVOLUT_EUR, '2026-10-22', -45, 'For the company', { payee: 'Office supplies shop' }),
      row(OTP, '2026-10-28', 45, 'For the company', { payee: 'Example Studio d.o.o.' }),
      row(OTP, '2026-10-29', -12, null, { payee: 'Not yet sorted' }),
    ]
    const before = totalsOf(ROWS, '2026-10')
    const after = totalsOf([...ROWS, ...outside], '2026-10')

    expect(after).toEqual(before)
    expect(after.byGroup.has(category('Between my accounts').id)).toBe(false)
    expect(after.byGroup.has(category('For the company').id)).toBe(false)
  })

  it('counts only the rows of the month still filling, and none of the month before', () => {
    const november = totalsOf([...ROWS, row(OTP, '2026-11-01', -600, 'Home/Rent'), row(OTP, '2026-11-02', -45.3, 'Food/Groceries')], '2026-11')

    expect([november.spent, november.income, november.saved]).toEqual([euros(645.3), euros(0), euros(0)])
  })

  it('counts a dollar row the rates do not reach as unrated, and as nothing in the figures', () => {
    const october = totalsOf(ROWS, '2026-10', NO_RATES)

    // 1,843.28 less the 27.78 the dollar row would count.
    expect([october.spent, october.unrated]).toEqual([euros(1_815.5), 1])
    expect(october.byGroup.has(category('Travel').id)).toBe(false)
  })

  it('leaves an unrated dollar transfer out of the unrated count, since it counts nowhere anyway', () => {
    const toDollars = row(REVOLUT_USD, '2026-10-21', 100, 'Between my accounts')

    expect(totalsOf([...ROWS, toDollars], '2026-10', NO_RATES).unrated).toBe(1)
  })
})

describe("a month's income, spending and saved", () => {
  it('gives the savings rate, income less spending over income, and none without income', () => {
    const flows = monthFlow([totalsOf(ROWS, '2026-10'), totalsOf([row(OTP, '2026-11-01', -600, 'Home/Rent')], '2026-11')])

    expect(flows.map((flow) => [flow.month, flow.income, flow.spent, flow.saved])).toEqual([
      ['2026-10', euros(2_400), euros(1_843.28), euros(300)],
      ['2026-11', euros(0), euros(600), euros(0)],
    ])
    // (2,400.00 − 1,843.28) ÷ 2,400.00 = 0.23196…
    expect(flows[0]!.savingsRate).toBeCloseTo(0.23197, 5)
    expect(flows[1]!.savingsRate).toBeNull()
  })

  it('reads below zero for a month that spent more than came in', () => {
    const [flow] = monthFlow([totalsOf([row(OTP, '2026-10-10', 1_000, 'Income/Salary'), row(OTP, '2026-10-12', -1_250, 'Food/Groceries')], '2026-10')])

    expect(flow!.savingsRate).toBeCloseTo(-0.25, 5)
  })
})
