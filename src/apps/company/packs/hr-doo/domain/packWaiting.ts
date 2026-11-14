import { yearOf } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'
import { sumMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { bookingOfAdvance, ledgerWindowOf } from '../../../workbook/domain/workbook'
import { forecastNeed, forecastYear } from './forecast/forecastYear'
import type { HrDooWorkbook } from './hrDooPart'
import { ownerAdvances } from './ownerAdvances'
import { payrollCadence } from './payrollCadence'
import type { PayrollCadence } from './payrollCadence'

/** Complete months in which a watched tax, such as the payroll contributions, had no payment. The owner's advances count, as on the payroll cadence. */
export interface MissedPayroll {
  readonly months: number
  readonly watchedTaxes: number
  readonly latestCategory: PayrollCadence['category']
  readonly latestMonth: MonthKey
}

/** Corporate tax overdue, or else due this month. */
export type CorporateTaxWaiting =
  { readonly kind: 'overdue'; readonly payments: number; readonly owed: Money } | { readonly kind: 'due'; readonly payments: number; readonly owed: Money; readonly nextDueOn: CivilDate }

/** What waits for a person in the pack's books. */
export interface PackWaiting {
  /** Reimbursements with no cost on file. */
  readonly unaccounted: number
  readonly payroll: MissedPayroll | null
  readonly corporateTax: CorporateTaxWaiting | null
}

export function packWaiting(workbook: HrDooWorkbook, asOf: CivilDate): PackWaiting {
  return {
    unaccounted: ownerAdvances(workbook.ownerAdvances, workbook.transactions, workbook.categories, workbook.repaidBy).unaccounted.length,
    payroll: missedPayroll(workbook),
    corporateTax: corporateTaxWaiting(workbook, asOf),
  }
}

function missedPayroll(workbook: HrDooWorkbook): MissedPayroll | null {
  const window = ledgerWindowOf(workbook.transactions)
  if (window === null) return null
  const bookings = [...workbook.transactions, ...workbook.ownerAdvances.map(bookingOfAdvance)]
  const missed = payrollCadence(bookings, workbook.categories, window).flatMap((cadence) =>
    cadence.months.filter((month) => month.state === 'missing').map((month) => ({ category: cadence.category, month: month.month })),
  )
  const latest = missed.reduce<(typeof missed)[number] | null>((found, entry) => (found === null || entry.month > found.month ? entry : found), null)
  if (latest === null) return null
  return { months: missed.length, watchedTaxes: new Set(missed.map((entry) => entry.category)).size, latestCategory: latest.category, latestMonth: latest.month }
}

/** Without the registration day there is no tax schedule to hold the payments against, so nothing waits. */
function corporateTaxWaiting(workbook: HrDooWorkbook, asOf: CivilDate): CorporateTaxWaiting | null {
  if (forecastNeed(workbook) !== null) return null
  let history
  try {
    history = forecastYear(workbook, yearOf(asOf), asOf).cit.history
  } catch (failure) {
    if (failure instanceof RangeError) return null
    throw failure
  }
  const overdue = history.filter((entry) => entry.status === 'overdue')
  const due = history.filter((entry) => entry.status === 'due')
  const owed = (entries: typeof history): Money => sumMoney(entries.map((entry) => entry.outstanding))
  if (overdue.length > 0) return { kind: 'overdue', payments: overdue.length, owed: owed(overdue) }
  const next = due[0]
  return next === undefined ? null : { kind: 'due', payments: due.length, owed: owed(due), nextDueOn: next.obligation.dueOn }
}
