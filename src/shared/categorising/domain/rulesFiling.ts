/** What a rule files under, by the keys its app names a category and a label with: its category, or null for none, and the labels it puts on. */
export interface RuleTargets<Key> {
  readonly category: Key | null
  readonly labels: readonly Key[]
}

/** The rules that file a row under the category or put the label on it, in the order given. */
export function rulesFiling<Rule, Key>(rules: readonly Rule[], target: Key, targetsOf: (rule: Rule) => RuleTargets<Key>): readonly Rule[] {
  return rules.filter((rule) => {
    const { category, labels } = targetsOf(rule)
    return category === target || labels.includes(target)
  })
}

/** How many rules file under each category and put on each label, by its key. A category or label no rule names is not in it, and a rule counts once under each. */
export function ruleCounts<Rule, Key>(rules: readonly Rule[], targetsOf: (rule: Rule) => RuleTargets<Key>): ReadonlyMap<Key, number> {
  const counts = new Map<Key, number>()
  for (const rule of rules) {
    const { category, labels } = targetsOf(rule)
    for (const target of new Set([...(category === null ? [] : [category]), ...labels])) {
      counts.set(target, (counts.get(target) ?? 0) + 1)
    }
  }
  return counts
}
