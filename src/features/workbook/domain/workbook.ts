import type { CivilDate } from '../../../shared/calendar/civilDate'
import { anchorWindow } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import type { Money } from '../../../shared/money/money'
import type { Settings } from '../../settings/domain/settings'
import type { Bucket, DefinedBucket } from './bucket'

export interface Category {
  readonly slug: string
  readonly family: string
  readonly bucket: DefinedBucket
  readonly colour: string
  /** What code may select the category for, such as `revenue` or `watched`. Lower case. */
  readonly roles: readonly string[]
}

export interface Account {
  readonly slug: string
  readonly iban: string
  /** Blank when the tab does not say, which means the workbook's currency. */
  readonly currency: string
}

/** Where the workbook lives: a Google Sheet, or this browser with xlsx files as its copies. */
export type WorkbookSource = 'google' | 'excel'

/** One booked bank entry from the `ledger` tab. Credits are positive. */
export interface Transaction {
  readonly account: string
  readonly date: CivilDate
  /**
   * Booking order across the whole ledger, oldest first. It comes from the tab's own order, which
   * is newest first with the last booking of a day on top, so the highest sequence on an account's
   * latest date is its closing balance.
   */
  readonly sequence: number
  readonly statement: string
  readonly counterparty: string
  readonly counterpartyIban: string
  readonly description: string
  readonly amount: Money
  /** The account's running balance after this entry. */
  readonly balance: Money
  /** Empty when the cell is blank. */
  readonly category: string
  readonly family: string
  readonly bucket: Bucket
  readonly flaggedBy: string
  readonly reference: string
  /** The 1-based row on the tab when it was read. */
  readonly sheetRow: number
}

/** A row the reader could not turn into a fact, kept so the screen can say what was left out. */
export interface WorkbookProblem {
  readonly tab: 'ledger' | 'categories' | 'accounts' | 'settings'
  readonly sheetRow: number
  readonly reason: string
}

export interface Workbook {
  /** The Google spreadsheet id, or the id of the workbook kept in this browser. */
  readonly id: string
  readonly source: WorkbookSource
  readonly title: string
  /** The `ledger` tab's numeric id, for links to its rows. Null for a copy cached without it. */
  readonly ledgerSheetId: number | null
  /** ISO timestamp of the read this copy came from, or of the last change kept in this browser. */
  readonly syncedAt: string
  /** Newest first, as the tab holds them. */
  readonly transactions: readonly Transaction[]
  readonly categories: readonly Category[]
  readonly accounts: readonly Account[]
  readonly settings: Settings
  readonly problems: readonly WorkbookProblem[]
}

/** The complete-month window of the whole ledger, or null when it holds no transaction. */
export function ledgerWindowOf(transactions: readonly Transaction[]): LedgerWindow | null {
  if (transactions.length === 0) {
    return null
  }
  let earliest = transactions[0].date
  let newest = earliest
  for (const transaction of transactions) {
    if (transaction.date < earliest) {
      earliest = transaction.date
    }
    if (transaction.date > newest) {
      newest = transaction.date
    }
  }
  return anchorWindow(earliest, newest)
}
