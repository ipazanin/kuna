import { unconvertedCount } from '../../rates/domain/euroRows'
import type { AccountOnDay } from '../../rates/domain/euroRows'
import { negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What the accounts hold in euros on a day and what the overdrawn ones owe, as Net worth, the home card and Accounts add them up. */
export interface AccountStanding {
  readonly held: Money
  /** How many accounts the held sum is across. */
  readonly heldAccounts: number
  /** What the accounts below zero owe, as a positive sum, or null when none is below zero. */
  readonly owed: Money | null
  /** How many accounts in another currency have no euro figure, which the sums count as nothing. */
  readonly unconverted: number
}

/** The standing of the accounts `countedAccounts` counts on the day. */
export function accountStanding(counted: readonly AccountOnDay[]): AccountStanding {
  const converted = counted.flatMap((shown) => (shown.euros === null ? [] : [shown.euros]))
  const held = converted.filter((amount) => amount >= 0)
  const owed = converted.filter((amount) => amount < 0)
  return {
    held: sumMoney(held),
    heldAccounts: held.length,
    owed: owed.length === 0 ? null : negateMoney(sumMoney(owed)),
    unconverted: unconvertedCount(counted),
  }
}
