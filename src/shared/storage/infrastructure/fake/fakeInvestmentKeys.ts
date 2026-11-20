import { addDays } from '../../../calendar/civilDate'
import type { CivilDate } from '../../../calendar/civilDate'

/** The bare UUIDs and days of the fake Investments file's records that the other apps' fake books name, since a fake seed of one app may not import another. */

/** The deposit into the second fake broker account that a waiting row of the fake Spending broker set pays. */
export const FAKE_PAID_DEPOSIT = 'fa4e1000-0000-4000-8000-000000000907'

/** The deposit arrives two days after the row that pays it, which the fake Spending broker set books six days before the day. */
export function fakePaidDepositDay(day: CivilDate): CivilDate {
  return addDays(day, -4)
}
