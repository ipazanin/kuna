import { addMonths } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * A limit on a spending category from a month on, in euros, until a later budget of the category. An amount of zero ends the
 * limit. A monthly limit has no `due`. A yearly cost has `due`, the first month it falls due on or after `from`, due again every
 * twelve months after, and its amount is the amount due each year.
 */
export interface Budget {
  readonly id: RecordId
  readonly category: RecordId
  readonly from: MonthKey
  readonly amount: Money
  readonly due?: MonthKey
}

/** Why a yearly cost's due month cannot be kept: before its first month, a year or more after it, or on a budget of zero, which ends the limit. */
export type DueProblem = 'before-from' | 'too-far' | 'on-zero'

/** Why a budget's due month cannot be kept, or null when it can or the budget is monthly. */
export function dueProblem(budget: Pick<Budget, 'from' | 'amount' | 'due'>): DueProblem | null {
  if (budget.due === undefined) return null
  if (budget.amount === 0) return 'on-zero'
  if (budget.due < budget.from) return 'before-from'
  return budget.due > addMonths(budget.from, 11) ? 'too-far' : null
}
