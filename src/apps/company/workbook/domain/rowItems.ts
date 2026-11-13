import { readItems } from './splitsReading'
import type { ItemRecord } from './splitsReading'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import { partOrder } from './splits'
import type { StoredSplit } from './splits'
import { storedSplitOfTab } from './splitsReading'
import type { WorkbookRecords } from './readWorkbook'
import type { Transaction, Workbook } from './workbook'

/**
 * Whether the books keep every ledger row's money on the items tab, which they do once they hold an item or while they hold no
 * ledger row. Books from before items keep a row's category and share on the row, and a split's parts on the splits tab.
 */
export function storesItems(records: { readonly ledger: RecordsRead<unknown>; readonly items: RecordsRead<unknown> }): boolean {
  return holdsItems(storedOf(records.ledger).length, storedOf(records.items).length)
}

/** Whether books of this many ledger rows and items keep every row's money on the items tab, as `storesItems` says. */
export function holdsItems(ledgerRows: number, items: number): boolean {
  return items > 0 || ledgerRows === 0
}

/** The items tab's records of the row, larger first. */
export function storedItemsOfRow(read: RecordsRead<ItemRecord>, row: Pick<Transaction, 'rowId'>): ItemRecord[] {
  return read.records
    .map(({ record }) => record)
    .filter((item) => row.rowId !== null && item.row === row.rowId)
    .sort(partOrder)
}

/**
 * What the books hold of the row's split, in either shape: the parts of a row of several items, or of a row whose items the
 * guards refused, and none for a row of one item that counts.
 */
export function storedSplitOf(records: WorkbookRecords, workbook: Pick<Workbook, 'transactions' | 'categories' | 'splits'>, row: Transaction): StoredSplit {
  if (!storesItems(records)) return storedSplitOfTab(records.splits, workbook.splits, row)
  const parts = storedItemsOfRow(records.items, row)
  const unreadable = records.items.refused.filter((refused) => row.rowId !== null && textOf(refused.fields.row_id) === row.rowId).length
  const counted = readItems({ records: records.items.records.filter(({ record }) => record.row === row.rowId), refused: [] }, workbook.transactions, workbook.categories).itemsByRow.has(row.id)
  if (counted && parts.length === 1 && unreadable === 0) return { parts: [], refused: false, unreadable }
  return { parts, refused: parts.length > 0 && !counted, unreadable }
}
