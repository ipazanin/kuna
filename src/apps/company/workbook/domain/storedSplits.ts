import { textOf } from '../../../../shared/storage/domain/storedFields'
import { definedCategories } from './categoriesReading'
import { ledgerOfRecords } from './readWorkbook'
import type { WorkbookRecords } from './readWorkbook'
import { storedItemsOfRow, storesItems } from './rowItems'
import type { StoredSplit } from './splits'
import { readItems, storedSplitOfTab } from './splitsReading'
import type { Transaction } from './workbook'

/**
 * What the books hold of each row's split, in either shape: the parts of a row of several items, or of a row whose items the
 * guards refused, and none for a row of one item that counts. It reads the ledger from the records once, since a workbook as
 * booked holds a split row once per item and would read every split as refused.
 */
export function storedSplitsOf(records: WorkbookRecords): (row: Transaction) => StoredSplit {
  const ledger = ledgerOfRecords(records, definedCategories(records.categories))
  if (!storesItems(records)) return (row) => storedSplitOfTab(records.splits, ledger.splits, row)
  return (row) => {
    const parts = storedItemsOfRow(records.items, row)
    const unreadable = records.items.refused.filter((refused) => row.rowId !== null && textOf(refused.fields.row_id) === row.rowId).length
    const counted = readItems({ records: records.items.records.filter(({ record }) => record.row === row.rowId), refused: [] }, ledger.transactions, ledger.categories).itemsByRow.has(row.id)
    if (counted && parts.length === 1 && unreadable === 0) return { parts: [], refused: false, unreadable }
    return { parts, refused: parts.length > 0 && !counted, unreadable }
  }
}
