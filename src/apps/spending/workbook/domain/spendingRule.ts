import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What a Spending rule tests: text in the payee's name, kept as you read it, or the other side's IBAN in capitals without spaces. */
export type SpendingRuleCondition = { readonly column: 'counterparty_contains'; readonly fragment: string } | { readonly column: 'counterparty_iban'; readonly iban: string }

/** What a rule into Between my accounts says of the money it files: cash taken out, into the cash account it names or, with none named, the one cash account of the row's currency. */
export interface RuleWithdrawal {
  readonly cashAccount: RecordId | null
}

/** Files a bank row with this payee under a category. */
export interface SpendingRule {
  readonly id: RecordId
  /** Ascending, and the first rule that holds decides the row. */
  readonly order: number
  readonly condition: SpendingRuleCondition
  readonly category: RecordId
  /** Set on a rule into Between my accounts that spots cash taken out, which then holds only for money out. */
  readonly withdrawal: RuleWithdrawal | null
}

/** Whether two conditions test the same thing, as stored. */
export function sameCondition(one: SpendingRuleCondition, other: SpendingRuleCondition): boolean {
  return one.column === 'counterparty_iban' ? other.column === 'counterparty_iban' && one.iban === other.iban : other.column === 'counterparty_contains' && one.fragment === other.fragment
}
