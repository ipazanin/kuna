import { words } from './words'
import type { SpendingRuleCondition } from '../../workbook/domain/spendingRule'

/** What a rule tests, as a person reads it. */
export function ruleTestOf(condition: SpendingRuleCondition): string {
  return condition.column === 'counterparty_iban' ? words.rules.iban(condition.iban) : words.rules.contains(condition.fragment)
}
