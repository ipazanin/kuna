import { instalmentsOf } from './bankLoanReading'
import { EXTRA_PAYMENT_EFFECTS } from './extraPayment'
import type { ExtraPayment } from './extraPayment'
import { LOAN_SCENARIO_RECORDS, SCENARIO_CHANGE_RECORDS } from './loanKinds'
import { loanCostsFields, loanCostsOf } from './loanScenarioReading'
import { SCENARIO_FIELD, namedScenarioId } from './loanReference'
import { RATE_TYPES } from './ratePeriod'
import type { RatePeriod } from './ratePeriod'
import { requiredRate } from './ratePeriodReading'
import { rateText } from '../../bankLoans/domain/yearlyRate'
import { REPEATS, SCENARIO_CHANGE_KINDS, changeDate } from '../../scenarios/domain/loanScenario'
import type { LoanChange, ScenarioChange } from '../../scenarios/domain/loanScenario'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { FieldValue } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalDate, ownId, positiveMoney, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import { words } from './words'

function loanChangeOf(fields: StoredFields): LoanChange {
  const kind = requiredChoice(fields, 'change', SCENARIO_CHANGE_KINDS, 'scenario change')
  const date = requiredDate(fields, 'date')
  const effect = (): ExtraPayment['effect'] => requiredChoice(fields, 'effect', EXTRA_PAYMENT_EFFECTS, 'payment effect')
  const rateType = (): RatePeriod['rateType'] => requiredChoice(fields, 'rate_type', RATE_TYPES, 'rate type')
  switch (kind) {
    case 'extra-payment':
      return { kind, date, amount: positiveMoney(fields, 'amount'), effect: effect() }
    case 'regular-extra-payment': {
      const until = optionalDate(fields, 'until')
      if (until !== null && until < date) refuse(storedWords.reasons.before('until', until, 'date', date))
      return { kind, from: date, every: requiredChoice(fields, 'every', REPEATS, 'repeat'), until, amount: positiveMoney(fields, 'amount'), effect: effect() }
    }
    case 'rate-change':
      return { kind, from: date, rate: requiredRate(fields, 'rate'), rateType: rateType() }
    case 'move':
      return { kind, on: date, lender: textOf(fields.lender), rate: requiredRate(fields, 'rate'), rateType: rateType(), instalments: instalmentsOf(fields, 'instalments'), costs: loanCostsOf(fields) }
  }
}

/** A change of the scenario its `scenario` names, its kind in `change` and the day it takes effect in `date`. */
export function scenarioChangeOf(fields: StoredFields, id: RecordId | null): ScenarioChange {
  const scenario = namedScenarioId(fields)
  return { ...loanChangeOf(fields), id: ownId(id), scenario }
}

/** The fields of a change beside its scenario, kind and day. */
function changeFields(change: LoanChange): Readonly<Record<string, FieldValue | null>> {
  switch (change.kind) {
    case 'extra-payment':
      return { amount: amountText(change.amount), effect: change.effect }
    case 'regular-extra-payment':
      return { every: change.every, until: change.until, amount: amountText(change.amount), effect: change.effect }
    case 'rate-change':
      return { rate: rateText(change.rate), rate_type: change.rateType }
    case 'move':
      return { lender: change.lender, rate: rateText(change.rate), rate_type: change.rateType, instalments: String(change.instalments), ...loanCostsFields(change.costs) }
  }
}

export const SCENARIO_CHANGE_CODEC: RecordCodec<ScenarioChange> = withIdField(SCENARIO_CHANGE_RECORDS, words.labels.scenarioChange, scenarioChangeOf, (change) =>
  filledFields({
    [SCENARIO_FIELD]: keyOfRecordId(LOAN_SCENARIO_RECORDS, change.scenario),
    change: change.kind,
    date: changeDate(change),
    ...changeFields(change),
  }),
)
