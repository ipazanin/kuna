import { describe, expect, it } from 'vitest'

import {
  ZERO_ACCOUNT_MONEY,
  absAccountMoney,
  accountMoneyFromAmount,
  accountMoneyFromCents,
  accountMoneyOfEuros,
  addAccountMoney,
  negateAccountMoney,
  subtractAccountMoney,
  sumAccountMoney,
  typedAccountAmount,
} from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_RATES, eurosOfAccountMoney } from '../src/shared/money/rateBook'
import { civil } from './fixtures/ledger'
import { RATES, USD } from './fixtures/spending'

describe('account money', () => {
  it('reads whole cents and refuses a fraction of a cent', () => {
    expect(accountMoneyFromCents(-3990)).toBe(-3990)
    expect(() => accountMoneyFromCents(0.5)).toThrow(RangeError)
    expect(accountMoneyFromAmount(-39.9)).toBe(-3990)
    expect(accountMoneyFromAmount(1.005)).toBe(101)
  })

  it('reads what a person typed, and nothing for text that is no amount', () => {
    expect(typedAccountAmount('12.50')).toBe(1250)
    expect(typedAccountAmount('twelve')).toBeNull()
  })

  it('adds, subtracts, negates and sums like cents, without producing a negative zero', () => {
    expect(addAccountMoney(accountMoneyFromCents(250), accountMoneyFromCents(-100))).toBe(150)
    expect(subtractAccountMoney(accountMoneyFromCents(250), accountMoneyFromCents(250))).toBe(0)
    expect(Object.is(negateAccountMoney(ZERO_ACCOUNT_MONEY), 0)).toBe(true)
    expect(absAccountMoney(accountMoneyFromCents(-70))).toBe(70)
    expect(sumAccountMoney([accountMoneyFromCents(100), accountMoneyFromCents(-30)])).toBe(70)
  })

  it('takes euros as the cents of a euro account', () => {
    expect(accountMoneyOfEuros(moneyFromAmount(23.49))).toBe(2349)
  })
})

describe('account money in euros', () => {
  it('passes a euro account through whatever the rates say', () => {
    expect(eurosOfAccountMoney(accountMoneyFromAmount(-12.34), EURO, civil('2026-11-04'), NO_RATES)).toBe(-1234)
  })

  it('converts dollars at the ECB rate on or before the day', () => {
    expect(eurosOfAccountMoney(accountMoneyFromAmount(-30), USD, civil('2026-10-12'), RATES)).toBe(moneyFromAmount(-27.78))
  })

  it('gives no euros for a currency the rates do not reach', () => {
    expect(eurosOfAccountMoney(accountMoneyFromAmount(-30), USD, civil('2026-08-01'), RATES)).toBeNull()
    expect(eurosOfAccountMoney(accountMoneyFromAmount(-30), USD, civil('2026-10-12'), NO_RATES)).toBeNull()
  })
})
