import { FLAG_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, flagOf, found, inputOf } from '../../../../shared/app/operationInput'
import { ENTRIES, picked } from './pickedParts'
import { addSharedCost, changeSharedCost, deleteSharedCost, joinSharedCost, leaveSharedCost, newSharedCost } from '../../sharedCosts/application/sharedCostWrites'
import type { SharedCostDraft } from '../../sharedCosts/application/sharedCostWrites'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import { BY_DAYS, OUT_OF_EVENTS } from '../../workbook/domain/event'
import type { EventChoice } from '../../workbook/domain/event'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { Category } from '../../workbook/domain/category'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import { CATEGORY_RECORDS, EVENT_RECORDS, ITEM_RECORDS, LABEL_RECORDS, SHARED_COST_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { language } from '../../../../shared/text/language'

const ENTRY_REFS = { 'entries.entry': TRANSACTION_RECORDS.name, 'entries.part': ITEM_RECORDS.name }
const EVENT_RULES = ['on-its-day', 'out-of-events'] as const

const LABELS: StrictSchema = { type: ['array', 'null'], items: inputOf({ label: TEXT }), description: 'Every label it carries, each by its ref, an empty list for none, or null to keep its own.' }
const EVENT: StrictSchema = { type: ['string', 'null'], description: 'The ref of the event it is put in by hand, or null.' }
const EVENT_RULE: StrictSchema = {
  type: ['string', 'null'],
  enum: [...EVENT_RULES, null],
  description:
    'on-its-day puts it on the event its day gives it, out-of-events takes it out of every event, or null. With null in event and in eventRule it keeps its own, and a new one goes by its day.',
}
const SHARED_COST_FIELDS = { day: TEXT_OR_NULL, payee: TEXT_OR_NULL, category: TEXT_OR_NULL, labels: LABELS, event: EVENT, eventRule: EVENT_RULE, note: TEXT_OR_NULL }
const SHARED_COST_REFS = { category: CATEGORY_RECORDS.name, 'labels.label': LABEL_RECORDS.name, event: EVENT_RECORDS.name }

/** What the shared cost dialog and the selection on Entries do: add, change and delete a shared cost, and put entries in one or take them out. */
export const SHARED_COST_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-shared-cost',
    about:
      'A new shared cost: money several entries make together, such as a gift paid in three shops that friends paid back their share of. It counts what its entries add up to on its own day, under its own payee, spending or income category, labels and event, and its entries count nowhere else. day and category are needed. A join-shared-cost step on the same card names it by its $ name.',
    input: inputOf(SHARED_COST_FIELDS),
    refs: SHARED_COST_REFS,
    creates: SHARED_COST_RECORDS.name,
    alone: false,
    example: { day: '2026-11-20', payee: 'Ana', category: 'category', labels: [{ label: 'label' }], event: 'event', eventRule: null, note: 'Birthday gift' },
  },
  {
    name: 'change-shared-cost',
    about: 'A new day, payee, category, labels, event, note or Settled for a shared cost, null to keep each. settled yes says nobody owes anything more on it, which changes nothing it counts.',
    input: inputOf({ sharedCost: TEXT, ...SHARED_COST_FIELDS, settled: FLAG_OR_NULL }),
    refs: { sharedCost: SHARED_COST_RECORDS.name, ...SHARED_COST_REFS },
    creates: null,
    alone: false,
    example: { sharedCost: 'shared-cost', day: null, payee: null, category: null, labels: null, event: null, eventRule: null, note: null, settled: 'yes' },
  },
  {
    name: 'delete-shared-cost',
    about: "Deletes a shared cost. Each of its entries' parts goes back to To review with no category, keeping its labels, event, payee and note, and counts nowhere until it is filed again.",
    input: inputOf({ sharedCost: TEXT }),
    refs: { sharedCost: SHARED_COST_RECORDS.name },
    creates: null,
    alone: false,
    example: { sharedCost: 'shared-cost' },
  },
  {
    name: 'join-shared-cost',
    about:
      'Puts entries in a shared cost, such as a purchase for the gift or a friend paying back their share: every part of each entry, or with part that part alone. Each part goes under In a shared cost and counts there, keeping its labels, event and payee for when it leaves. A part linked to a record in another app is unlinked first, and a move between your accounts never joins. A file from before parts keeps no shared cost, so move-to-items goes first.',
    input: inputOf({ sharedCost: TEXT, entries: ENTRIES }),
    refs: { sharedCost: SHARED_COST_RECORDS.name, ...ENTRY_REFS },
    creates: null,
    alone: false,
    example: { sharedCost: 'shared-cost', entries: [{ entry: 'transaction', part: null }] },
  },
  {
    name: 'leave-shared-cost',
    about:
      "Takes entries out of their shared cost: every part of each entry, or with part that part alone. Each part takes its shared cost's category and counts again under its own labels, event and payee.",
    input: inputOf({ entries: ENTRIES }),
    refs: ENTRY_REFS,
    creates: null,
    alone: false,
    example: { entries: [{ entry: 'transaction-shared', part: null }] },
  },
]

const SHARED_COST_OPERATION_NAMES: ReadonlySet<string> = new Set(SHARED_COST_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the shared cost operations. */
export function isSharedCostStep(operation: string): boolean {
  return SHARED_COST_OPERATION_NAMES.has(operation)
}

/** The event the step names, on its day, out of every event, or the event by its ref, or null to keep what it has. */
function eventChoiceOf(book: SpendingBook, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string): EventChoice | null {
  const rule = choiceOf(EVENT_RULES, field['eventRule'], 'eventRule')
  if (field['event'] !== null && rule !== null) throw new StepRefused('A shared cost takes an event or an eventRule, not both.')
  if (field['event'] !== null) return found(book.events, idOf(field['event']), 'event').id
  if (rule === null) return null
  return rule === 'on-its-day' ? BY_DAYS : OUT_OF_EVENTS
}

/** What the step sets on a shared cost, with what it leaves null as `held` has it. */
function draftOf(book: SpendingBook, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string, held: SharedCostDraft | null): SharedCostDraft {
  const day = field['day'] === null ? held?.day : dayOf(field['day'])
  const category = field['category'] === null ? held?.category : found(book.categories, idOf(field['category']), 'category').id
  if (day === undefined || category === undefined) throw new StepRefused('A new shared cost needs its day and its category.')
  const labels =
    field['labels'] === null ? (held?.labels ?? []) : [...new Set((field['labels'] as readonly { readonly label: string }[]).map(({ label }) => found(book.labels, idOf(label), 'label').id))]
  return {
    day,
    payee: (field['payee'] as string | null) ?? held?.payee ?? '',
    category,
    labels,
    event: eventChoiceOf(book, field, idOf) ?? held?.event ?? BY_DAYS,
    note: (field['note'] as string | null) ?? held?.note ?? '',
    settled: held?.settled ?? false,
  }
}

/** What a shared cost step leaves for the later steps of its card: the shared cost it added, and the categories a join added. */
export interface SharedCostStep {
  readonly added: SharedCost | null
  readonly categories: readonly Category[]
}

const NOTHING_ADDED: SharedCostStep = { added: null, categories: [] }

/**
 * Writes a shared cost step through the writes the screens use, and gives the shared cost an add-shared-cost step made so a later
 * step names it by `$`. A file from before items keeps no shared cost, so a step that changes entries is refused there.
 */
export function writeSharedCostStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): SharedCostStep {
  if (operation === 'add-shared-cost') {
    const sharedCost = newSharedCost(draftOf(book, field, idOf, null))
    addSharedCost(unit, sharedCost)
    return { added: sharedCost, categories: [] }
  }
  if (operation === 'leave-shared-cost') {
    const { rows, parts } = picked(book, field['entries'], idOf)
    leaveSharedCost(unit, records, book.sharedCosts, rows, parts)
    return NOTHING_ADDED
  }
  const sharedCost = found(book.sharedCosts, idOf(field['sharedCost']), 'shared cost')
  if (operation === 'delete-shared-cost') {
    deleteSharedCost(unit, records, sharedCost)
    return NOTHING_ADDED
  }
  if (operation === 'change-shared-cost') {
    changeSharedCost(unit, sharedCost, { ...draftOf(book, field, idOf, sharedCost), settled: flagOf(field['settled'], sharedCost.settled) })
    return NOTHING_ADDED
  }
  if (isBeforeItems(records)) throw new StepRefused('This file stores entries the way older versions of Kuna did, so it keeps no shared cost. Propose move-to-items first.')
  const { rows, parts } = picked(book, field['entries'], idOf)
  if (rows.some((row) => row.pair !== null)) throw new StepRefused('A move between your accounts stays whole, so it joins no shared cost.')
  const itemsOf = rowItemsOf(book)
  const joining = rows.flatMap((row) => {
    const items = itemsOf(row)
    return items.some((item) => parts.has(item.id)) ? items.filter((item) => parts.has(item.id)) : items
  })
  if (joining.some((item) => item.link !== null)) throw new StepRefused('A part linked to a record in another app would count its money twice. Propose unlink-entry for it first.')
  return { added: null, categories: joinSharedCost(unit, records, book.categories, rows, sharedCost, language, parts) }
}
