import { SUGGESTION_KINDS } from './dismissals'
import type { Dismissal } from './dismissals'
import { dayText, labelWords, withIdField } from './recordCodec'
import type { RecordCodec } from './recordCodec'
import { filledFields } from './recordFields'
import type { RecordId } from './recordId'
import { DISMISSAL_RECORDS } from './recordKind'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { sharedKeys } from './sharedKeys'
import { optionalDate, ownId, refuse, requiredChoice, slugOf, textOf } from './storedFields'
import type { StoredFields } from './storedFields'

export function dismissalOf(fields: StoredFields, id: RecordId | null): Dismissal {
  const kind = requiredChoice(fields, 'kind', SUGGESTION_KINDS, 'kind of suggestion')
  const key = textOf(fields.key)
  if (key === '') refuse('no key')
  return { kind, key, category: slugOf(fields.category), dismissedOn: optionalDate(fields, 'dismissed_on'), id: ownId(id) }
}

export const DISMISSAL_CODEC: RecordCodec<Dismissal> = withIdField(
  DISMISSAL_RECORDS,
  (fields) => labelWords([textOf(fields.key), dayText(fields.dismissed_on)]),
  dismissalOf,
  (dismissal) => filledFields({ kind: dismissal.kind, key: dismissal.key, category: dismissal.category, dismissed_on: dismissal.dismissedOn }),
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
      ...unshared.filter((stored) => twice.has(keyOf(stored.record))).map((stored) => problemOf(stored, `${stored.record.key} is dismissed on more than one row, so none of them counts`)),
    ],
  }
}
