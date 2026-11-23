import { LABEL_RECORDS } from './spendingKinds'
import { labelNameProblem } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { doubted, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'

export function labelOf(fields: StoredFields, id: RecordId | null): Label {
  return { id: ownId(id), name: requiredText(fields, 'name') }
}

export const LABEL_CODEC: RecordCodec<Label> = withIdField(
  LABEL_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  labelOf,
  (label) => filledFields({ name: label.name }),
)

/** Labels count, but one whose name another label has once folded is doubted for `nameShared`, since the two read as one. */
export function readLabels(read: RecordsRead<Label>, nameShared: (name: string) => string): Reading<Label> {
  const labels = read.records.map((stored) => stored.record)
  return doubted(
    readEach(read, () => []),
    read,
    (label) => (labelNameProblem(label.name, labels, label.id) === 'taken' ? nameShared(label.name) : null),
  )
}
