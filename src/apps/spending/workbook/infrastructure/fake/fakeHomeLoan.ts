import { addDays } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, monthKey, monthOf } from '../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'

/** The IBAN of the fake home loan's account at Example Bank, which the fake rule whose rows pay the home loan tests. */
export const FAKE_HOME_LOAN_IBAN = 'HR5523400091110000001'

type ShareFrom = readonly [MonthKey, number]

/** The day of the month the fake home loan's instalments fall due. */
const DUE_DAY = 20

/**
 * Your share of the fake home loan's instalment in euros, from the month each share starts, as the fake Loans plan has it: the
 * subsidy ends after March 2027 and the fixed rate after March 2028. Spending cannot read the Loans plan here, so a spec holds
 * these to it.
 */
const SHARES: readonly [ShareFrom, ...ShareFrom[]] = [
  [monthKey(2025, 6), 612.2],
  [monthKey(2027, 4), 822.2],
  [monthKey(2028, 4), 878.74],
]

/** Your share of the instalment the fake home loan has due in the month. */
export function fakeHomeLoanShare(month: MonthKey): number {
  return SHARES.reduce((share, [from, euros]) => (from <= month ? euros : share), SHARES[0][1])
}

/** The fake home loan's due date in the month. */
function fakeHomeLoanDue(month: MonthKey): CivilDate {
  return addDays(firstDayOf(month), DUE_DAY - 1)
}

/** The last instalment of the fake home loan due on or before the day. */
export function latestFakeHomeLoanDue(day: CivilDate): CivilDate {
  const thisMonths = fakeHomeLoanDue(monthOf(day))
  return thisMonths <= day ? thisMonths : fakeHomeLoanDue(addMonths(monthOf(day), -1))
}
