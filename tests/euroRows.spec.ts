import { describe, expect, it } from 'vitest'
import { accountOnDay, euroRows } from '../src/apps/spending/rates/domain/euroRows'
import { ratesNeeded } from '../src/apps/spending/rates/domain/ratesNeeded'
import { moneyFromCents } from '../src/shared/money/money'
import { NO_RATES } from '../src/shared/money/rateBook'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CASH, DAY, OTP, RATES, REVOLUT_EUR, REVOLUT_USD, ROWS, USD, account, row } from './fixtures/spending'

function eurosOf(rows: Parameters<typeof euroRows>[0]['transactions'], rates = RATES) {
  return euroRows({ accounts: ACCOUNTS, transactions: rows, items: [] }, rates).map((entry) => entry.euros)
}

describe('a row in euros', () => {
  it('converts the $30.00 row of 10 Oct at that day’s 1.0800 to €27.78', () => {
    // 30.00 ÷ 1.0800 = 27.777…
    expect(eurosOf([row(REVOLUT_USD, '2026-10-10', -30, 'Travel/On the trip')])).toEqual([euros(-27.78)])
  })

  it('takes the newest earlier rate on a day the ECB has none, so a Sunday has the Friday’s', () => {
    // 30.00 ÷ 1.0850, the rate of Friday 30 Oct, = 27.649…
    expect(eurosOf([row(REVOLUT_USD, '2026-11-01', -30, 'Travel/On the trip')])).toEqual([euros(-27.65)])
  })

  it('leaves a row before the series starts unrated, never guessed', () => {
    const rows = euroRows({ accounts: ACCOUNTS, transactions: [row(REVOLUT_USD, '2026-08-20', -30, 'Travel/On the trip')], items: [] }, RATES)

    expect(rows).toMatchObject([{ account: { name: 'Revolut USD' }, euros: null }])
  })

  it('passes a row on a euro account through as it is, with no rates at all', () => {
    expect(eurosOf([row(OTP, '2026-10-12', -350, 'Food/Groceries'), row(CASH, '2026-08-20', -3.5, 'Food/Coffee')], NO_RATES)).toEqual([euros(-350), euros(-3.5)])
  })

  it('gives every row of the worked example its account, and only the dollar row a rate', () => {
    const rows = euroRows({ accounts: ACCOUNTS, transactions: ROWS, items: [] }, RATES)

    expect(rows.map((entry) => entry.account.name)).toEqual(ROWS.map((entry) => ACCOUNTS.find((held) => held.id === entry.account)!.name))
    expect(rows.filter((entry) => entry.euros !== moneyFromCents(entry.transaction.amount)).map((entry) => [entry.transaction.payee, entry.euros])).toEqual([['Diner in Boston', euros(-27.78)]])
  })

  it('leaves out a row whose account is not in the book', () => {
    const elsewhere = account(9, { ...OTP, name: 'Elsewhere' })

    expect(euroRows({ accounts: ACCOUNTS, transactions: [row(elsewhere, '2026-10-12', -1, 'Food/Groceries')], items: [] }, RATES)).toEqual([])
  })
})

describe('a balance in euros', () => {
  it('converts at the rate of the day it is shown for: $170.00 at 1.0900 on 4 Nov is €155.96', () => {
    // 170.00 ÷ 1.0900 = 155.963…
    expect(accountOnDay(REVOLUT_USD, ROWS, DAY, RATES)).toEqual({ account: REVOLUT_USD, balance: euros(170), euros: euros(155.96) })
  })

  it('converts the same dollars at another day’s rate on another day', () => {
    // 170.00 ÷ 1.0850, the rate of Friday 30 Oct, on Sunday 1 Nov = 156.682…
    expect(accountOnDay(REVOLUT_USD, ROWS, civil('2026-11-01'), RATES).euros).toEqual(euros(156.68))
  })

  it('has no euros while the rates do not reach the day, and a euro account its balance', () => {
    expect(accountOnDay(REVOLUT_USD, ROWS, DAY, NO_RATES)).toMatchObject({ balance: euros(170), euros: null })
    expect(accountOnDay(REVOLUT_EUR, ROWS, DAY, NO_RATES)).toMatchObject({ balance: euros(320.5), euros: euros(320.5) })
  })
})

describe('the rates a file needs', () => {
  it('are none for a file of euro accounts only', () => {
    expect(ratesNeeded({ accounts: [OTP, REVOLUT_EUR, CASH], transactions: ROWS })).toEqual(new Map())
  })

  it('start on the day the dollar account opened when its rows come later', () => {
    expect(ratesNeeded({ accounts: ACCOUNTS, transactions: ROWS })).toEqual(new Map([[USD, civil('2026-09-01')]]))
  })

  it('start on the day of the oldest dollar row when it comes before the account opened', () => {
    const early = row(REVOLUT_USD, '2026-08-20', -30, 'Travel/On the trip')

    expect(ratesNeeded({ accounts: ACCOUNTS, transactions: [early, ...ROWS] })).toEqual(new Map([[USD, civil('2026-08-20')]]))
  })
})
