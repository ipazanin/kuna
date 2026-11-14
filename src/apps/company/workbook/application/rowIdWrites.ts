import { LEDGER_WRITES } from '../../imports/application/ledgerWrites'
import { installedPack } from '../../packs/packContribution'
import { SPLIT_WRITES } from '../../transactions/application/splitWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { definedCategories } from '../domain/categoriesReading'
import { readLedger } from '../domain/ledgerReading'
import type { CompanyBooks, WorkbookRecords } from '../domain/readWorkbook'
import { rowsOfSplitKey } from '../domain/splits'
import type { Transaction } from '../domain/workbook'
import { ITEM_WRITES } from '../../transactions/application/itemWrites'
import { keyOfRecordId, newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ITEM_RECORDS, SPLIT_PART_RECORDS } from '../domain/coreKinds'
import type { ItemRecord } from '../domain/splitsReading'
import { storesItems } from '../domain/rowItems'

/**
 * Gives every ledger row that has no row id a new one, and in the same write links what finds such a row by its content to
 * the row's id: each split part whose day, account, amount and balance find exactly one row, and the pack's records.
 */
export function giveRowsIds(unit: UnitOfWork, records: WorkbookRecords, newId: () => string = newRecordId): void {
  const categories = definedCategories(records.categories)
  const entries = recordsOf(records.ledger)
  const given = entries.map((entry) => (entry.rowId === null ? newId() : null))
  const ledger = unit.of(LEDGER_WRITES)
  entries.forEach((entry, position) => {
    const rowId = given[position] ?? null
    if (rowId !== null) ledger.change(entry, { ...entry, rowId })
  })
  // The reader keeps the ledger's order, so each row stands where its entry does.
  const transactions = readLedger(records.ledger, categories).facts.map((row, position): Transaction => ({ ...row, rowId: given[position] ?? row.rowId }))
  const parts = unit.of(SPLIT_WRITES)
  for (const part of recordsOf(records.splits)) {
    const found = part.key.rowId === null ? rowsOfSplitKey(transactions, part.key) : []
    const rowId = found.length === 1 ? found[0]!.rowId : null
    if (rowId !== null) parts.change(part, { ...part, key: { ...part.key, rowId } })
  }
  installedPack().linkToRows(unit, records, { transactions, categories })
}

/** What keeps books from before items from moving, since the move writes only what the books count today and repairs nothing. */
export type ItemsMoveBlocker =
  /** A ledger row the reader cannot read, which no item can name. */
  | { readonly kind: 'unreadable-row'; readonly label: string }
  /** A part of the splits tab that cannot be read, or whose split the guards refuse, so its row counts whole today. */
  | { readonly kind: 'refused-part'; readonly label: string }
  /** A split of a row the pack keeps whole, so the row counts whole today. */
  | { readonly kind: 'kept-whole'; readonly label: string }
  /** A row of no amount, which no item can hold. */
  | { readonly kind: 'zero-row'; readonly label: string }

/** Why the books cannot move to the items tab yet, each with what names the record. None for books that can, or already have. */
export function itemsMoveBlockers(books: CompanyBooks): readonly ItemsMoveBlocker[] {
  const { records, workbook } = books
  if (storesItems(records)) return []
  const counted = new Set(workbook.splits.map((split) => split.row.id))
  const splitProblems = workbook.problems.filter((problem) => problem.tab === 'splits')
  return [
    ...records.ledger.refused.map((refused): ItemsMoveBlocker => ({ kind: 'unreadable-row', label: refused.label })),
    ...splitProblems.map((problem): ItemsMoveBlocker => ({ kind: 'refused-part', label: problem.label })),
    ...workbook.splits.filter((split) => workbook.rowsKeptWhole.has(split.row.id)).map((split): ItemsMoveBlocker => ({ kind: 'kept-whole', label: split.row.date })),
    ...workbook.transactions.filter((row) => !counted.has(row.id) && row.amount === 0).map((row): ItemsMoveBlocker => ({ kind: 'zero-row', label: row.date })),
  ]
}

/** An item's id under the key its split part was stored by. */
function itemIdOfPart(id: RecordId): RecordId {
  return recordIdOf(ITEM_RECORDS, keyOfRecordId(SPLIT_PART_RECORDS, id))
}

/**
 * Moves books from before items to the items tab in one write. Every ledger row gets a row id if it has none, and gives up its
 * category and share to its items: a row not split one item under its own id with them, and a split row its parts, each under the
 * key it was stored by, in the order the splits tab holds them. The splits tab is emptied, and the pack splits the items by what
 * its records count them as today and has its records that name a row name its items. Gives the items the move wrote, in the
 * order of the ledger.
 */
export function moveToItems(unit: UnitOfWork, books: CompanyBooks, newId: () => string = newRecordId): readonly ItemRecord[] {
  const { records, workbook } = books
  const ledger = unit.of(LEDGER_WRITES)
  const rowOf = new Map(workbook.transactions.map((row) => [row.id, row]))
  const counted = new Set(workbook.splits.map((split) => split.row.id))
  const parts = recordsOf(records.splits)
  const byEntry = new Map(
    recordsOf(records.ledger).map((entry): [RecordId, ItemRecord[]] => {
      const rowId = entry.rowId ?? newId()
      ledger.change(entry, { ...entry, rowId, category: '', ownerShare: null })
      const row: Transaction | undefined = rowOf.get(entry.id)
      if (row !== undefined && counted.has(row.id)) {
        return [
          entry.id,
          parts
            .filter((part) => rowsOfSplitKey([row], part.key).length === 1)
            .map((part) => ({ row: rowId, amount: part.amount, category: part.category, note: part.note, ownerShare: part.ownerShare, id: itemIdOfPart(part.id) })),
        ]
      }
      return [entry.id, [{ row: rowId, amount: entry.amount, category: entry.category, note: '', ownerShare: entry.ownerShare, id: recordIdOf(ITEM_RECORDS, rowId) }]]
    }),
  )
  const splitParts = unit.of(SPLIT_WRITES)
  parts.forEach((part) => splitParts.remove(part))
  const items = installedPack().linkToItems(unit, books, {
    items: [...byEntry.values()].flat(),
    itemOf: ({ id, split }) => {
      const held = byEntry.get(split?.whole.id ?? id) ?? []
      return split === undefined ? held[0] : held.find((item) => item.id === itemIdOfPart(split.id))
    },
  })
  const itemWrites = unit.of(ITEM_WRITES)
  items.forEach((item) => itemWrites.add(item))
  return items
}
