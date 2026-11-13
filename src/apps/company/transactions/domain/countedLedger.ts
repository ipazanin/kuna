import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import type { FilterState } from '../../filters/domain/filterState'
import { withOwnerParts } from '../../owner-share/domain/ownerParts'
import type { VatOnPrivateShare } from '../../owner-share/domain/ownerParts'
import { bookingOfAdvance, ledgerWindowOf } from '../../workbook/domain/workbook'
import type { Booking, OwnerAdvance, Transaction, Workbook } from '../../workbook/domain/workbook'
import { scopeOwnerAdvances, scopeTransactions } from './filterTransactions'
import { presentedWorkbook } from './presentedWorkbook'

/** The books as the screens count them under a set of filters, the period left to each screen. */
export interface CountedLedger {
  /**
   * The workbook as the cash screens count it: split rows as their parts, under the settings, and
   * each shared row and advance as its business part and the owner's part.
   */
  readonly workbook: Workbook
  /** The same workbook as booked, without the owner parts, which Year, the taxes and who owes whom read. */
  readonly booked: Workbook
  /** The whole ledger's window, so rolling periods end at the same month on every screen. */
  readonly window: LedgerWindow
  /** Rows every filter but the period selects. A screen applies its own periods to these. */
  readonly scoped: readonly Transaction[]
  /** The costs the owner paid privately that every filter but the period selects. */
  readonly scopedAdvances: readonly OwnerAdvance[]
  /** The scoped rows and the scoped advances: everything profit and loss counts. */
  readonly profitAndLossRows: readonly Booking[]
}

/** Null for books with no transaction. The pack's slot gives the VAT an owner's part carries beyond its row. */
export function countedLedger(workbook: Workbook, filters: FilterState, vatOnPrivateShare: VatOnPrivateShare): CountedLedger | null {
  const booked = presentedWorkbook(workbook)
  const cash = withOwnerParts(booked, vatOnPrivateShare)
  const window = ledgerWindowOf(cash.transactions)
  if (window === null) {
    return null
  }
  const scoped = scopeTransactions(cash.transactions, filters)
  const scopedAdvances = scopeOwnerAdvances(cash.ownerAdvances, filters)
  return { workbook: cash, booked, window, scoped, scopedAdvances, profitAndLossRows: [...scoped, ...scopedAdvances.map(bookingOfAdvance)] }
}
