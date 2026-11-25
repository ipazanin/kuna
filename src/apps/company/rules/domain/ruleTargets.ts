import type { Rule } from './rule'
import type { RuleTargets } from '../../../../shared/categorising/domain/rulesFiling'

/** What a Company rule files under: its category by its short name, or none on a review rule with a blank one, and its labels by their ids. */
export function ruleTargetsOf(rule: Pick<Rule, 'category' | 'labels'>): RuleTargets<string> {
  const category = rule.category.trim().toLowerCase()
  return { category: category === '' ? null : category, labels: rule.labels ?? [] }
}
