import { BANK_LOAN_RECORDS, RATE_PERIOD_RECORDS } from './loanKinds'
import { LOAN_FIELD, namedLoanId } from './loanReference'
import { RATE_TYPES } from './ratePeriod'
import type { RatePeriod } from './ratePeriod'
import { rateOfText, rateText } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import { words } from './words'

/** A yearly percent kept as text, such as `3.18`, or null for a blank field. */
export function optionalRate(fields: StoredFields, name: string): YearlyRate | null {
  const text = textOf(fields[name])
  if (text === '') return null
  return rateOfText(text) ?? refuse(words.notARate(name, text))
}

export function requiredRate(fields: StoredFields, name: string): YearlyRate {
  return optionalRate(fields, name) ?? refuse(storedWords.reasons.none(name, ''))
}

export function ratePeriodOf(fields: StoredFields, id: RecordId | null): RatePeriod {
  const loan = namedLoanId(fields, BANK_LOAN_RECORDS)
  const from = requiredDate(fields, 'from')
  const rate = requiredRate(fields, 'rate')
  return { id: ownId(id), loan, from, rate, rateType: requiredChoice(fields, 'rate_type', RATE_TYPES, 'rate type'), note: textOf(fields.note) }
}

export const RATE_PERIOD_CODEC: RecordCodec<RatePeriod> = withIdField(RATE_PERIOD_RECORDS, words.labels.ratePeriod, ratePeriodOf, (period) =>
  filledFields({
    [LOAN_FIELD]: keyOfRecordId(BANK_LOAN_RECORDS, period.loan),
    from: period.from,
    rate: rateText(period.rate),
    rate_type: period.rateType,
    note: period.note,
  }),
)
