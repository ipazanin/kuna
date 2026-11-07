import { stepsOfNumber } from './numberRounding'
import type { Share } from './percent'

/**
 * An amount of money as a whole number of cents. Integer cents make sums exact, so no figure needs
 * the half-cent tolerance the Sheet formulas carry.
 */
export type Money = number & { readonly __unit: 'cents' }

export const ZERO = 0 as Money

/** What a typed amount that reads as no amount stands for, so a field can show its error. It is no figure and is never summed. */
export const UNREADABLE_AMOUNT = Number.NaN as Money

/** Rounds half away from zero, so a negative number rounds the same way as its positive twin. */
export function roundHalfAwayFromZero(fractionalCents: number): number {
  return Math.sign(fractionalCents) * Math.round(Math.abs(fractionalCents)) + 0
}

/** Reads a decimal amount as a Sheet cell holds it, for example `-39.9`, rounded half away from zero to the cent, so 1.005 is 1.01. */
export function moneyFromAmount(amount: number): Money {
  const cents = stepsOfNumber(amount, 2)
  if (cents === null) {
    throw new RangeError(`${amount} is not an amount of money.`)
  }
  return (Number(cents) + 0) as Money
}

/** A figure worked out in fractional cents, rounded half away from zero, so a loss and a gain of the same size round alike. */
export function moneyFromFractionalCents(fractionalCents: number): Money {
  return roundHalfAwayFromZero(fractionalCents) as Money
}

export function moneyFromCents(cents: number): Money {
  if (!Number.isInteger(cents)) {
    throw new RangeError(`${cents} is not a whole number of cents.`)
  }
  return (cents + 0) as Money
}

/** A number a chart hands back from a series of cents. It stays as it is, since a tick between two values can hold a fraction of a cent, which `moneyFromCents` refuses. */
export function moneyOfChart(value: number): Money {
  return value as Money
}

/** The decimal amount, for charts and for comparing with a Sheet figure. */
export function amountOf(money: Money): number {
  return money / 100
}

export function addMoney(left: Money, right: Money): Money {
  return (left + right) as Money
}

export function subtractMoney(left: Money, right: Money): Money {
  return (left - right) as Money
}

export function negateMoney(money: Money): Money {
  return (0 - money) as Money
}

export function absMoney(money: Money): Money {
  return Math.abs(money) as Money
}

export function minMoney(left: Money, right: Money): Money {
  return left < right ? left : right
}

export function maxMoney(left: Money, right: Money): Money {
  return left > right ? left : right
}

export function sumMoney(amounts: Iterable<Money>): Money {
  let total = 0
  for (const amount of amounts) {
    total += amount
  }
  return total as Money
}

/** The whole-number quotient rounded half away from zero, done in integers so no half cent drifts. */
export function dividedRounded(numerator: number, denominator: number): number {
  const magnitude = Math.floor((2 * Math.abs(numerator) + denominator) / (2 * denominator))
  return Math.sign(numerator) * magnitude + 0
}

/** Splits an amount into `divisor` equal parts, rounded to the cent. An average per month is one. */
export function divideMoney(money: Money, divisor: number): Money {
  if (divisor <= 0 || !Number.isFinite(divisor)) {
    throw new RangeError(`Cannot divide money by ${divisor}.`)
  }
  return roundHalfAwayFromZero(money / divisor) as Money
}

/** One amount as a share of another, or null when the whole is zero. */
export function ratioOf(part: Money, whole: Money): Share | null {
  return whole === 0 ? null : ((part / whole) as Share)
}

/** An amount written for a person to read in a problem, such as `-1234.50`, the same in every locale. */
export function plainAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}
