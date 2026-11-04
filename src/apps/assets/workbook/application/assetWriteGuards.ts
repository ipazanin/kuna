import { ASSET_PARTS, assetsRecordsOf, readAssetBook } from '../domain/readAssetBook'
import type { AssetBook } from '../domain/readAssetBook'
import { dependentRefusalsOf } from '../../../../shared/storage/application/dependentRefusals'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { FreshRecords } from '../../../../shared/storage/domain/writeRules'

/** The book the records make, with the kind's records as `read` gives them. */
export function bookWith<R>(kind: RecordKind<R>, read: RecordsRead<R>, records: FreshRecords): AssetBook {
  return readAssetBook(assetsRecordsOf(<K>(other: RecordKind<K>) => (other.name === kind.name ? (read as RecordsRead<unknown> as RecordsRead<K>) : records.of(other))))
}

/** Why a write would harm records of the asset parts that read the written kind. */
export const dependentRefusals = dependentRefusalsOf((records) => readAssetBook(assetsRecordsOf((kind) => records.of(kind))), ASSET_PARTS)
