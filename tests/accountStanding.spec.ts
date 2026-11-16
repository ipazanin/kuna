import { describe, expect, it } from 'vitest'

import { accountStanding } from '../src/apps/spending/accounts/domain/accountStanding'
import { countedAccounts } from '../src/apps/spending/rates/domain/euroRows'
import { NO_RATES } from '../src/shared/money/rateBook'
import { euros } from './fixtures/ledger'
import { ACCOUNTS, CASH, DAY, RATES, ROWS, row } from './fixtures/spending'

describe('what the accounts hold and owe', () => {
  it("holds the worked example's €2,390.46 across 4 accounts, with nothing owed", () => {
    // 1,850.00 + 320.50 + 155.96 + 64.00, with 170.00 ÷ 1.0900 = 155.963…
    expect(accountStanding(countedAccounts({ accounts: ACCOUNTS, transactions: ROWS }, DAY, RATES))).toEqual({ held: euros(2_390.46), heldAccounts: 4, owed: null, unconverted: 0 })
  })

  it('owes what an overdrawn account is below zero, apart from what the others hold', () => {
    const overdrawn = [...ROWS, row(CASH, '2026-11-03', -94, 'Food/Restaurants')]

    // Cash 64.00 − 94.00 = −30.00, and the other three 1,850.00 + 320.50 + 155.96.
    expect(accountStanding(countedAccounts({ accounts: ACCOUNTS, transactions: overdrawn }, DAY, RATES))).toEqual({ held: euros(2_326.46), heldAccounts: 3, owed: euros(30), unconverted: 0 })
  })

  it('counts the dollar account as nothing without a rate, and says so', () => {
    // 1,850.00 + 320.50 + 64.00.
    expect(accountStanding(countedAccounts({ accounts: ACCOUNTS, transactions: ROWS }, DAY, NO_RATES))).toEqual({ held: euros(2_234.5), heldAccounts: 3, owed: null, unconverted: 1 })
  })

  it('holds nothing across no accounts', () => {
    expect(accountStanding([])).toEqual({ held: euros(0), heldAccounts: 0, owed: null, unconverted: 0 })
  })
})
