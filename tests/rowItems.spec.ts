import { describe, expect, it } from 'vitest'

import { rowSide } from '../src/apps/spending/categories/domain/rowSide'
import { euroRows } from '../src/apps/spending/rates/domain/euroRows'
import { isSplit, rowItemsOf, waitsOnReview, wholeRowItemId } from '../src/apps/spending/workbook/domain/rowItems'
import { ITEM_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_RATES } from '../src/shared/money/rateBook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { ACCOUNTS, CATEGORIES, OTP, category, row } from './fixtures/spending'

const groceries = category('Food/Groceries')

describe("a Spending row's items", () => {
  it('reads a row the file holds no items of as one item of its whole amount under its category, with no words', () => {
    const bakery = row(OTP, '2026-10-12', -6.5, 'Food/Groceries')
    expect(rowItemsOf({ items: [] })(bakery)).toEqual([{ id: wholeRowItemId(bakery), transaction: bakery.id, receipt: null, printed: '', text: '', amount: bakery.amount, category: groceries.id }])
  })

  it('reads the items the file holds for a split row, and a row waiting on review as one item with no category', () => {
    const market = row(OTP, '2026-10-12', -30, 'Food/Groceries')
    const waiting = row(OTP, '2026-10-13', -12, null)
    const parts: TransactionItem[] = [
      { id: recordIdOf(ITEM_RECORDS, 'part-a'), transaction: market.id, receipt: null, printed: '', text: 'Bread', amount: accountMoneyFromAmount(-20), category: groceries.id },
      { id: recordIdOf(ITEM_RECORDS, 'part-b'), transaction: market.id, receipt: null, printed: '', text: '', amount: accountMoneyFromAmount(-10), category: category('Personal').id },
    ]
    const itemsOf = rowItemsOf({ items: parts })
    expect(itemsOf(market)).toEqual(parts)
    expect(isSplit(itemsOf(market))).toBe(true)
    expect(isSplit(itemsOf(waiting))).toBe(false)
    expect(waitsOnReview(itemsOf(waiting))).toBe(true)
    expect(waitsOnReview(itemsOf(market))).toBe(false)
  })

  it('counts a row of one item at its whole euros, the same as the row', () => {
    const bakery = row(OTP, '2026-10-12', -6.5, 'Food/Groceries')
    const [euroRow] = euroRows({ accounts: ACCOUNTS, transactions: [bakery], items: [] }, NO_RATES)
    expect(rowSide(euroRow!, new Map(CATEGORIES.map((held) => [held.id, held])))).toEqual([{ category: groceries, side: 'spending', counted: moneyFromAmount(6.5) }])
  })
})
