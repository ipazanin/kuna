import type { SpendingEvent } from '../../workbook/domain/event'
import { EVENT_RECORDS } from '../../workbook/domain/spendingKinds'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'

/** Why a name and days cannot be an event's: the name is blank, or the last day is before the first. Names may repeat. */
export type EventProblem = 'blank' | 'ends-before'

/** Why the name and days cannot be an event's, or null when they can. The reader and every write ask this one rule. */
export function eventProblem(name: string, days: DateRange): EventProblem | null {
  if (name.trim() === '') return 'blank'
  return days.to < days.from ? 'ends-before' : null
}

/** A new event of the name, trimmed, and the days, with an id of its own. */
export function newEvent(name: string, days: DateRange): SpendingEvent {
  return { id: recordIdOf(EVENT_RECORDS, newRecordId()), name: name.trim(), days }
}

/** How many days the event runs, both ends counted. */
export function eventLength(event: Pick<SpendingEvent, 'days'>): number {
  return daysBetween(event.days.from, event.days.to) + 1
}

/** The events newest first: by first day, then by name. */
export function eventsNewestFirst<E extends Pick<SpendingEvent, 'days' | 'name'>>(events: readonly E[]): readonly E[] {
  return [...events].sort((one, other) => (one.days.from !== other.days.from ? (one.days.from > other.days.from ? -1 : 1) : one.name.localeCompare(other.name)))
}

/** Orders events shortest first, then the one that starts later, then by name and id, so the file's order never decides which an item joins. */
export function shortestFirst(one: Pick<SpendingEvent, 'id' | 'days' | 'name'>, other: Pick<SpendingEvent, 'id' | 'days' | 'name'>): number {
  return (
    eventLength(one) - eventLength(other) ||
    (one.days.from !== other.days.from ? (one.days.from > other.days.from ? -1 : 1) : 0) ||
    one.name.localeCompare(other.name) ||
    (one.id < other.id ? -1 : one.id > other.id ? 1 : 0)
  )
}
