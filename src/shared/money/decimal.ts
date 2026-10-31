import { moneyFromCents } from './money'
import type { Money } from './money'
import { AMOUNT_SEPARATORS } from './typedAmount'
import { language } from '../text/language'
import type { Language } from '../text/language'

/** An exact decimal with up to twelve places, as a whole number of its smallest step. */
export type Decimal = bigint & { readonly __unit: 'decimal-12' }

const PLACES = 12
const STEPS_PER_UNIT = 10n ** BigInt(PLACES)
const STEPS_PER_CENT = STEPS_PER_UNIT / 100n

export const DECIMAL_ZERO = 0n as Decimal

const STORED_TEXT = /^(-?)(\d+)(?:\.(\d{1,12}))?$/
const TYPED_TEXT = /^(\d+)(?:[.,](\d{1,12}))?$/

/** Thousands grouped as the language writes them, before an optional decimal mark, as in 1,000 or 1.234,5. A first group of 0 is a decimal, so 0,125 is an eighth. */
const GROUPED: Readonly<Record<Language, RegExp>> = {
  en: /^[1-9]\d{0,2}(,\d{3})+(\.\d{1,12})?$/,
  hr: /^[1-9]\d{0,2}(\.\d{3})+(,\d{1,12})?$/,
}

/** Decimal text as a record stores it, such as `0.00841` or `-3.5`. Null for anything else. */
export function decimalOfText(text: string): Decimal | null {
  const match = STORED_TEXT.exec(text)
  return match === null ? null : decimalOfDigits(match[1] === '-', match[2]!, match[3] ?? '')
}

/**
 * Typed into a field, as `typedAmount` reads money: with a decimal point or a decimal comma, and with thousands grouped
 * as the language on screen writes them, so 1,000 in English and 1.000 in Croatian are a thousand. There is no k or m.
 * Null for anything that is not zero or more with at most twelve places, blank included.
 */
export function typedDecimal(text: string): Decimal | null {
  const trimmed = text.trim()
  const match = TYPED_TEXT.exec(GROUPED[language].test(trimmed) ? trimmed.replaceAll(AMOUNT_SEPARATORS[language].group, '') : trimmed)
  return match === null ? null : decimalOfDigits(false, match[1]!, match[2] ?? '')
}

const NUMBER_TEXT = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/

/**
 * A number, as a spreadsheet's number cell gives it, rounded half away from zero to `places` places, from none to
 * twelve. It is read from the shortest text that gives the number back, so 0.1 + 0.2 is 0.3 at twelve places. Null
 * for a number that is not finite.
 */
export function decimalOfNumber(value: number, places: number): Decimal | null {
  if (!Number.isInteger(places) || places < 0 || places > PLACES) {
    throw new RangeError(`Cannot round to ${places} places.`)
  }
  const match = NUMBER_TEXT.exec(String(value))
  if (match === null) {
    return null
  }
  const fraction = match[3] ?? ''
  const digits = BigInt(`${match[2]}${fraction}`)
  const shift = places - fraction.length + Number(match[4] ?? '0')
  const steps = shift >= 0 ? digits * 10n ** BigInt(shift) : dividedHalfAwayFromZero(digits, 10n ** BigInt(-shift))
  const scaled = steps * 10n ** BigInt(PLACES - places)
  return (match[1] === '-' ? -scaled : scaled) as Decimal
}

/** The shortest text that reads back as the same decimal, such as `100` or `-0.00841`. */
export function decimalText(value: Decimal): string {
  const magnitude = value < 0n ? -value : value
  const fraction = String(magnitude % STEPS_PER_UNIT)
    .padStart(PLACES, '0')
    .replace(/0+$/, '')
  return `${value < 0n ? '-' : ''}${magnitude / STEPS_PER_UNIT}${fraction === '' ? '' : `.${fraction}`}`
}

export function addDecimal(left: Decimal, right: Decimal): Decimal {
  return (left + right) as Decimal
}

export function subtractDecimal(left: Decimal, right: Decimal): Decimal {
  return (left - right) as Decimal
}

export function negateDecimal(value: Decimal): Decimal {
  return -value as Decimal
}

export function sumDecimal(values: Iterable<Decimal>): Decimal {
  let total = 0n
  for (const value of values) {
    total += value
  }
  return total as Decimal
}

/** An amount of euros as an exact decimal. */
export function decimalOfMoney(money: Money): Decimal {
  return (BigInt(money) * STEPS_PER_CENT) as Decimal
}

/** The product, rounded half away from zero to twelve places. */
export function timesDecimal(left: Decimal, right: Decimal): Decimal {
  return dividedHalfAwayFromZero(left * right, STEPS_PER_UNIT) as Decimal
}

/** Left × numerator ÷ denominator, rounded half away from zero to twelve places, for a split's new ÷ old. */
export function scaledDecimal(left: Decimal, numerator: bigint, denominator: bigint): Decimal {
  return dividedHalfAwayFromZero(left * numerator, denominator) as Decimal
}

/** Left ÷ right, rounded half away from zero to twelve places. Right is above zero. */
export function dividedDecimal(left: Decimal, right: Decimal): Decimal {
  return dividedHalfAwayFromZero(left * STEPS_PER_UNIT, right) as Decimal
}

/** The value rounded half away from zero to `places` places, from none to twelve. */
export function roundedDecimal(value: Decimal, places: number): Decimal {
  if (!Number.isInteger(places) || places < 0 || places > PLACES) {
    throw new RangeError(`Cannot round to ${places} places.`)
  }
  const step = 10n ** BigInt(PLACES - places)
  return (dividedHalfAwayFromZero(value, step) * step) as Decimal
}

/**
 * The total split in proportion to the weights. Each part but the last is rounded half away from zero to twelve
 * places and the last takes the rest, so the parts always add up to the total. Weights are zero or more.
 */
export function decimalParts(total: Decimal, weights: readonly bigint[]): Decimal[] {
  return proportionalParts(total, weights) as Decimal[]
}

/** The same split as `decimalParts`, of euros to the cent, so a €1.00 fee over three equal lots is €0.33, €0.33 and €0.34. */
export function moneyParts(total: Money, weights: readonly bigint[]): Money[] {
  return proportionalParts(BigInt(total), weights).map((cents) => moneyFromCents(Number(cents)))
}

/** The amount in euros at a rate of units per euro, rounded half away from zero to the cent. A null rate is for an amount already in euros. */
export function inEuros(amount: Decimal, unitsPerEuro: Decimal | null): Money {
  if (unitsPerEuro === null) {
    return moneyFromCents(Number(dividedHalfAwayFromZero(amount, STEPS_PER_CENT)))
  }
  return moneyFromCents(Number(dividedHalfAwayFromZero(amount * 100n, unitsPerEuro)))
}

function decimalOfDigits(negative: boolean, whole: string, fraction: string): Decimal {
  const steps = BigInt(whole) * STEPS_PER_UNIT + BigInt(fraction.padEnd(PLACES, '0'))
  return (negative ? -steps : steps) as Decimal
}

function proportionalParts(total: bigint, weights: readonly bigint[]): bigint[] {
  const whole = weights.reduce((sum, weight) => sum + weight, 0n)
  const leading = weights.slice(0, -1).map((weight) => (whole === 0n ? 0n : dividedHalfAwayFromZero(total * weight, whole)))
  return weights.length === 0 ? [] : [...leading, total - leading.reduce((sum, part) => sum + part, 0n)]
}

function dividedHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new RangeError(`Cannot divide by ${denominator}.`)
  }
  const magnitude = numerator < 0n ? -numerator : numerator
  const quotient = (2n * magnitude + denominator) / (2n * denominator)
  return numerator < 0n ? -quotient : quotient
}
