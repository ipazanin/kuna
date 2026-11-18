import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Percent } from '../../../../shared/money/percent'
import { yourPartOf } from '../../../../shared/money/yourPart'

/** What Assets counts of an asset and of the bank loan on it, and what is yours after the loan. */
export interface Equity {
  /** Your part of the value, null without a value. */
  readonly value: Money | null
  /** The whole value, only for an asset you own part of. */
  readonly whole?: Money
  /** What you owe on the loan, null when no loan is found for it, or its plan cannot be worked out. */
  readonly owed: Money | null
  /** Your part of the value less what you owe, null while either is unknown. */
  readonly yours: Money | null
}

/** What is counted of an asset at your part of it on the day, and of its loan. Every figure of an asset's value and its loan reads it from here. */
export function equityOf(whole: Money | null, part: Percent | null, loan: { readonly owed: Money | null } | null): Equity {
  const value = whole === null ? null : yourPartOf(whole, part)
  const owed = loan?.owed ?? null
  return { value, ...(whole === null || part === null ? {} : { whole }), owed, yours: value === null || owed === null ? null : subtractMoney(value, owed) }
}
