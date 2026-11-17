import type { AccountIntake, AccountSource } from '../../../../shared/app/accountSource'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The ways an Investments account's rows come in. No broker has a bank link. */
export const INVESTMENT_ROWS_FROM = ['mail', 'by-hand'] as const satisfies readonly AccountSource[]

export type InvestmentRowsFrom = (typeof INVESTMENT_ROWS_FROM)[number]

/** How an account's rows come in: from IBKR's mailed report from its start day, or by hand. */
export type InvestmentIntake = AccountIntake<'mail'>

/** An account at a broker, which holds units of instruments and cash in each currency. */
export interface InvestmentAccount {
  readonly id: RecordId
  readonly name: string
  readonly note: string
  /** Null in a file from before each account said how its rows come in, which `accountIntakes` reads from the records it holds. */
  readonly intake: InvestmentIntake | null
}
