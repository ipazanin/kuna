import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'
import type { Transaction } from './workbook'

/**
 * What finds a ledger row again after the ingest has inserted rows above it: the bank's reference
 * on its account, or for a row without one, the booking itself.
 */
export interface LedgerRowKey {
  readonly account: string
  /** Blank on a row from a statement PDF or typed by hand. */
  readonly reference: string
  readonly date: CivilDate
  readonly amount: Money
  readonly balance: Money
  readonly description: string
}

export function ledgerRowKeyOf(transaction: Pick<Transaction, 'account' | 'reference' | 'date' | 'amount' | 'balance' | 'description'>): LedgerRowKey {
  return {
    account: transaction.account,
    reference: transaction.reference,
    date: transaction.date,
    amount: transaction.amount,
    balance: transaction.balance,
    description: transaction.description,
  }
}

/** By (account, reference), or for a blank reference by (account, date, amount, balance, description). */
export function isSameLedgerRow(wanted: LedgerRowKey, candidate: LedgerRowKey): boolean {
  if (wanted.account !== candidate.account) {
    return false
  }
  if (wanted.reference !== '') {
    return candidate.reference === wanted.reference
  }
  return (
    candidate.date === wanted.date &&
    candidate.amount === wanted.amount &&
    candidate.balance === wanted.balance &&
    candidate.description === wanted.description
  )
}
