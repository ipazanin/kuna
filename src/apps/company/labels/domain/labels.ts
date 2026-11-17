import type { Label } from '../../../../shared/categorising/domain/labels'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { LABEL_RECORDS } from '../../workbook/domain/coreKinds'

/** A new label of the name, trimmed, with an id of its own, so a write can add it and put it on items at once. */
export function newLabel(name: string): Label {
  return { id: recordIdOf(LABEL_RECORDS, newRecordId()), name: name.trim() }
}
