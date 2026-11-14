import type { ItemRecord } from './splitsReading'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { partOrder } from './splits'
import type { Transaction } from './workbook'

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
