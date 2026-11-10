import type { UnitOfWork } from '../../../../../shared/storage/application/repository'
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
