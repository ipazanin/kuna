import { holdingRules } from './spendingCategorisation'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { SpendingRule } from '../../workbook/domain/spendingRule'

/** Rows of the book that two rules filing into different categories both fit, where the one tried first decides. */
export interface RuleOverlap {
  readonly first: SpendingRule
  readonly then: SpendingRule
  readonly rows: number
}

/**
 * The bank's rows each pair of rules files into different categories, counted on the rows themselves: for each row, the first
 * rule that holds and files decides, and every later one that holds and files into another category before a Stop here is an
 * overlap. Most rows first.
 */
export function ruleOverlaps(book: Pick<SpendingBook, 'rules' | 'accounts' | 'categories' | 'transactions'>): readonly RuleOverlap[] {
  const holdingOf = holdingRules(
    book.rules.filter((rule) => rule.category !== null || rule.stop),
    book,
  )
  const counted = new Map<string, { first: SpendingRule; then: SpendingRule; rows: number }>()
  for (const row of book.transactions) {
    if (row.source !== 'statement') continue
    const [first, ...later] = holdingOf(row).filter((rule) => rule.category !== null)
    if (first === undefined) continue
    for (const then of later) {
      if (then.category === first.category) continue
      const key = `${first.id} ${then.id}`
      const held = counted.get(key)
      if (held === undefined) counted.set(key, { first, then, rows: 1 })
      else held.rows += 1
    }
  }
  return [...counted.values()].sort((one, other) => other.rows - one.rows)
}
