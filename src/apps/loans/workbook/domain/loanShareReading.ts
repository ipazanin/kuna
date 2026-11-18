import { BANK_LOAN_RECORDS, LOAN_SHARE_RECORDS } from './loanKinds'
import { LOAN_FIELD, namedLoanId } from './loanReference'
import type { LoanShare } from './loanShare'
import { dayText, labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields, partText } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredDate, requiredPart, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function loanShareOf(fields: StoredFields, id: RecordId | null): LoanShare {
  return { id: ownId(id), loan: namedLoanId(fields, BANK_LOAN_RECORDS), from: requiredDate(fields, 'from'), share: requiredPart(fields, 'share'), note: textOf(fields.note) }
}

export const LOAN_SHARE_CODEC: RecordCodec<LoanShare> = withIdField(
  LOAN_SHARE_RECORDS,
  (fields) => labelWords([dayText(fields.from), textOf(fields.share)]),
  loanShareOf,
  (change) => filledFields({ [LOAN_FIELD]: keyOfRecordId(BANK_LOAN_RECORDS, change.loan), from: change.from, share: partText(change.share), note: change.note }),
)
