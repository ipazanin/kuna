import type { LoanChange } from './loanScenario'
import { scenarioPlan } from './scenarioPlan'
import type { DatedCost, ScenarioBase } from './scenarioPlan'
import type { PlanRow } from '../../bankLoans/domain/loanPlan'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater, wholeMonthsBetween } from '../../../../shared/calendar/monthKey'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { solvedRate } from '../../../../shared/money/rateSolver'

/** Years between two days as the EU effective rate counts them: whole months over 12, then the days left over 365. */
function monthsAndDaysOver365(from: CivilDate, to: CivilDate): number {
  const months = wholeMonthsBetween(from, to)
  return months / 12 + daysBetween(dayMonthsLater(from, months), to) / 365
}

/**
 * Kuna's estimate of the effective rate (EKS): the yearly rate at which the principal on the drawdown
 * equals every payment and cost, each discounted from its day, rounded half up to two decimals of a
 * percent. Rows count their full payment, so a subsidy stays out, as it does in the bank's figure.
 * Null when no rate balances them.
 */
export function effectiveRate(principal: Money, drawdown: CivilDate, rows: readonly PlanRow[], costs: readonly DatedCost[]): YearlyRate | null {
  const rate = solvedRate([{ date: drawdown, amount: negateMoney(principal) }, ...rows.map((row) => ({ date: row.date, amount: row.payment })), ...costs], monthsAndDaysOver365)
  return rate === null ? null : ((Math.round(rate * 10_000) * 100) as YearlyRate)
}

/**
 * Kuna's estimate of an offer's effective rate, worked out on the offer with its rate changes up to a
 * move only, since the EKS assumes the loan runs to its end as signed. Null when that plan is refused
 * or no rate balances it.
 */
export function offerEks(base: ScenarioBase, changes: readonly LoanChange[]): YearlyRate | null {
  const move = changes.find((change) => change.kind === 'move')
  const plan = scenarioPlan(
    base,
    changes.filter((change) => change.kind === 'rate-change' && (move === undefined || change.from <= move.on)),
    null,
  )
  return 'refused' in plan ? null : effectiveRate(plan.loan.principal, plan.loan.drawdown, plan.rows, plan.costs)
}
