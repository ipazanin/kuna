import type { UnitOfWork } from '../../../../../shared/storage/application/repository'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../../shared/storage/domain/recordsRead'
import type { MovedItems } from '../../../packs/packContribution'
import { presentedWorkbook } from '../../../transactions/domain/presentedWorkbook'
import { ITEM_RECORDS } from '../../../workbook/domain/coreKinds'
import { recordsOfKindIn } from '../../../workbook/domain/readWorkbook'
import type { CompanyBooks, WorkbookRecords } from '../../../workbook/domain/readWorkbook'
import type { ItemRecord } from '../../../workbook/domain/splitsReading'
import { movedPartId, repaymentParts } from '../domain/advanceRepayments'
import { ASSET_RECORDS, OWNER_ADVANCE_RECORDS, TRIP_RECORDS } from '../domain/hrDooKinds'
import { hrDooWorkbook } from '../domain/hrDooPart'
import { ASSET_WRITES, OWNER_ADVANCE_WRITES, TRIP_WRITES } from '../domain/hrDooWrites'
import { matchedPayments } from '../domain/ownerAdvances'
import { ownerAdvanceOrder } from '../../../workbook/domain/workbook'

/**
 * In the write that moves the books to the items tab, splits each payment to the owner into the advances it pays back today, and
 * turns each asset and trip that names a bank row by its row id to name the row's items. Gives the items the move writes.
 */
export function linkPackToItems(unit: UnitOfWork, books: CompanyBooks, moved: MovedItems): readonly ItemRecord[] {
  const items = placeAdvances(unit, books, moved)
  linkRowsToItems(unit, books.records, (rowId) => items.filter((item) => item.row === rowId).map((item) => item.id))
  return items
}

/**
 * Splits each payment to the owner by today's matching: what pays back no advance keeps the payment's item, and each advance it pays
 * back gets an item of its own with the advance's description as its note. Each advance names the items that paid it back.
 */
function placeAdvances(unit: UnitOfWork, books: CompanyBooks, moved: MovedItems): readonly ItemRecord[] {
  const { ownerAdvances, categories, transactions } = hrDooWorkbook(presentedWorkbook(books.workbook))
  const replaced = new Map<RecordId, readonly ItemRecord[]>()
  const repaidBy = new Map<RecordId, RecordId[]>()
  for (const placed of matchedPayments([...ownerAdvances].sort(ownerAdvanceOrder), transactions, categories)) {
    const item = moved.itemOf(placed.payment)
    if (item === undefined || placed.shares.length === 0) continue
    const parts = repaymentParts(item, placed.shares, (place) => movedPartId(item.id, place))
    replaced.set(
      item.id,
      parts.map((part) => ({ ...item, id: part.id, amount: part.amount, note: part.note })),
    )
    for (const part of parts) {
      if (part.advance !== null) repaidBy.set(part.advance.id, [...(repaidBy.get(part.advance.id) ?? []), part.id])
    }
  }
  const advances = unit.of(OWNER_ADVANCE_WRITES)
  for (const advance of recordsOf(recordsOfKindIn(books.records, OWNER_ADVANCE_RECORDS))) {
    const items = repaidBy.get(advance.id)
    if (items !== undefined) advances.change(advance, { ...advance, repaidBy: items })
  }
  return moved.items.flatMap((item) => replaced.get(item.id) ?? [item])
}

/**
 * Turns each asset and trip that names a bank row by its row id to name the row's items. An asset names its row's one item, and a
 * trip every item of each row it links or set aside. A row id no row carries any more becomes the item id it would have had, so the
 * link still reads as gone.
 */
function linkRowsToItems(unit: UnitOfWork, records: WorkbookRecords, itemsOf: (rowId: string) => readonly RecordId[]): void {
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
