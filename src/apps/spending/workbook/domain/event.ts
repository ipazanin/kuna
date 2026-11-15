import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A stretch of days, such as a trip, whose spending its money joins by the day of each row. Two trips to one city are two events of one name. */
export interface SpendingEvent {
  readonly id: RecordId
  readonly name: string
  readonly days: DateRange
}

/** A part that joins an event by its row's day. */
export const BY_DAYS = 'days'

/** A part taken out by hand, which joins no event, also one made later over its day. */
export const OUT_OF_EVENTS = 'out'

/** Which event a part counts in: the one its row's day falls in, the event put in by hand, or none. */
export type EventChoice = typeof BY_DAYS | typeof OUT_OF_EVENTS | RecordId

/** The event put in by hand that the choice names, or null when the part goes by its day or was taken out. */
export function eventPutIn(choice: EventChoice): RecordId | null {
  return choice === BY_DAYS || choice === OUT_OF_EVENTS ? null : choice
}
