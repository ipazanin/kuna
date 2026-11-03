import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The interest a bank charged from the drawdown up to the date the loan entered repayment, as the bank charged it. */
export interface InterimInterest {
  readonly amount: Money
  readonly date: CivilDate
}

/** A fixed amount a third party, such as APN, pays of each instalment it covers. */
export interface LoanSubsidy {
  readonly monthly: Money
  /** The number of the first instalment it covers, counting from 1. */
  readonly firstInstalment: number
  readonly instalments: number
  /** Who pays it, such as APN, or empty when the file does not say. */
  readonly payer: string
}

/** How a loan's instalments are set: the same amount every month, or the same share of principal plus a falling interest. */
export const REPAYMENTS = ['annuity', 'equal-principal'] as const

/**
 * A loan from a bank, repaid in monthly instalments on the first instalment's day of the month, which the
 * borrower owes. An annuity loan pays the same instalment every month, and an equal principal loan repays the
 * same share of principal each month with the month's interest on top.
 */
export interface BankLoan {
  readonly id: RecordId
  readonly name: string
  readonly lender: string
  readonly principal: Money
  readonly drawdown: CivilDate
  readonly firstInstalment: CivilDate
  readonly instalments: number
  readonly interimInterest: InterimInterest | null
  readonly subsidy: LoanSubsidy | null
  readonly repayment: (typeof REPAYMENTS)[number]
  readonly note: string
}

/** The terms a bank loan shares with an offer you are weighing. */
export type LoanTerms = Pick<BankLoan, 'lender' | 'principal' | 'drawdown' | 'firstInstalment' | 'instalments' | 'interimInterest' | 'subsidy' | 'repayment'>
