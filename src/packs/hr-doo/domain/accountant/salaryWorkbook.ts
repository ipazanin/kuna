import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Rate } from '../../ruleset/schema'

/**
 * A payment listed beside the salary. A tax-free payment carries the ruleset's key for it. Rent of
 * the owner's office and refunds of costs he paid are not pay at all.
 */
export type PaymentBesideSalary =
  | { readonly kind: 'nontaxable'; readonly label: string; readonly amount: Money; readonly payment: string }
  | { readonly kind: 'rent' | 'cost-refund' | 'unknown'; readonly label: string; readonly amount: Money }

/** One employee's month as the accountant computed it, named as `PayrollMonth` names the same lines. */
export interface SalaryWorkbook {
  /** As the tab's name gives it after `Obračun plaće_`, blank when it gives none. */
  readonly employeeName: string
  readonly workedMonth: MonthKey
  readonly paidOn: CivilDate
  /** Gross II. */
  readonly employerCost: Money
  readonly health: Money
  /** Gross I. */
  readonly gross: Money
  readonly pensionPillarOne: Money
  readonly pensionPillarTwo: Money
  readonly income: Money
  readonly personalAllowance: Money
  readonly taxableIncome: Money
  readonly incomeTax: Money
  readonly net: Money
  readonly besideSalary: readonly PaymentBesideSalary[]
  readonly totalCompanyCost: Money
  readonly stateTake: Money
  /** The net salary with every payment beside it, rent and refunds included. */
  readonly paidToEmployee: Money
  /** From the note on the income tax line. */
  readonly residenceCity: string
  readonly statedLowerRate: Rate
  /** The gross is the director's minimum base, not an agreed salary. */
  readonly directorMinimum: boolean
  /** The gross covers part of the month, and the days worked are not in the workbook. */
  readonly partMonth: boolean
}

/** Rent and refunds of costs listed beside the salary, which are not pay. */
export function outsidePayroll(salary: SalaryWorkbook): Money {
  return sumMoney(salary.besideSalary.filter((payment) => payment.kind === 'rent' || payment.kind === 'cost-refund').map((payment) => payment.amount))
}
