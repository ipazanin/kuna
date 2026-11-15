import type { Label } from './label'
import { LABEL_RECORDS } from './spendingKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function labelOf(fields: StoredFields, id: RecordId | null): Label {
  return { id: ownId(id), name: requiredText(fields, 'name') }
}

export const LABEL_CODEC: RecordCodec<Label> = withIdField(
  LABEL_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  labelOf,
  (label) => filledFields({ name: label.name }),
)
