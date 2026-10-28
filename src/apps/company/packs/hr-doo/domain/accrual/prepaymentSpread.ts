import { addDays, civilDate, dayOfMonth, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthNumber, monthOf, yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import type { Booking } from '../../../../workbook/domain/workbook'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { spreadByDays } from './daySpread'

/** The part of a prepaid cost that belongs to one month. */
export interface PrepaidShare {
  readonly month: MonthKey
  readonly cost: TracedFigure
}

/**
 * Spreads a cost paid ahead, such as an annual insurance policy, evenly over the days it covers:
 * from the payment date to the day before the same date `months` later. The shares add up to the
 * booking's amount, and what falls after 31 December is the prepaid expense at year end.
 */
export function prepaymentSpread(booking: Booking, months: number, rules: RuleSource = ruleValue): readonly PrepaidShare[] {
  if (!Number.isInteger(months) || months < 1) {
    throw new RangeError(`A prepayment cannot cover ${months} months.`)
  }
  const accrual = rules('hr.acc.accrual-basis', civilDate(yearOf(booking.date), 1, 1))
  const coveredTo = addDays(sameDayMonthsLater(booking.date, months), -1)
  const spread = spreadByDays(booking.amount, { from: booking.date, to: coveredTo })
  return spread.shares.map((share) => ({
    month: share.month,
    cost: { ...tracedFigure(`${share.days} of ${spread.totalDays} days covered by the payment of`, share.amount, 'ledger', [accrual.citation]), on: booking.date },
  }))
}

/** The same day of the month `months` later, or that month's last day when it is shorter. */
function sameDayMonthsLater(date: CivilDate, months: number): CivilDate {
  const month = addMonths(monthOf(date), months)
  const day = Math.min(dayOfMonth(date), dayOfMonth(lastDayOf(month)))
  return civilDate(yearOfMonth(month), monthNumber(month), day)
}
