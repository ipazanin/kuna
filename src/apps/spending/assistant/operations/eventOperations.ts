import { TEXT, TEXT_OR_NULL, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { ENTRIES, picked } from './pickedParts'
import { addEvent, changeEvent, chooseEvent, deleteEvent } from '../../events/application/eventWrites'
import { eventProblem, newEvent } from '../../events/domain/events'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import { BY_DAYS, OUT_OF_EVENTS } from '../../workbook/domain/event'
import type { EventChoice, SpendingEvent } from '../../workbook/domain/event'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { EVENT_RECORDS, ITEM_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

const ENTRY_REFS = { 'entries.entry': TRANSACTION_RECORDS.name, 'entries.part': ITEM_RECORDS.name }

/** What Events and the selection on Entries do: add, change and delete an event, and put entries in one, take them out of every event or put them back on their days. */
export const EVENT_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-event',
    about:
      'A new event, a stretch of days such as a trip, from its first day to its last. Money out on spending categories on those days joins it by itself, and it changes no category, month total or limit. Two events may share a name. A put-in-event step on the same card names it by its $ name.',
    input: inputOf({ name: TEXT, from: TEXT, to: TEXT }),
    refs: {},
    creates: EVENT_RECORDS.name,
    alone: false,
    example: { name: 'Prague', from: '2027-07-10', to: '2027-07-14' },
  },
  {
    name: 'change-event',
    about: 'A new name or new days for an event, null to keep each. Its money follows its days, so a part on a day it no longer covers leaves it, unless it was put in by hand.',
    input: inputOf({ event: TEXT, name: TEXT_OR_NULL, from: TEXT_OR_NULL, to: TEXT_OR_NULL }),
    refs: { event: EVENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { event: 'event', name: null, from: null, to: '2027-07-15' },
  },
  {
    name: 'delete-event',
    about: 'Deletes an event. Every part put in it by hand, of an entry or of a waiting receipt, goes back on its days. Their categories stay.',
    input: inputOf({ event: TEXT }),
    refs: { event: EVENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { event: 'event' },
  },
  {
    name: 'put-in-event',
    about:
      'Puts entries in an event by hand, whatever their days, such as a flight bought in March for a July trip: every part of each entry, or with part that part alone. It changes no category or month total. A file from before parts keeps no event chosen by hand, so move-to-items goes first.',
    input: inputOf({ event: TEXT, entries: ENTRIES }),
    refs: { event: EVENT_RECORDS.name, ...ENTRY_REFS },
    creates: null,
    alone: false,
    example: { event: 'event', entries: [{ entry: 'transaction', part: null }] },
  },
  {
    name: 'take-out-of-events',
    about: 'Takes entries out of every event, also one made later over their days: every part of each entry, or with part that part alone. It changes no category or month total.',
    input: inputOf({ entries: ENTRIES }),
    refs: ENTRY_REFS,
    creates: null,
    alone: false,
    example: { entries: [{ entry: 'transaction', part: null }] },
  },
  {
    name: 'back-on-days',
    about: 'Puts entries put in an event or taken out by hand back on their days, so they join the event their days fall in and follow it if its days move.',
    input: inputOf({ entries: ENTRIES }),
    refs: ENTRY_REFS,
    creates: null,
    alone: false,
    example: { entries: [{ entry: 'transaction-split', part: null }] },
  },
]

const EVENT_OPERATION_NAMES: ReadonlySet<string> = new Set(EVENT_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the event operations. */
export function isEventStep(operation: string): boolean {
  return EVENT_OPERATION_NAMES.has(operation)
}

function refuseProblem(name: string, days: DateRange): void {
  const problem = eventProblem(name, days)
  if (problem === 'blank') throw new StepRefused('An event needs a name.')
  if (problem === 'ends-before') throw new StepRefused("An event's last day cannot be before its first.")
}

/** The choice a step that changes entries makes: the event it names, out of every event, or back on their days. */
function choiceOf(book: SpendingBook, operation: string, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string): EventChoice {
  if (operation === 'take-out-of-events') return OUT_OF_EVENTS
  if (operation === 'back-on-days') return BY_DAYS
  return found(book.events, idOf(field['event']), 'event').id
}

/**
 * Writes an event step through the writes Events and Entries use, and gives the event an add-event step made so a later step
 * names it by `$`. A file from before items keeps no event chosen by hand, so a step that changes entries is refused there.
 */
export function writeEventStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts' | 'sharedCosts'>,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): SpendingEvent | null {
  if (operation === 'add-event') {
    const days = { from: dayOf(field['from']), to: dayOf(field['to']) }
    refuseProblem(field['name'], days)
    const event = newEvent(field['name'], days)
    addEvent(unit, event)
    return event
  }
  if (operation === 'change-event' || operation === 'delete-event') {
    const event = found(book.events, idOf(field['event']), 'event')
    if (operation === 'delete-event') {
      deleteEvent(unit, records, event)
      return null
    }
    const name = (field['name'] as string | null) ?? event.name
    const days = { from: field['from'] === null ? event.days.from : dayOf(field['from']), to: field['to'] === null ? event.days.to : dayOf(field['to']) }
    refuseProblem(name, days)
    changeEvent(unit, event, { name, days })
    return null
  }
  if (isBeforeItems(records)) throw new StepRefused('This file stores entries the way older versions of Kuna did, so it keeps no event chosen by hand. Propose move-to-items first.')
  const { rows, parts } = picked(book, field['entries'], idOf)
  chooseEvent(unit, records, rows, choiceOf(book, operation, field, idOf), parts)
  return null
}
