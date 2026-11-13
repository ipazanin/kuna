import type { UnitOfWork } from '../../../../../shared/storage/application/repository'
import type { CompanyBooks } from '../../../workbook/domain/readWorkbook'
import { storesItems } from '../../../workbook/domain/rowItems'
import { rowItemsOf } from '../../../workbook/domain/splits'
import type { Asset } from '../domain/assets/assets'
import { recordsOf } from '../../../../../shared/storage/domain/recordsRead'
import { recordsOfKindIn } from '../../../workbook/domain/readWorkbook'
import type { WorkbookRecords } from '../../../workbook/domain/readWorkbook'
import type { Category, Transaction } from '../../../workbook/domain/workbook'
import { assetsToLink } from '../domain/assets/assetRegister'
import { ASSET_RECORDS } from '../domain/hrDooKinds'
import { ASSET_WRITES } from '../domain/hrDooWrites'

/** Links each asset whose `ledger_reference` finds exactly the one payment it counts to that row's id. */
export function linkAssetsToRows(unit: UnitOfWork, records: WorkbookRecords, ledger: { readonly transactions: readonly Transaction[]; readonly categories: readonly Category[] }): void {
  const assets = unit.of(ASSET_WRITES)
  for (const { asset, rowId } of assetsToLink(recordsOf(recordsOfKindIn(records, ASSET_RECORDS)), ledger.transactions, ledger.categories)) {
    assets.change(asset, { ...asset, rowId })
  }
}

/**
 * The asset paid for by a ledger row, as the books keep the link: naming the row's one item on books with an items tab, and the
 * row's id on books from before items. Null for a row split into parts, since an asset names one item and keeps it whole.
 */
export function assetPaidBy(asset: Asset, row: Transaction, books: CompanyBooks): Asset | null {
  const items = rowItemsOf(books.workbook.splits)(row)
  const [only] = items
  if (items.length !== 1 || only === undefined) return null
  const { payment: _payment, ...unlinked } = asset
  return storesItems(books.records) ? { ...unlinked, payment: only.id, rowId: null } : { ...unlinked, rowId: row.rowId }
}
