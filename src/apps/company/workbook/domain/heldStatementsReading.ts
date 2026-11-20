import { HELD_STATEMENT_RECORDS } from './coreKinds'
import { isHeldStatement } from './heldStatements'
import type { HeldStatement } from './heldStatements'
import { dayText, labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { optionalDate, ownId, requiredDate, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function heldStatementOf(fields: StoredFields, id: RecordId | null): HeldStatement {
  return {
    mailId: requiredText(fields, 'mail_id'),
    attachment: requiredText(fields, 'attachment'),
    label: requiredText(fields, 'label'),
    iban: textOf(fields.iban),
    mailedOn: requiredDate(fields, 'mailed_on'),
    passedOverOn: optionalDate(fields, 'passed_over_on'),
    id: ownId(id),
  }
}

export const HELD_STATEMENT_CODEC: RecordCodec<HeldStatement> = withIdField(
  HELD_STATEMENT_RECORDS,
  (fields) => labelWords([textOf(fields.label), dayText(fields.mailed_on)]),
  heldStatementOf,
  (held) => filledFields({ mail_id: held.mailId, attachment: held.attachment, label: held.label, iban: held.iban, mailed_on: held.mailedOn, passed_over_on: held.passedOverOn }),
)

/**
 * The statements the sync held. Two devices that sync at once may each remember one statement, so only the first record of a
 * statement counts and the others wait for the write that files it, which deletes every one.
 */
export function readHeldStatements(read: RecordsRead<HeldStatement>): Reading<HeldStatement> {
  const sharesId = idSharing(read)
  const unshared = read.records.filter((stored) => !sharesId(stored)).map((stored) => stored.record)
  return {
    facts: unshared.filter((held, at) => unshared.findIndex((other) => isHeldStatement(other, held)) === at),
    problems: [...refusedProblems(read), ...read.records.filter(sharesId).map((stored) => problemOf(stored, SHARED_ID_REASON))],
  }
}
