import { describe, expect, it } from 'vitest'

import { sameBooking, sameMoney } from '../src/apps/spending/pairing/domain/sameMoney'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { OTP, REVOLUT_EUR, row } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const typedOn = (date: string, amount = -10) => row(OTP, date, amount, 'Food/Coffee')
const bankOn = (date: string, amount = -10, on = OTP) => row(on, date, amount, null, { source: 'statement' })

describe('same money', () => {
  it.each([
    ['2026-10-07', true],
    ['2026-10-06', false],
    ['2026-10-17', true],
    ['2026-10-18', false],
  ])('at the window of 3 days before to 7 days after 10 Oct, a bank row on %s matching is %s', (bankDate, matches) => {
    expect(sameMoney([typedOn('2026-10-10')], [bankOn(bankDate)]).matches.length === 1).toBe(matches)
  })

  it('matches only to the cent', () => {
    expect(sameMoney([typedOn('2026-10-10')], [bankOn('2026-10-10', -10.01)]).matches).toEqual([])
  })

  it('matches only on one account', () => {
    const { matches, near } = sameMoney([typedOn('2026-10-10')], [bankOn('2026-10-10', -10, REVOLUT_EUR)])

    expect([matches, near]).toEqual([[], []])
  })

  it('keeps two equal coffees on one day two, one to one in date order', () => {
    const [first, second] = [typedOn('2026-10-10'), typedOn('2026-10-10')]
    const [earlier, later] = [bankOn('2026-10-10'), bankOn('2026-10-11')]

    expect(sameMoney([first, second], [later, earlier]).matches).toEqual([
      { typed: first, bank: earlier },
      { typed: second, bank: later },
    ])
  })

  it('takes the bank row nearest the typed day, the earlier on a tie, so an exact day wins over an earlier one', () => {
    const [before, exact, after] = [bankOn('2026-09-28', -4.2), bankOn('2026-10-01', -4.2), bankOn('2026-10-03', -4.2)]
    const typed = typedOn('2026-10-01', -4.2)

    expect(sameMoney([typed], [before, exact, after]).matches).toEqual([{ typed, bank: exact }])
    const [day9, day11] = [bankOn('2026-10-09'), bankOn('2026-10-11')]
    expect(sameMoney([typedOn('2026-10-10')], [day11, day9]).matches[0]?.bank).toBe(day9)
  })

  it('does not take one bank row for two typed ones', () => {
    const { matches, near } = sameMoney([typedOn('2026-10-10'), typedOn('2026-10-11')], [bankOn('2026-10-11')])

    expect(matches).toHaveLength(1)
    expect(near).toEqual([])
  })

  it('offers a different amount in the window as near, with the difference', () => {
    const typed = typedOn('2026-10-10')
    const bank = bankOn('2026-10-11', -10.5)

    expect(sameMoney([typed], [bank])).toEqual({ matches: [], near: [{ typed, bank, difference: accountMoneyFromAmount(-0.5) }] })
  })

  it('offers an equal amount on days further apart as near, with no difference', () => {
    const typed = typedOn('2026-10-10')
    const bank = bankOn('2026-10-20')

    expect(sameMoney([typed], [bank]).near).toEqual([{ typed, bank, difference: accountMoneyFromAmount(0) }])
  })

  it('offers neither an amount far off, money the other way, nor a date a month away', () => {
    const typed = typedOn('2026-10-10')

    expect(sameMoney([typed], [bankOn('2026-10-11', -20), bankOn('2026-10-11', 10), bankOn('2026-11-10')]).near).toEqual([])
  })
})

describe('sameBooking', () => {
  const held = (date: string, amount: number) => ({ account: OTP.id, date: civil(date), amount: accountMoneyFromAmount(amount) })

  it('matches only an equal account, amount and day', () => {
    expect(sameBooking([held('2026-10-28', -6.5)], [held('2026-10-28', -6.5)])).toHaveLength(1)
    expect(sameBooking([held('2026-10-28', -6.5)], [held('2026-10-27', -6.5)])).toEqual([])
    expect(sameBooking([held('2026-10-28', -6.5)], [held('2026-10-28', -6.6)])).toEqual([])
    expect(sameBooking([held('2026-10-28', -6.5)], [{ ...held('2026-10-28', -6.5), account: REVOLUT_EUR.id }])).toEqual([])
  })

  it('matches one to one, so a second equal row stays out', () => {
    const coming = [held('2026-10-28', -6.5), held('2026-10-28', -6.5)]
    expect(sameBooking([held('2026-10-28', -6.5)], coming).map(({ bank }) => bank)).toEqual([coming[0]])
  })
})
