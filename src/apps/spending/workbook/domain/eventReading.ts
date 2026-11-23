import type { SpendingEvent } from './event'
import { EVENT_RECORDS } from './spendingKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredDate, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { eventProblem } from '../../events/domain/events'
import type { EventProblem } from '../../events/domain/events'

export function eventOf(fields: StoredFields, id: RecordId | null): SpendingEvent {
  return { id: ownId(id), name: requiredText(fields, 'name'), days: { from: requiredDate(fields, 'from'), to: requiredDate(fields, 'to') } }
}

export const EVENT_CODEC: RecordCodec<SpendingEvent> = withIdField(
  EVENT_RECORDS,
  (fields) => labelWords([textOf(fields.name), textOf(fields.from)]),
  eventOf,
  (event) => filledFields({ name: event.name, from: event.days.from, to: event.days.to }),
)

/** Events count when their name is not blank and their last day is not before their first, the rest for the reason of their problem. Names may repeat. */
export function readEvents(read: RecordsRead<SpendingEvent>, reasons: { readonly [Problem in EventProblem]: string }): Reading<SpendingEvent> {
  return readEach(read, ({ record: event }) => {
    const problem = eventProblem(event.name, event.days)
    return problem === null ? [] : [reasons[problem]]
  })
}
