import { DISMISSAL_RECORDS } from './coreKinds'
import { SUGGESTION_KINDS } from './dismissals'
import type { Dismissal } from './dismissals'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { optionalDate, ownId, refuse, requiredChoice, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words } from './words'

export function dismissalOf(fields: StoredFields, id: RecordId | null): Dismissal {
  const kind = requiredChoice(fields, 'kind', SUGGESTION_KINDS, 'kind of suggestion')
  const key = textOf(fields.key)
  if (key === '') refuse(words.dismissals.noKey)
  return { kind, key, category: slugOf(fields.category), dismissedOn: optionalDate(fields, 'dismissed_on'), id: ownId(id) }
}

export const DISMISSAL_CODEC: RecordCodec<Dismissal> = withIdField(DISMISSAL_RECORDS, words.labels.dismissal, dismissalOf, (dismissal) =>
  filledFields({ kind: dismissal.kind, key: dismissal.key, category: dismissal.category, dismissed_on: dismissal.dismissedOn }),
)

/** The suggestions dismissed. One dismissed on more than one record is left out on every one, so it shows again until one record is cleared. */
export function readDismissals(read: RecordsRead<Dismissal>): Reading<Dismissal> {
  const sharesId = idSharing(read)
  const unshared = read.records.filter((stored) => !sharesId(stored))
  const keyOf = (dismissal: Dismissal): string => `${dismissal.kind} ${dismissal.key}`
  const twice = sharedKeys(
    unshared.map((stored) => stored.record),
    keyOf,
  )
  return {
    facts: unshared.map((stored) => stored.record).filter((dismissal) => !twice.has(keyOf(dismissal))),
    problems: [
      ...refusedProblems(read),
      ...read.records.filter(sharesId).map((stored) => problemOf(stored, SHARED_ID_REASON)),
      ...unshared.filter((stored) => twice.has(keyOf(stored.record))).map((stored) => problemOf(stored, words.dismissals.dismissedTwice(stored.record.key))),
    ],
  }
}
