import { words } from './words'
import type { SpendingEvent } from '../../workbook/domain/event'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** An event's days as a line reads them, such as "10 Jul 2027 – 14 Jul 2027", or one day alone. */
export function eventDays(event: Pick<SpendingEvent, 'days'>): string {
  const { from, to } = event.days
  return from === to ? dayLabel(from) : words.days(dayLabel(from), dayLabel(to))
}
