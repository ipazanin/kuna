import type { CivilDate } from '../calendar/civilDate'
import type { Money } from './money'
import { moneyAt, percentFromWhole } from './percent'
import type { Percent } from './percent'

/** All of it, which a part of 100% is. */
const WHOLE = percentFromWhole(100)

/** A dated change of your part of something you own or owe with others: the part from that day on. */
export interface PartChange {
  readonly from: CivilDate
  readonly share: Percent
}

/** Whether a part is one you can hold: above 0% and at most all of it. */
export function isPartOfWhole(share: Percent): boolean {
  return share > 0 && share <= WHOLE
}

/** Your part on the day: the latest change on or before it, else the part from the start. Null when it is all yours. */
export function partOnDay(fromStart: Percent | undefined, changes: readonly PartChange[], day: CivilDate): Percent | null {
  const latest = changes.reduce<PartChange | null>((held, change) => (change.from <= day && (held === null || change.from > held.from) ? change : held), null)
  const part = latest?.share ?? fromStart ?? WHOLE
  return part === WHOLE ? null : part
}

/** Your part of an amount, rounded once to the cent, or the whole amount when it is all yours. */
export function yourPartOf(whole: Money, part: Percent | null): Money {
  return part === null ? whole : moneyAt(whole, part)
}
