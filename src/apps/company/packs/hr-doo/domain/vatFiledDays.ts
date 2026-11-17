import { ruleValue } from '../ruleset/ruleset'
import { addDays } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, lastDayOf, monthOf } from '../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'

/** The day a month's VAT return is due, as `hr.vat.deadlines` in force for that period says. */
export function vatReturnDue(month: MonthKey): CivilDate {
  const due = ruleValue('hr.vat.deadlines', firstDayOf(month)).value.returnDue.text
  const next = addMonths(month, 1)
  if (due === '20th-of-following-month') return addDays(firstDayOf(next), 19)
  if (due === 'last-day-of-following-month') return lastDayOf(next)
  throw new RangeError(`The VAT return deadline "${due}" is not one Kuna reads.`)
}

/**
 * The first day not yet filed: the first day of the earliest month whose VAT return is not yet past its due day. Rows a sync
 * adds before it could change a VAT figure already filed. Monthly VAT periods are assumed, as the ruleset gives no other.
 */
export function firstVatOpenDay(today: CivilDate): CivilDate {
  let month = addMonths(monthOf(today), -1)
  while (vatReturnDue(month) >= today) month = addMonths(month, -1)
  return firstDayOf(addMonths(month, 1))
}
