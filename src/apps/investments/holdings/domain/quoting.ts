import type { PercentQuoting, Quoting } from '../../workbook/domain/instrument'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { DECIMAL_ZERO, addDecimal, decimalOfText, dividedDecimal, scaledDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'

const GRAMS_PER_TROY_OUNCE = decimalOfText('31.1034768')!
const PERCENT = decimalOfText('100')!

/** What a quantity at a price comes to in the quote currency: a bond's nominal at a price in percent of it, anything else units × price. */
export function tradeWorth(quoting: Quoting, quantity: Decimal, price: Decimal): Decimal {
  const worth = timesDecimal(quantity, price)
  return quoting.kind === 'percent' ? dividedDecimal(worth, PERCENT) : worth
}

/** The price at which the quantity comes to the worth, the other way round from `tradeWorth`. The quantity is above zero. */
export function priceOfWorth(quoting: Quoting, worth: Decimal, quantity: Decimal): Decimal {
  const price = dividedDecimal(worth, quantity)
  return quoting.kind === 'percent' ? timesDecimal(price, PERCENT) : price
}

/** A close as a price per unit Kuna holds, so gold's close per troy ounce becomes a price per gram. */
export function closePerUnit(quoting: Quoting, close: Decimal): Decimal {
  return quoting.kind === 'gram' ? dividedDecimal(close, GRAMS_PER_TROY_OUNCE) : close
}

/** What a holding is worth in the quote currency at a price per unit on a day: a bond's clean worth plus the interest accrued to that day. */
export function heldWorth(quoting: Quoting, quantity: Decimal, price: Decimal, day: CivilDate): Decimal {
  const worth = tradeWorth(quoting, quantity, price)
  return quoting.kind === 'percent' ? addDecimal(worth, accruedInterest(quantity, quoting, day)) : worth
}

/**
 * The coupon earned on the nominal since the last coupon day, ACT/ACT: the year's coupon × the days since the last
 * coupon ÷ the days between the last and the next. Coupons fall once a year on the maturity's day and month, and
 * nothing accrues from the maturity on.
 */
export function accruedInterest(nominal: Decimal, bond: PercentQuoting, day: CivilDate): Decimal {
  if (day >= bond.maturity) {
    return DECIMAL_ZERO
  }
  let yearsBefore = 0
  while (dayMonthsLater(bond.maturity, -12 * (yearsBefore + 1)) > day) {
    yearsBefore += 1
  }
  const next = dayMonthsLater(bond.maturity, -12 * yearsBefore)
  const last = dayMonthsLater(bond.maturity, -12 * (yearsBefore + 1))
  return scaledDecimal(timesDecimal(nominal, bond.coupon), BigInt(daysBetween(last, day)), BigInt(daysBetween(last, next)) * 100n)
}
