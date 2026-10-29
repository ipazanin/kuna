import { UNCLASSIFIED } from './bucket'
import type { Transaction } from './workbook'

/** A person set the category: `flagged_by` holds neither the categoriser's `rule` nor `ai`, nor nothing. */
export function isHumanConfirmed(transaction: Pick<Transaction, 'flaggedBy'>): boolean {
  return transaction.flaggedBy !== 'rule' && transaction.flaggedBy !== 'ai' && transaction.flaggedBy !== ''
}

/**
 * A row waits for a human when the AI guessed its category, no defined category covers it, or the
 * statement parser gave a reason to look at it, such as a reversal, until a person confirms it.
 */
export function needsReview(transaction: Pick<Transaction, 'flaggedBy' | 'bucket' | 'reviewReasons'>): boolean {
  return transaction.flaggedBy === 'ai' || transaction.bucket === UNCLASSIFIED || (transaction.reviewReasons.length > 0 && !isHumanConfirmed(transaction))
}
