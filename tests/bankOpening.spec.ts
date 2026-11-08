import { describe, expect, it } from 'vitest'

import { balanceDifferences } from '../src/apps/spending/bankSync/domain/bankBalance'
import { openingFromBank } from '../src/apps/spending/bankSync/domain/bankOpening'
import { accountMoneyFromAmount, accountMoneyFromCents } from '../src/shared/money/accountMoney'
import { civil } from './fixtures/ledger'
import { OTP, row } from './fixtures/spending'

const DAY = civil('2026-10-30')
const money = accountMoneyFromAmount

describe('the opening a bank gives', () => {
  const rows = [
    { date: civil('2026-09-03'), amount: money(40) },
    { date: civil('2026-10-01'), amount: money(-12.5) },
  ]

  it('opens at zero the day before the first row when the rows add up to the balance', () => {
    expect(openingFromBank(rows, money(27.5), DAY, false)).toEqual({ openedOn: civil('2026-09-02'), opening: 0, source: 'start', rows: 2 })
  })

  it('works out the opening on the first day as the balance less the rows', () => {
    // 100.00 less 40.00 and −12.50.
    expect(openingFromBank(rows, money(100), DAY, false)).toEqual({ openedOn: civil('2026-09-03'), opening: money(72.5), source: 'worked', rows: 2 })
  })

  it('opens on the day at the balance when the bank gave no rows', () => {
    expect(openingFromBank([], money(15), DAY, false)).toEqual({ openedOn: DAY, opening: money(15), source: 'worked', rows: 0 })
  })

  it('opens at zero on the first row as a guess when the bank gave no balance', () => {
    expect(openingFromBank(rows, null, DAY, false)).toEqual({ openedOn: civil('2026-09-03'), opening: 0, source: 'guess', rows: 2 })
  })

  it('never claims the account started empty while the bank holds pending rows, since its balance may count them', () => {
    expect(openingFromBank(rows, money(27.5), DAY, true)).toEqual({ openedOn: civil('2026-09-03'), opening: 0, source: 'pending', rows: 2 })
    expect(openingFromBank([], money(15), DAY, true).source).toBe('pending')
  })

  it('adds cents, never floats, so 0.10 and 0.20 make 0.30', () => {
    const cents = [
      { date: civil('2026-10-01'), amount: money(0.1) },
      { date: civil('2026-10-02'), amount: money(0.2) },
    ]
    expect(openingFromBank(cents, money(0.3), DAY, false).source).toBe('start')
  })
})

describe('a balance that differs', () => {
  const coffee = row(OTP, '2026-10-20', -6.5, 'Food/Coffee')

  it('offers the opening that makes the bank and Kuna agree', () => {
    // Kuna works out the opening less 6.50, so the opening moves by what the bank says above that.
    const worked = OTP.opening - 650
    expect(balanceDifferences([{ account: OTP, balance: money(1), pending: false }], [coffee], DAY)).toEqual([{ account: OTP, stated: 100, worked, fixedOpening: OTP.opening + 100 - worked }])
  })

  it('offers no opening while pending rows may explain the difference', () => {
    expect(balanceDifferences([{ account: OTP, balance: money(1), pending: true }], [coffee], DAY).map((difference) => difference.fixedOpening)).toEqual([null])
  })

  it('says nothing when they agree', () => {
    expect(balanceDifferences([{ account: OTP, balance: accountMoneyFromCents(OTP.opening - 650), pending: false }], [coffee], DAY)).toEqual([])
  })
})
