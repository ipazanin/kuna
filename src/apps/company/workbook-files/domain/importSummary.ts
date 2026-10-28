import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { Workbook, WorkbookProblem } from '../../workbook/domain/workbook'

export type WorkbookTabName = WorkbookProblem['tab']

/** What an import would bring in, shown before anything is replaced. */
export interface ImportSummary {
  readonly transactionCount: number
  /** Accounts named in the accounts tab or on a ledger row, sorted. */
  readonly accounts: readonly string[]
  /** Null for a ledger with no readable row, such as a blank template. */
  readonly dateRange: DateRange | null
  readonly categoryCount: number
  readonly problems: readonly WorkbookProblem[]
  /** Optional tabs the file lacks, whose defaults apply. */
  readonly defaultedTabs: readonly WorkbookTabName[]
  /** Why the file cannot be imported at all, or null. */
  readonly refusal: string | null
}

export function importSummary(workbook: Workbook, missingTabs: readonly WorkbookTabName[]): ImportSummary {
  const dates = workbook.transactions.map((transaction) => transaction.date).sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  return {
    transactionCount: workbook.transactions.length,
    accounts: [...new Set([...workbook.accounts.map((account) => account.slug), ...workbook.transactions.map((transaction) => transaction.account)])].sort(),
    dateRange: first === undefined || last === undefined ? null : { from: first, to: last },
    categoryCount: workbook.categories.length,
    problems: workbook.problems,
    defaultedTabs: missingTabs.filter((tab) => tab !== 'ledger'),
    refusal: missingTabs.includes('ledger') ? 'The file has no tab called "ledger", so it is not a Ledgerboard workbook.' : null,
  }
}
