import { describe, expect, it } from 'vitest'

import { isPairable, transferPairs } from '../src/apps/spending/pairing/domain/transferPairs'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { ACCOUNTS, category, OTP, REVOLUT_EUR, REVOLUT_USD, row } from './fixtures/spending'

const bank = (on: typeof OTP, date: string, amount: number, fields: Partial<Transaction> = {}) => row(on, date, amount, null, { source: 'statement', ...fields })

describe('transfer pairs', () => {
  it('pairs an OTP debit to the Revolut IBAN with a top-up a day later', () => {
    const debit = bank(OTP, '2026-10-10', -75, { counterpartyIban: REVOLUT_EUR.iban })
    const credit = bank(REVOLUT_EUR, '2026-10-11', 75)

    expect(transferPairs([debit, credit], ACCOUNTS)).toEqual({ pairs: [{ debit, credit }], waiting: [], offered: [] })
  })

  it('pairs a credit that names the debit account just the same', () => {
    const debit = bank(REVOLUT_EUR, '2026-10-10', -75)
    const credit = bank(OTP, '2026-10-10', 75, { counterpartyIban: REVOLUT_EUR.iban })

    expect(transferPairs([debit, credit], ACCOUNTS).pairs).toEqual([{ debit, credit }])
  })

  it('pairs the credit nearest the debit, ahead of an earlier one that also fits', () => {
    const debit = bank(OTP, '2026-10-10', -75, { counterpartyIban: REVOLUT_EUR.iban })
    const [friend, topUp] = [bank(REVOLUT_EUR, '2026-10-07', 75), bank(REVOLUT_EUR, '2026-10-11', 75)]

    expect(transferPairs([debit, friend, topUp], ACCOUNTS).pairs).toEqual([{ debit, credit: topUp }])
  })

  it('leaves as they are legs 4 days apart, and legs of other amounts', () => {
    const debit = bank(OTP, '2026-10-10', -75, { counterpartyIban: REVOLUT_EUR.iban })

    expect(transferPairs([debit, bank(REVOLUT_EUR, '2026-10-14', 75)], ACCOUNTS).pairs).toEqual([])
    expect(transferPairs([debit, bank(REVOLUT_EUR, '2026-10-11', 74)], ACCOUNTS).pairs).toEqual([])
  })

  it('leaves a friend paid the same amount on the same day as spending, neither paired nor offered', () => {
    const toFriend = bank(OTP, '2026-10-10', -50, { counterpartyIban: 'HR2200000000000000022' })
    const topUp = bank(REVOLUT_EUR, '2026-10-10', 50)

    expect(transferPairs([toFriend, topUp], ACCOUNTS)).toEqual({ pairs: [], waiting: [], offered: [] })
  })

  it("pairs an exchange's two legs by their started time, whatever the amounts", () => {
    const debit = bank(REVOLUT_EUR, '2026-10-10', -54, { movedAt: '2026-10-10 09:00:00' })
    const credit = bank(REVOLUT_USD, '2026-10-10', 58, { movedAt: '2026-10-10 09:00:00' })
    const other = bank(REVOLUT_USD, '2026-10-10', 60, { movedAt: '2026-10-10 09:05:00' })

    expect(transferPairs([debit, other, credit], ACCOUNTS)).toEqual({ pairs: [{ debit, credit }], waiting: [other], offered: [] })
  })

  it('leaves a lone debit to an own IBAN waiting', () => {
    const debit = bank(OTP, '2026-10-10', -75, { counterpartyIban: REVOLUT_EUR.iban })

    expect(transferPairs([debit], ACCOUNTS)).toEqual({ pairs: [], waiting: [debit], offered: [] })
  })

  it('only offers two rows that have the amount and the date alone', () => {
    const debit = bank(OTP, '2026-10-10', -60)
    const credit = bank(REVOLUT_EUR, '2026-10-12', 60)

    expect(transferPairs([debit, credit], ACCOUNTS)).toEqual({ pairs: [], waiting: [], offered: [{ debit, credit }] })
  })

  it('offers no row that has a category', () => {
    const debit = bank(OTP, '2026-10-10', -60, { category: category('Food/Coffee').id })

    expect(transferPairs([debit, bank(REVOLUT_EUR, '2026-10-10', 60)], ACCOUNTS).offered).toEqual([])
  })

  it('offers nothing across two currencies', () => {
    expect(transferPairs([bank(REVOLUT_EUR, '2026-10-10', -60), bank(REVOLUT_USD, '2026-10-10', 60)], ACCOUNTS).offered).toEqual([])
  })

  it('takes no row you decided about, or that is on a pair, or that no statement brought', () => {
    expect(isPairable(bank(OTP, '2026-10-10', -60))).toBe(true)
    expect(isPairable(bank(OTP, '2026-10-10', -60, { categorisedBy: 'rule' }))).toBe(true)
    expect(isPairable(bank(OTP, '2026-10-10', -60, { categorisedBy: 'person' }))).toBe(false)
    expect(isPairable(bank(OTP, '2026-10-10', -60, { pair: bank(REVOLUT_EUR, '2026-10-10', 60).id }))).toBe(false)
    expect(isPairable(row(OTP, '2026-10-10', -60, null))).toBe(false)
  })
})
