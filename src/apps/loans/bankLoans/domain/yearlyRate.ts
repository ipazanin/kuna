import { dividedRounded, moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** A yearly interest rate in millionths, so 3.18% is 31_800 and 2.143% is 21_430, exact to four decimals of a percent. */
export type YearlyRate = number & { readonly __unit: 'millionths' }

const MILLIONTHS_PER_WHOLE = 1_000_000
const MILLIONTHS_PER_PERCENT = 10_000
const MONTHS_PER_YEAR = 12

/** A percent as a bank writes it, such as `3.18` or `3.1825`: up to two whole digits and up to four decimals. */
const RATE_TEXT = /^(\d{1,2})(?:\.(\d{1,4}))?$/

/** The rate a percent written as text names, or null for text that is not one. */
export function rateOfText(text: string): YearlyRate | null {
  const match = RATE_TEXT.exec(text.trim())
  if (match === null) {
    return null
  }
  return (Number(match[1]) * MILLIONTHS_PER_PERCENT + Number((match[2] ?? '').padEnd(4, '0'))) as YearlyRate
}

/** The percent as its shortest text, such as `3.18` for 31_800 and `3` for 30_000. */
export function rateText(rate: YearlyRate): string {
  const decimals = String(rate % MILLIONTHS_PER_PERCENT)
    .padStart(4, '0')
    .replace(/0+$/, '')
  const whole = String(Math.floor(rate / MILLIONTHS_PER_PERCENT))
  return decimals === '' ? whole : `${whole}.${decimals}`
}

/** One month's interest on the balance: balance times the yearly rate over 12, rounded half up to the cent. */
export function monthlyInterest(balance: Money, rate: YearlyRate): Money {
  return moneyFromCents(dividedRounded(balance * rate, MONTHS_PER_YEAR * MILLIONTHS_PER_WHOLE))
}

/**
 * The equal monthly instalment that repays the balance over `count` months at the rate, rounded half
 * up to the cent. With r the monthly rate, it is balance × r × (1 + r)^count / ((1 + r)^count − 1),
 * worked out in exact integers, since r is a whole number of millionths over 12.
 */
export function annuity(balance: Money, rate: YearlyRate, count: number): Money {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`${count} is not a number of instalments.`)
  }
  if (rate === 0) {
    return moneyFromCents(dividedRounded(balance, count))
  }
  const perYear = BigInt(MONTHS_PER_YEAR * MILLIONTHS_PER_WHOLE)
  const grown = (perYear + BigInt(rate)) ** BigInt(count)
  const numerator = BigInt(balance) * BigInt(rate) * grown
  const denominator = perYear * (grown - perYear ** BigInt(count))
  return moneyFromCents(Number((2n * numerator + denominator) / (2n * denominator)))
}
