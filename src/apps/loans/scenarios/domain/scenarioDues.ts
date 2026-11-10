import type { LoanChange } from './loanScenario'
import { scenarioPlan } from './scenarioPlan'
import type { ScenarioBase } from './scenarioPlan'
import { dueDateOf } from '../../bankLoans/domain/loanPlan'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** A due date a change can start on, numbered from the loan's first instalment. */
export interface ScenarioDue {
  readonly number: number
  readonly date: CivilDate
}

/** Every due date of the loan, and of the new loan after a move over the instalments given, numbered from the first. */
export function scenarioDues(loan: BankLoan, movedInstalments: number): readonly ScenarioDue[] {
  return Array.from({ length: loan.instalments + movedInstalments }, (_, offset) => ({ number: offset + 1, date: dueDateOf(loan, offset + 1) }))
}

/** Each instalment of the old loan, with the scenario's changes but its move, and how many it still has after that one. Null while they cannot be worked out. */
export function oldLoanDues(base: ScenarioBase, changes: readonly LoanChange[]): readonly { readonly date: CivilDate; readonly left: number }[] | null {
  const plan = scenarioPlan(
    base,
    changes.filter((change) => change.kind !== 'move'),
    null,
  )
  if ('refused' in plan) return null
  const instalments = plan.rows.filter((row) => row.kind === 'instalment')
  return instalments.map((row, index) => ({ date: row.date, left: instalments.length - index - 1 }))
}

/** The due dates a move may fall on: each the old loan still has an instalment after. Null while the old loan cannot be worked out. */
export function moveDates(base: ScenarioBase, changes: readonly LoanChange[]): ReadonlySet<CivilDate> | null {
  const dues = oldLoanDues(base, changes)
  return dues === null ? null : new Set(dues.filter((due) => due.left > 0).map((due) => due.date))
}
