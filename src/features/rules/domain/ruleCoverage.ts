import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'
import { categorise } from './categorise'
import type { Rule } from './rule'
import type { CategorisableTransaction, CategorisationContext } from './transactionFacts'

type CoverageRow = CategorisableTransaction & Pick<Transaction, 'category' | 'flaggedBy' | 'bucket'>

export interface CategoryCount {
  readonly category: string
  readonly count: number
}

/** Rows from one counterparty that a person confirmed and the rules do not file the same way. */
export interface CoverageGroup<Row> {
  /** `iban:` plus the IBAN, or `name:` plus the folded name, as counterparty filters key them, or a card merchant's folded name. An exception adds the rule's id. */
  readonly key: string
  /** The name as the newest row writes it. */
  readonly name: string
  /** Blank when the group is by name, a card merchant's included. */
  readonly iban: string
  /** Newest first. */
  readonly rows: readonly Row[]
  /** How many of the rows sit in each category, most first. */
  readonly categories: readonly CategoryCount[]
}

/** Confirmed rows that a rule settles in another category than the one the person chose. */
export interface CoverageException<Row> extends CoverageGroup<Row> {
  readonly ruleId: string
  /** The category the rule files them in. */
  readonly ruleCategory: string
}

export interface RuleCoverage<Row> {
  /** No rule settles these rows: none matches, or the first that matches sends them to review. Each may be a rule the workbook is missing. */
  readonly notCovered: readonly CoverageGroup<Row>[]
  /** A rule settles these rows, but in another category. A new rule for them would file the rule's other rows wrongly. */
  readonly exceptions: readonly CoverageException<Row>[]
}

/**
 * Human-confirmed rows in a defined category that the rules would not file the same way at rule
 * confidence, grouped by counterparty IBAN, else by name, and split by whether a rule settles them
 * in another category. A card purchase settled against the bank's own account is grouped by its
 * merchant. Exceptions are grouped by counterparty and rule. Largest groups first.
 */
export function ruleCoverage<Row extends CoverageRow>(transactions: readonly Row[], rules: readonly Rule[], context: CategorisationContext): RuleCoverage<Row> {
  type Group = { name: string; iban: string; rows: Row[] }
  const notCovered = new Map<string, Group>()
  const exceptions = new Map<string, Group & { ruleId: string; ruleCategory: string }>()
  for (const transaction of transactions) {
    if (!isHumanConfirmed(transaction) || transaction.bucket === UNCLASSIFIED) {
      continue
    }
    const verdict = categorise(transaction, rules, context)
    const settlingRule = verdict.flaggedBy === 'rule' ? verdict.ruleId : null
    if (settlingRule !== null && verdict.category === transaction.category) {
      continue
    }
    const identity = counterpartyIdentity(transaction, context.cardSettlementIbans)
    const emptyGroup: Group = { name: identity.writtenName, iban: identity.iban, rows: [] }
    if (settlingRule !== null) {
      const key = `${identity.key}|${settlingRule}`
      const group = exceptions.get(key) ?? { ...emptyGroup, ruleId: settlingRule, ruleCategory: verdict.category }
      group.rows.push(transaction)
      exceptions.set(key, group)
    } else {
      const group = notCovered.get(identity.key) ?? emptyGroup
      group.rows.push(transaction)
      notCovered.set(identity.key, group)
    }
  }
  return { notCovered: largestFirst(notCovered), exceptions: largestFirst(exceptions) }
}

function largestFirst<Group extends { name: string; rows: readonly Pick<Transaction, 'category'>[] }>(
  groups: ReadonlyMap<string, Group>,
): (Group & { key: string; categories: CategoryCount[] })[] {
  return [...groups.entries()]
    .map(([key, group]) => ({ key, ...group, categories: categoryCounts(group.rows) }))
    .sort((larger, smaller) => smaller.rows.length - larger.rows.length || larger.name.localeCompare(smaller.name))
}

function categoryCounts(rows: readonly Pick<Transaction, 'category'>[]): CategoryCount[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((more, fewer) => fewer.count - more.count || more.category.localeCompare(fewer.category))
}
