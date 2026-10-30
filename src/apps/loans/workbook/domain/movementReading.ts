import { INFORMAL_LOAN_RECORDS, MOVEMENT_RECORDS } from './loanKinds'
import { LOAN_FIELD, namedLoanId } from './loanReference'
import { MOVEMENT_KINDS } from './movement'
import type { Movement } from './movement'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, positiveMoney, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words } from './words'

export function movementOf(fields: StoredFields, id: RecordId | null): Movement {
  return {
    id: ownId(id),
    loan: namedLoanId(fields, INFORMAL_LOAN_RECORDS),
    date: requiredDate(fields, 'date'),
    kind: requiredChoice(fields, 'kind', MOVEMENT_KINDS, 'movement kind'),
    amount: positiveMoney(fields, 'amount'),
    note: textOf(fields.note),
  }
}

export const MOVEMENT_CODEC: RecordCodec<Movement> = withIdField(MOVEMENT_RECORDS, words.labels.movement, movementOf, (movement) =>
  filledFields({
    [LOAN_FIELD]: keyOfRecordId(INFORMAL_LOAN_RECORDS, movement.loan),
    date: movement.date,
    kind: movement.kind,
    amount: amountText(movement.amount),
    note: movement.note,
  }),
)
