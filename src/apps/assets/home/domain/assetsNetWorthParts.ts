import type { AssetsTotal } from '../../values/domain/assetsOnDay'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What Assets adds to the sum on Net worth: what the assets are worth on the day, on the side of what you have. */
export interface AssetsNetWorthPart {
  readonly side: 'has'
  readonly cents: Money
}

/** The assets' value on the day as the one part Assets adds to Net worth. */
export function assetsNetWorthParts(total: Pick<AssetsTotal, 'value'>): AssetsNetWorthPart[] {
  return [{ side: 'has', cents: total.value }]
}

/** What is yours after every known loan on the assets, added up. */
export function yoursAfterLoans(yoursAfter: AssetsTotal['yoursAfter']): Money {
  return sumMoney(yoursAfter.map((entry) => entry.yours))
}
