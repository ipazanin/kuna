import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

export const LOAN_DIRECTIONS = ['you-owe', 'owed-to-you'] as const

/** Which way a loan runs. A bank loan is always one you owe. */
export type LoanDirection = (typeof LOAN_DIRECTIONS)[number]

/**
 * What the borrower means to repay, for information only: a fixed amount on a day of each month, the first
 * time after the day the plan starts. Repayments count towards it from that day. It never writes a movement.
 */
export interface ExpectedPlan {
  readonly monthly: Money
  readonly from: CivilDate
  /** From 1 to 31, the last day of a shorter month. */
  readonly day: number
}

/** Money owed between people, with no interest: an opening balance, the movements after it and an optional expected plan. */
export interface InformalLoan {
  readonly id: RecordId
  readonly name: string
  readonly counterparty: string
  readonly direction: LoanDirection
  readonly openingBalance: Money
  readonly start: CivilDate
  readonly note: string
  readonly expected: ExpectedPlan | null
}
