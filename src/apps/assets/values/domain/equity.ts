import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What Assets counts of an asset and of the bank loan on it, and what is yours after the loan. */
export interface Equity {
  readonly value: Money | null
  /** Null when no loan is found for it, or its plan cannot be worked out. */
  readonly owed: Money | null
  /** The value less what is owed, null while either is unknown. */
  readonly yours: Money | null
}

/** What is counted of an asset and of its loan, both in whole, since an asset is not shared. Every figure of an asset's value and its loan reads it from here. */
export function equityOf(value: Money | null, loan: { readonly owed: Money | null } | null): Equity {
  const owed = loan?.owed ?? null
  return { value, owed, yours: value === null || owed === null ? null : subtractMoney(value, owed) }
}
