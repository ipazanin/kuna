import { eventLength, shortestFirst } from './events'
import type { SpendingEvent } from '../../workbook/domain/event'
import { addDays, daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** How many days after its last day an event still shows on Overview. */
export const SHOWN_AFTER_DAYS = 7

/** Where the day falls for an event: before its first day, on its days with which of them, or after its last day with how many days since. */
export type EventStage = { readonly kind: 'ahead' } | { readonly kind: 'running'; readonly day: number; readonly days: number } | { readonly kind: 'over'; readonly daysSince: number }

export function eventStage(event: Pick<SpendingEvent, 'days'>, today: CivilDate): EventStage {
  if (today < event.days.from) return { kind: 'ahead' }
  if (today <= event.days.to) return { kind: 'running', day: daysBetween(event.days.from, today) + 1, days: eventLength(event) }
  return { kind: 'over', daysSince: daysBetween(event.days.to, today) }
}

/** The events Overview shows on the day: each whose first day has come and whose last day is at most a week back, shortest first, as an item picks among them. */
export function eventsShown<E extends Pick<SpendingEvent, 'id' | 'days' | 'name'>>(events: readonly E[], today: CivilDate): readonly E[] {
  const since = addDays(today, -SHOWN_AFTER_DAYS)
  return events.filter((event) => event.days.from <= today && event.days.to >= since).sort(shortestFirst)
}
