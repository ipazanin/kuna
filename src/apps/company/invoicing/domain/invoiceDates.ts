import { civilDate, dayOfMonth } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, lastDayOf, monthNumber, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'

export interface NewInvoiceDates {
  readonly due: CivilDate
  readonly periodFrom: CivilDate
  readonly periodTo: CivilDate
}

/**
 * The dates a new invoice starts with, as the invoice generator sets them: due on the same day a
 * month later, or that month's last day when it is shorter, for the work of the month it is issued in.
 */
export function newInvoiceDates(issued: CivilDate): NewInvoiceDates {
  const next = addMonths(monthOf(issued), 1)
  const due = civilDate(yearOfMonth(next), monthNumber(next), Math.min(dayOfMonth(issued), dayOfMonth(lastDayOf(next))))
  return { due, periodFrom: firstDayOf(monthOf(issued)), periodTo: lastDayOf(monthOf(issued)) }
}
