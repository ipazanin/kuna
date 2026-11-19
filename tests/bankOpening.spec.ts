import { describe, expect, it } from 'vitest'

import { balanceDifferences } from '../src/apps/spending/bankSync/domain/bankBalance'
import { earliestStart, openingOn, startDays, startsWithin } from '../src/apps/spending/accounts/domain/bankOpening'
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
  const evidence = (stated: number | null, from = rows) => ({ rows: from, stated: stated === null ? null : money(stated) })

  it('opens at zero on a day no later than the first row when the rows add up to the balance', () => {
    expect(openingOn(evidence(27.5), civil('2026-09-02'))).toEqual({ openedOn: civil('2026-09-02'), opening: 0, source: 'start', rows: 2 })
  })

  it('works out the opening on the day as the balance less the rows from that day on', () => {
    // 100.00 less 40.00 and -12.50.
    expect(openingOn(evidence(100), civil('2026-09-03'))).toEqual({ openedOn: civil('2026-09-03'), opening: money(72.5), source: 'worked', rows: 2 })
    // 100.00 less -12.50, since the 40.00 is before the day.
    expect(openingOn(evidence(100), civil('2026-09-20'))).toEqual({ openedOn: civil('2026-09-20'), opening: money(112.5), source: 'worked', rows: 1 })
  })

  it('reads a zero after the first row as worked out, since rows before the day may have filled it', () => {
    // 27.50 less -12.50 and 40.00 left out is 40.00, and 40.00 less 40.00 from 3 September is zero only on that day or before.
    expect(openingOn(evidence(-12.5), civil('2026-09-20')).source).toBe('worked')
    expect(openingOn(evidence(-12.5), civil('2026-09-20')).opening).toBe(0)
  })

  it('opens on the day at the balance when the bank gave no rows', () => {
    expect(openingOn(evidence(15, []), DAY)).toEqual({ openedOn: DAY, opening: money(15), source: 'worked', rows: 0 })
  })

  it('opens at zero on the day as a guess when the bank gave no balance', () => {
    expect(openingOn(evidence(null), civil('2026-09-03'))).toEqual({ openedOn: civil('2026-09-03'), opening: 0, source: 'guess', rows: 2 })
  })

  it('adds cents, never floats, so 0.10 and 0.20 make 0.30', () => {
    const cents = [
      { date: civil('2026-10-01'), amount: money(0.1) },
      { date: civil('2026-10-02'), amount: money(0.2) },
    ]
    expect(openingOn(evidence(0.3, cents), civil('2026-10-01')).source).toBe('start')
  })

  it('starts no earlier than the first row, or the day before it when the rows reach back to an empty account', () => {
    expect(earliestStart(evidence(100))).toBe(civil('2026-09-03'))
    expect(earliestStart(evidence(27.5))).toBe(civil('2026-09-02'))
    expect(earliestStart(evidence(15, []))).toBeNull()
  })

  it('starts from the earliest day to the latest its balance knows, and only on the latest with no rows', () => {
    expect(startDays(evidence(100), DAY)).toEqual({ earliest: civil('2026-09-03'), latest: DAY })
    expect(startDays(evidence(15, []), DAY)).toEqual({ earliest: DAY, latest: DAY })
    expect([civil('2026-09-02'), civil('2026-09-03'), DAY, civil('2026-10-31')].map((day) => startsWithin(evidence(100), day, DAY))).toEqual([false, true, true, false])
  })
})

describe('a balance that differs', () => {
  const coffee = row(OTP, '2026-10-20', -6.5, 'Food/Eating out')
  const card = row(OTP, '2026-10-29', -0.8, null, { pending: true })
  // Kuna works out the opening less 6.50.
  const worked = accountMoneyFromCents(OTP.opening - 650)
  const stated = (balance: number, kind: 'booked' | 'available') => [{ account: OTP, balance: accountMoneyFromCents(balance), kind, unlisted: null }]

  it('offers the opening that makes the bank and Kuna agree', () => {
    // The opening moves by what the bank says above what Kuna works out.
    expect(balanceDifferences(stated(100, 'booked'), [coffee], DAY)).toEqual([{ account: OTP, stated: 100, worked, fixedOpening: OTP.opening + 100 - worked }])
  })

  it('reads a booked balance against the booked rows and an available one against every row', () => {
    expect(balanceDifferences(stated(worked, 'booked'), [coffee, card], DAY)).toEqual([])
    expect(balanceDifferences(stated(worked - 80, 'available'), [coffee, card], DAY)).toEqual([])
    expect(balanceDifferences(stated(worked, 'available'), [coffee, card], DAY)).toEqual([{ account: OTP, stated: worked, worked: worked - 80, fixedOpening: OTP.opening + 80 }])
  })

  it('says nothing when they agree', () => {
    expect(balanceDifferences(stated(worked, 'booked'), [coffee], DAY)).toEqual([])
  })
})
