import { cellText } from '../../../../shared/text/cellText'
import { RULE_RECORDS } from '../../workbook/domain/coreKinds'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { backtestRuleChange } from './backtestRule'
import type { BacktestTransaction, RuleBacktest } from './backtestRule'
import { readRules } from './readRules'
import type { RuleTabRow } from './readRules'
import type { Rule } from './rule'
import { rulesTabAfter } from './rulesTabChange'
import type { RulesTabChange } from './rulesTabChange'
import type { CategorisationContext } from './transactionFacts'

export interface RulesChangePreview<Row> {
  /** Why the save would be refused. Empty when it can be saved. */
  readonly refusals: readonly string[]
  readonly backtest: RuleBacktest<Row>
}

/**
 * What a change to the rules tab would do, worked out on the copy on screen before anything is
 * written: the rows it changes must still hold what the app read, every rule it writes must read,
 * and every row whose verdict moves is listed. The save repeats the checks on a fresh read.
 */
export function previewRulesChange<Row extends BacktestTransaction>(
  rows: readonly RuleTabRow[],
  change: RulesTabChange,
  definedCategories: ReadonlySet<string>,
  current: readonly Rule[],
  transactions: readonly Row[],
  context: CategorisationContext,
): RulesChangePreview<Row> {
  const after = rulesTabAfter(rows, change)
  const { rules: proposed, problems } = readRules(after.rows, definedCategories)
  const written = new Set(
    [change.appended, ...change.edited.map((edit) => edit.fields)].flatMap((fields) => {
      if (fields === null) return []
      const id = cellText(fields.rule).toLowerCase()
      return [id === '' ? null : recordIdOf(RULE_RECORDS, id)]
    }),
  )
  const refusals = [...after.refusals, ...problems.filter((problem) => written.has(problem.id)).map((problem) => `${problem.label}: ${problem.reason}`)]
  return { refusals: [...new Set(refusals)], backtest: backtestRuleChange(current, proposed, transactions, context) }
}
