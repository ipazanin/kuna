import { categorise } from '../../rules/domain/categorise'
import type { Rule } from '../../rules/domain/rule'
import type { CategorisableTransaction, CategorisationContext } from '../../rules/domain/transactionFacts'
import type { Settings } from '../../settings/domain/settings'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { ledgerRowKeyOf } from '../../workbook/domain/ledgerRowKey'
import type { LedgerRowKey } from '../../workbook/domain/ledgerRowKey'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'

/** A ledger row's `category` and `flagged_by` cells, the only two the app writes there. */
export interface LedgerVerdict {
  readonly category: string
  readonly flaggedBy: string
}

/** One ledger row's verdict changed. */
export interface LedgerVerdictChange {
  readonly key: LedgerRowKey
  /** What the row holds now as the app read it. The write is refused when the workbook holds something else. */
  readonly from: LedgerVerdict
  readonly to: LedgerVerdict
  /**
   * True when it puts back what an earlier change replaced, which may be a category the categories
   * tab does not define. Any other change must name a defined category.
   */
  readonly undoes: boolean
}

/** What a write replaced, so Undo can put it back. `from` holds the cells as they were, exactly. */
export interface VerdictReceipt {
  readonly changes: readonly LedgerVerdictChange[]
}

type ReviewedRow = Pick<Transaction, 'account' | 'reference' | 'date' | 'amount' | 'balance' | 'description' | 'category' | 'flaggedBy' | 'bucket'>

function verdictOf(transaction: Pick<Transaction, 'category' | 'flaggedBy'>): LedgerVerdict {
  return { category: transaction.category, flaggedBy: transaction.flaggedBy }
}

/** A person agrees with the category the row has: it stays, and `flagged_by` takes their review label. Null for a row whose category is not defined. */
export function confirmation(transaction: ReviewedRow, settings: Pick<Settings, 'reviewLabel'>): LedgerVerdictChange | null {
  if (transaction.bucket === UNCLASSIFIED) {
    return null
  }
  return {
    key: ledgerRowKeyOf(transaction),
    from: verdictOf(transaction),
    to: { category: transaction.category, flaggedBy: settings.reviewLabel },
    undoes: false,
  }
}

/** A person files the row in another category, which `flagged_by` records with their review label. */
export function recategorisation(transaction: ReviewedRow, category: string, settings: Pick<Settings, 'reviewLabel'>): LedgerVerdictChange {
  return {
    key: ledgerRowKeyOf(transaction),
    from: verdictOf(transaction),
    to: { category, flaggedBy: settings.reviewLabel },
    undoes: false,
  }
}

/** Puts back what the receipt's write replaced, refused if anything changed the rows since. */
export function undoOf(receipt: VerdictReceipt): LedgerVerdictChange[] {
  return receipt.changes.map((change) => ({ key: change.key, from: change.to, to: change.from, undoes: true }))
}

/**
 * The rows a new rule settles that still wait on review: flagged `ai` or unclassified, never a row
 * a person confirmed. Each takes the rule's category and `rule`, as the morning ingest would have
 * written had the rule existed.
 */
export function waitingRowsSettledBy(
  ruleId: string,
  transactions: readonly (ReviewedRow & CategorisableTransaction)[],
  rules: readonly Rule[],
  context: CategorisationContext,
): LedgerVerdictChange[] {
  const changes: LedgerVerdictChange[] = []
  for (const transaction of transactions) {
    if (isHumanConfirmed(transaction) || (transaction.flaggedBy !== 'ai' && transaction.bucket !== UNCLASSIFIED)) {
      continue
    }
    const verdict = categorise(transaction, rules, context)
    if (verdict.ruleId?.toLowerCase() !== ruleId.toLowerCase() || verdict.flaggedBy !== 'rule') {
      continue
    }
    changes.push({ key: ledgerRowKeyOf(transaction), from: verdictOf(transaction), to: { category: verdict.category, flaggedBy: 'rule' }, undoes: false })
  }
  return changes
}
