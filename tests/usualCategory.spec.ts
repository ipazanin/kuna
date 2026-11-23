import { describe, expect, it } from 'vitest'

import { payeeKey } from '../src/apps/spending/payees/domain/payeeKey'
import { usualCategories } from '../src/apps/spending/payees/domain/usualCategory'
import type { EntrySide } from '../src/apps/spending/payees/domain/usualCategory'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { ITEM_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { OTP, category, row, spendingBook, wholeItems } from './fixtures/spending'

let day = 0

/** A row the person filed, a day after the one before. */
function filed(payee: string, path: string, amount = -10, fields: Partial<StoredRow> = {}): StoredRow {
  day += 1
  return row(OTP, `2026-10-${String(day).padStart(2, '0')}`, amount, path, { payee, categorisedBy: 'person', ...fields })
}

function usualCategory(book: Pick<SpendingBook, 'transactions' | 'items' | 'payees'>, payee: string, side: EntrySide) {
  return usualCategories(book, side).get(payeeKey(payee)) ?? null
}

function usualOf(rows: readonly StoredRow[], side: EntrySide = 'out') {
  return usualCategory(spendingBook(rows), 'Corner market', side)
}

describe("a payee's usual category", () => {
  it('is the category of their one entry, and none for a payee with no entries', () => {
    expect(usualOf([filed('Corner market', 'Food/Groceries')])).toBe(category('Food/Groceries').id)
    expect(usualOf([filed('Harbour bistro', 'Food/Eating out')])).toBeNull()
  })

  it('stays put after one stray entry', () => {
    const rows = [filed('Corner market', 'Food/Groceries'), filed('Corner market', 'Food/Groceries'), filed('corner MARKET', 'Food/Eating out')]

    expect(usualOf(rows)).toBe(category('Food/Groceries').id)
  })

  it('moves once 2 of the 3 newest entries use another category', () => {
    const rows = [filed('Corner market', 'Food/Groceries'), filed('Corner market', 'Food/Eating out'), filed('Corner market', 'Food/Eating out')]

    expect(usualOf(rows)).toBe(category('Food/Eating out').id)
  })

  it('keeps money in apart from money out', () => {
    const rows = [filed('Corner market', 'Food/Groceries'), filed('Corner market', 'Income/Other income', 25)]

    expect(usualOf(rows, 'in')).toBe(category('Income/Other income').id)
    expect(usualOf(rows, 'out')).toBe(category('Food/Groceries').id)
  })

  it('reads no entry waiting on review or split, and does read one an older file filed', () => {
    const split = filed('Corner market', 'Food/Eating out')
    const waiting = row(OTP, '2026-10-28', -10, null, { payee: 'Corner market' })
    const rows = [filed('Corner market', 'Food/Groceries', -10, { categorisedBy: null }), waiting, split, filed('Corner market', 'Food/Eating out')]
    const parts = [
      { ...wholeItems([split])[0]!, amount: accountMoneyFromAmount(-5) },
      { ...wholeItems([split])[0]!, id: recordIdOf(ITEM_RECORDS, 'split-part'), amount: accountMoneyFromAmount(-5) },
    ]
    const book = spendingBook(rows, { items: [...wholeItems(rows.filter((entry) => entry !== split)), ...parts] })

    expect(usualCategory(book, 'Corner market', 'out')).toBe(category('Food/Groceries').id)
  })
})

describe("every payee's usual category", () => {
  it('reads each payee apart, grouping spellings that differ only in case', () => {
    const rows = [filed('Corner market', 'Food/Groceries'), filed('Harbour bistro', 'Food/Eating out'), filed('Corner market', 'Food/Eating out'), filed('corner market', 'Food/Eating out')]

    expect(Object.fromEntries(usualCategories(spendingBook(rows), 'out'))).toEqual({
      'CORNER MARKET': category('Food/Eating out').id,
      'HARBOUR BISTRO': category('Food/Eating out').id,
    })
  })
})
