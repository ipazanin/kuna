import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words } from '../../../../shared/storage/domain/words'

/** The field in which a record names its loan by the loan's bare UUID, as the loan's own `id` field holds it. */
export const LOAN_FIELD = 'loan'

/** The id of the loan a record names, read as a loan of `kind`, so a UUID of another kind names no loan the reader finds. */
export function namedLoanId(fields: StoredFields, kind: RecordKind): RecordId {
  const key = textOf(fields[LOAN_FIELD])
  return key === '' ? refuse(words.reasons.none(LOAN_FIELD, '')) : recordIdOf(kind, key)
}
