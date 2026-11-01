import { decimalField, groupField, mixGroupOf, percentField } from './investmentFields'
import { TARGET_RECORDS } from './investmentKinds'
import { MIXES } from './mixGroup'
import type { Target } from './target'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function targetOf(fields: StoredFields, id: RecordId | null): Target {
  return { id: ownId(id), slice: mixGroupOf(fields, MIXES), percent: percentField(fields, 'percent') }
}

export const TARGET_CODEC: RecordCodec<Target> = withIdField(TARGET_RECORDS, words.labels.share, targetOf, (target) =>
  filledFields({ mix: target.slice.mix, group: groupField(target.slice), percent: decimalField(target.percent) }),
)
