import { LOAN_DIRECTIONS } from './informalLoan'
import type { ExpectedPlan, InformalLoan } from './informalLoan'
import { INFORMAL_LOAN_RECORDS } from './loanKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalDate, optionalMoney, ownId, refuse, requiredChoice, requiredDate, requiredMoney, textOf, wholeNumberOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import { words } from './words'

/** The plan the three fields keep, all filled or none, from the loan's start on. */
function expectedPlanOf(fields: StoredFields, start: InformalLoan['start']): ExpectedPlan | null {
  const monthly = optionalMoney(fields, 'expected_monthly')
  const from = optionalDate(fields, 'expected_from')
  const day = fields.expected_day === undefined ? null : wholeNumberOf(fields.expected_day)
  if (monthly === null && from === null && fields.expected_day === undefined) return null
  if (monthly === null || from === null || fields.expected_day === undefined) refuse(words.expectedIncomplete)
  if (monthly <= 0) refuse(storedWords.reasons.notAboveZero('expected_monthly'))
  if (day === null || day < 1 || day > 31) refuse(words.notADayOfMonth('expected_day', textOf(fields.expected_day)))
  if (from < start) refuse(words.expectedBeforeStart(from, start))
  return { monthly, from, day }
}

export function informalLoanOf(fields: StoredFields, id: RecordId | null): InformalLoan {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  const openingBalance = requiredMoney(fields, 'opening_balance')
  if (openingBalance < 0) refuse(words.openingBelowZero)
  const start = requiredDate(fields, 'start')
  return {
    id: ownId(id),
    name,
    counterparty: textOf(fields.counterparty),
    direction: requiredChoice(fields, 'direction', LOAN_DIRECTIONS),
    openingBalance,
    start,
    note: textOf(fields.note),
    expected: expectedPlanOf(fields, start),
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
      expected_monthly: loan.expected === null ? null : amountText(loan.expected.monthly),
      expected_from: loan.expected === null ? null : loan.expected.from,
      expected_day: loan.expected === null ? null : String(loan.expected.day),
    }),
)
