import type { FilteredLedger } from '../../../transactions/application/useFilteredLedger'
import { scopeTransactions } from '../../../transactions/domain/filterTransactions'
import { ownerAdvances } from '../domain/ownerAdvances'
import type { UnaccountedReimbursement } from '../domain/ownerAdvances'

/**
 * Payments to the owner in view that no cost the owner paid accounts for, which wait until a person
 * adds the cost. Payments match every cost on file, so a filter changes which are shown, never which match.
 */
export function unaccountedInView(ledger: FilteredLedger): readonly UnaccountedReimbursement[] {
  const { booked, filters } = ledger
  const inView = new Set(scopeTransactions(booked.transactions, filters))
  return ownerAdvances(booked.ownerAdvances, booked.transactions, booked.categories).unaccounted.filter((line) => inView.has(line.payment))
}
