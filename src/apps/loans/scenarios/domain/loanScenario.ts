import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import type { LoanTerms } from '../../workbook/domain/bankLoan'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What a loan charges beside its instalments, paid on its own dates. */
export interface LoanCosts {
  readonly upfront: Money
  readonly monthly: Money
  readonly yearly: Money
}

export const NO_COSTS: LoanCosts = { upfront: ZERO, monthly: ZERO, yearly: ZERO }

/** A loan you are weighing but do not have, with the bank loan's terms and what it costs beside them. */
export interface OfferTerms extends LoanTerms {
  readonly costs: LoanCosts
  /** The effective rate the bank printed, or null when none was typed in. */
  readonly bankEks: YearlyRate | null
}

/** A scenario starts from a bank loan in the file, or from an offer's own terms. */
export type ScenarioStart = { readonly kind: 'loan'; readonly loan: RecordId } | { readonly kind: 'offer'; readonly terms: OfferTerms }

export interface LoanScenario {
  readonly id: RecordId
  readonly name: string
  readonly start: ScenarioStart
}

export const SCENARIO_CHANGE_KINDS = ['extra-payment', 'regular-extra-payment', 'rate-change', 'move'] as const

export const REPEATS = ['month', 'year'] as const

/** One change a scenario makes to the loan it starts from. */
export type LoanChange =
  | { readonly kind: 'extra-payment'; readonly date: CivilDate; readonly amount: Money; readonly effect: ExtraPayment['effect'] }
  | {
      readonly kind: 'regular-extra-payment'
      /** The due date of the first payment. */
      readonly from: CivilDate
      readonly every: (typeof REPEATS)[number]
      /** The last day a payment may fall on, or null to pay to the end. */
      readonly until: CivilDate | null
      readonly amount: Money
      readonly effect: ExtraPayment['effect']
    }
  | { readonly kind: 'rate-change'; readonly from: CivilDate; readonly rate: YearlyRate; readonly rateType: RatePeriod['rateType'] }
  | {
      readonly kind: 'move'
      /** The due date after whose instalment the new bank repays the old loan. */
      readonly on: CivilDate
      readonly lender: string
      readonly rate: YearlyRate
      readonly rateType: RatePeriod['rateType']
      readonly instalments: number
      readonly costs: LoanCosts
    }

/** A change as the Loans file keeps it, naming its scenario. */
export type ScenarioChange = LoanChange & { readonly id: RecordId; readonly scenario: RecordId }

/** The day a change takes effect on. */
export function changeDate(change: LoanChange): CivilDate {
  switch (change.kind) {
    case 'extra-payment':
      return change.date
    case 'regular-extra-payment':
    case 'rate-change':
      return change.from
    case 'move':
      return change.on
  }
}
