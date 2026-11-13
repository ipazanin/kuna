import type { UnitOfWork } from '../../../../../shared/storage/application/repository'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../../shared/storage/domain/recordsRead'
import { ITEM_RECORDS } from '../../../workbook/domain/coreKinds'
import { recordsOfKindIn } from '../../../workbook/domain/readWorkbook'
import type { WorkbookRecords } from '../../../workbook/domain/readWorkbook'
import { ASSET_RECORDS, TRIP_RECORDS } from '../domain/hrDooKinds'
import { ASSET_WRITES, TRIP_WRITES } from '../domain/hrDooWrites'

/**
 * Turns each asset and trip that names a bank row by its row id to name the row's items, as the books move to the items tab. An
 * asset names its row's one item, and a trip every item of each row it links or set aside. A row id no row carries any more
 * becomes the item id it would have had, so the link still reads as gone.
 */
export function linkPackToItems(unit: UnitOfWork, records: WorkbookRecords, itemsOf: (rowId: string) => readonly RecordId[]): void {
  const named = (rowId: string): readonly RecordId[] => {
    const items = itemsOf(rowId)
    return items.length > 0 ? items : [recordIdOf(ITEM_RECORDS, rowId)]
  }
  const assets = unit.of(ASSET_WRITES)
  for (const asset of recordsOf(recordsOfKindIn(records, ASSET_RECORDS))) {
    const [item] = asset.rowId === null ? [] : named(asset.rowId)
    if (item !== undefined) assets.change(asset, { ...asset, payment: item, rowId: null })
  }
  const trips = unit.of(TRIP_WRITES)
  for (const trip of recordsOf(recordsOfKindIn(records, TRIP_RECORDS))) {
    if (trip.advanceRow === null && trip.payoutRow === null && trip.dismissedRows.length === 0) continue
    trips.change(trip, {
      ...trip,
      advanceItems: trip.advanceRow === null ? trip.advanceItems : named(trip.advanceRow),
      payoutItems: trip.payoutRow === null ? trip.payoutItems : named(trip.payoutRow),
      dismissedItems: [...trip.dismissedItems, ...trip.dismissedRows.flatMap(named)],
      advanceRow: null,
      payoutRow: null,
      dismissedRows: [],
    })
  }
}
