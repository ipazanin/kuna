import type { ScenarioPlan } from './scenarioPlan'
import { payoffDate, ratePeriodOn, splitOfRows, subsidyRepaidUntil, subsidyShareOf, yourShareOf } from '../../bankLoans/domain/loanFigures'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What a scenario comes to from a day on, or over its whole loan. */
export interface ScenarioOutcome {
  readonly nextInstalment: Money | null
  readonly lastInstalment: Money | null
  /** Whether an instalment before the last differs from the first, since the last of an annuity only takes the rounding left over. */
  readonly instalmentChanges: boolean
  readonly instalments: number
  readonly payoff: CivilDate | null
  /** The interest you pay, leaving out what the subsidy pays of it. */
  readonly interest: Money
  readonly extra: Money
  readonly costs: Money
  /** Principal and interest the subsidy pays. */
  readonly subsidy: Money
  /** Everything you pay: principal, interest, extra payments and costs, less what the subsidy pays. */
  readonly total: Money
  /** The due date of the first instalment at a variable rate, or null when every one is fixed. */
  readonly variableFrom: CivilDate | null
  /**
   * When the scenario repays early by the last day that means paying the subsidy back: that day and
   * what the subsidy has paid up to the change, the most the payback could be.
   */
  readonly subsidyPayback: { readonly until: CivilDate; readonly paidByChange: Money } | null
}

/** The scenario's figures after `from`, or over the whole loan when `from` is null, as an offer is compared. */
export function scenarioOutcome(plan: ScenarioPlan, from: CivilDate | null): ScenarioOutcome {
  const after = plan.rows.filter((row) => from === null || row.date > from)
  const instalments = after.filter((row) => row.kind === 'instalment')
  const variable = (date: CivilDate): boolean => ratePeriodOn(plan.periods, date)?.rateType === 'variable'
  const split = splitOfRows(after)
  const costs = sumMoney(plan.costs.filter((cost) => from === null || cost.date > from).map((cost) => cost.amount))
  const until = subsidyRepaidUntil(plan.loan)
  const early = plan.firstEarlyRepayment
  return {
    nextInstalment: instalments[0]?.payment ?? null,
    lastInstalment: instalments.at(-1)?.payment ?? null,
    instalmentChanges: instalments.slice(0, -1).some((row) => row.payment !== instalments[0]!.payment),
    instalments: instalments.length,
    payoff: payoffDate(plan.rows),
    interest: split.interest,
    extra: split.extra,
    costs,
    subsidy: subsidyShareOf(split),
    total: addMoney(yourShareOf(split), costs),
    variableFrom: instalments.find((row) => variable(row.date))?.date ?? null,
    subsidyPayback: until === null || early === null || early > until ? null : { until, paidByChange: sumMoney(plan.rows.filter((row) => row.date <= early).map((row) => row.subsidy)) },
  }
}

/** What you have paid by the end of each month, your share of each row and the costs. */
function paidByMonthEnds(plan: ScenarioPlan, months: readonly MonthKey[]): Money[] {
  const flows = [...plan.rows.map((row) => ({ date: row.date, amount: row.yourShare })), ...plan.costs].sort((earlier, later) => earlier.date.localeCompare(later.date))
  let paid = ZERO
  let next = 0
  return months.map((month) => {
    const end = lastDayOf(month)
    for (; next < flows.length && flows[next]!.date <= end; next += 1) {
      paid = addMoney(paid, flows[next]!.amount)
    }
    return paid
  })
}

/** The month a move's costs are paid back, and how many months after the move's month that is. */
export interface MoveBreakEven {
  readonly month: MonthKey
  readonly months: number
}

/**
 * The first month end from the move's month on by which you have paid no more with the move, costs
 * included, than the same scenario without the move, or null when that never happens. The two
 * scenarios share every row before the move, so the totals from the start compare what each pays
 * since it.
 */
export function moveBreakEven(withMove: ScenarioPlan, withoutMove: ScenarioPlan): MoveBreakEven | null {
  if (withMove.move === null) return null
  const last = [payoffDate(withMove.rows), payoffDate(withoutMove.rows)].reduce<CivilDate>((latest, day) => (day !== null && day > latest ? day : latest), withMove.move)
  const months = monthsFrom(monthOf(withMove.move), monthOf(last))
  const paidWith = paidByMonthEnds(withMove, months)
  const paidWithout = paidByMonthEnds(withoutMove, months)
  const index = months.findIndex((_, at) => paidWith[at]! <= paidWithout[at]!)
  return index === -1 ? null : { month: months[index]!, months: index }
}
