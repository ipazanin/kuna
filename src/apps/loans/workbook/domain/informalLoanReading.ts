import { LOAN_DIRECTIONS } from './informalLoan'
import type { InformalLoan } from './informalLoan'
import { INFORMAL_LOAN_RECORDS } from './loanKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredDate, requiredMoney, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function informalLoanOf(fields: StoredFields, id: RecordId | null): InformalLoan {
  const name = textOf(fields.name)
  if (name === '') refuse('no name')
  const openingBalance = requiredMoney(fields, 'opening_balance')
  if (openingBalance < 0) refuse('opening_balance is below zero')
  return {
    id: ownId(id),
    name,
    counterparty: textOf(fields.counterparty),
    direction: requiredChoice(fields, 'direction', LOAN_DIRECTIONS),
    openingBalance,
    start: requiredDate(fields, 'start'),
    note: textOf(fields.note),
  }
}

export const INFORMAL_LOAN_CODEC: RecordCodec<InformalLoan> = withIdField(
  INFORMAL_LOAN_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  informalLoanOf,
  (loan) =>
    filledFields({
      name: loan.name,
      counterparty: loan.counterparty,
      direction: loan.direction,
      opening_balance: amountText(loan.openingBalance),
      start: loan.start,
      note: loan.note,
    }),
)
