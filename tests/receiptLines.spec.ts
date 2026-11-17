import { describe, expect, it } from 'vitest'

import { retypedEntry } from '../src/apps/spending/entries/application/entryWrites'
import { lineRefilesOf, refiledReceiptLines } from '../src/apps/spending/receipts/domain/receiptLines'
import { ITEM_RECORDS, RECEIPT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { CATEGORIES, OTP, category, row } from './fixtures/spending'

const groceries = category('Food/Groceries')
const eatingOut = category('Food/Eating out')
const market = row(OTP, '2026-10-12', -30, 'Food/Groceries', { categorisedBy: 'rule' })
const receipt = recordIdOf(RECEIPT_RECORDS, 'market-receipt')

function line(key: string, amount: number, onReceipt = true): TransactionItem {
  return {
    id: recordIdOf(ITEM_RECORDS, key),
    transaction: market.id,
    receipt: onReceipt ? receipt : null,
    printed: key.toUpperCase(),
    note: '',
    amount: accountMoneyFromAmount(amount),
    category: groceries.id,
    link: null,
    labels: [],
    ruleLabels: [],
    event: BY_DAYS,
    splitByLink: false,
  }
}

const [bread, coffee] = [line('bread', -20), line('coffee', -10)]

describe("a receipt's lines filed anew", () => {
  it('take the category and trimmed words given, keep their amounts, and leave a line not named as it was', () => {
    const refiled = refiledReceiptLines(CATEGORIES, [bread!, coffee!], [{ line: coffee!.id, category: eatingOut.id, note: ' Espresso ' }])

    expect(refiled).toEqual([bread, { ...coffee, category: eatingOut.id, note: 'Espresso' }])
  })

  it('refuse a part split by hand, a line of another entry, a group with children and Between my accounts', () => {
    const handPart = line('hand', -30, false)
    const between = CATEGORIES.find((held) => held.kind === 'transfer')!

    expect(refiledReceiptLines(CATEGORIES, [handPart], [{ line: handPart.id, category: eatingOut.id, note: '' }])).toEqual({ refused: 'not-a-receipt-line' })
    expect(refiledReceiptLines(CATEGORIES, [bread!], [{ line: coffee!.id, category: eatingOut.id, note: '' }])).toEqual({ refused: 'not-a-receipt-line' })
    expect(refiledReceiptLines(CATEGORIES, [bread!], [{ line: bread!.id, category: category('Food').id, note: '' }])).toEqual({ refused: 'group-with-children' })
    expect(refiledReceiptLines(CATEGORIES, [bread!], [{ line: bread!.id, category: between.id, note: '' }])).toEqual({ refused: 'between-accounts' })
  })

  it('are written over the entry as typed, so the entry becomes filed by the person, while a hand part keeps its category for Change the split', () => {
    const handPart = { ...line('hand', -10, false), id: recordIdOf(ITEM_RECORDS, 'hand') }
    const before = { row: market, items: [bread!, handPart] }
    const typed = {
      row: market,
      items: [
        { ...bread!, category: eatingOut.id, note: 'Rolls' },
        { ...handPart, category: eatingOut.id, note: 'Ignored' },
      ],
    }

    const after = retypedEntry(before, typed)

    expect(after.items).toEqual([{ ...bread, category: eatingOut.id, note: 'Rolls' }, handPart])
    expect(after.row.categorisedBy).toBe('person')
  })
})

describe("a receipt's lines as the entry dialog holds them", () => {
  it('refile only the lines whose category or words changed, and show every line under what was picked', () => {
    const filed = lineRefilesOf(CATEGORIES, [bread!, coffee!], {
      [bread!.id]: { category: groceries.id, note: ' ' },
      [coffee!.id]: { category: eatingOut.id, note: 'Espresso' },
    })

    expect(filed.refiles).toEqual([{ line: coffee!.id, category: eatingOut.id, note: 'Espresso' }])
    expect(filed.refused.size).toBe(0)
    expect(filed.lines).toEqual([
      { ...bread, note: ' ' },
      { ...coffee, category: eatingOut.id, note: 'Espresso' },
    ])
  })

  it('leave a line under a group with children alone until it is changed, then say why it cannot be saved', () => {
    const underGroup = { ...bread!, category: category('Food').id }

    expect(lineRefilesOf(CATEGORIES, [underGroup], { [underGroup.id]: { category: underGroup.category, note: '' } }).refused.size).toBe(0)
    const changed = lineRefilesOf(CATEGORIES, [underGroup], { [underGroup.id]: { category: underGroup.category, note: 'Rolls' } })
    expect(changed.refiles).toEqual([])
    expect([...changed.refused]).toEqual([[underGroup.id, 'group-with-children']])
  })
})
