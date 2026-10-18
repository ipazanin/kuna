import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'
import { categorise } from './categorise'
import type { Rule } from './rule'
import type { CategorisableTransaction, CategorisationContext } from './transactionFacts'

type CoverageRow = CategorisableTransaction & Pick<Transaction, 'category' | 'flaggedBy' | 'bucket'>

/** Rows from one counterparty that a person confirmed and no rule reproduces. */
export interface CoverageGap<Row> {
  /** `iban:` plus the IBAN, or `name:` plus the folded name, as counterparty filters key them. */
  readonly key: string
  /** The name as the newest row writes it. */
  readonly name: string
  /** Blank when the group is by name. */
  readonly iban: string
  /** Newest first. */
  readonly rows: readonly Row[]
  /** How many of the rows sit in each category, most first. */
  readonly categories: readonly { readonly category: string; readonly count: number }[]
}

/**
 * Human-confirmed rows in a defined category that the rules would not file the same way at rule
 * confidence, grouped by counterparty IBAN, else by name. Largest groups first. Each is a rule the
 * workbook is missing, or a row that rules cannot decide.
 */
export function ruleCoverageGaps<Row extends CoverageRow>(
  transactions: readonly Row[],
  rules: readonly Rule[],
  context: CategorisationContext,
): CoverageGap<Row>[] {
  const groups = new Map<string, { name: string; iban: string; rows: Row[] }>()
  for (const transaction of transactions) {
    if (!isHumanConfirmed(transaction) || transaction.bucket === UNCLASSIFIED) {
      continue
    }
    const verdict = categorise(transaction, rules, context)
    if (verdict.flaggedBy === 'rule' && verdict.category === transaction.category) {
      continue
    }
    const identity = counterpartyIdentity(transaction)
    const group = groups.get(identity.key) ?? { name: identity.writtenName, iban: transaction.counterpartyIban, rows: [] }
    group.rows.push(transaction)
    groups.set(identity.key, group)
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, ...group, categories: categoryCounts(group.rows) }))
    .sort((larger, smaller) => smaller.rows.length - larger.rows.length || larger.name.localeCompare(smaller.name))
}

function categoryCounts(rows: readonly Pick<Transaction, 'category'>[]): { category: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((more, fewer) => fewer.count - more.count || more.category.localeCompare(fewer.category))
}
