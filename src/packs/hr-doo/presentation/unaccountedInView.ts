import type { FilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { ownerAdvances } from '../domain/ownerAdvances'
import type { UnaccountedReimbursement } from '../domain/ownerAdvances'

/** Payments to the owner in view that no cost the owner paid accounts for, which wait until a person adds the cost. */
export function unaccountedInView(ledger: FilteredLedger): readonly UnaccountedReimbursement[] {
  return ownerAdvances(ledger.scopedAdvances, ledger.scoped, ledger.workbook.categories).unaccounted
}
