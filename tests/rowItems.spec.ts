import { describe, expect, it } from 'vitest'

import { rowSide } from '../src/apps/spending/categories/domain/rowSide'
import { euroRows } from '../src/apps/spending/rates/domain/euroRows'
import { itemsOfStoredRow, plainLineOf, storedBeforeItems } from '../src/apps/spending/workbook/domain/beforeItems'
import { isSplit, largestItem, rowItemsOf, waitsOnReview, wholeItemOf, wholeRowItemId } from '../src/apps/spending/workbook/domain/rowItems'
import { ITEM_RECORDS, LINE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_RATES } from '../src/shared/money/rateBook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RowLink } from '../src/apps/spending/workbook/domain/rowLink'
import { ACCOUNTS, CATEGORIES, OTP, category, row, wholeItems } from './fixtures/spending'

const groceries = category('Food/Groceries')
const flat: RowLink = { app: 'loans', kind: 'informal-loan', key: 'made-up-flat', due: null }

function part(key: string, of: { readonly id: TransactionItem['transaction'] }, amount: number, path: string, note = ''): TransactionItem {
  return { id: recordIdOf(ITEM_RECORDS, key), transaction: of.id, receipt: null, printed: '', note, amount: accountMoneyFromAmount(amount), category: category(path).id, link: null }
}

describe("a Spending row's items", () => {
  it('are the items the book holds of the row, in their order, and none for a row the book holds none of', () => {
    const market = row(OTP, '2026-10-12', -30, 'Food/Groceries')
    const waiting = row(OTP, '2026-10-13', -12, null)
    const parts = [part('part-a', market, -20, 'Food/Groceries', 'Bread'), part('part-b', market, -10, 'Personal')]
    const itemsOf = rowItemsOf({ items: [...parts, ...wholeItems([waiting])] })
    expect(itemsOf(market)).toEqual(parts)
    expect(itemsOf(row(OTP, '2026-10-14', -1, null))).toEqual([])
    expect(isSplit(itemsOf(market))).toBe(true)
    expect(isSplit(itemsOf(waiting))).toBe(false)
    expect(waitsOnReview(itemsOf(waiting))).toBe(true)
    expect(waitsOnReview(itemsOf(market))).toBe(false)
  })

  it('names the largest item by its money, signs aside, and the first of them on a tie', () => {
    const market = row(OTP, '2026-10-12', -30, 'Food/Groceries')
    const [first, second, discount] = [part('a', market, -15, 'Food/Groceries'), part('b', market, -15, 'Personal'), part('c', market, 20, 'Personal')]
    expect(largestItem([first!, second!])).toBe(first)
    expect(largestItem([first!, discount!])).toBe(discount)
    expect(largestItem([])).toBeNull()
  })

  it('counts a row of one item at its whole euros, the same as the row', () => {
    const bakery = row(OTP, '2026-10-12', -6.5, 'Food/Groceries')
    const [euroRow] = euroRows({ accounts: ACCOUNTS, transactions: [bakery], items: wholeItems([bakery]) }, NO_RATES)
    expect(rowSide(euroRow!, new Map(CATEGORIES.map((held) => [held.id, held])))).toEqual([{ category: groceries, side: 'spending', counted: moneyFromAmount(6.5) }])
  })
})

describe('a row of a file from before items', () => {
  const dinner = row(OTP, '2026-10-12', -60, 'Food/Restaurants', { note: 'dinner with Ana', link: flat })
  const lines = [part('pizza', dinner, -35, 'Food/Restaurants', 'Pizza'), part('wine', dinner, -15, 'Food/Restaurants', 'Wine'), part('water', dinner, -10, 'Food/Groceries')].map(plainLineOf)

  it('reads as one item under its own category, with its note and link, and the row id as its key', () => {
    const bakery = row(OTP, '2026-10-12', -6.5, 'Food/Groceries', { note: 'Sunday', link: flat })
    expect(itemsOfStoredRow(bakery, [])).toEqual([
      { id: wholeRowItemId(bakery), transaction: bakery.id, receipt: null, printed: '', note: 'Sunday', amount: bakery.amount, category: groceries.id, link: flat },
    ])
  })

  it("reads its lines as items under the same keys, the row's note in front of the largest line's words and its link on each", () => {
    expect(lines[0]!.id).toBe(recordIdOf(LINE_RECORDS, 'pizza'))
    expect(itemsOfStoredRow(dinner, lines).map((item) => [item.id, item.note, item.link])).toEqual([
      [recordIdOf(ITEM_RECORDS, 'pizza'), 'dinner with Ana · Pizza', flat],
      [recordIdOf(ITEM_RECORDS, 'wine'), 'Wine', flat],
      [recordIdOf(ITEM_RECORDS, 'water'), '', flat],
    ])
  })

  it('stores the items it reads back as the row and lines it holds', () => {
    const read = itemsOfStoredRow(dinner, lines)
    expect(storedBeforeItems(dinner, read, { row: dinner, lines })).toEqual({ row: dinner, lines })
    const bakery = row(OTP, '2026-10-12', -6.5, 'Food/Groceries', { note: 'Sunday', link: flat })
    expect(storedBeforeItems(bakery, itemsOfStoredRow(bakery, []), { row: bakery, lines: [] })).toEqual({ row: bakery, lines: [] })
  })

  it("keeps the row's note on the row and the main category on it when its items change, and the rest of each line's words on the line", () => {
    const [pizza, wine, water] = itemsOfStoredRow(dinner, lines)
    const changed = [{ ...pizza!, note: 'dinner with Ana · Pizza, no olives' }, { ...wine!, category: category('Food/Groceries').id }, water!]
    const stored = storedBeforeItems(dinner, changed, { row: dinner, lines })
    expect(stored.row).toEqual({ ...dinner, category: category('Food/Restaurants').id })
    expect(stored.lines.map((line) => [line.id, line.text, line.category])).toEqual([
      [lines[0]!.id, 'Pizza, no olives', category('Food/Restaurants').id],
      [lines[1]!.id, 'Wine', category('Food/Groceries').id],
      [lines[2]!.id, '', category('Food/Groceries').id],
    ])
  })

  it("puts a row not split back on the row alone, with the row's note when the split comes off as it read", () => {
    const whole = wholeItemOf(dinner, { category: category('Food/Restaurants').id, note: 'dinner with Ana · Pizza', link: flat })
    expect(storedBeforeItems(dinner, [whole], { row: dinner, lines })).toEqual({ row: { ...dinner, category: category('Food/Restaurants').id }, lines: [] })
    const typed = { ...whole, note: 'Typed again' }
    expect(storedBeforeItems(dinner, [typed], { row: dinner, lines: [] }).row).toMatchObject({ note: 'Typed again', link: flat })
  })

  it("splits a row not split into lines under its main category, the first part keeping the row's note", () => {
    const bakery = row(OTP, '2026-10-12', -10, 'Food/Groceries', { note: 'Sunday' })
    const [held] = itemsOfStoredRow(bakery, [])
    const parts = [{ ...held!, amount: accountMoneyFromAmount(-4), category: category('Personal').id }, part('rest', bakery, -6, 'Food/Groceries', 'Bread')]
    const stored = storedBeforeItems(bakery, parts, { row: bakery, lines: [] })
    expect(stored.row).toEqual({ ...bakery, category: groceries.id })
    expect(stored.lines.map((line) => [line.id, line.text])).toEqual([
      [recordIdOf(LINE_RECORDS, held!.id.slice('item:'.length)), ''],
      [recordIdOf(LINE_RECORDS, 'rest'), 'Bread'],
    ])
  })
})
