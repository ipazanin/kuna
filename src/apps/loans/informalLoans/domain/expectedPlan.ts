import { informalBalanceOn, lastMovement } from './informalBalance'
import type { ExpectedPlan, InformalLoan } from '../../workbook/domain/informalLoan'
import type { Movement } from '../../workbook/domain/movement'
import { civilDate, dayOfMonth } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthNumber, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, moneyFromCents, subtractMoney, sumMoney } from '../../../../shared/money/money'
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

/** An amount the plan still asks for. */
export interface PlanPayment {
  /** The due date, or the day itself for what the borrower is behind by. */
  readonly date: CivilDate
  readonly amount: Money
  /** What the borrower is behind by, due now. */
  readonly overdue: boolean
}

/** What the loan would owe at a month end had the borrower paid exactly its expected plan. */
export interface PlannedMonth {
  readonly month: MonthKey
  readonly owed: Money
}

/** Which fields of an expected plan break its rules. */
export type ExpectedPlanFaults = Readonly<Record<keyof ExpectedPlan, boolean>>

/**
 * The expected plan the fields give, or null while one breaks its rules: an amount above zero, a first due date on or after the
 * loan starts, and a day of the month from 1 to 31. A field that does not read as its value is null.
 */
export function checkedExpectedPlan(
  monthly: Money | null,
  from: CivilDate | null,
  day: number | null,
  start: CivilDate | null,
): { readonly expected: ExpectedPlan | null; readonly faults: ExpectedPlanFaults } {
  const faults = {
    monthly: monthly === null || monthly <= 0,
    from: from === null || (start !== null && from < start),
    day: day === null || !Number.isInteger(day) || day < 1 || day > 31,
  }
  const expected = monthly !== null && from !== null && day !== null && !Object.values(faults).some(Boolean) ? { monthly, from, day } : null
  return { expected, faults }
}

/** How far past today's month a plan's line runs at most, so a plan of small instalments on a large loan stays readable. */
const PLAN_LINE_MONTHS = 120

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

/** The plan's figures on a day, from which its standing and what it still asks for follow. */
interface PlanDay {
  readonly plan: ExpectedPlan
  readonly expected: Money
  readonly repaid: Money
  /** Still owed at the end of the day, never below zero. */
  readonly owed: Money
  /** What the borrower is behind by, zero when on track or ahead. */
  readonly behind: Money
  /** Still owed at the end of the day and not yet due, which the instalments still to come ask for. */
  readonly notYetDue: Money
  /** The first due date on or after the day. */
  readonly nextDate: CivilDate
}

function planDay(loan: InformalLoan, movements: readonly Movement[], day: CivilDate): PlanDay | null {
  const plan = loan.expected
  if (plan === null) return null
  const repaid = sumMoney(
    movements.filter((movement) => (movement.kind === 'repaid' || movement.kind === 'repaid-in-kind') && movement.date >= plan.from && movement.date <= day).map((movement) => movement.amount),
  )
  const balance = informalBalanceOn(loan, movements, day)
  const owed = balance > 0 ? balance : ZERO
  const reachable = sumMoney([repaid, owed])
  const dates = dueDatesUpTo(plan, day)
  const asked = moneyFromCents(plan.monthly * dates.filter((date) => date < day).length)
  const expected = asked < reachable ? asked : reachable
  const short = subtractMoney(expected, repaid)
  const behind = short > 0 ? short : ZERO
  return { plan, expected, repaid, owed, behind, notYetDue: subtractMoney(owed, behind), nextDate: dates.at(-1) ?? day }
}

/** The instalments still to come, the first on the next due date, each the plan's amount and the last only what is left. */
function instalmentsAhead(state: PlanDay, count: number): PlanPayment[] {
  const instalments: PlanPayment[] = []
  let left = state.notYetDue
  for (let date = state.nextDate; left > 0 && instalments.length < count; date = dueIn(addMonths(monthOf(date), 1), state.plan)) {
    const amount = left < state.plan.monthly ? left : state.plan.monthly
    instalments.push({ date, amount, overdue: false })
    left = subtractMoney(left, amount)
  }
  return instalments
}

/**
 * How the loan's repayments since its plan started stand on the day, or null for a loan without a plan.
 * An instalment counts as due from the day after its due date, so on the due date itself nobody is behind
 * on it yet. The plan never expects more than the borrower repaid and still owes, so a loan that was let
 * go of in part, or never owed that much, asks for no more than is left. Borrowing more after the plan
 * starts makes nobody behind.
 */
export function planStanding(loan: InformalLoan, movements: readonly Movement[], day: CivilDate): PlanStanding | null {
  const state = planDay(loan, movements, day)
  if (state === null) return null
  const [next] = instalmentsAhead(state, 1)
  return { expected: state.expected, repaid: state.repaid, ahead: subtractMoney(state.repaid, state.expected), next: next === undefined ? null : { date: next.date, amount: next.amount } }
}

/**
 * The first `count` amounts the plan still asks for from the day on, empty for a loan without a plan or with
 * nothing owed. What the borrower is behind by comes first, due on the day itself, since an instalment
 * missed yesterday is still owed today. The instalments still to come follow on their due dates, each the
 * plan's amount, until together they come to what is still owed.
 */
export function planPayments(loan: InformalLoan, movements: readonly Movement[], day: CivilDate, count: number): PlanPayment[] {
  const state = planDay(loan, movements, day)
  if (state === null || count < 1) return []
  return [...(state.behind > 0 ? [{ date: day, amount: state.behind, overdue: true }] : []), ...instalmentsAhead(state, count)].slice(0, count)
}

/**
 * What the loan would owe at each month end had the borrower paid exactly its expected plan: what it owes
 * then, moved by how far the borrower is ahead or behind, so the gap to what is owed is the standing. It
 * starts in the month the plan starts, or the loan does when that is later, and runs to the later of the
 * day's month and the newest movement's, then on until it reaches zero, at most ten years past the day's
 * month. Borrowing after the plan starts raises it, as it makes nobody behind. Empty for a loan without a plan.
 */
export function plannedOwed(loan: InformalLoan, movements: readonly Movement[], day: CivilDate): PlannedMonth[] {
  const plan = loan.expected
  if (plan === null) return []
  const newest = lastMovement(movements)?.date ?? day
  const recorded = monthOf(newest > day ? newest : day)
  const cap = addMonths(monthOf(day), PLAN_LINE_MONTHS)
  const months: PlannedMonth[] = []
  for (let month = monthOf(plan.from > loan.start ? plan.from : loan.start); month <= cap; month = addMonths(month, 1)) {
    const state = planDay(loan, movements, lastDayOf(month))!
    const owed = addMoney(state.owed, subtractMoney(state.repaid, state.expected))
    months.push({ month, owed })
    if (month >= recorded && owed <= 0) break
  }
  return months
}
