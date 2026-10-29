import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { Movement, MovementKind } from '../../workbook/domain/movement'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

const RAISES: ReadonlySet<MovementKind> = new Set(['borrowed', 'borrowed-in-kind'])

/** Oldest first, a day's movements in the order the file gives them. */
function byDate(movements: readonly Movement[]): Movement[] {
  return [...movements].sort((earlier, later) => earlier.date.localeCompare(later.date))
}

/** What is owed after a movement or after the opening balance, in the loan's direction. Below zero, the other side owes. */
export interface InformalBalance {
  readonly date: CivilDate
  /** Null for the opening balance. */
  readonly movement: Movement | null
  readonly balance: Money
}

/** The opening balance on the start day, then the balance after each movement. */
export function informalBalances(loan: InformalLoan, movements: readonly Movement[]): InformalBalance[] {
  const balances: InformalBalance[] = [{ date: loan.start, movement: null, balance: loan.openingBalance }]
  let balance = loan.openingBalance
  for (const movement of byDate(movements)) {
    balance = RAISES.has(movement.kind) ? addMoney(balance, movement.amount) : subtractMoney(balance, movement.amount)
    balances.push({ date: movement.date, movement, balance })
  }
  return balances
}

/** What is owed at the end of the day, nothing before the loan starts. */
export function informalBalanceOn(loan: InformalLoan, movements: readonly Movement[], day: CivilDate): Money {
  return (
    informalBalances(loan, movements)
      .filter((step) => step.date <= day)
      .at(-1)?.balance ?? ZERO
  )
}

/** The newest movement, the last of its day in the file, or null when there is none. */
export function lastMovement(movements: readonly Movement[]): Movement | null {
  return byDate(movements).at(-1) ?? null
}

/** What the movements added to the opening balance and took off it, by how. */
export interface InformalTotals {
  /** Borrowed, in money or in kind. */
  readonly raised: Money
  /** Repaid, in money or in kind. */
  readonly repaid: Money
  readonly forgiven: Money
}

/** The totals of the movements dated on or before the day, so they add up to the balance at the end of that day. */
export function informalTotals(movements: readonly Movement[], day: CivilDate): InformalTotals {
  const sumOf = (matches: (kind: MovementKind) => boolean): Money => sumMoney(movements.filter((movement) => movement.date <= day && matches(movement.kind)).map((movement) => movement.amount))
  return {
    raised: sumOf((kind) => RAISES.has(kind)),
    repaid: sumOf((kind) => kind === 'repaid' || kind === 'repaid-in-kind'),
    forgiven: sumOf((kind) => kind === 'forgiven'),
  }
}
