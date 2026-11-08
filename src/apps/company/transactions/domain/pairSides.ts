import type { EntrySide } from '../../../../shared/categorising/domain/rule'
import type { Money } from '../../../../shared/money/money'

/** The side each paired role takes, by role. */
export type PairSides = Readonly<Record<string, EntrySide>>

/**
 * The side of a credit and debit pair each of core's paired roles takes. A reimbursement goes either way, so it has no
 * side here.
 */
const CORE_PAIR_SIDES: PairSides = { revenue: 'credit', 'client-refund': 'debit' }

/** Core's paired roles with the installed pack's, whose sides a category's roles are checked against. */
export function pairSidesWith(packPairSides: PairSides): PairSides {
  return { ...CORE_PAIR_SIDES, ...packPairSides }
}

/** Whether a category with these roles may file a row of this amount: money in takes no debit role, and money out no credit role. */
export function fitsPairSide(roles: readonly string[], amount: Money, sides: PairSides): boolean {
  const side: EntrySide = amount > 0 ? 'credit' : 'debit'
  return roles.every((role) => !Object.hasOwn(sides, role) || sides[role] === side)
}
