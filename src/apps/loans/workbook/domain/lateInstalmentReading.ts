import type { LateInstalment } from './lateInstalment'
import { BANK_LOAN_RECORDS, LATE_INSTALMENT_RECORDS } from './loanKinds'
import { LOAN_FIELD, namedLoanId } from './loanReference'
import { dayText, labelWords, labelled, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredDate } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function lateInstalmentOf(fields: StoredFields, id: RecordId | null): LateInstalment {
  const loan = namedLoanId(fields, BANK_LOAN_RECORDS)
  const due = requiredDate(fields, 'due')
  const paid = requiredDate(fields, 'paid')
  if (paid <= due) refuse(`paid ${paid} is not after the due date ${due}`)
  return { id: ownId(id), loan, due, paid }
}

export const LATE_INSTALMENT_CODEC: RecordCodec<LateInstalment> = withIdField(
  LATE_INSTALMENT_RECORDS,
  (fields) => labelWords([labelled('due', dayText(fields.due)), labelled('paid', dayText(fields.paid))]),
  lateInstalmentOf,
  (late) => filledFields({ [LOAN_FIELD]: keyOfRecordId(BANK_LOAN_RECORDS, late.loan), due: late.due, paid: late.paid }),
)
