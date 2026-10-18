import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'
import { categorise } from './categorise'
import type { Verdict } from './categorise'
import type { Rule } from './rule'
import type { CategorisableTransaction, CategorisationContext } from './transactionFacts'

export type BacktestTransaction = CategorisableTransaction & Pick<Transaction, 'category' | 'flaggedBy' | 'bucket'>

/** One row whose verdict the change alters. */
export interface VerdictChange<Row> {
  readonly transaction: Row
  readonly before: Verdict
  readonly after: Verdict
}

export interface RuleBacktest<Row> {
  /** Rows waiting on review, as `ai` or unclassified, that the change files at rule confidence. */
  readonly settled: readonly VerdictChange<Row>[]
  /** Rows a rule filed whose verdict the change alters. */
  readonly brokenAgreements: readonly VerdictChange<Row>[]
  /** Rows a person confirmed that the change would file as something else. */
  readonly humanConflicts: readonly VerdictChange<Row>[]
}

/**
 * Every row's verdict under the rules as they are and as they would be, for a rule added, edited,
 * switched off or moved. Only rows whose verdict differs are listed.
 */
export function backtestRuleChange<Row extends BacktestTransaction>(
  current: readonly Rule[],
  proposed: readonly Rule[],
  transactions: readonly Row[],
  context: CategorisationContext,
): RuleBacktest<Row> {
  const settled: VerdictChange<Row>[] = []
  const brokenAgreements: VerdictChange<Row>[] = []
  const humanConflicts: VerdictChange<Row>[] = []
  for (const transaction of transactions) {
    const before = categorise(transaction, current, context)
    const after = categorise(transaction, proposed, context)
    if (before.category === after.category && before.flaggedBy === after.flaggedBy) {
      continue
    }
    const change = { transaction, before, after }
    if (isHumanConfirmed(transaction)) {
      if (after.category !== transaction.category) {
        humanConflicts.push(change)
      }
    } else if (transaction.flaggedBy === 'rule' && transaction.bucket !== UNCLASSIFIED) {
      brokenAgreements.push(change)
    } else if (after.flaggedBy === 'rule') {
      settled.push(change)
    }
  }
  return { settled, brokenAgreements, humanConflicts }
}
