import type { Category } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import { inTryingOrder } from '../../../../shared/categorising/domain/rule'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { foldRuleText, normaliseIban } from '../../../../shared/text/fold'
import { naturalOrder } from '../../../../shared/text/naturalOrder'

/** Two rules of different categories that can both hold for one payee, where the first rule tried decides. */
export interface RuleOverlap {
  readonly first: SpendingRule
  readonly then: SpendingRule
  /** The first files only money in, as a rule on an income category does, so the other still files money out. */
  readonly firstOnlyMoneyIn: boolean
}

/** A category that rules file into, with its rules in the order they are tried and the overlaps they take part in. */
export interface RuleGroup {
  readonly category: Category
  /** The group the category sits under, which tells two categories of one name apart. */
  readonly parent: Category | null
  readonly rules: readonly SpendingRule[]
  readonly overlaps: readonly RuleOverlap[]
}

/** What a rule's condition is compared by: its words folded as categorising folds them, or its IBAN normalised. */
function testedText(rule: SpendingRule): { readonly iban: boolean; readonly text: string } {
  const { condition } = rule
  return condition.column === 'counterparty_iban' ? { iban: true, text: normaliseIban(condition.iban) } : { iban: false, text: foldRuleText(condition.fragment) }
}

/**
 * Pairs of rules on different categories that can both hold for one payee: words where one contains the other, or the
 * same IBAN. A payee whose name holds the longer words also holds the shorter, so whichever is tried first files it.
 */
export function ruleOverlaps(rules: readonly SpendingRule[], categories: readonly Category[]): readonly RuleOverlap[] {
  const income = new Set(categories.filter((category) => category.kind === 'income').map((category) => category.id))
  const tried = inTryingOrder(rules).map((rule) => ({ rule, tested: testedText(rule) }))
  return tried.flatMap(({ rule: first, tested: firstTested }, place) =>
    tried.slice(place + 1).flatMap(({ rule: then, tested: thenTested }) => {
      if (first.category === then.category || firstTested.iban !== thenTested.iban) return []
      const overlapping = firstTested.iban ? firstTested.text === thenTested.text : firstTested.text.includes(thenTested.text) || thenTested.text.includes(firstTested.text)
      return overlapping ? [{ first, then, firstOnlyMoneyIn: income.has(first.category) && !income.has(then.category) }] : []
    }),
  )
}

/** Each category that has rules, by its name and then its group's, with its rules and the overlaps that touch them. */
export function ruleGroups(book: Pick<SpendingBook, 'rules' | 'categories'>): readonly RuleGroup[] {
  const categories = new Map(book.categories.map((category) => [category.id, category]))
  const overlaps = ruleOverlaps(book.rules, book.categories)
  const rulesOf = new Map<RecordId, SpendingRule[]>()
  for (const rule of inTryingOrder(book.rules)) {
    const held = rulesOf.get(rule.category)
    if (held === undefined) rulesOf.set(rule.category, [rule])
    else held.push(rule)
  }
  const parentOf = (category: Category): Category | null => (category.parent === null ? null : (categories.get(category.parent) ?? null))
  return [...rulesOf.entries()]
    .flatMap(([id, rules]) => {
      const category = categories.get(id)
      return category === undefined ? [] : [{ category, parent: parentOf(category), rules, overlaps: overlaps.filter(({ first, then }) => first.category === id || then.category === id) }]
    })
    .sort((one, other) => naturalOrder(one.category.name, other.category.name) || naturalOrder(one.parent?.name ?? '', other.parent?.name ?? ''))
}
