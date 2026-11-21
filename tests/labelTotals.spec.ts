import { describe, expect, it } from 'vitest'
import type { Label } from '../src/shared/categorising/domain/labels'

import { labelTotals } from '../src/apps/spending/labels/domain/labelTotals'
import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { ITEM_RECORDS, LABEL_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { RateBook } from '../src/shared/money/rateBook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, REVOLUT_USD, category, row, wholeItems } from './fixtures/spending'

const PRAGUE: Label = { id: recordIdOf(LABEL_RECORDS, 'prague'), name: 'Prague' }
const FLAT: Label = { id: recordIdOf(LABEL_RECORDS, 'flat'), name: 'New flat' }
const GARDEN: Label = { id: recordIdOf(LABEL_RECORDS, 'garden'), name: 'Garden' }

const labelled = (entry: Transaction, ...labels: Label[]): TransactionItem => ({ ...wholeItems([entry])[0]!, labels: labels.map((label) => label.id) })

// The hotel's 324 USD is 300 EUR at the 1.08 of 10 October, and the last day's 10.90 USD is 10 EUR at the 1.09 of 4 November.
const hotel = row(REVOLUT_USD, '2026-10-10', -324, 'Travel/Accommodation')
const dinners = row(OTP, '2026-10-12', -120, 'Food/Eating out')
const paidBack = row(OTP, '2026-10-14', 60, 'Food/Eating out')
const toRevolut = row(OTP, '2026-10-01', -500, 'Between my accounts')
const shop = row(OTP, '2026-10-30', -40, 'Food/Groceries')
const lastDay = row(REVOLUT_USD, '2026-11-04', -10.9, 'Travel/Trip activities')
const paint = row(OTP, '2026-10-05', -80, 'Home/Furniture and household goods')

const shopParts: readonly TransactionItem[] = [
  { ...wholeItems([shop])[0]!, amount: accountMoneyFromAmount(-30) },
  { ...wholeItems([shop])[0]!, id: recordIdOf(ITEM_RECORDS, 'shop-souvenir'), amount: accountMoneyFromAmount(-10), category: category('Travel/Trip activities').id, labels: [PRAGUE.id] },
]

const transactions = [toRevolut, paint, hotel, dinners, paidBack, shop, lastDay]
const items = [labelled(toRevolut, PRAGUE), labelled(paint, FLAT), labelled(hotel, PRAGUE), labelled(dinners, PRAGUE), labelled(paidBack, PRAGUE), ...shopParts, labelled(lastDay, PRAGUE)]

function totalsOf(rates: RateBook) {
  return labelTotals(countedRows({ accounts: ACCOUNTS, transactions, items }, rates), CATEGORIES, [PRAGUE, FLAT, GARDEN])
}

describe("a label's totals", () => {
  it('count as the month counts: a refund lowers its category, a transfer counts nowhere, and only the labelled part of a split row counts', () => {
    const prague = totalsOf(RATES).find((totals) => totals.label.id === PRAGUE.id)!

    // 300 hotel + 120 dinners - 60 paid back + 10 souvenir + 10 last day. The 500 sent to Revolut lists but counts nowhere.
    expect(prague.spent).toBe(euros(380))
    expect(prague.groups).toEqual([
      { group: category('Travel').id, spent: euros(320) },
      { group: category('Food').id, spent: euros(60) },
    ])
    expect([prague.income, prague.saved]).toEqual([euros(0), euros(0)])
    expect([prague.rows, prague.latest, prague.unrated]).toEqual([6, civil('2026-11-04'), 0])
  })

  it('come with a label no row carries first, then newest first by the day of its newest row', () => {
    expect(totalsOf(RATES).map((totals) => [totals.label.name, totals.rows])).toEqual([
      ['Garden', 0],
      ['Prague', 6],
      ['New flat', 1],
    ])
  })

  it('count a row whose day the rates do not reach as nothing, and say how many there are', () => {
    const prague = totalsOf(NO_RATES).find((totals) => totals.label.id === PRAGUE.id)!

    expect(prague.spent).toBe(euros(70))
    expect(prague.unrated).toBe(2)
  })
})
