import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Typed by you, brought by a bank statement, or made from a receipt that no payment matched yet. */
export const TRANSACTION_SOURCES = ['typed', 'statement', 'receipt'] as const

export type TransactionSource = (typeof TRANSACTION_SOURCES)[number]

/** Money in or out of one of your accounts, in the account's currency. */
export interface Transaction {
  readonly id: RecordId
  readonly account: RecordId
  readonly date: CivilDate
  /** Credits above zero, debits below, never zero. */
  readonly amount: Money
  /** Who was paid, or who paid you. */
  readonly payee: string
  /** Null while the row waits on review, when it counts nowhere. */
  readonly category: RecordId | null
  readonly note: string
  readonly source: TransactionSource
  /** The other leg of a transfer between your accounts, on another account, which names this row back. */
  readonly pair: RecordId | null
}
