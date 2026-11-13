import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useFilters } from '../../filters/application/filterStore'
import { transactionsInPeriod } from '../../filters/domain/filterState'
import type { FilterState } from '../../filters/domain/filterState'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { OwnerAdvance, Transaction } from '../../workbook/domain/workbook'
import { installedPack } from '../../packs/packContribution'
import { countedLedger } from '../domain/countedLedger'
import type { CountedLedger } from '../domain/countedLedger'
import { filterTransactions } from '../domain/filterTransactions'

/** The workbook on screen with the shared filters applied, in the cuts the screens compute from. */
export interface FilteredLedger extends CountedLedger {
  readonly filters: FilterState
  /** Rows every filter selects, period included. */
  readonly selected: readonly Transaction[]
  /** The costs the owner paid privately that every filter selects, period included. */
  readonly selectedAdvances: readonly OwnerAdvance[]
  /** Every row of the accounts in view, which balances need whatever else is filtered. */
  readonly accountRows: readonly Transaction[]
}

/** Null until a workbook with at least one transaction is on screen. */
export function useFilteredLedger(): ComputedRef<FilteredLedger | null> {
  const { state } = useWorkbook()
  const { filters } = useFilters()
  return computed(() => {
    const current = filters.value as FilterState
    const counted = state.workbook === null ? null : countedLedger(state.workbook, current, installedPack().vatOnPrivateShare)
    if (counted === null) {
      return null
    }
    const { workbook, window } = counted
    const accounts = current.accounts
    return {
      ...counted,
      filters: current,
      selected: filterTransactions(workbook.transactions, current, window),
      selectedAdvances: transactionsInPeriod(counted.scopedAdvances, current.period, window),
      accountRows: accounts.length === 0 ? workbook.transactions : workbook.transactions.filter((transaction) => accounts.includes(transaction.account)),
    }
  })
}
