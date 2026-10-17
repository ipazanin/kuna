import { UNCLASSIFIED } from './bucket'
import type { Transaction } from './workbook'

/**
 * A row waits for a human when the AI guessed its category, no defined category covers it, or the
 * statement parser gave a reason to look at it, such as a reversal, even when a rule settled it.
 */
export function needsReview(transaction: Pick<Transaction, 'flaggedBy' | 'bucket' | 'reviewReasons'>): boolean {
  return transaction.flaggedBy === 'ai' || transaction.bucket === UNCLASSIFIED || transaction.reviewReasons.length > 0
}
