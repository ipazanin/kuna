import type { PeriodSource, SourcePeriod } from '../../../../shared/app/accountSource'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Where an Investments account's rows come from: IBKR's mailed report, a report the person uploads, or by hand. No broker has a bank link. */
export const INVESTMENT_SOURCES = ['mail', 'provider-file', 'by-hand'] as const satisfies readonly PeriodSource[]

export type InvestmentSource = (typeof INVESTMENT_SOURCES)[number]

export type InvestmentPeriod = SourcePeriod<InvestmentSource>

/** One period by hand from the account's start, as an account that names no other source has. */
export const BY_HAND_SOURCES: readonly InvestmentPeriod[] = [{ source: 'by-hand', from: null }]

/** An account at a broker, which holds units of instruments and cash in each currency. */
export interface InvestmentAccount {
  readonly id: RecordId
  readonly name: string
  readonly note: string
  /**
   * Where its rows come from, from each period's day until the next period's. The first may start on a day, and the account then
   * takes no row before it. Null in a file from before each account said it, which `accountSources` reads from the records it holds.
   */
  readonly sources: readonly InvestmentPeriod[] | null
}
