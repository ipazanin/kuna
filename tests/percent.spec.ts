import { describe, expect, it } from 'vitest'

import { moneyFromCents, ratioOf } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import {
  moneyAt,
  moneyAtPartOfYear,
  moneyBefore,
  moneyInside,
  percentFromBasisPoints,
  percentFromFraction,
  percentFromWhole,
  percentFromWritten,
  percentText,
  restOf,
  shareFromPercent,
  shareOfPercent,
  wholePercentOf,
  writtenPercent,
} from '../src/shared/money/percent'
import type { Percent, Share } from '../src/shared/money/percent'
import type { YearlyRate } from '../src/apps/loans/bankLoans/domain/yearlyRate'
import { basisPoints } from '../src/apps/company/packs/hr-doo/ruleset/schema'

const quarter = percentFromBasisPoints(2500)

describe('percent', () => {
  it('makes a rate from basis points or a whole percent, and refuses what is neither', () => {
    expect(percentFromBasisPoints(1650)).toBe(1650)
    expect(percentFromWhole(24)).toBe(2400)
    expect(() => percentFromBasisPoints(16.5)).toThrow(RangeError)
    expect(() => percentFromBasisPoints(-1)).toThrow(RangeError)
    expect(() => percentFromWhole(12.5)).toThrow(RangeError)
    expect(() => percentFromWhole(-1)).toThrow(RangeError)
  })

  it.each([
    [0.8, 80],
    [2.5, 250],
    [2.65, 265],
    [0, 0],
    [100, 10_000],
    [120, 12_000],
    [2.6500000000000004, 265],
    [2.345, null],
    [0.001, null],
    [-1, null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
  ])('reads a rate written as %d on the scale of 0 to 100 as %j basis points', (written, points) => {
    expect(percentFromWritten(written)).toBe(points)
  })

  it.each([
    [0.8, 8000],
    [0.1, 1000],
    [0.07, 700],
    [1, 10_000],
    [0, 0],
    [0.12345, 1235],
    [0.12344, 1234],
  ])('reads a stored fraction of %d as %d basis points', (fraction, points) => {
    expect(percentFromFraction(fraction)).toBe(points)
  })

  it('refuses a stored fraction that is below zero or no number', () => {
    expect(() => percentFromFraction(-0.1)).toThrow(RangeError)
    expect(() => percentFromFraction(Number.NaN)).toThrow(RangeError)
  })

  it('gives a rate back on the scale of 0 to 100, the same in every locale', () => {
    expect([1, 50, 250, 265, 10_000].map((points) => writtenPercent(percentFromBasisPoints(points)))).toEqual([0.01, 0.5, 2.5, 2.65, 100])
  })

  it('takes a yearly rate for the part of a year an amount was held', () => {
    // 1,000.00 at 25% is 250.00 a year, and three months of twelve is 62.50.
    expect(moneyAtPartOfYear(moneyFromCents(100_000) * 3, quarter, 12)).toBe(6250)
    // 1,000.00 at 2% is 20.00 a year, and 10 days of 365 is 54.79 cents, which rounds up.
    expect(moneyAtPartOfYear(moneyFromCents(100_000) * 10, percentFromBasisPoints(200), 365)).toBe(55)
  })

  it('finds an amount before a rate was added on top', () => {
    expect(moneyBefore(moneyFromCents(11_650), percentFromBasisPoints(1650))).toBe(10_000)
    // 100.00 of cost with 16.5% added on top is 85.8369 of gross.
    expect(moneyBefore(moneyFromCents(10_000), percentFromBasisPoints(1650))).toBe(8584)
  })

  it('rounds a rate of an amount half away from zero on both signs', () => {
    expect(moneyAt(moneyFromCents(10_000), quarter)).toBe(2500)
    expect(moneyAt(moneyFromCents(10), percentFromBasisPoints(2500))).toBe(3)
    expect(moneyAt(moneyFromCents(-10), percentFromBasisPoints(2500))).toBe(-3)
    expect(moneyAt(moneyFromCents(-1), percentFromBasisPoints(100))).toBe(0)
    expect(Object.is(moneyAt(moneyFromCents(-1), percentFromBasisPoints(100)), -0)).toBe(false)
  })

  it('finds the part a rate makes up inside a gross amount', () => {
    expect(moneyInside(moneyFromCents(12_500), quarter)).toBe(2500)
    expect(moneyInside(moneyFromCents(100), quarter)).toBe(20)
    expect(moneyInside(moneyFromCents(-12_500), quarter)).toBe(-2500)
    expect(moneyInside(moneyFromCents(12_500), percentFromBasisPoints(0))).toBe(0)
  })

  it('leaves the rest of the whole, and refuses a rate over the whole', () => {
    expect(restOf(percentFromBasisPoints(3000))).toBe(7000)
    expect(restOf(percentFromBasisPoints(10_000))).toBe(0)
    expect(() => restOf(percentFromBasisPoints(10_001))).toThrow(RangeError)
  })

  it('states a rate as a share', () => {
    expect(shareOfPercent(quarter)).toBe(0.25)
    expect(shareFromPercent(12.5)).toBe(0.125)
  })

  it('writes a rate as people do', () => {
    expect(percentText(percentFromBasisPoints(2150))).toBe('21.5%')
    expect(percentText(percentFromBasisPoints(1000))).toBe('10%')
  })

  it('makes a share from a ratio of money, which a gain can take outside 0 to 1', () => {
    expect(ratioOf(moneyFromCents(25), moneyFromCents(100))).toBe(0.25)
    expect(ratioOf(moneyFromCents(150), moneyFromCents(100))).toBe(1.5)
    expect(ratioOf(moneyFromCents(-30), moneyFromCents(100))).toBe(-0.3)
  })

  it('keeps the rule rows of the d.o.o. pack on the same type and scale', () => {
    const rate: Percent = quarter
    expect(basisPoints(rate).basisPoints).toBe(2500)
    expect(() => basisPoints(16.5)).toThrow(RangeError)
  })

  it('refuses to mix the scales at compile time', () => {
    const cents = moneyFromCents(100)
    const share: Share = shareOfPercent(quarter)
    const stillANumber: number = quarter

    // @ts-expect-error a plain number is no rate
    expect(moneyAt(cents, 2500)).toBe(25)
    // @ts-expect-error a share is on another scale
    expect(moneyAt(cents, share)).toBe(0)
    // @ts-expect-error a bank's yearly rate is in millionths
    expect(moneyAt(cents, 31825 as YearlyRate)).toBe(318)
    // @ts-expect-error a rate is no amount
    const amount: Money = quarter
    // @ts-expect-error a share is no rate
    const rate: Percent = share

    expect([amount, rate, stillANumber]).toEqual([2500, 0.25, 2500])
  })

  it.each([
    [29, 100, 29],
    [98_994, 120_000, 82],
    [99, 100, 99],
    [100, 100, 100],
    [0, 100, 0],
    [1, 3, 33],
    [2, 3, 66],
  ])('gives %d cents of %d as %d whole percent, rounded down', (part, whole, percent) => {
    expect(wholePercentOf(moneyFromCents(part), moneyFromCents(whole))).toBe(percent)
  })
})
