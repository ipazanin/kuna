import type { AccountSource } from '../../../../shared/app/accountSource'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The ways an Investments account's rows come in. No broker has a bank link. */
export const INVESTMENT_ROWS_FROM = ['mail', 'by-hand'] as const satisfies readonly AccountSource[]

export type InvestmentRowsFrom = (typeof INVESTMENT_ROWS_FROM)[number]

/** How an account's rows come in: from IBKR's mailed report on and after its start day, and by hand before it, or by hand on every day, with no start day. */
export type AccountIntake = { readonly rowsFrom: 'mail'; readonly startsOn: CivilDate } | { readonly rowsFrom: 'by-hand'; readonly startsOn: null }

export const BY_HAND: AccountIntake = { rowsFrom: 'by-hand', startsOn: null }

/** An account at a broker, which holds units of instruments and cash in each currency. */
export interface InvestmentAccount {
  readonly id: RecordId
  readonly name: string
  readonly note: string
  /** Null in a file from before each account said how its rows come in, which `accountIntakes` reads from the records it holds. */
  readonly intake: AccountIntake | null
}
