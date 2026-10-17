import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Transaction } from '../../workbook/domain/workbook'
import { categorise } from './categorise'
import type { Verdict } from './categorise'
import type { Rule } from './rule'
import type { CategorisableTransaction, CategorisationContext } from './transactionFacts'

export type BacktestTransaction = CategorisableTransaction & Pick<Transaction, 'category' | 'flaggedBy' | 'bucket'>

/** One row whose verdict the candidate changes. */
export interface VerdictChange<Row> {
  readonly transaction: Row
  readonly before: Verdict
  readonly after: Verdict
}

export interface RuleBacktest<Row> {
  /** Rows waiting on review, as `ai` or unclassified, that the candidate files at rule confidence. */
  readonly settled: readonly VerdictChange<Row>[]
  /** Rows a rule filed whose verdict the candidate changes. */
  readonly brokenAgreements: readonly VerdictChange<Row>[]
  /** Rows a person confirmed that the candidate would file as something else. */
  readonly humanConflicts: readonly VerdictChange<Row>[]
}

/** A person set the category: `flagged_by` holds neither the categoriser's `rule` nor `ai`, nor nothing. */
export function isHumanConfirmed(transaction: Pick<Transaction, 'flaggedBy'>): boolean {
  return transaction.flaggedBy !== 'rule' && transaction.flaggedBy !== 'ai' && transaction.flaggedBy !== ''
}

/** Every row's verdict with and without the candidate placed among the rules at its order. */
export function backtestRule<Row extends BacktestTransaction>(
  candidate: Rule,
  rules: readonly Rule[],
  transactions: readonly Row[],
  context: CategorisationContext,
): RuleBacktest<Row> {
  const withCandidate = [...rules, candidate]
  const settled: VerdictChange<Row>[] = []
  const brokenAgreements: VerdictChange<Row>[] = []
  const humanConflicts: VerdictChange<Row>[] = []
  for (const transaction of transactions) {
    const before = categorise(transaction, rules, context)
    const after = categorise(transaction, withCandidate, context)
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
