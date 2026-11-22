import { givenDays, handedDays, inHandedDays, takesRowOn } from '../../../../shared/app/accountSource'
import type { GivenDays, HandedDays } from '../../../../shared/app/accountSource'
import { ledgerRowOrigin } from '../../workbook/domain/accountSources'
import type { Account, CompanyPeriod, CompanySource, Transaction } from '../../workbook/domain/workbook'

/**
 * What giving an account's days to another source does: the rows on those days the new source does not take go, with their
 * items, and the new source brings its own. A row whose items pay an invoice leaves that invoice unpaid until the new row pays it.
 */
export interface SourceHandover {
  readonly account: string
  /** The days that change from one source to another. */
  readonly runs: readonly HandedDays<CompanySource>[]
  /** The days before the old first period that a source now fills. */
  readonly given: readonly GivenDays<CompanySource>[]
  /** The rows that go, oldest first. */
  readonly rows: readonly Transaction[]
}

/** What giving the account the periods does, or null when no day changes source. Each row's origin is read by the periods it came in under. */
export function sourceHandover(account: Pick<Account, 'slug' | 'sources'>, sources: readonly CompanyPeriod[], ledger: readonly Transaction[]): SourceHandover | null {
  const runs = handedDays(account.sources, sources)
  const given = givenDays(account.sources, sources)
  if (runs.length + given.length === 0) return null
  const days = [...runs, ...given]
  const rows = ledger
    .filter((row) => row.account === account.slug && inHandedDays(days, row.date) && !takesRowOn(sources, row.date, ledgerRowOrigin(row, account.sources)))
    .sort((earlier, later) => earlier.sequence - later.sequence)
  return { account: account.slug, runs, given, rows }
}
