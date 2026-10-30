import { EXTRA_PAYMENT_EFFECTS } from './extraPayment'
import type { ExtraPayment } from './extraPayment'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS } from './loanKinds'
import { LOAN_FIELD, namedLoanId } from './loanReference'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, positiveMoney, requiredChoice, requiredDate } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words } from './words'

export function extraPaymentOf(fields: StoredFields, id: RecordId | null): ExtraPayment {
  return {
    id: ownId(id),
    loan: namedLoanId(fields, BANK_LOAN_RECORDS),
    date: requiredDate(fields, 'date'),
    amount: positiveMoney(fields, 'amount'),
    effect: requiredChoice(fields, 'effect', EXTRA_PAYMENT_EFFECTS, 'payment effect'),
  }
}

export const EXTRA_PAYMENT_CODEC: RecordCodec<ExtraPayment> = withIdField(EXTRA_PAYMENT_RECORDS, words.labels.extraPayment, extraPaymentOf, (payment) =>
  filledFields({
    [LOAN_FIELD]: keyOfRecordId(BANK_LOAN_RECORDS, payment.loan),
    date: payment.date,
    amount: amountText(payment.amount),
    effect: payment.effect,
  }),
)
