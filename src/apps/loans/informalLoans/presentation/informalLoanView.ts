import { informalBalanceOn, informalBalances, informalTotals, lastMovement, raisesWhatIsOwed } from '../domain/informalBalance'
import type { InformalTotals } from '../domain/informalBalance'
import type { PlanStanding } from '../domain/expectedPlan'
import { words } from './words'
import type { BalanceMove, MonthBalance } from '../../balances/presentation/balanceChart'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { Movement, MovementKind } from '../../workbook/domain/movement'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { words as bookWords } from '../../workbook/domain/words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { negateMoney, subtractMoney } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import type { Tone } from '../../../../shared/ui/toneText'

export const MOVEMENT_KIND_NAMES: Readonly<Record<MovementKind, string>> = bookWords.kinds

/** What you owe on the loan, below zero when the other side owes you, whichever way the loan runs. */
export function owedByYou(loan: InformalLoan, balance: Money): Money {
  return loan.direction === 'you-owe' ? balance : negateMoney(balance)
}

/** "You owe" or "They owe you", as the sign of what you owe says, and that nobody owes anything at zero. */
export function whoOwes(owed: Money): string {
  if (owed === 0) return words.hero.settled
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
  /** Above zero when the movement raised what is owed, the loan's way. */
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
      return [{ movement: step.movement, kind: MOVEMENT_KIND_NAMES[step.movement.kind], change: subtractMoney(step.balance, before.balance), owedAfter }]
    })
    .reverse()
}

/**
 * What is owed the loan's way at each month end, from its start to the later of the day's month and its
 * newest movement: what you owe on a loan you owe, and what they owe you on one owed to you.
 */
export function informalLoanMonths(book: InformalLoanBook, day: CivilDate): MonthBalance[] {
  const newest = lastMovement(book.movements)?.date ?? day
  const end = monthOf(newest > day ? newest : day)
  return monthsFrom(monthOf(book.loan.start), end).map((month) => ({ month, owed: informalBalanceOn(book.loan, book.movements, lastDayOf(month)) }))
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

/** What the balance chart marks on an informal loan: each movement, raising or lowering what is owed. */
export function informalLoanMoves(book: InformalLoanBook): BalanceMove[] {
  return book.movements.map((movement) => ({
    date: movement.date,
    kind: MOVEMENT_KIND_NAMES[movement.kind],
    amount: movement.amount,
    note: movement.note,
    effect: raisesWhatIsOwed(movement.kind) ? 'raises' : 'lowers',
  }))
}

/** Who is how far ahead of the loan's expected plan or behind it, in words, and the tone that goes with it: the borrower is the other side on a loan owed to you, and you on one you owe. */
export function standingWords(loan: InformalLoan, standing: PlanStanding): { readonly text: string; readonly tone: Extract<Tone, 'warning' | 'success'> | null } {
  const amount = formatMoney(standing.ahead < 0 ? negateMoney(standing.ahead) : standing.ahead)
  const theirs = loan.direction === 'owed-to-you'
  if (standing.ahead < 0) return { text: theirs ? words.plan.behindThem(loan.counterparty, amount) : words.plan.behindYou(amount), tone: 'warning' }
  if (standing.ahead > 0) return { text: theirs ? words.plan.aheadThem(loan.counterparty, amount) : words.plan.aheadYou(amount), tone: 'success' }
  return { text: words.plan.onTrack, tone: null }
}
