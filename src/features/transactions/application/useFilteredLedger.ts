import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { useFilters } from '../../filters/application/filterStore'
import { transactionsInPeriod } from '../../filters/domain/filterState'
import type { FilterState } from '../../filters/domain/filterState'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { bookingOfAdvance, ledgerWindowOf } from '../../workbook/domain/workbook'
import type { Booking, OwnerAdvance, Transaction, Workbook } from '../../workbook/domain/workbook'
import { filterTransactions, scopeOwnerAdvances, scopeTransactions } from '../domain/filterTransactions'
import { presentedWorkbook } from './presentedWorkbook'

/** The workbook on screen with the shared filters applied, in the cuts the screens compute from. */
export interface FilteredLedger {
  /** The workbook on screen, its rows as the screens count them: split rows as their parts, under the settings. */
  readonly workbook: Workbook
  /** The whole ledger's window, so rolling periods end at the same month on every screen. */
  readonly window: LedgerWindow
  readonly filters: FilterState
  /** Rows every filter but the period selects. A screen applies its own periods to these. */
  readonly scoped: readonly Transaction[]
  /** Rows every filter selects, period included. */
  readonly selected: readonly Transaction[]
  /** The costs the owner paid privately that every filter but the period selects. */
  readonly scopedAdvances: readonly OwnerAdvance[]
  /** The costs the owner paid privately that every filter selects, period included. */
  readonly selectedAdvances: readonly OwnerAdvance[]
  /** The scoped rows and the scoped advances: everything profit and loss counts. */
  readonly profitAndLossRows: readonly Booking[]
  /** Every row of the accounts in view, which balances need whatever else is filtered. */
  readonly accountRows: readonly Transaction[]
}

/** Null until a workbook with at least one transaction is on screen. */
export function useFilteredLedger(): ComputedRef<FilteredLedger | null> {
  const { state } = useWorkbook()
  const { filters } = useFilters()
  const presented = computed(() => (state.workbook === null ? null : presentedWorkbook(state.workbook)))
  return computed(() => {
    const workbook = presented.value
    const window = workbook === null ? null : ledgerWindowOf(workbook.transactions)
    if (workbook === null || window === null) {
      return null
    }
    const current = filters.value as FilterState
    const accounts = current.accounts
    const scoped = scopeTransactions(workbook.transactions, current)
    const scopedAdvances = scopeOwnerAdvances(workbook.ownerAdvances, current)
    return {
      workbook,
      window,
      filters: current,
      scoped,
      selected: filterTransactions(workbook.transactions, current, window),
      scopedAdvances,
      selectedAdvances: transactionsInPeriod(scopedAdvances, current.period, window),
      profitAndLossRows: [...scoped, ...scopedAdvances.map(bookingOfAdvance)],
      accountRows:
        accounts.length === 0
          ? workbook.transactions
          : workbook.transactions.filter((transaction) => accounts.includes(transaction.account)),
    }
  })
}
