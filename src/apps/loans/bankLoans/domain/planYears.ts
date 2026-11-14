import { lateOn } from './instalmentPayments'
import type { InstalmentStanding } from './instalmentPayments'
import { isEstimate } from './loanFigures'
import type { PlanRow } from './loanPlan'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** One row of the plan, placed in its year. */
export interface PlanLine {
  readonly key: string
  readonly kind: PlanRow['kind']
  readonly date: CivilDate
  readonly number: number | null
  readonly payment: Money
  readonly yourShare: Money
  readonly interest: Money
  readonly principal: Money
  readonly subsidy: Money
  readonly balance: Money
  /** Worked out at a variable rate, so the bank's figure may differ. */
  readonly estimate: boolean
  /** An instalment that went out after its due date. */
  readonly late: boolean
}

export type PlanTotals = Pick<PlanLine, 'payment' | 'yourShare' | 'interest' | 'principal' | 'subsidy'>

export interface PlanYear {
  readonly year: number
  readonly lines: readonly PlanLine[]
  readonly totals: PlanTotals
  /** What is owed once the year's last row is paid. */
  readonly balance: Money
  readonly estimate: boolean
}

const NO_TOTALS: PlanTotals = { payment: ZERO, yourShare: ZERO, interest: ZERO, principal: ZERO, subsidy: ZERO }

/** The plan grouped by the calendar year its rows fall due in, with each year's totals, oldest first. Each instalment stands as `standings` gives it. */
export function planYears(book: BankLoanBook, day: CivilDate, standings: ReadonlyMap<CivilDate, InstalmentStanding>): PlanYear[] {
  const years = new Map<number, PlanLine[]>()
  for (const [index, row] of (book.plan ?? []).entries()) {
    const line: PlanLine = {
      ...row,
      key: `${row.kind}-${row.date}-${index}`,
      estimate: isEstimate(row, book.ratePeriods, day),
      late: row.kind === 'instalment' && lateOn(row.date, standings.get(row.date)) !== null,
    }
    const year = yearOf(row.date)
    years.set(year, [...(years.get(year) ?? []), line])
  }
  return [...years].map(([year, lines]) => ({
    year,
    lines,
    totals: lines.reduce(
      (sum, line) => ({
        payment: addMoney(sum.payment, line.payment),
        yourShare: addMoney(sum.yourShare, line.yourShare),
        interest: addMoney(sum.interest, line.interest),
        principal: addMoney(sum.principal, line.principal),
        subsidy: addMoney(sum.subsidy, line.subsidy),
      }),
      NO_TOTALS,
    ),
    balance: lines.at(-1)!.balance,
    estimate: lines.some((line) => line.estimate),
  }))
}
