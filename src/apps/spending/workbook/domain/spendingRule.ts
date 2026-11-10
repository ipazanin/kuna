import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What a Spending rule tests: text in the payee's name, kept as you read it, or the other side's IBAN in capitals without spaces. */
export type SpendingRuleCondition = { readonly column: 'counterparty_contains'; readonly fragment: string } | { readonly column: 'counterparty_iban'; readonly iban: string }

/** Files a bank row with this payee under a category. */
export interface SpendingRule {
  readonly id: RecordId
  /** Ascending, and the first rule that holds decides the row. */
  readonly order: number
  readonly condition: SpendingRuleCondition
  readonly category: RecordId
}

/** Whether two conditions test the same thing, as stored. */
export function sameCondition(one: SpendingRuleCondition, other: SpendingRuleCondition): boolean {
  return one.column === 'counterparty_iban' ? other.column === 'counterparty_iban' && one.iban === other.iban : other.column === 'counterparty_contains' && one.fragment === other.fragment
}
