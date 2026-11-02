import { informalBalanceOn } from './informalBalance'
import type { ExpectedPlan, InformalLoan } from '../../workbook/domain/informalLoan'
import type { Movement } from '../../workbook/domain/movement'
import { civilDate, dayOfMonth } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthNumber, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, moneyFromCents, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** How a loan's repayments stand against its expected plan on a day. */
export interface PlanStanding {
  /** What the plan expects repaid by the day: one instalment for each due date before it, and never more than was repaid and is still owed. */
  readonly expected: Money
  /** Repaid, in money or in kind, from the day the plan starts to the end of the day. */
  readonly repaid: Money
  /** Repaid less expected. Above zero the borrower is ahead, below zero behind. */
  readonly ahead: Money
  /** The next due date on or after the day and what falls due on it, while something is still owed and the plan still asks for more. */
  readonly next: { readonly date: CivilDate; readonly amount: Money } | null
}

/** The plan's day in the month, or the month's last day when the month is shorter. */
function dueIn(month: MonthKey, plan: ExpectedPlan): CivilDate {
  const last = lastDayOf(month)
  return plan.day < dayOfMonth(last) ? civilDate(yearOfMonth(month), monthNumber(month), plan.day) : last
}

/** The plan's due dates after the day it starts, in order, up to the first one on or after `day`, which comes last. */
function dueDatesUpTo(plan: ExpectedPlan, day: CivilDate): CivilDate[] {
  const dates: CivilDate[] = []
  for (let month = monthOf(plan.from); ; month = addMonths(month, 1)) {
    const due = dueIn(month, plan)
    if (due <= plan.from) continue
    dates.push(due)
    if (due >= day) return dates
  }
}

/**
 * How the loan's repayments since its plan started stand on the day, or null for a loan without a plan.
 * An instalment counts as due from the day after its due date, so on the due date itself nobody is behind
 * on it yet. The plan never expects more than the borrower repaid and still owes, so a loan that was let
 * go of in part, or never owed that much, asks for no more than is left. Borrowing more after the plan
 * starts makes nobody behind.
 */
export function planStanding(loan: InformalLoan, movements: readonly Movement[], day: CivilDate): PlanStanding | null {
  const plan = loan.expected
  if (plan === null) return null
  const repaid = sumMoney(
    movements.filter((movement) => (movement.kind === 'repaid' || movement.kind === 'repaid-in-kind') && movement.date >= plan.from && movement.date <= day).map((movement) => movement.amount),
  )
  const owed = informalBalanceOn(loan, movements, day)
  const reachable = sumMoney([repaid, owed > 0 ? owed : ZERO])
  const dates = dueDatesUpTo(plan, day)
  const due = dates.filter((date) => date < day).length
  const asked = moneyFromCents(plan.monthly * due)
  const expected = asked < reachable ? asked : reachable
  const left = subtractMoney(reachable, asked)
  const nextDate = dates.at(-1)
  return {
    expected,
    repaid,
    ahead: subtractMoney(repaid, expected),
    next: owed > 0 && left > 0 && nextDate !== undefined && nextDate >= day ? { date: nextDate, amount: left < plan.monthly ? left : plan.monthly } : null,
  }
}
