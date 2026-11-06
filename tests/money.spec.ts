import { describe, expect, it } from 'vitest'

import {
  ZERO,
  absMoney,
  addMoney,
  amountOf,
  divideMoney,
  dividedRounded,
  maxMoney,
  minMoney,
  moneyFromAmount,
  moneyFromCents,
  negateMoney,
  ratioOf,
  subtractMoney,
  sumMoney,
} from '../src/shared/money/money'

describe('money', () => {
  it('reads a decimal amount as whole cents, without floating-point drift', () => {
    expect(moneyFromAmount(0.29)).toBe(29)
    expect(moneyFromAmount(-39.9)).toBe(-3990)
    expect(moneyFromAmount(17199.5)).toBe(1719950)
    expect(amountOf(moneyFromAmount(-1043.67))).toBe(-1043.67)
  })

  it('rounds a third decimal half away from zero, by what the cell says and not its float times 100', () => {
    expect([1.005, 1.255, 8.325, 1.004, -1.005, -8.325].map(moneyFromAmount)).toEqual([101, 126, 833, 100, -101, -833])
    expect(Object.is(moneyFromAmount(-0.001), 0)).toBe(true)
    expect(moneyFromAmount(1e21)).toBe(1e23)
  })

  it('refuses what is not an amount', () => {
    expect(() => moneyFromAmount(Number.NaN)).toThrow(RangeError)
    expect(() => moneyFromCents(1.5)).toThrow(RangeError)
  })

  it('adds, subtracts, negates and sums exactly', () => {
    const tenths = Array.from({ length: 10 }, () => moneyFromAmount(0.1))

    expect(sumMoney(tenths)).toBe(100)
    expect(addMoney(moneyFromCents(5), moneyFromCents(7))).toBe(12)
    expect(subtractMoney(moneyFromCents(5), moneyFromCents(7))).toBe(-2)
    expect(negateMoney(ZERO)).toBe(0)
    expect(Object.is(negateMoney(ZERO), -0)).toBe(false)
  })

  it('takes the size, the smaller and the larger of two amounts', () => {
    expect(absMoney(moneyFromCents(-5))).toBe(5)
    expect(absMoney(moneyFromCents(5))).toBe(5)
    expect(Object.is(absMoney(ZERO), 0)).toBe(true)
    expect(minMoney(moneyFromCents(-5), moneyFromCents(7))).toBe(-5)
    expect(maxMoney(moneyFromCents(-5), moneyFromCents(7))).toBe(7)
  })

  it('divides whole numbers exactly, rounding half away from zero on both signs', () => {
    expect(dividedRounded(5, 2)).toBe(3)
    expect(dividedRounded(-5, 2)).toBe(-3)
    expect(dividedRounded(749_999, 1_000)).toBe(750)
    expect(dividedRounded(-1, 4)).toBe(0)
    expect(Object.is(dividedRounded(-1, 4), -0)).toBe(false)
  })

  it('divides to the cent, rounding half away from zero on both signs', () => {
    expect(divideMoney(moneyFromCents(5), 2)).toBe(3)
    expect(divideMoney(moneyFromCents(-5), 2)).toBe(-3)
    // 100 / 3 = 33.33… cents
    expect(divideMoney(moneyFromCents(100), 3)).toBe(33)
    expect(() => divideMoney(moneyFromCents(1), 0)).toThrow(RangeError)
  })

  it('gives a ratio, or null against a zero whole', () => {
    expect(ratioOf(moneyFromCents(25), moneyFromCents(100))).toBe(0.25)
    expect(ratioOf(moneyFromCents(25), ZERO)).toBeNull()
  })
})
