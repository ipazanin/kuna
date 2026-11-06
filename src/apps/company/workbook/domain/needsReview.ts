import { UNCLASSIFIED } from './bucket'
import type { Transaction } from './workbook'

/** A person set the category: `flagged_by` holds neither the categoriser's `rule` nor `ai`, nor nothing. */
export function isHumanConfirmed(transaction: Pick<Transaction, 'flaggedBy'>): boolean {
  return transaction.flaggedBy !== 'rule' && transaction.flaggedBy !== 'ai' && transaction.flaggedBy !== ''
}

/** No rule settled the row: the AI guessed its category, or no defined category covers it. A new rule can file such a row. */
export function ruleCouldFile(transaction: Pick<Transaction, 'flaggedBy' | 'bucket'>): boolean {
  return transaction.flaggedBy === 'ai' || transaction.bucket === UNCLASSIFIED
}

/**
 * A row waits for a human when the AI guessed its category, no defined category covers it, or the
 * statement parser gave a reason to look at it, such as a reversal, until a person confirms it.
 */
export function needsReview(transaction: Pick<Transaction, 'flaggedBy' | 'bucket' | 'reviewReasons'>): boolean {
  return ruleCouldFile(transaction) || (transaction.reviewReasons.length > 0 && !isHumanConfirmed(transaction))
}

/** How many rows wait for review, which the menu beside Transactions and the company's card on the home both show. */
export function reviewCount(transactions: readonly Pick<Transaction, 'flaggedBy' | 'bucket' | 'reviewReasons'>[]): number {
  return transactions.filter(needsReview).length
}
