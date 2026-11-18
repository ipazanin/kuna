import { ASSET_RECORDS, ASSET_SHARE_RECORDS } from './assetKinds'
import type { AssetShare } from './assetShare'
import { dayText, labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields, partText } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredDate, requiredPart, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** The field in which a share change names its asset by the asset's bare UUID, as the asset's own `id` field holds it. */
const ASSET_FIELD = 'asset'

export function assetShareOf(fields: StoredFields, id: RecordId | null): AssetShare {
  return {
    id: ownId(id),
    asset: recordIdOf(ASSET_RECORDS, requiredText(fields, ASSET_FIELD)),
    from: requiredDate(fields, 'from'),
    share: requiredPart(fields, 'share'),
    note: textOf(fields.note),
  }
}

export const ASSET_SHARE_CODEC: RecordCodec<AssetShare> = withIdField(
  ASSET_SHARE_RECORDS,
  (fields) => labelWords([dayText(fields.from), textOf(fields.share)]),
  assetShareOf,
  (change) => filledFields({ [ASSET_FIELD]: keyOfRecordId(ASSET_RECORDS, change.asset), from: change.from, share: partText(change.share), note: change.note }),
)
