import type { SpendingRule } from '../../workbook/domain/spendingRule'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The rules that file a row under the category or put the label on it, in the order given. */
export function rulesFiling<Rule extends Pick<SpendingRule, 'category' | 'labels'>>(rules: readonly Rule[], target: RecordId): readonly Rule[] {
  return rules.filter((rule) => rule.category === target || rule.labels.includes(target))
}

/** How many rules file under each category and put on each label, by its id. A category or label no rule names is not in it. */
export function ruleCounts(rules: readonly Pick<SpendingRule, 'category' | 'labels'>[]): ReadonlyMap<RecordId, number> {
  const counts = new Map<RecordId, number>()
  for (const rule of rules) {
    for (const target of new Set([...(rule.category === null ? [] : [rule.category]), ...rule.labels])) {
      counts.set(target, (counts.get(target) ?? 0) + 1)
    }
  }
  return counts
}
