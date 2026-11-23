import { describe, expect, it } from 'vitest'

import { entryLine } from '../src/apps/spending/entries/presentation/entryLine'
import { euroRows } from '../src/apps/spending/rates/domain/euroRows'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { ITEM_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { ACCOUNTS, CATEGORIES, OTP, RATES, category, row, wholeItems } from './fixtures/spending'

const byId = new Map(CATEGORIES.map((held) => [held.id, held]))
const meal = row(OTP, '2026-11-14', -84, 'Food/Eating out', { payee: 'Harbour bistro' })
const [whole] = wholeItems([meal])

function lineOf(items: readonly TransactionItem[]) {
  const [shown] = euroRows({ accounts: ACCOUNTS, transactions: [meal], items }, RATES)
  return entryLine(shown!, byId, false)
}

describe('how an entry reads on Entries', () => {
  it('names only the entry payee while every part counts under it', () => {
    expect(lineOf([whole!]).title).toBe('Harbour bistro')
  })

  it('adds each other payee a part counts under once, after the entry payee', () => {
    const halves = [
      { ...whole!, amount: accountMoneyFromAmount(-42), payee: 'HARBOUR BISTRO' },
      { ...whole!, id: recordIdOf(ITEM_RECORDS, 'meal-ana'), amount: accountMoneyFromAmount(-21), category: category('Family and gifts/Gifts').id, payee: 'Ana' },
      { ...whole!, id: recordIdOf(ITEM_RECORDS, 'meal-ana-2'), amount: accountMoneyFromAmount(-21), payee: 'ana' },
    ]

    expect(lineOf(halves).title).toBe('Harbour bistro · Ana')
  })

  it('names who an entry not split counts under beside its payee', () => {
    expect(lineOf([{ ...whole!, payee: 'Ana' }])).toMatchObject({ title: 'Harbour bistro · Ana', details: 'Eating out' })
  })
})
