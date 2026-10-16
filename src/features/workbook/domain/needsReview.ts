import { UNCLASSIFIED } from './bucket'
import type { Transaction } from './workbook'

/** A row waits for a human when the AI guessed its category or no defined category covers it. */
export function needsReview(transaction: Pick<Transaction, 'flaggedBy' | 'bucket'>): boolean {
  return transaction.flaggedBy === 'ai' || transaction.bucket === UNCLASSIFIED
}
