import type { Label } from '../../../../shared/categorising/domain/labels'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { problemOf } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { ownId, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { LABEL_RECORDS } from './coreKinds'

function labelOf(fields: StoredFields, id: RecordId | null): Label {
  return { id: ownId(id), name: requiredText(fields, 'name') }
}

export const LABEL_CODEC: RecordCodec<Label> = withIdField(
  LABEL_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  labelOf,
  (label) => filledFields({ name: label.name }),
)

/** The labels of the labels tab, and a problem on each record that cannot be read. */
export function readLabels(read: RecordsRead<Label>): Reading<Label> {
  return { facts: read.records.map((stored) => stored.record), problems: read.refused.map((refused) => problemOf(refused, refused.reason)) }
}
