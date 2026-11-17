import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { pricesDay } from '../application/pricesUpdate'
import { addDays, startOfDayIn } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** A second past midnight, so the timer never fires a moment early and finds the old day. */
const PAST_MIDNIGHT_MILLISECONDS = 1000

/**
 * Today in Zagreb, which the prices' day follows, as a value that turns at midnight there. A device that slept through
 * midnight misses its timer, so the day is read again when the page comes back into view.
 */
export function zagrebDay(): Readonly<Ref<CivilDate>> {
  const day = ref(pricesDay(new Date().toISOString()))
  const turn = (): void => {
    const now = Date.now()
    day.value = pricesDay(new Date(now).toISOString())
    setTimeout(turn, startOfDayIn(addDays(day.value, 1), 'Europe/Zagreb') - now + PAST_MIDNIGHT_MILLISECONDS)
  }
  turn()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') day.value = pricesDay(new Date().toISOString())
    })
  }
  return readonly(day)
}
