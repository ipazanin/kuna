import { plannedOwed } from './expectedPlan'
import { informalBalanceOn, informalBalances, informalTotals, lastMovement } from './informalBalance'
import type { InformalTotals } from './informalBalance'
import type { MonthBalance } from '../../balances/domain/monthBalance'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { Movement } from '../../workbook/domain/movement'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { negateMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What you owe on the loan, below zero when the other side owes you, whichever way the loan runs. */
export function owedByYou(loan: InformalLoan, balance: Money): Money {
  return loan.direction === 'you-owe' ? balance : negateMoney(balance)
}

export interface InformalLoanFigures {
  /** What you owe on the day, below zero when they owe you. */
  readonly owedByYou: Money
  readonly last: Movement | null
  readonly totals: InformalTotals
}

export function informalLoanFigures(book: InformalLoanBook, day: CivilDate): InformalLoanFigures {
  return { owedByYou: owedByYou(book.loan, informalBalanceOn(book.loan, book.movements, day)), last: lastMovement(book.movements), totals: informalTotals(book.movements, day) }
}

/** A movement with what it changed and what you owe after it. */
export interface MovementStep {
  readonly movement: Movement
  /** Above zero when the movement raised what is owed, the loan's way. */
  readonly change: Money
  readonly owedAfter: Money
}

/** The movements newest first, a day's movements last in the file first. */
export function movementSteps(book: InformalLoanBook): MovementStep[] {
  const steps = informalBalances(book.loan, book.movements)
  return steps
    .flatMap((step, index) => {
      const before = steps[index - 1]
      if (step.movement === null || before === undefined) return []
      return [{ movement: step.movement, change: subtractMoney(step.balance, before.balance), owedAfter: owedByYou(book.loan, step.balance) }]
    })
    .reverse()
}

/**
 * What is owed the loan's way at each month end, from its start to the later of the day's month, its
 * newest movement and `through`: what you owe on a loan you owe, and what they owe you on one owed to you.
 */
export function informalLoanMonths(book: InformalLoanBook, day: CivilDate, through: MonthKey | null = null): MonthBalance[] {
  const newest = lastMovement(book.movements)?.date ?? day
  const recorded = monthOf(newest > day ? newest : day)
  const end = through !== null && through > recorded ? through : recorded
  return monthsFrom(monthOf(book.loan.start), end).map((month) => ({ month, owed: informalBalanceOn(book.loan, book.movements, lastDayOf(month)) }))
}

/** What the loan's Owed over time draws: what is owed at each month end, and the expected plan's line, over months that run on to where the plan's line ends. */
export function informalLoanChartMonths(book: InformalLoanBook, day: CivilDate): { readonly months: MonthBalance[]; readonly expected: MonthBalance[] } {
  const expected = plannedOwed(book.loan, book.movements, day)
  return { months: informalLoanMonths(book, day, expected.at(-1)?.month ?? null), expected }
}

/**
 * The day of the loan's last movement, while nothing is owed at the end of the day and no movement
 * comes after it. Null while it is open, and on a loan at zero with no movement yet, on which nothing
 * was ever owed.
 */
export function informalClosedOn(book: InformalLoanBook, day: CivilDate): CivilDate | null {
  const last = lastMovement(book.movements)
  if (last === null || last.date > day || informalBalanceOn(book.loan, book.movements, day) !== 0) return null
  return last.date
}
