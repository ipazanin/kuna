import { addDays } from '../../../calendar/civilDate'
import type { CivilDate } from '../../../calendar/civilDate'
import { addMonths, firstDayOf, monthOf } from '../../../calendar/monthKey'

/** The bare UUIDs of the fake Loans file's records that the other apps' fake books and the visual checks name, since a fake seed of one app may not import another. */

/** The home loan, which the fake flat is bought with and the fake Spending rows pay. */
export const FAKE_HOME_LOAN = 'fa4e0000-0000-4000-8000-000000000001'

/** The car loan of the house-and-car set, which the fake car is bought with. */
export const FAKE_CAR_LOAN = 'fa4e0000-0000-4000-8000-000000000030'

/** The sample's last repayment of the loan from Marko, which a fake Spending row is linked to. */
export const FAKE_MARKO_REPAID = 'fa4e0000-0000-4000-8000-000000000013'

/** The home loan's extra payment, which a fake Spending row is linked to. */
export const FAKE_HOME_LOAN_EXTRA_PAYMENT = 'fa4e0000-0000-4000-8000-000000000004'

/**
 * The home loan's instalment two months before the day's month, due on the 20th, and the day the fake Loans file records it
 * as paid, nine days late. The fake Spending sets pay it on the 15th with a row linked to it, so the linked row overrules the
 * record. The Loans file has fixed dates and the Spending rows move with the day, so both read the days here.
 */
export function fakeOverruledLate(day: CivilDate): { readonly due: CivilDate; readonly paid: CivilDate } {
  const due = addDays(firstDayOf(addMonths(monthOf(day), -2)), 19)
  return { due, paid: addDays(due, 9) }
}
