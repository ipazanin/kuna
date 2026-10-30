import type { ScenarioPlan } from '../domain/scenarioPlan'
import { payoffDate, splitOf } from '../../bankLoans/domain/loanFigures'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What a scenario owes at a month end, and the interest you have paid since the comparison starts. */
export interface ScenarioMonth {
  readonly month: MonthKey
  readonly owed: Money
  readonly interest: Money
}

/** Each month end from the month of `from`, or of the drawdown for a whole loan, to the payoff, in one walk over the rows. */
export function scenarioMonths(plan: ScenarioPlan, from: CivilDate | null): ScenarioMonth[] {
  const payoff = payoffDate(plan.rows)
  if (payoff === null) return []
  let owed = plan.loan.principal
  let interest = ZERO
  let next = 0
  return monthsFrom(monthOf(from ?? plan.loan.drawdown), monthOf(payoff)).map((month) => {
    const end = lastDayOf(month)
    for (; next < plan.rows.length && plan.rows[next]!.date <= end; next += 1) {
      const row = plan.rows[next]!
      owed = row.balance
      if (from === null || row.date > from) interest = addMoney(interest, splitOf(row).interest)
    }
    return { month, owed, interest }
  })
}
