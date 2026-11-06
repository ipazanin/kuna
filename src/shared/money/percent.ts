import { dividedRounded, moneyFromCents } from './money'
import type { Money } from './money'
import { formatRate } from './moneyFormat'

/** A rate applied to money, as a whole number of basis points: 10% is 1000, 16.5% is 1650, a coefficient of 0.65 is 6500. */
export type Percent = number & { readonly __unit: 'basis-points' }

/** A measured ratio where 1 is the whole, as a float, never multiplied back into money. A part of a whole is 0 to 1, and a gain or a change can fall outside that. */
export type Share = number & { readonly __unit: 'share-of-one' }

const BASIS_POINTS_PER_WHOLE = 10_000
const BASIS_POINTS_PER_PERCENT = 100
const PERCENT_PER_WHOLE = 100

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

/** The amount times the rate, rounded half away from zero to the cent, which is Kuna's convention since the law docs state no rounding rule. */
export function moneyAt(amount: Money, rate: Percent): Money {
  return moneyFromCents(dividedRounded(amount * rate, BASIS_POINTS_PER_WHOLE))
}

/** The part of a gross amount that a rate added on top makes up, such as the VAT inside a price, rounded half away from zero to the cent. */
export function moneyInside(gross: Money, rate: Percent): Money {
  return moneyFromCents(dividedRounded(gross * rate, BASIS_POINTS_PER_WHOLE + rate))
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

/** A rate as people write it: 2150 basis points is 21.5%, or 21,5 % in Croatian. */
export function percentText(rate: Percent): string {
  return formatRate(shareOfPercent(rate))
}
