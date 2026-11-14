import { describe, expect, it } from 'vitest'

import { spendingHomeFigures } from '../src/apps/spending/home/presentation/spendingHomeFigures'
import { rateBookOfDatedRates } from '../src/shared/money/rateBook'
import type { RatesState } from '../src/shared/rates/domain/ratesState'
import { euros } from './fixtures/ledger'
import { CASH, DAY, OTP, RATES, ROWS, budget, row, spendingBook } from './fixtures/spending'

const LOADED: RatesState = { everyday: RATES, failed: false }
const GROCERIES = row(OTP, '2026-11-02', -45, 'Food/Groceries', { payee: 'Corner market' })

describe("Spending's card on the Kuna home", () => {
  it('leads with Bank and cash as Net worth shows it, with this month spent after it', () => {
    // The worked example's 2,390.46 less November's 45.00 of groceries.
    expect(spendingHomeFigures(spendingBook([...ROWS, GROCERIES]), LOADED, DAY)).toEqual({
      amounts: [
        { label: 'Bank and cash', cents: euros(2_345.46) },
        { label: 'Spent this month', cents: euros(45) },
      ],
      waiting: null,
    })
  })

  it('shows Overdrawn beside Bank and cash while an account is below zero', () => {
    const overdrawn = [...ROWS, row(CASH, '2026-11-03', -94, 'Food/Restaurants', { payee: 'Harbour bistro' })]

    // Cash 64.00 − 94.00 = −30.00, and the other three 1,850.00 + 320.50 + 155.96.
    expect(spendingHomeFigures(spendingBook(overdrawn), LOADED, DAY)).toMatchObject({
      amounts: [
        { label: 'Bank and cash', cents: euros(2_326.46) },
        { label: 'Overdrawn', cents: euros(30) },
        { label: 'Spent this month', cents: euros(94) },
      ],
    })
  })

  it("adds what is left of this month's limits", () => {
    const book = spendingBook([...ROWS, GROCERIES], { budgets: [budget(1, 'Food/Groceries', '2026-11', 200)] })

    // 200.00 − 45.00.
    expect(spendingHomeFigures(book, LOADED, DAY)).toMatchObject({ amounts: [{ label: 'Bank and cash' }, { label: 'Spent this month' }, { label: 'Left this month', cents: euros(155) }] })
  })

  it('says which account the lead figure leaves out when the rates failed', () => {
    const failed: RatesState = { everyday: rateBookOfDatedRates(new Map()), failed: true }

    // 1,850.00 + 320.50 + 64.00, without the dollars.
    expect(spendingHomeFigures(spendingBook(ROWS), failed, DAY)).toMatchObject({
      amounts: [{ label: 'Bank and cash', cents: euros(2_234.5) }, { label: 'Spent this month' }],
      waiting: '1 account in another currency not converted: the ECB rates did not load',
    })
  })

  it('waits while the rates load for a file with a dollar account', () => {
    expect(spendingHomeFigures(spendingBook(ROWS), 'loading', DAY)).toBe('opening')
  })

  it('has nothing to show for a file with no accounts', () => {
    expect(spendingHomeFigures(spendingBook([], { accounts: [] }), LOADED, DAY)).toBeNull()
  })
})
