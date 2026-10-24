import type { FilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { scopeOwnerAdvances, scopeTransactions } from '../../../features/transactions/domain/filterTransactions'
import { ownerAdvances } from '../domain/ownerAdvances'
import type { UnaccountedReimbursement } from '../domain/ownerAdvances'

/**
 * Payments to the owner in view that no cost the owner paid accounts for, which wait until a person
 * adds the cost. A payment repays advances as booked, never their owner parts.
 */
export function unaccountedInView(ledger: FilteredLedger): readonly UnaccountedReimbursement[] {
  const { booked, filters } = ledger
  return ownerAdvances(scopeOwnerAdvances(booked.ownerAdvances, filters), scopeTransactions(booked.transactions, filters), booked.categories).unaccounted
}
