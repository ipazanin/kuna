import { cellText } from '../../../../shared/text/cellText'
import { RULE_RECORDS } from '../../workbook/domain/coreKinds'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { backtestRuleChange } from './backtestRule'
import type { BacktestTransaction, RuleBacktest } from './backtestRule'
import { readRules } from './readRules'
import type { RuleLabelIds, RuleTabRow } from './readRules'
import type { Rule } from './rule'
import { rulesTabAfter } from './rulesTabChange'
import type { RulesTabChange } from './rulesTabChange'
import type { CategorisationContext } from './companyFacts'

/** A rule a change gives labels it did not put on rows before, which the rows it files from then on take. */
export interface RuleLabelsGained {
  readonly ruleId: string
  readonly labels: readonly RecordId[]
}

export interface RulesChangePreview<Row> {
  /** Why the save would be refused. Empty when it can be saved. */
  readonly refusals: readonly string[]
  readonly backtest: RuleBacktest<Row>
  /** The rules the change gives labels. The rows they filed before keep their labels. */
  readonly labelsGained: readonly RuleLabelsGained[]
}

/**
 * What a change to the rules tab would do, worked out on the copy on screen before anything is
 * written: the rows it changes must still hold what the app read, every rule it writes must read,
 * and every row whose verdict moves is listed, with each rule that gains labels. A rule may name the labels in `labels`. The save
 * repeats the checks on a fresh read.
 */
export function previewRulesChange<Row extends BacktestTransaction>(
  rows: readonly RuleTabRow[],
  change: RulesTabChange,
  definedCategories: ReadonlySet<string>,
  labels: RuleLabelIds,
  current: readonly Rule[],
  transactions: readonly Row[],
  context: CategorisationContext,
): RulesChangePreview<Row> {
  const after = rulesTabAfter(rows, change)
  const { rules: proposed, problems } = readRules(after.rows, definedCategories, labels)
  const written = new Set(
    [change.appended, ...change.edited.map((edit) => edit.fields)].flatMap((fields) => {
      if (fields === null) return []
      const id = cellText(fields.rule).toLowerCase()
      return [id === '' ? null : recordIdOf(RULE_RECORDS, id)]
    }),
  )
  const refusals = [...after.refusals, ...problems.filter((problem) => written.has(problem.id)).map((problem) => `${problem.label}: ${problem.reason}`)]
  return { refusals: [...new Set(refusals)], backtest: backtestRuleChange(current, proposed, transactions, context), labelsGained: labelsGained(change, current, proposed) }
}

/** Each rule the change adds or edits with labels the rule it was did not put on, found by the id the edit names. */
function labelsGained(change: RulesTabChange, current: readonly Rule[], proposed: readonly Rule[]): RuleLabelsGained[] {
  const ruleWithId = (rules: readonly Rule[], id: string) => rules.find((rule) => rule.id.toLowerCase() === id.trim().toLowerCase())
  const written = [
    ...(change.appended === null ? [] : [{ before: null, id: cellText(change.appended.rule) }]),
    ...change.edited.map((edit) => ({ before: ruleWithId(current, edit.id) ?? null, id: cellText(edit.fields.rule) })),
  ]
  return written.flatMap(({ before, id }) => {
    const rule = ruleWithId(proposed, id)
    const gained = (rule?.labels ?? []).filter((label) => !(before?.labels ?? []).includes(label))
    return rule === undefined || gained.length === 0 ? [] : [{ ruleId: rule.id, labels: gained }]
  })
}
