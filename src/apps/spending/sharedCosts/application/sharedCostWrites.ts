import { CATEGORY_WRITES } from '../../categories/application/categoryWrites'
import { fixedCategoryIn } from '../../categories/domain/starterCategories'
import { heldItemsOf, writeRows } from '../../entries/application/rowRecords'
import type { RowWrite } from '../../entries/application/rowRecords'
import { SHARED_COST_WRITES } from './sharedCostRecords'
import { addPartPayees } from '../../payees/application/payeeWrites'
import type { PartPayeeRecords } from '../../payees/application/payeeWrites'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import type { Category } from '../../workbook/domain/category'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import { SHARED_COST_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { Language } from '../../../../shared/text/language'

/** The rows and items a shared cost write reads of the file. */
type SharedCostRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>

/** What a person sets on a shared cost. */
export type SharedCostDraft = Omit<SharedCost, 'id'>

/** A new shared cost with an id of its own, its payee and note trimmed. */
export function newSharedCost(draft: SharedCostDraft): SharedCost {
  return { ...draft, payee: draft.payee.trim(), note: draft.note.trim(), id: recordIdOf(SHARED_COST_RECORDS, newRecordId()) }
}

/**
 * Adds the shared cost, which `newSharedCost` made, so the same write can put rows in it. A payee no record or entry names yet,
 * such as the friend a gift was for, joins the payees as a person in the same write, as a part's payee does.
 */
export function addSharedCost(unit: UnitOfWork, records: PartPayeeRecords, sharedCost: SharedCost): void {
  addPartPayees(unit, records, [sharedCost])
  unit.of(SHARED_COST_WRITES).add(sharedCost)
}

/** The shared cost with what a person set, Settled included. Its members stay, and it counts their money under its new day, payee, category, labels and event. A new payee joins the payees as `addSharedCost` adds one. */
export function changeSharedCost(unit: UnitOfWork, records: PartPayeeRecords, sharedCost: SharedCost, changed: SharedCostDraft): void {
  const after = { ...changed, payee: changed.payee.trim(), note: changed.note.trim(), id: sharedCost.id }
  addPartPayees(unit, records, [after])
  unit.of(SHARED_COST_WRITES).change(sharedCost, after)
}

/** What a picker files a part under: a category, or a shared cost the part joins. */
export type PickedFiling = { readonly category: RecordId } | { readonly sharedCost: RecordId }

/** The fields of a part a filing sets. */
export interface FilingFields {
  readonly category: RecordId
  readonly sharedCost: RecordId | null
}

/**
 * How a write files parts as a picker gives them: under a category and out of any shared cost, or in a shared cost under In a
 * shared cost. A file made before that category lacks it, so `categories` holds it as the write adds it, and `addFor` adds it in
 * the write once a part joins.
 */
export function sharedCostFiling(categories: readonly Category[], language: Language) {
  const filedIn = fixedCategoryIn(categories, 'shared-cost', language)
  return {
    categories: filedIn.added ? [...categories, filedIn.category] : categories,
    filedIn: filedIn.category.id,
    added: filedIn.added ? filedIn.category : null,
    fields: (picked: PickedFiling): FilingFields => ('sharedCost' in picked ? { category: filedIn.category.id, sharedCost: picked.sharedCost } : { category: picked.category, sharedCost: null }),
    addFor: (unit: UnitOfWork, parts: readonly Pick<TransactionItem, 'sharedCost'>[]): void => {
      if (filedIn.added && parts.some((part) => part.sharedCost !== null)) unit.of(CATEGORY_WRITES).add(filedIn.category)
    },
  }
}

/** Each row with the items `change` gives the picked parts, or all of its items when none of them is picked, as a write of rows. */
function rowsWithParts(
  records: SharedCostRecords,
  rows: readonly Transaction[],
  parts: ReadonlySet<RecordId>,
  change: (item: TransactionItem) => TransactionItem,
  row: (row: Transaction) => Transaction = (same) => same,
): RowWrite[] {
  const itemsOf = heldItemsOf(records)
  return rows.map((before) => {
    const items = itemsOf(before)
    const named = items.some((item) => parts.has(item.id))
    return { before, after: row(before), items: items.map((item) => (!named || parts.has(item.id) ? change(item) : item)) }
  })
}

/**
 * Puts the rows in the shared cost, every part of each or with `parts` those parts alone, such as the wine line of a receipt, in one
 * write. Each part goes under In a shared cost, added to a file that lacks it, and keeps its labels, event and payee for when it
 * leaves. The whole row is marked filed by a person even when only one part joins, because a rule or a transfer pairing that refiles
 * a row not filed by a person would take that part out of its shared cost. A part linked to a record in another app is refused, since both
 * would count its money, and so is a move between your accounts and a file from before items. Gives the categories it added.
 */
export function joinSharedCost(
  unit: UnitOfWork,
  records: SharedCostRecords,
  categories: readonly Category[],
  rows: readonly Transaction[],
  sharedCost: SharedCost,
  language: Language,
  parts: ReadonlySet<RecordId> = new Set(),
): readonly Category[] {
  if (isBeforeItems(records)) throw new Error('A file from before items keeps no shared cost. Move it to items first.')
  if (rows.some((row) => row.pair !== null)) throw new Error('A move between your accounts stays whole, so it joins no shared cost.')
  const filing = sharedCostFiling(categories, language)
  const joined = rowsWithParts(
    records,
    rows,
    parts,
    (item) => ({ ...item, ...filing.fields({ sharedCost: sharedCost.id }) }),
    (row) => ({ ...row, categorisedBy: 'person' }),
  )
  filing.addFor(
    unit,
    joined.flatMap((write) => write.items ?? []),
  )
  writeRows(unit, records, joined)
  return filing.added === null ? [] : [filing.added]
}

/** Takes the rows out of their shared cost, every part of each or with `parts` those parts alone. Each takes its shared cost's category and counts again under its own labels, event and payee. */
export function leaveSharedCost(unit: UnitOfWork, records: SharedCostRecords, sharedCosts: readonly SharedCost[], rows: readonly Transaction[], parts: ReadonlySet<RecordId> = new Set()): void {
  const byId = new Map(sharedCosts.map((sharedCost) => [sharedCost.id, sharedCost]))
  writeRows(
    unit,
    records,
    rowsWithParts(records, rows, parts, (item) => {
      const home = item.sharedCost === null ? undefined : byId.get(item.sharedCost)
      return home === undefined ? item : { ...item, category: home.category, sharedCost: null }
    }),
  )
}

/**
 * Deletes the shared cost and sends each of its members back to To review, without a category or a shared cost, in one write, so
 * one Undo puts the shared cost and every member back. A member keeps its labels, event, payee and note, so filing it again keeps
 * what it had, and a split's other parts keep theirs.
 */
export function deleteSharedCost(unit: UnitOfWork, records: SharedCostRecords, sharedCost: SharedCost): void {
  const itemsOf = heldItemsOf(records)
  const holds = (items: readonly TransactionItem[]): boolean => items.some((item) => item.sharedCost === sharedCost.id)
  writeRows(
    unit,
    records,
    recordsOf(records.transactions)
      .filter((row) => holds(itemsOf(row)))
      .map((row) => ({ before: row, after: row, items: itemsOf(row).map((item) => (item.sharedCost === sharedCost.id ? { ...item, category: null, sharedCost: null } : item)) })),
  )
  unit.of(SHARED_COST_WRITES).remove(sharedCost)
}
