import { describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CASH, DAY, OTP, REVOLUT_EUR, REVOLUT_USD, ROWS, row } from './fixtures/spending'

describe('an account balance', () => {
  it("is the worked example's on 4 Nov: €1,850.00, €320.50, $170.00 and €64.00, each in its own currency", () => {
    expect(ACCOUNTS.map((account) => [account.name, accountBalance(account, ROWS, DAY)])).toEqual([
      ['OTP current', euros(1_850)],
      ['Revolut EUR', euros(320.5)],
      ['Revolut USD', euros(170)],
      ['Cash', euros(64)],
    ])
  })

  it('moves both accounts by a transfer between them, and leaves the sum of the two as it was', () => {
    const [out, into] = ROWS.filter((entry) => entry.pair !== null)

    // 1,550.00 − 200.00 and 300.00 + 200.00, which still add up to 1,850.00.
    expect([accountBalance(OTP, [out!], DAY), accountBalance(REVOLUT_EUR, [into!], DAY)]).toEqual([euros(1_350), euros(500)])
  })

  it('is the opening on the day the account opened, before its first row', () => {
    expect(accountBalance(OTP, ROWS, civil('2026-09-01'))).toEqual(euros(1_550))
    expect(accountBalance(REVOLUT_USD, ROWS, civil('2026-10-09'))).toEqual(euros(200))
  })

  it('takes a row of the day itself, and leaves out a row before the account opened and one after the day', () => {
    const rows = [row(CASH, '2026-08-31', -20, 'Food/Coffee'), row(CASH, '2026-11-04', -4, 'Food/Coffee'), row(CASH, '2026-11-05', -6, 'Food/Coffee')]

    // 100.00 opening − 4.00 on the day itself.
    expect(accountBalance(CASH, rows, DAY)).toEqual(euros(96))
  })

  it('can go below zero, as an overdrawn account does', () => {
    expect(accountBalance(CASH, [row(CASH, '2026-10-01', -130, 'Food/Restaurants')], DAY)).toEqual(euros(-30))
  })
})
