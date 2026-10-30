import { informalBalanceOn, informalBalances, informalTotals, lastMovement } from '../domain/informalBalance'
import type { InformalTotals } from '../domain/informalBalance'
import { words } from './words'
import type { MonthBalance } from '../../balances/presentation/balanceChart'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { Movement, MovementKind } from '../../workbook/domain/movement'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { words as bookWords } from '../../workbook/domain/words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { negateMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

export const MOVEMENT_KIND_NAMES: Readonly<Record<MovementKind, string>> = bookWords.kinds

/** What you owe on the loan, below zero when the other side owes you, whichever way the loan runs. */
export function owedByYou(loan: InformalLoan, balance: Money): Money {
  return loan.direction === 'you-owe' ? balance : negateMoney(balance)
}

/** "You owe" or "They owe you", as the sign of what you owe says. */
export function whoOwes(owed: Money): string {
  return owed < 0 ? words.theyOweYou : words.youOwe
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

/** A movement as the list shows it, with what you owe after it. */
export interface MovementLine {
  readonly movement: Movement
  readonly kind: string
  /** Above zero when the movement raised what you owe. */
  readonly change: Money
  readonly owedAfter: Money
}

/** The movements newest first, a day's movements last in the file first. */
export function movementLines(book: InformalLoanBook): MovementLine[] {
  const steps = informalBalances(book.loan, book.movements)
  return steps
    .flatMap((step, index) => {
      const before = steps[index - 1]
      if (step.movement === null || before === undefined) return []
      const owedAfter = owedByYou(book.loan, step.balance)
      return [{ movement: step.movement, kind: MOVEMENT_KIND_NAMES[step.movement.kind], change: subtractMoney(owedAfter, owedByYou(book.loan, before.balance)), owedAfter }]
    })
    .reverse()
}

/** What you owe at each month end from the loan's start to the later of the day's month and its newest movement. */
export function informalLoanMonths(book: InformalLoanBook, day: CivilDate): MonthBalance[] {
  const newest = lastMovement(book.movements)?.date ?? day
  const end = monthOf(newest > day ? newest : day)
  return monthsFrom(monthOf(book.loan.start), end).map((month) => ({ month, owed: owedByYou(book.loan, informalBalanceOn(book.loan, book.movements, lastDayOf(month))) }))
}
