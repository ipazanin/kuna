import type { Transaction } from '../../workbook/domain/transaction'

/**
 * One row of a statement as a reader hands it to the dry run, on the account the reader found for it, with its import key
 * unique on that account across exports. A reader may file the row itself, as Revolut's does a fee, and leaves `category`
 * null otherwise.
 */
export type StatementRow = Pick<Transaction, 'account' | 'date' | 'amount' | 'payee' | 'category' | 'description' | 'counterpartyIban' | 'importKey' | 'movedAt' | 'pocket'>

/** What any bank's reader makes of a file, which is all the dry run knows of the bank. */
export interface StatementRows {
  /** The label each row of the file carries. */
  readonly label: string
  readonly rows: readonly StatementRow[]
  /** What the reader left out and why. */
  readonly notes: readonly string[]
}

/** A file a reader could read, or why it could not. */
export type StatementReading = { readonly statement: StatementRows } | { readonly refusal: string }
