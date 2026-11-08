import { dividedRounded, moneyFromCents, roundHalfAwayFromZero } from './money'
import type { Money } from './money'
import { decimalText } from './decimal'
import type { Decimal } from './decimal'
import { formatRate } from './moneyFormat'
import type { MoneyFormat } from './moneyFormat'
import { stepsOfNumber } from './numberRounding'

/** A rate applied to money, as a whole number of basis points: 10% is 1000, 16.5% is 1650, a coefficient of 0.65 is 6500. */
export type Percent = number & { readonly __unit: 'basis-points' }

/** A measured ratio where 1 is the whole, as a float, never multiplied back into money. A part of a whole is 0 to 1, and a gain or a change can fall outside that. */
export type Share = number & { readonly __unit: 'share-of-one' }

/** A ratio of nothing, for a part with no whole to measure against. */
export const ZERO_SHARE = 0 as Share

const BASIS_POINTS_PER_WHOLE = 10_000
const BASIS_POINTS_PER_PERCENT = 100
const PERCENT_PER_WHOLE = 100
const BASIS_POINT_PLACES_OF_FRACTION = 4
const WRITTEN_PERCENT_PLACES = 5
const WRITTEN_STEPS_PER_BASIS_POINT = 1000n
const FRACTION_STEPS_PER_WHOLE = 1_000_000
const WRITTEN_STEPS_PER_WHOLE = 10_000

export function percentFromBasisPoints(points: number): Percent {
  if (!Number.isInteger(points) || points < 0) {
    throw new RangeError(`${points} is not a whole number of basis points.`)
  }
  return points as Percent
}

/** A rate the law states in whole percent, such as 24 for 24%. */
export function percentFromWhole(whole: number): Percent {
  if (!Number.isInteger(whole)) {
    throw new RangeError(`${whole} is not a whole percent.`)
  }
  return percentFromBasisPoints(whole * BASIS_POINTS_PER_PERCENT)
}

/**
 * A rate written on the scale of 0 to 100, such as 2.5 for 2.5%. Null when it is below zero or finer than a basis point, so 2.345 is no rate.
 * It reads to a thousandth of a basis point, so float noise such as 2.6500000000000004 still reads as 2.65.
 */
export function percentFromWritten(written: number): Percent | null {
  const steps = stepsOfNumber(written, WRITTEN_PERCENT_PLACES)
  if (steps === null || steps < 0n || steps % WRITTEN_STEPS_PER_BASIS_POINT !== 0n) {
    return null
  }
  return percentFromBasisPoints(Number(steps / WRITTEN_STEPS_PER_BASIS_POINT))
}

/** A rate stored as a fraction where 1 is the whole, to the nearest basis point, so 0.8 is 80%. */
export function percentFromFraction(fraction: number): Percent {
  const points = stepsOfNumber(fraction, BASIS_POINT_PLACES_OF_FRACTION)
  if (points === null) {
    throw new RangeError(`${fraction} is not a fraction.`)
  }
  return percentFromBasisPoints(Number(points))
}

/** The amount times the rate, rounded half away from zero to the cent, which is Kuna's convention since the law docs state no rounding rule. */
export function moneyAt(amount: Money, rate: Percent): Money {
  return moneyFromCents(dividedRounded(amount * rate, BASIS_POINTS_PER_WHOLE))
}

/** The part of a gross amount that a rate added on top makes up, such as the VAT inside a price, rounded half away from zero to the cent. */
export function moneyInside(gross: Money, rate: Percent): Money {
  return moneyFromCents(dividedRounded(gross * rate, BASIS_POINTS_PER_WHOLE + rate))
}

/** A yearly rate on an amount held for part of a year. The first figure is the amount times the days or months it was held, and the last is how many of them a year has. */
export function moneyAtPartOfYear(amountTimesPeriods: number, rate: Percent, periodsInYear: number): Money {
  return moneyFromCents(dividedRounded(amountTimesPeriods * rate, BASIS_POINTS_PER_WHOLE * periodsInYear))
}

/** What a gross amount was before a rate was added on top, such as the gross pay inside an employer's cost, rounded half away from zero to the cent. */
export function moneyBefore(gross: Money, rate: Percent): Money {
  return moneyFromCents(dividedRounded(gross * BASIS_POINTS_PER_WHOLE, BASIS_POINTS_PER_WHOLE + rate))
}

/** What the rate leaves of the whole: 30% leaves 70%. */
export function restOf(rate: Percent): Percent {
  return percentFromBasisPoints(BASIS_POINTS_PER_WHOLE - rate)
}

export function shareOfPercent(rate: Percent): Share {
  return (rate / BASIS_POINTS_PER_WHOLE) as Share
}

/** A chart's or a cell's float on the scale of 0 to 100 as a share, so 12.5 is 0.125. */
export function shareFromPercent(percent: number): Share {
  return (percent / PERCENT_PER_WHOLE) as Share
}

/** The rate on the scale of 0 to 100, as a cell or a field holds it, so 250 basis points is 2.5, the same in every locale. */
export function writtenPercent(rate: Percent): number {
  return rate / BASIS_POINTS_PER_PERCENT
}

/** A stored fraction as a person writes it, on the scale of 0 to 100 to four decimals of a percent, so 0.125 is 12.5. */
export function writtenPercentOfFraction(fraction: number): number {
  return roundHalfAwayFromZero(fraction * FRACTION_STEPS_PER_WHOLE) / WRITTEN_STEPS_PER_WHOLE
}

/** An exact percent such as a fund's cost or a bond's coupon as a share, so 0.2 is 0.002. */
export function shareOfDecimalPercent(percent: Decimal): Share {
  return shareFromPercent(Number(decimalText(percent)))
}

/** A ratio already worked out in floats, such as a return or a chart's value, as a share. It holds whatever it is given, since a return can be any size. */
export function shareFromRatio(ratio: number): Share {
  return ratio as Share
}

/** A measured part over its whole, such as days along a scale of days. A whole of 0 gives no number. */
export function shareOfScale(part: number, whole: number): Share {
  return (part / whole) as Share
}

/** A share on the scale of 0 to 100, for a figure shown in points. */
export function pointsOfShare(share: Share): number {
  return share * PERCENT_PER_WHOLE
}

/** A ratio where 1 is the whole, in basis points and not rounded, so 0.00005 is 0.5. */
export function basisPointsOfRatio(ratio: number): number {
  return ratio * BASIS_POINTS_PER_WHOLE
}

/** A percent as somebody wrote it, in basis points to the nearest one, so 2.5 is 250. */
export function nearestBasisPoints(written: number): number {
  return Number(stepsOfNumber(written, 2))
}

/** The whole percent a part is of a whole, rounded down and worked out on the cents, so 29 cents of 100 is 29. */
export function wholePercentOf(part: Money, whole: Money): number {
  return Math.floor((part * PERCENT_PER_WHOLE) / whole)
}

/** A rate as people write it: 2150 basis points is 21.5%, or 21,5 % in Croatian. A file in one language passes its format. */
export function percentText(rate: Percent, format?: MoneyFormat): string {
  return formatRate(shareOfPercent(rate), format)
}
