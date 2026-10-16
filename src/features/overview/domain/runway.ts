import type { Figure } from '../../filters/domain/drillTarget'
import type { WindowColumn } from './windowAverages'

export interface Runway {
  /** How many months the cash lasts at the recent cost, or null when nothing is being spent. */
  readonly months: number | null
  readonly cashOnHand: Figure
  readonly monthlyCost: Figure
}

/**
 * Cash on hand over the average monthly cost of a window, usually the last three complete months:
 * how long the company runs if no further income arrives. Owner pay counts as cost, owner loans
 * included.
 */
export function runway(cashOnHand: Figure, costWindow: WindowColumn): Runway {
  const { lines, span } = costWindow
  const monthlyCost: Figure = { amount: lines.cost.perMonth, drill: lines.cost.drill }
  return {
    // From the unrounded total, so the figure does not carry the rounding of the monthly cost.
    months: lines.cost.total > 0 ? (cashOnHand.amount * span.monthCount) / lines.cost.total : null,
    cashOnHand,
    monthlyCost,
  }
}
