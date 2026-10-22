import { backtestRuleChange } from './backtestRule'
import type { BacktestTransaction, RuleBacktest } from './backtestRule'
import { readRules } from './readRules'
import type { RuleTabRow } from './readRules'
import { RULE_COLUMNS, newOrderTies } from './rule'
import type { Rule } from './rule'
import { rulesTabAfter } from './rulesTabChange'
import type { RulesTabChange } from './rulesTabChange'
import { rulesTabRefusals } from './rulesTabRefusals'
import type { CategorisationContext } from './transactionFacts'

export interface RulesChangePreview<Row> {
  /** Why the save would be refused, the whole tab's problems included. Empty when it can be saved. */
  readonly refusals: readonly string[]
  readonly backtest: RuleBacktest<Row>
}

/**
 * What a change to the rules tab would do, worked out on the copy on screen before anything is
 * written: the same checks the save makes, and every row whose verdict moves. The save repeats the
 * checks on a fresh read, where the Sheet's own header row counts too.
 */
export function previewRulesChange<Row extends BacktestTransaction>(
  rows: readonly RuleTabRow[],
  change: RulesTabChange,
  definedCategories: ReadonlySet<string>,
  hasClientsTab: boolean,
  current: readonly Rule[],
  transactions: readonly Row[],
  context: CategorisationContext,
): RulesChangePreview<Row> {
  const after = rulesTabAfter(rows, change)
  const header = [...new Set([...RULE_COLUMNS, ...after.rows.flatMap((row) => Object.keys(row.cells))])]
  const proposed = readRules(after.rows, definedCategories, hasClientsTab).rules
  const refusals = [
    ...after.refusals,
    ...rulesTabRefusals(header, after.rows, definedCategories, hasClientsTab),
    ...newOrderTies(current, proposed),
  ]
  return { refusals, backtest: backtestRuleChange(current, proposed, transactions, context) }
}
