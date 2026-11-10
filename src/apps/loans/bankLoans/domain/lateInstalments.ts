import type { PlanRow } from './loanPlan'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** The loan's instalments due by today that no other late instalment names, newest first. The late instalment being changed keeps its own. */
export function lateDues(book: BankLoanBook, today: CivilDate, editing: LateInstalment | null): readonly PlanRow[] {
  const marked = new Set(book.lateInstalments.filter((late) => late.id !== editing?.id).map((late) => late.due))
  return (book.plan ?? []).filter((row) => row.kind === 'instalment' && row.date <= today && !marked.has(row.date)).reverse()
}

/** Whether an instalment paid on the day went out after its due date, as a late one must. */
export function paidLate(due: CivilDate, paid: CivilDate): boolean {
  return paid > due
}
