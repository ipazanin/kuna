import { parseCivilDate, today } from '../../civilDate'
import type { CivilDate } from '../../civilDate'

/**
 * The day `?day=` names, or today where it names none or a day that does not exist. The fake build's books, bank sync, chat
 * and ECB all date their rows from it, so a check that builds files for a day and runs past midnight still sees them line up.
 */
export function fakeDayHere(): CivilDate {
  const requested = new URLSearchParams(window.location.search).get('day')
  return (requested === null ? null : parseCivilDate(requested)) ?? today()
}
