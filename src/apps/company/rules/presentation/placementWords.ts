import { inTryingOrder } from '../../../../shared/categorising/domain/rule'
import type { Rule } from '../../../../shared/categorising/domain/rule'
import { words } from './words'

/** Where a rule is tried, as the rule form and the chat's card say it: first, before the rule tried next, or after every rule. */
export function placementWords(next: string | null, first: boolean): string {
  if (first) return words.form.first
  return next === null ? words.form.last : words.form.before(next)
}

/** The places the rule form offers: before each other rule in trying order, the top one said as first, then `last` for after every rule. */
export function placementChoices(rules: readonly Pick<Rule, 'id' | 'order'>[], editingId: string | null, last: string): { readonly value: string; readonly label: string }[] {
  const others = inTryingOrder(rules).filter((rule) => rule.id !== editingId)
  return [...others.map((rule, at) => ({ value: rule.id, label: placementWords(rule.id, at === 0) })), { value: last, label: placementWords(null, false) }]
}
