import { partsInEvent } from './eventMembership'
import { eventsNewestFirst } from './events'
import { partTotals } from '../../analytics/domain/partTotals'
import type { PartTotals } from '../../analytics/domain/partTotals'
import type { CountedRow } from '../../analytics/domain/countedRow'
import type { Category } from '../../workbook/domain/category'
import type { SpendingEvent } from '../../workbook/domain/event'

/** An event's figures, counted as Spending's month counts them, over every part in it. */
export interface EventTotals extends PartTotals {
  readonly event: SpendingEvent
}

/** Every event with what it counts, newest first by its first day, then by name. Events move no month total or limit. */
export function eventTotals(rows: readonly CountedRow[], categories: readonly Category[], events: readonly SpendingEvent[]): readonly EventTotals[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return eventsNewestFirst(events).map((event) => ({ event, ...partTotals(rows, byId, partsInEvent(events, event.id)) }))
}
