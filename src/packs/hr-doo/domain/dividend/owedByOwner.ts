import type { HrDooWorkbook } from '../hrDooPart'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO } from '../../../../shared/money/money'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { netOwed, ownerAdvances } from '../ownerAdvances'
import { ownerLoans } from '../ownerLoans'
import { tracedFigure } from '../payroll/payrollArithmetic'

/** What the owner owes the company on loans and advances, net, on a day, never below nothing. */
export function owedByOwnerOn(workbook: HrDooWorkbook, on: CivilDate): TracedFigure {
  const rows = workbook.transactions.filter((row) => row.date <= on)
  const advances = workbook.ownerAdvances.filter((advance) => advance.date <= on)
  const owed = netOwed(ownerLoans(rows, workbook.categories), ownerAdvances(advances, rows, workbook.categories), workbook.categories)
  return withDrill({ ...tracedFigure('Owed by the owner, net, on', owed.amount > 0 ? owed.amount : ZERO, 'ledger', []), on }, owed.drill)
}
