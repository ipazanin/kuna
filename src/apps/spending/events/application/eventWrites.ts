import { heldItemsOf, waitingItemsOf, writeRows } from '../../entries/application/rowRecords'
import { eventProblem } from '../domain/events'
import { words as eventWords } from '../domain/words'
import { SHARED_COST_WRITES } from '../../sharedCosts/application/sharedCostRecords'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import { BY_DAYS } from '../../workbook/domain/event'
import type { EventChoice, SpendingEvent } from '../../workbook/domain/event'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { EVENT_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { words } from '../../workbook/domain/words'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** An event keeps a name and days that end on or after they start, and stays while an item names it, but Undo takes back one a write added. */
export const EVENT_WRITES: WriteRules<SpendingEvent> = {
  kind: EVENT_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(EVENT_RECORDS, read, records).readings.events,
  refusals: (_change, fresh, after) => dependentRefusals(['events', 'items', 'sharedCosts'], fresh, after),
}

/** The rows and items an event write reads of the file. */
type EventRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts' | 'sharedCosts'>

function refuseProblem(event: Pick<SpendingEvent, 'name' | 'days'>): void {
  const problem = eventProblem(event.name, event.days)
  if (problem !== null) throw new Error(problem === 'blank' ? eventWords.blank : eventWords.endsBefore)
}

/** Adds the event, which `newEvent` made. Its rows join it by their days, with no write to them. */
export function addEvent(unit: UnitOfWork, event: SpendingEvent): void {
  refuseProblem(event)
  unit.of(EVENT_WRITES).add(event)
}

/** The event under the name, trimmed, and the days. Rows join it by their days, so new days move them with no write to them. */
export function changeEvent(unit: UnitOfWork, event: SpendingEvent, changed: Pick<SpendingEvent, 'name' | 'days'>): void {
  const after = { ...event, name: changed.name.trim(), days: changed.days }
  refuseProblem(after)
  unit.of(EVENT_WRITES).change(event, after)
}

/**
 * Deletes the event and puts every part and shared cost put in it by hand, of a row or a waiting receipt's line, back on its day in the same
 * write, so one Undo puts it all back.
 */
export function deleteEvent(unit: UnitOfWork, records: EventRecords, event: SpendingEvent): void {
  const itemsOf = heldItemsOf(records)
  const waitingOf = waitingItemsOf(records)
  const holds = (items: readonly TransactionItem[]): boolean => items.some((item) => item.event === event.id)
  const backOnDays = (items: readonly TransactionItem[]): readonly TransactionItem[] => items.map((item) => (item.event === event.id ? { ...item, event: BY_DAYS } : item))
  writeRows(
    unit,
    records,
    recordsOf(records.transactions)
      .filter((entry) => holds(itemsOf(entry)))
      .map((entry) => ({ before: entry, after: entry, items: backOnDays(itemsOf(entry)) })),
    recordsOf(records.receipts)
      .filter((receipt) => receipt.transaction === null && holds(waitingOf(receipt.id)))
      .map((receipt) => ({ receipt: receipt.id, lines: backOnDays(waitingOf(receipt.id)) })),
  )
  recordsOf(records.sharedCosts)
    .filter((sharedCost) => sharedCost.event === event.id)
    .forEach((sharedCost) => unit.of(SHARED_COST_WRITES).change(sharedCost, { ...sharedCost, event: BY_DAYS }))
  unit.of(EVENT_WRITES).remove(event)
}

/**
 * Puts every item of each row in the event by hand, takes it out of every event, or puts it back on its day, in one write. With
 * `parts`, a row with a part among them changes those parts alone, such as one line of a receipt. A file from before items keeps
 * no choice, so it moves to items first.
 */
export function chooseEvent(unit: UnitOfWork, records: EventRecords, rows: readonly Transaction[], choice: EventChoice, parts: ReadonlySet<RecordId> = new Set()): void {
  if (isBeforeItems(records)) throw new Error(words.beforeItems('event'))
  const itemsOf = heldItemsOf(records)
  writeRows(
    unit,
    records,
    rows.map((row) => {
      const items = itemsOf(row)
      const named = items.some((item) => parts.has(item.id))
      return { before: row, after: row, items: items.map((item) => (!named || parts.has(item.id) ? { ...item, event: choice } : item)) }
    }),
  )
}
