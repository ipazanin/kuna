import { describe, expect, it } from 'vitest'
import type { Label } from '../src/shared/categorising/domain/labels'

import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { spanBreakdown } from '../src/apps/spending/analytics/domain/spanBreakdown'
import type { Grouping } from '../src/apps/spending/analytics/domain/spanBreakdown'
import { LABEL_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, REVOLUT_EUR, REVOLUT_USD, category, row, wholeItems } from './fixtures/spending'

const TRIP: Label = { id: recordIdOf(LABEL_RECORDS, 'trip'), name: 'Trip' }
const WORK: Label = { id: recordIdOf(LABEL_RECORDS, 'work'), name: 'Work' }

const labelled = (entry: Transaction, ...labels: Label[]): TransactionItem => ({ ...wholeItems([entry])[0]!, labels: labels.map((label) => label.id) })

// The dollar dinner on 20 August is before the first rate of 1 September, so it counts as nothing and once as unrated.
const september = row(OTP, '2026-09-12', -100, 'Food/Groceries', { payee: 'Corner market' })
const refund = row(OTP, '2026-10-02', 20, 'Food/Groceries', { payee: 'Corner market' })
const october = row(OTP, '2026-10-12', -60, 'Food/Eating out', { payee: 'Harbour bistro' })
const salary = row(OTP, '2026-10-10', 2_000, 'Income/Salary', { payee: 'Example Studio' })
const topUp = row(OTP, '2026-10-03', -200, 'Between my accounts', { payee: 'Top-up' })
const arrived = row(REVOLUT_EUR, '2026-10-03', 200, 'Between my accounts', { payee: 'Top-up' })
const unreached = row(REVOLUT_USD, '2026-08-20', -30, 'Food/Eating out', { payee: 'Diner' })
const november = row(OTP, '2026-11-02', -50, 'Food/Groceries', { payee: 'Corner market' })

const transactions = [unreached, september, refund, topUp, arrived, salary, october, november]
const items = [...wholeItems([unreached, september, refund, topUp, arrived, salary]), labelled(october, TRIP, WORK), ...wholeItems([november])]
const rows = countedRows({ accounts: ACCOUNTS, transactions, items }, RATES)
const book = { categories: CATEGORIES, labels: [TRIP, WORK], accounts: ACCOUNTS }

const SEPTEMBER_TO_OCTOBER = { from: civil('2026-09-01'), to: civil('2026-10-31') }
const breakdown = (grouping: Grouping, range = SEPTEMBER_TO_OCTOBER) => spanBreakdown(rows, book, range, grouping)

describe("a span's breakdown", () => {
  it('counts a span across two months and leaves the month after out', () => {
    const { total } = breakdown('category')

    // 100 in September, less the 20 refund, and 60 in October. November's 50 is after the span.
    expect([total.spent, total.income, total.saved]).toEqual([euros(140), euros(2_000), euros(0)])
  })

  it('puts each group of categories first by what it spent, with its children under it', () => {
    const lines = breakdown('category').lines.map((line) => [line.name, line.spent, line.income, line.rows, line.children.map((child) => [child.name, child.spent])])

    expect(lines).toEqual([
      [
        'Food',
        euros(140),
        euros(0),
        3,
        [
          ['Groceries', euros(80)],
          ['Eating out', euros(60)],
        ],
      ],
      ['Income', euros(0), euros(2_000), 1, [['Salary', euros(0)]]],
      ['Between my accounts', euros(0), euros(0), 2, []],
    ])
  })

  it("nets a payee's refund against what you paid them", () => {
    const market = breakdown('payee').lines.find((line) => line.name === 'Corner market')!

    expect([market.key, market.spent, market.rows]).toEqual(['CORNER MARKET', euros(80), 2])
  })

  it('counts a part with two labels on both lines', () => {
    expect(breakdown('label').lines.map((line) => [line.name, line.spent])).toEqual([
      ['Trip', euros(60)],
      ['Work', euros(60)],
    ])
  })

  it('counts a row the rates do not reach as nothing, once among the unrated', () => {
    const august = { from: civil('2026-08-01'), to: civil('2026-09-30') }
    const food = breakdown('category', august).lines.find((line) => line.key === category('Food').id)!

    expect([food.spent, food.rows, food.unrated]).toEqual([euros(100), 2, 1])
    expect(breakdown('category', august).total.unrated).toBe(1)
  })

  it("lists a transfer among each account's rows and counts it nowhere, so the accounts add up to the span", () => {
    const lines = breakdown('account').lines.map((line) => [line.name, line.spent, line.income, line.rows])

    expect(lines).toEqual([
      ['OTP current', euros(140), euros(2_000), 5],
      ['Revolut EUR', euros(0), euros(0), 1],
    ])
  })
})
