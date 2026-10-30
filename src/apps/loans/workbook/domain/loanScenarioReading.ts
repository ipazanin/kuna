import { LOAN_TERM_FIELDS, loanTermsFields, loanTermsOf } from './bankLoanReading'
import { BANK_LOAN_RECORDS, LOAN_SCENARIO_RECORDS } from './loanKinds'
import { LOAN_FIELD } from './loanReference'
import { optionalRate } from './ratePeriodReading'
import { rateText } from '../../bankLoans/domain/yearlyRate'
import type { LoanCosts, LoanScenario } from '../../scenarios/domain/loanScenario'
import { ZERO } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { FieldValue } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalMoney, ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import { words } from './words'

const COST_FIELDS = { upfront: 'upfront_costs', monthly: 'monthly_costs', yearly: 'yearly_costs' } as const

/** Every field only an offer fills. */
const OFFER_FIELDS = [...LOAN_TERM_FIELDS, ...Object.values(COST_FIELDS), 'bank_eks']

function costOf(fields: StoredFields, name: string): Money {
  const amount = optionalMoney(fields, name) ?? ZERO
  return amount < 0 ? refuse(words.costBelowZero(name)) : amount
}

/** The one-off, monthly and yearly costs, a blank field costing nothing. */
export function loanCostsOf(fields: StoredFields): LoanCosts {
  return { upfront: costOf(fields, COST_FIELDS.upfront), monthly: costOf(fields, COST_FIELDS.monthly), yearly: costOf(fields, COST_FIELDS.yearly) }
}

export function loanCostsFields(costs: LoanCosts): Readonly<Record<string, FieldValue | null>> {
  const field = (amount: Money): string | null => (amount === 0 ? null : amountText(amount))
  return { [COST_FIELDS.upfront]: field(costs.upfront), [COST_FIELDS.monthly]: field(costs.monthly), [COST_FIELDS.yearly]: field(costs.yearly) }
}

/** A scenario of the bank loan its `loan` names, or, with `loan` blank, an offer with a bank loan's terms and its costs. */
export function loanScenarioOf(fields: StoredFields, id: RecordId | null): LoanScenario {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  const loan = textOf(fields[LOAN_FIELD])
  if (loan !== '') {
    const filled = OFFER_FIELDS.filter((field) => fields[field] !== undefined)
    if (filled.length > 0) refuse(words.offerFieldsOnLoan(filled.join(', ')))
    return { id: ownId(id), name, start: { kind: 'loan', loan: recordIdOf(BANK_LOAN_RECORDS, loan) } }
  }
  return { id: ownId(id), name, start: { kind: 'offer', terms: { ...loanTermsOf(fields), costs: loanCostsOf(fields), bankEks: optionalRate(fields, 'bank_eks') } } }
}

export const LOAN_SCENARIO_CODEC: RecordCodec<LoanScenario> = withIdField(
  LOAN_SCENARIO_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  loanScenarioOf,
  ({ name, start }) =>
    filledFields(
      start.kind === 'loan'
        ? { name, [LOAN_FIELD]: keyOfRecordId(BANK_LOAN_RECORDS, start.loan) }
        : { name, ...loanTermsFields(start.terms), ...loanCostsFields(start.terms.costs), bank_eks: start.terms.bankEks === null ? null : rateText(start.terms.bankEks) },
    ),
)
