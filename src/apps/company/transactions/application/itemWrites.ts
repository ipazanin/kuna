import { absMoney, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import { installedPack } from '../../packs/packContribution'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { CATEGORY_RECORDS, ITEM_RECORDS, LEDGER_RECORDS, SPLIT_PART_RECORDS } from '../../workbook/domain/coreKinds'
import { definedCategories } from '../../workbook/domain/categoriesReading'
import { readItems } from '../../workbook/domain/splitsReading'
import type { ItemRecord } from '../../workbook/domain/splitsReading'
import { readLedger } from '../../workbook/domain/ledgerReading'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import { packRecordsOf } from '../../workbook/domain/packPart'
import { ledgerOfRecords } from '../../workbook/domain/readWorkbook'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import { storedItemsOfRow, storesItems } from '../../workbook/domain/rowItems'
import { splitKeyOf, wholeItemId } from '../../workbook/domain/splits'
import type { StoredItem, StoredSplit } from '../../workbook/domain/splits'
import type { RowRepayments } from '../../workbook/domain/repayments'
import type { Transaction, Workbook } from '../../workbook/domain/workbook'
import { words } from '../../workbook/domain/words'
import { keyOfRecordId, newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordWithId } from '../../../../shared/storage/domain/recordsRead'
import type { FreshRecords, KindChange, WriteRules } from '../../../../shared/storage/domain/writeRules'
import { LEDGER_WRITES } from '../../imports/application/ledgerWrites'
import { REFUSED_SPLIT_WRITES, SPLIT_WRITES } from './splitWrites'

/** An item a write leaves on a row: the stored one it keeps, by its id, or a new one with none. */
export interface ItemDraft {
  readonly id: RecordId | null
  /** The same sign as the row. */
  readonly amount: Money
  readonly category: string
  readonly note: string
  readonly ownerShare: OwnerShare | null
}

/** A new item's id. */
function newItemId(): RecordId {
  return recordIdOf(ITEM_RECORDS, newRecordId())
}

/** The id the books store an item under: on the items tab as it is, and in books from before items as a split part's under the same key. */
export function storedItemIdOf(records: WorkbookRecords, id: RecordId): RecordId {
  return storesItems(records) ? id : splitPartIdOf(id)
}

/** The id of a split part of books from before items, under the same key as the item's. */
function splitPartIdOf(id: RecordId): RecordId {
  return id.startsWith(`${SPLIT_PART_RECORDS.name}:`) ? id : recordIdOf(SPLIT_PART_RECORDS, keyOfRecordId(ITEM_RECORDS, id))
}

/** The ledger rows filed as their items, as the records the check read hold them. */
function freshLedger(fresh: FreshRecords): Pick<Workbook, 'transactions' | 'splits' | 'categories'> {
  return ledgerOfRecords({ ledger: fresh.of(LEDGER_RECORDS), splits: fresh.of(SPLIT_PART_RECORDS), items: fresh.of(ITEM_RECORDS) }, definedCategories(fresh.of(CATEGORY_RECORDS)))
}

/** The items a record of the pack files, which a write leaves as they are unless it also changes what the pack names. */
function keptItems(records: FreshRecords): ReadonlyMap<RecordId, string> {
  const pack = installedPack().workbook
  if (pack === null) return new Map()
  return pack.itemsKept(
    packRecordsOf(pack.itemsKeptReads, (kind) => records.of(kind)),
    freshLedger(records),
  )
}

/**
 * A write may not split a row the pack keeps whole, and may not take out or change the amount of an item a record of the pack
 * files, unless the same write changes which items that record names, as a trip's own filing does.
 */
function itemRefusals(change: KindChange<ItemRecord>, fresh: FreshRecords, after: FreshRecords): string[] {
  const pack = installedPack().workbook
  if (pack === null || change.undoing) return []
  const ledger = freshLedger(after)
  const rowOf = (rowId: string) => ledger.transactions.find((row) => row.rowId === rowId) ?? null
  const keptWhole = pack.rowsKeptWhole(
    packRecordsOf(pack.keptWholeReads, (kind) => fresh.of(kind)),
    ledger,
  )
  const split = new Set(ledger.splits.map((held) => held.row.id))
  const touched = new Set(change.edits.flatMap((edit) => [edit.before, edit.after].flatMap((stored) => (stored === null || !('record' in stored) ? [] : [stored.record.row]))))
  const wholeRefusals = [...touched].flatMap((rowId) => {
    const row = rowOf(rowId)
    const why = row === null ? undefined : keptWhole.get(row.id)
    return row !== null && why !== undefined && split.has(row.id) ? [words.splits.refusedKeptWhole(row.account, row.date, row.amount, why)] : []
  })
  const before = keptItems(fresh)
  const still = keptItems(after)
  const keptBy = (kept: ReadonlyMap<RecordId, string>, why: string) => [...kept].flatMap(([id, held]) => (held === why ? [id] : [])).join(' ')
  const keptRefusals = change.edits.flatMap((edit) => {
    if (edit.before === null || edit.before.id === null || !('record' in edit.before)) return []
    const why = before.get(edit.before.id)
    if (why === undefined || keptBy(before, why) !== keptBy(still, why)) return []
    const item = edit.before.record
    if (edit.after !== null && 'record' in edit.after && edit.after.record.amount === item.amount) return []
    const row = rowOf(item.row)
    return row === null ? [] : [words.splits.refusedItemNamed(row.account, row.date, row.amount, why)]
  })
  return [...new Set([...wholeRefusals, ...keptRefusals])]
}

/**
 * Items of the ledger rows, checked by their reader against the ledger and the categories as they are now, so a row's items
 * that miss its amount or name no category are never written, and against what the pack keeps whole or files.
 */
export const ITEM_WRITES: WriteRules<ItemRecord> = {
  kind: ITEM_RECORDS,
  get reads() {
    const pack = installedPack().workbook
    return [LEDGER_RECORDS, CATEGORY_RECORDS, ...(pack?.keptWholeReads ?? []), ...(pack?.itemsKeptReads ?? [])]
  },
  undoable: true,
  read: (read, records) => {
    const categories = definedCategories(records.of(CATEGORY_RECORDS))
    return readItems(read, readLedger(records.of(LEDGER_RECORDS), categories).facts, categories)
  },
  refusals: itemRefusals,
}

/** The items' rules for the items of a row the guards refused, which keep no Undo, since the guards would refuse to write them back. */
const REFUSED_ITEM_WRITES: WriteRules<ItemRecord> = {
  kind: ITEM_RECORDS,
  get reads() {
    return ITEM_WRITES.reads
  },
  undoable: false,
  read: ITEM_WRITES.read,
  refusals: ITEM_WRITES.refusals,
}

/** The row as a write's items name it. */
type ItemsRow = Pick<Transaction, 'id' | 'date' | 'account' | 'amount' | 'balance' | 'rowId'>

/**
 * Leaves the row holding these items, in the shape the books keep. Books with an items tab hold them there: a stored item a draft
 * names keeps its id, the rest are added or removed, and a row's one item always takes the row's own item id. Books from before
 * items hold one item as the row's category and share, and several as a split on the splits tab, the parts of a refused split
 * replaced with no Undo. Sets who filed the row when `flaggedBy` is given. Gives each item as the books read it back.
 */
export function writeRowItems(unit: UnitOfWork, records: WorkbookRecords, row: ItemsRow, stored: StoredSplit, items: readonly ItemDraft[], flaggedBy: string | null = null): readonly StoredItem[] {
  if (items.length === 0) throw new Error('A row keeps at least one item.')
  const entry = recordWithId(records.ledger, row.id)?.record
  if (entry === undefined) throw new Error('The row is no longer in the books.')
  if (storesItems(records)) {
    const ledger = flaggedBy === null || flaggedBy === entry.flaggedBy ? entry : { ...entry, flaggedBy }
    if (ledger !== entry) unit.of(LEDGER_WRITES).change(entry, ledger)
    return writeItemsTab(unit, records, row, stored, items)
  }
  const parts = unit.of(SPLIT_WRITES)
  const held = stored.refused ? unit.of(REFUSED_SPLIT_WRITES) : parts
  const [only] = items
  if (items.length === 1 && only !== undefined) {
    stored.parts.forEach((part) => {
      const record = recordWithId(records.splits, part.id)?.record
      if (record !== undefined) held.remove(record)
    })
    const filed = { ...entry, category: only.category, ownerShare: only.ownerShare, flaggedBy: flaggedBy ?? entry.flaggedBy }
    if (filed.category !== entry.category || filed.ownerShare !== entry.ownerShare || filed.flaggedBy !== entry.flaggedBy) unit.of(LEDGER_WRITES).change(entry, filed)
    return [{ ...only, id: wholeItemId(row) }]
  }
  const key = splitKeyOf(row)
  const written = items.map((item): StoredItem => {
    const wanted = { amount: item.amount, category: item.category, note: item.note, ownerShare: item.ownerShare }
    const record = item.id === null ? undefined : recordWithId(records.splits, item.id)?.record
    if (record === undefined) {
      const added = { key, ...wanted, id: splitPartIdOf(item.id ?? newItemId()) }
      parts.add(added)
      return added
    }
    const changed = { ...record, key, ...wanted }
    held.change(record, changed)
    return changed
  })
  for (const part of stored.parts.filter((candidate) => !written.some((kept) => kept.id === candidate.id))) {
    const record = recordWithId(records.splits, part.id)?.record
    if (record !== undefined) held.remove(record)
  }
  if (flaggedBy !== null && flaggedBy !== entry.flaggedBy) unit.of(LEDGER_WRITES).change(entry, { ...entry, flaggedBy })
  return written
}

/** The row's items written on the items tab, against every record of the row the tab holds. */
function writeItemsTab(unit: UnitOfWork, records: WorkbookRecords, row: ItemsRow, stored: StoredSplit, items: readonly ItemDraft[]): readonly StoredItem[] {
  if (row.rowId === null) throw new Error('A row on the items tab has a row id.')
  const rowId = row.rowId
  const repository = unit.of(stored.refused ? REFUSED_ITEM_WRITES : ITEM_WRITES)
  const held = storedItemsOfRow(records.items, row)
  const whole = items.length === 1 ? wholeItemId(row) : null
  const written = items.map((item): ItemRecord => {
    const id = whole ?? item.id ?? newItemId()
    const wanted: ItemRecord = { row: rowId, amount: item.amount, category: item.category, note: item.note, ownerShare: item.ownerShare, id }
    const record = held.find((candidate) => candidate.id === id)
    if (record === undefined) {
      unit.of(ITEM_WRITES).add(wanted)
    } else if (record.amount !== wanted.amount || record.category !== wanted.category || record.note !== wanted.note || record.ownerShare !== wanted.ownerShare) {
      repository.change(record, wanted)
    }
    return wanted
  })
  for (const record of held.filter((candidate) => !written.some((kept) => kept.id === candidate.id))) {
    repository.remove(record)
  }
  return written
}

/** The ledger entry as the books store it: without its category and share on books with an items tab, which its items hold. */
function storedEntry(records: WorkbookRecords, entry: LedgerEntry): LedgerEntry {
  return storesItems(records) ? { ...entry, category: '', ownerShare: null } : entry
}

/**
 * Takes the replaced rows out and adds the new ones, each with the category and share its entry names. Books with an items tab
 * give a new row one item under them, or when it pays back what a pack keeps the items `repayments` give it. A new row that takes
 * the place of one taken out keeps that row's items, and when its amount differs the largest of them takes up the difference, so
 * they still add up to it. Items of a row taken out that nothing takes the place of go with it.
 */
export function replaceLedgerRows(unit: UnitOfWork, records: WorkbookRecords, removed: readonly LedgerEntry[], added: readonly LedgerEntry[], repayments: readonly RowRepayments[] = []): void {
  const ledger = unit.of(LEDGER_WRITES)
  removed.forEach((entry) => ledger.remove(entry))
  added.forEach((entry) => ledger.add(storedEntry(records, entry)))
  if (!storesItems(records)) return
  const items = unit.of(ITEM_WRITES)
  const heldBy = (rowId: string | null) => (rowId === null ? [] : storedItemsOfRow(records.items, { rowId }))
  for (const entry of added) {
    const held = heldBy(entry.rowId)
    if (entry.rowId === null) throw new Error('A new ledger row has a row id.')
    if (held.length === 0) {
      const rowId = entry.rowId
      const repaid = repayments.find((repayment) => repayment.row === rowId)?.items ?? [{ id: wholeItemId(entry), amount: entry.amount, note: '' }]
      repaid.forEach((item) => items.add({ row: rowId, amount: item.amount, category: entry.category, note: item.note, ownerShare: entry.ownerShare, id: item.id }))
      continue
    }
    const gap = restOfWhole(
      entry.amount,
      held.map((item) => item.amount),
    )
    const [largest] = [...held].sort((left, right) => absMoney(right.amount) - absMoney(left.amount))
    if (gap !== 0 && largest !== undefined) items.change(largest, { ...largest, amount: addMoney(largest.amount, gap) })
  }
  const kept = new Set(added.map((entry) => entry.rowId))
  for (const entry of removed.filter((candidate) => !kept.has(candidate.rowId))) {
    heldBy(entry.rowId).forEach((item) => items.remove(item))
  }
}
