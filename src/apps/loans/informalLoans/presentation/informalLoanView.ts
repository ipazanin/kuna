import { raisesWhatIsOwed } from '../domain/informalBalance'
import { movementSteps } from '../domain/informalLoanFigures'
import type { MovementStep } from '../domain/informalLoanFigures'
import type { PlanStanding } from '../domain/expectedPlan'
import { words } from './words'
import type { BalanceMove } from '../../balances/presentation/balanceChart'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { MovementKind } from '../../workbook/domain/movement'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { words as bookWords } from '../../workbook/domain/words'
import { absMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Tone } from '../../../../shared/ui/toneText'

export const MOVEMENT_KIND_NAMES: Readonly<Record<MovementKind, string>> = bookWords.kinds

/** "You owe" or "They owe you", as the sign of what you owe says, and that nobody owes anything at zero. */
export function whoOwes(owed: Money): string {
  if (owed === 0) return words.hero.settled
  return owed < 0 ? words.theyOweYou : words.youOwe
}

/** A movement as the list shows it, with what you owe after it. */
export interface MovementLine extends MovementStep {
  readonly kind: string
}

/** The movements as the list shows them, newest first. */
export function movementLines(book: InformalLoanBook): MovementLine[] {
  return movementSteps(book).map((step) => ({ ...step, kind: MOVEMENT_KIND_NAMES[step.movement.kind] }))
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
  const amount = formatMoney(absMoney(standing.ahead))
  const theirs = loan.direction === 'owed-to-you'
  if (standing.ahead < 0) return { text: theirs ? words.plan.behindThem(loan.counterparty, amount) : words.plan.behindYou(amount), tone: 'warning' }
  if (standing.ahead > 0) return { text: theirs ? words.plan.aheadThem(loan.counterparty, amount) : words.plan.aheadYou(amount), tone: 'success' }
  return { text: words.plan.onTrack, tone: null }
}
