import { bookWith, dependentRefusals } from '../../workbook/application/assetWriteGuards'
import type { Asset } from '../../workbook/domain/asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../../workbook/domain/assetKinds'
import type { AssetsRecords } from '../../workbook/domain/readAssetBook'
import type { Valuation } from '../../workbook/domain/valuation'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

const ASSET_KINDS = [ASSET_RECORDS, VALUATION_RECORDS]

/** An asset keeps the valuations that name it. */
export const ASSET_WRITES: WriteRules<Asset> = {
  kind: ASSET_RECORDS,
  reads: ASSET_KINDS,
  undoable: true,
  read: (read, records) => bookWith(ASSET_RECORDS, read, records).readings.assets,
  refusals: (_change, fresh, after) => dependentRefusals(['valuations'], fresh, after),
}

export const VALUATION_WRITES: WriteRules<Valuation> = {
  kind: VALUATION_RECORDS,
  reads: ASSET_KINDS,
  undoable: true,
  read: (read, records) => bookWith(VALUATION_RECORDS, read, records).readings.valuations,
  refusals: () => [],
}

/** Deletes the asset and its valuations in one write, so one Undo puts them all back. */
export function removeAsset(unit: UnitOfWork, records: AssetsRecords, asset: Asset): void {
  unit.of(ASSET_WRITES).remove(asset)
  records.valuations.records.filter((stored) => stored.record.asset === asset.id).forEach((stored) => unit.of(VALUATION_WRITES).remove(stored.record))
}

/** A new asset, its text trimmed, with an id of its own. */
export function newAsset(asset: Omit<Asset, 'id'>): Asset {
  return { ...asset, name: asset.name.trim(), note: asset.note.trim(), id: recordIdOf(ASSET_RECORDS, newRecordId()) }
}

export function newValuation(valuation: Omit<Valuation, 'id'>): Valuation {
  return { ...valuation, note: valuation.note.trim(), id: recordIdOf(VALUATION_RECORDS, newRecordId()) }
}
