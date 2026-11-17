import { describe, expect, it } from 'vitest'

import { inWindow, isNear, matchMoney, nearestTo } from '../src/shared/app/moneyMatch'
import type { DatedMoney } from '../src/shared/app/moneyMatch'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'

const money = (date: string, amount = -10, name = ''): DatedMoney & { readonly name: string } => ({ date: parseCivilDate(date)!, amount: accountMoneyFromAmount(amount), name })

describe('money matching', () => {
  it.each([
    ['2026-10-07', true],
    ['2026-10-06', false],
    ['2026-10-17', true],
    ['2026-10-18', false],
  ])('counts a row booked on %s inside the window of 3 days before to 7 days after 10 Oct: %s', (booked, inside) => {
    expect(inWindow(money('2026-10-10'), money(booked))).toBe(inside)
  })

  it.each([
    ['an equal amount 14 days away', '2026-10-24', -10, true],
    ['an equal amount 15 days away', '2026-10-25', -10, false],
    ['a tenth more inside the window', '2026-10-11', -11, true],
    ['more than a tenth more', '2026-10-11', -11.2, false],
    ['a near amount outside the window', '2026-10-18', -10.5, false],
    ['money the other way', '2026-10-11', 10, false],
  ])('calls %s near: %s', (_what, booked, amount, near) => {
    expect(isNear(money('2026-10-10'), money(booked, amount))).toBe(near)
  })

  it('takes the row nearest the day, the first given on a tie', () => {
    const [before, after] = [money('2026-10-09', -10, 'before'), money('2026-10-11', -10, 'after')]

    expect(nearestTo(parseCivilDate('2026-10-10')!, [after, before])).toBe(after)
    expect(nearestTo(parseCivilDate('2026-10-10')!, [])).toBeUndefined()
  })

  it('takes exact rows first for every expected money, then near ones, each row once, in the order the money is given', () => {
    const [first, second, third] = [money('2026-10-01', -10, 'first'), money('2026-10-12', -10, 'second'), money('2026-10-20', -50, 'third')]
    const exactForSecond = money('2026-10-12', -10, 'exact for second')
    const nearForFirst = money('2026-10-01', -10.5, 'near for first')
    const nearForThird = money('2026-10-21', -52, 'near for third')

    expect(matchMoney([first, second, third], [nearForFirst, exactForSecond, nearForThird], { near: isNear })).toEqual([
      { expected: first, row: nearForFirst, exact: false, difference: accountMoneyFromAmount(-0.5) },
      { expected: second, row: exactForSecond, exact: true, difference: accountMoneyFromAmount(0) },
      { expected: third, row: nearForThird, exact: false, difference: accountMoneyFromAmount(-2) },
    ])
  })

  it('takes exact rows before near ones, whatever order the money comes in', () => {
    const [first, second] = [money('2026-10-10', -10, 'first'), money('2026-10-10', -10.5, 'second')]
    const row = money('2026-10-10', -10)

    expect(matchMoney([second, first], [row], { near: isNear }).map((match) => [match.expected.name, match.exact])).toEqual([['first', true]])
  })

  it('takes only the rows the caller lets stand for the money', () => {
    const wanted = money('2026-10-10', -10, 'here')

    expect(matchMoney([wanted], [money('2026-10-10', -10, 'there')], { mayBe: (expected, row) => expected.name === row.name, near: isNear })).toEqual([])
    expect(matchMoney([wanted], [money('2026-10-25', -10)], { near: () => true })).toHaveLength(1)
  })
})
