import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { weekdaysBetween } from '../../../../shared/calendar/civilDate'
import { firstDayOf, lastDayOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../features/workbook/domain/recordId'
import type { EmployeeFacts } from '../payroll/incomeTax'

/** One row of the `employees` tab: a person the company pays a salary, with the facts the payroll needs about them. */
export interface Employee extends EmployeeFacts {
  /** A short name in lower case, which the row is known by. */
  readonly slug: string
  /** Blank when the tab gives none. The payroll mail's IP1 forms are matched to the employee by its words. */
  readonly name: string
  /** The accounts the salary is paid into, normalised. The bank's rows to them are this employee's pay. */
  readonly ibans: readonly string[]
  /** The full-time monthly gross of the contract, or null when the tab gives none. A director is paid at least the director floor. */
  readonly agreedGross: Money | null
  /** The first day of the employment. */
  readonly from: CivilDate
  /** The last day of the employment, or null while it lasts. */
  readonly to: CivilDate | null
  /** By its name. */
  readonly id: RecordId
}

/**
 * The weekdays of a month the employment covers, public holidays included, as the monthly fund of
 * hours counts them. Null when the employment does not reach into the month.
 */
export function weekdaysEmployed(employee: Pick<Employee, 'from' | 'to'>, month: MonthKey): number | null {
  const from = employee.from > firstDayOf(month) ? employee.from : firstDayOf(month)
  const to = employee.to !== null && employee.to < lastDayOf(month) ? employee.to : lastDayOf(month)
  return from > to ? null : weekdaysBetween(from, to)
}

/** The director whose facts the owner's payroll is worked out on, or null while no single row is the director's or it names no city. */
export function payrollDirector(workbook: { readonly director: Employee | null }): Employee | null {
  return workbook.director !== null && workbook.director.residenceCity !== '' ? workbook.director : null
}
