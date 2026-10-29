import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { Movement, MovementKind } from '../../workbook/domain/movement'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney, subtractMoney } from '../../../../shared/money/money'
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
