import { BANK_LOAN_RECORDS, RATE_PERIOD_RECORDS } from './loanKinds'
import { LOAN_FIELD, namedLoanId } from './loanReference'
import { RATE_TYPES } from './ratePeriod'
import type { RatePeriod } from './ratePeriod'
import { rateOfText, rateText } from '../../bankLoans/domain/yearlyRate'
import { dayText, labelWords, labelled, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** A rate the field reads as a percent, such as `3.18%`, and any other text as it is. */
function percentLabel(text: string): string {
  const rate = rateOfText(text)
  return rate === null ? text : `${rateText(rate)}%`
}

export function ratePeriodOf(fields: StoredFields, id: RecordId | null): RatePeriod {
  const loan = namedLoanId(fields, BANK_LOAN_RECORDS)
  const from = requiredDate(fields, 'from')
  const text = textOf(fields.rate)
  if (text === '') refuse('no rate')
  const rate = rateOfText(text) ?? refuse(`rate "${text}" is not a yearly percent with at most four decimals, such as 3.18`)
  return { id: ownId(id), loan, from, rate, rateType: requiredChoice(fields, 'rate_type', RATE_TYPES, 'rate type'), note: textOf(fields.note) }
}

export const RATE_PERIOD_CODEC: RecordCodec<RatePeriod> = withIdField(
  RATE_PERIOD_RECORDS,
  (fields) => labelWords([percentLabel(textOf(fields.rate)), labelled('from', dayText(fields.from))]),
  ratePeriodOf,
  (period) =>
    filledFields({
      [LOAN_FIELD]: keyOfRecordId(BANK_LOAN_RECORDS, period.loan),
      from: period.from,
      rate: rateText(period.rate),
      rate_type: period.rateType,
      note: period.note,
    }),
)
