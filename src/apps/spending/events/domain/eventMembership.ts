import { shortestFirst } from './events'
import type { KeepsPart } from '../../analytics/domain/partTotals'
import type { Side } from '../../categories/domain/rowSide'
import { BY_DAYS, OUT_OF_EVENTS } from '../../workbook/domain/event'
import type { SpendingEvent } from '../../workbook/domain/event'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { rangeContains } from '../../../../shared/calendar/dateRange'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The event a part of a row is in, from the part's choice, the row's day and the side the part counts on, or null. */
export type EventOfPart = (part: Pick<TransactionItem, 'event'>, day: CivilDate, side: Side) => RecordId | null

/**
 * Which event each part is in. A part put in an event by hand is in it on any side, and one taken out is in none. Otherwise a
 * part on the spending side joins the shortest event whose days cover its row's day, on a tie the one that starts later, then by
 * name and id, so the file's order never decides. A part on any other side joins no event by its day. A part that names an
 * event the file lacks goes by its day.
 */
export function eventMembership(events: readonly SpendingEvent[]): EventOfPart {
  const known = new Set(events.map((event) => event.id))
  const candidates = [...events].sort(shortestFirst)
  return ({ event }, day, side) => {
    if (event === OUT_OF_EVENTS) return null
    if (event !== BY_DAYS && known.has(event)) return event
    if (side !== 'spending') return null
    return candidates.find((candidate) => rangeContains(candidate.days, day))?.id ?? null
  }
}

/** Picks the parts of rows that are in the event, for its totals and for the rows Entries lists under it. */
export function partsInEvent(events: readonly SpendingEvent[], event: RecordId): KeepsPart {
  const eventOf = eventMembership(events)
  return (row, part, place) => eventOf(row.items[place]!, row.transaction.date, part.side) === event
}
