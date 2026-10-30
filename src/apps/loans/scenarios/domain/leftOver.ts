import type { ScenarioPlan } from './scenarioPlan'
import { payoffDate } from '../../bankLoans/domain/loanFigures'
import { fractionOf } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { wholeMonthsBetween } from '../../../../shared/calendar/monthKey'
import { ZERO, moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** Everything the scenario has cost you by the horizon, each payment grown monthly at the savings rate from its day, plus what it still owes then, in fractional cents. */
function costByHorizon(plan: ScenarioPlan, horizon: CivilDate, monthlyGrowth: number): number {
  const paid = [...plan.rows.map((row) => ({ date: row.date, amount: row.yourShare })), ...plan.costs].filter((flow) => flow.date <= horizon)
  const grown = paid.reduce((total, flow) => total + flow.amount * (1 + monthlyGrowth) ** wholeMonthsBetween(flow.date, horizon), 0)
  const owed = plan.rows.filter((row) => row.date <= horizon).at(-1)?.balance ?? plan.loan.principal
  return grown + owed
}

/**
 * How much each scenario leaves you ahead of the base, counting what the money it does not pay
 * would earn at the savings rate, by the earliest payoff among them. Above zero, the scenario leaves
 * you that much more. The base's own figure is zero.
 */
export function leftOver(plans: readonly ScenarioPlan[], base: ScenarioPlan, savingsRate: YearlyRate): Money[] {
  const horizon = plans.map((plan) => payoffDate(plan.rows)).reduce<CivilDate | null>((earliest, day) => (day !== null && (earliest === null || day < earliest) ? day : earliest), null)
  if (horizon === null) return plans.map(() => ZERO)
  const monthlyGrowth = fractionOf(savingsRate) / 12
  const baseCost = costByHorizon(base, horizon, monthlyGrowth)
  return plans.map((plan) => (plan === base ? ZERO : moneyFromCents(Math.round(baseCost - costByHorizon(plan, horizon, monthlyGrowth)))))
}
