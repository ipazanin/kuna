import { inTryingOrder } from './rule'
import type { Rule, RuleCondition } from './rule'
import { transactionFacts } from './transactionFacts'
import type { CategorisableTransaction, CategorisationContext, TransactionFacts } from './transactionFacts'

/** What the categoriser writes for a row no rule decides, or a `review` rule with no category. */
export const UNKNOWN_CATEGORY = 'unknown'

export interface Verdict {
  readonly category: string
  /** `rule` for a settled row, `ai` for one that waits on Needs review. */
  readonly flaggedBy: 'rule' | 'ai'
  /** The rule that decided, or null when none did. */
  readonly ruleId: string | null
}

/** The first enabled rule, in order, whose every condition holds decides the row. No match is `unknown` / `ai`. */
export function categorise(transaction: CategorisableTransaction, rules: readonly Rule[], context: CategorisationContext): Verdict {
  const facts = transactionFacts(transaction, context)
  const deciding = inTryingOrder(rules).find((rule) => rule.enabled && ruleMatches(rule, facts))
  if (deciding === undefined) {
    return { category: UNKNOWN_CATEGORY, flaggedBy: 'ai', ruleId: null }
  }
  return {
    category: deciding.category || UNKNOWN_CATEGORY,
    flaggedBy: deciding.confidence === 'rule' ? 'rule' : 'ai',
    ruleId: deciding.id,
  }
}

export function ruleMatches(rule: Rule, facts: TransactionFacts): boolean {
  return rule.conditions.every((condition) => conditionHolds(condition, facts))
}

/** A blank counterparty matches no fragment and a blank IBAN matches no IBAN, so a row without one never equals a blank cell. */
function conditionHolds(condition: RuleCondition, facts: TransactionFacts): boolean {
  switch (condition.column) {
    case 'direction':
      return condition.direction === 'credit' ? facts.isCredit : !facts.isCredit
    case 'counterparty_iban':
      return facts.hasCounterpartyIban && facts.counterpartyIban === condition.iban
    case 'has_counterparty_iban':
      return facts.hasCounterpartyIban === condition.present
    case 'counterparty_is_own':
      return facts.ownAccount
    case 'counterparty_contains':
      return facts.counterparty !== '' && facts.counterparty.includes(condition.fragment)
    case 'description_contains':
      return facts.description.includes(condition.fragment)
    case 'description_starts_with':
      return facts.description.startsWith(condition.fragment)
    case 'tx_domain':
      return facts.txDomain === condition.code
    case 'tx_family':
      return facts.txFamily === condition.code
    case 'tx_sub_family':
      return facts.txSubFamily === condition.code
    case 'purpose':
      return facts.purpose === condition.code
    case 'revenue_code':
      return facts.revenueCode === condition.code
    case 'is_card':
      return facts.isCard
    case 'foreign_currency':
      return facts.foreignCurrency
  }
}
