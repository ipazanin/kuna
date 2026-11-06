import { describe, expect, it } from 'vitest'

import { spendingHubFigures } from '../src/apps/spending/home/presentation/spendingHubFigures'
import { rateBookOfEcbRates } from '../src/shared/money/rateBook'
import type { RatesState } from '../src/apps/spending/rates/domain/ratesState'
import { euros } from './fixtures/ledger'
import { ACCOUNTS, CASH, DAY, OTP, RATES, REVOLUT_EUR, REVOLUT_USD, ROWS, row } from './fixtures/spending'

const LOADED: RatesState = { book: RATES, failed: false }

describe('what Spending adds to Net worth', () => {
  it("is the worked example's €2,390.46 of bank and cash across 4 accounts, the dollars at 4 Nov's 1.0900", () => {
    // 1,850.00 + 320.50 + 155.96 + 64.00, with 170.00 ÷ 1.0900 = 155.963…
    expect(spendingHubFigures({ accounts: ACCOUNTS, transactions: ROWS }, LOADED, DAY)).toEqual({
      parts: [{ label: 'Bank and cash', cents: euros(2_390.46), side: 'has', caption: 'Across 4 accounts', to: '/spending/accounts' }],
      notes: [],
    })
  })

  it('shows an overdrawn account as owed, apart from what the others hold', () => {
    const overdrawn = [...ROWS, row(CASH, '2026-11-03', -94, 'Food/Restaurants')]

    // Cash 64.00 − 94.00 = −30.00, and the other three 1,850.00 + 320.50 + 155.96.
    expect(spendingHubFigures({ accounts: ACCOUNTS, transactions: overdrawn }, LOADED, DAY)).toEqual({
      parts: [
        { label: 'Bank and cash', cents: euros(2_326.46), side: 'has', caption: 'Across 3 accounts', to: '/spending/accounts' },
        { label: 'Overdrawn', cents: euros(30), side: 'owes', caption: null, to: '/spending/accounts' },
      ],
      notes: [],
    })
  })

  it('counts the dollar account as nothing with a note when the rates failed', () => {
    const failed: RatesState = { book: rateBookOfEcbRates(new Map()), failed: true }

    // 1,850.00 + 320.50 + 64.00.
    expect(spendingHubFigures({ accounts: ACCOUNTS, transactions: ROWS }, failed, DAY)).toEqual({
      parts: [{ label: 'Bank and cash', cents: euros(2_234.5), side: 'has', caption: 'Across 3 accounts', to: '/spending/accounts' }],
      notes: ['1 account in another currency, since the ECB rates did not load'],
    })
  })

  it('is opening while the rates load for a file with a dollar account', () => {
    expect(spendingHubFigures({ accounts: ACCOUNTS, transactions: ROWS }, 'loading', DAY)).toBe('opening')
  })

  it('does not wait on the rates for a file of euro accounts only, or one whose only foreign account is closed and empty', () => {
    const euroOnly = { accounts: [OTP, REVOLUT_EUR, CASH], transactions: ROWS }
    const dollarsEmptied = { accounts: [OTP, REVOLUT_EUR, { ...REVOLUT_USD, closed: true }, CASH], transactions: [...ROWS, row(REVOLUT_USD, '2026-11-03', -170, 'Food/Restaurants')] }

    for (const book of [euroOnly, dollarsEmptied]) {
      expect(spendingHubFigures(book, 'loading', DAY)).toEqual({
        parts: [{ label: 'Bank and cash', cents: euros(2_234.5), side: 'has', caption: 'Across 3 accounts', to: '/spending/accounts' }],
        notes: [],
      })
    }
  })

  it('keeps counting a closed account while it still holds money, so closing it never drops money from the sum', () => {
    const closed = [OTP, { ...REVOLUT_EUR, closed: true }, REVOLUT_USD, CASH]

    expect(spendingHubFigures({ accounts: closed, transactions: ROWS }, LOADED, DAY)).toMatchObject({ parts: [{ cents: euros(2_390.46), caption: 'Across 4 accounts' }] })
    expect(spendingHubFigures({ accounts: [OTP, { ...REVOLUT_USD, closed: true }], transactions: ROWS }, 'loading', DAY)).toBe('opening')
  })

  it('leaves a closed account at zero out of the sum and the count', () => {
    const emptied = [...ROWS, row(REVOLUT_EUR, '2026-11-03', -320.5, 'Food/Restaurants')]
    const closed = [OTP, { ...REVOLUT_EUR, closed: true }, REVOLUT_USD, CASH]

    // 1,850.00 + 155.96 + 64.00.
    expect(spendingHubFigures({ accounts: closed, transactions: emptied }, LOADED, DAY)).toMatchObject({ parts: [{ cents: euros(2_069.96), caption: 'Across 3 accounts' }] })
  })

  it('adds nothing for a file with no accounts', () => {
    expect(spendingHubFigures({ accounts: [], transactions: [] }, LOADED, DAY)).toBeNull()
  })
})
