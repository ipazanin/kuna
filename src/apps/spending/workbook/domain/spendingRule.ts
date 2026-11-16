import type { RowLink } from './rowLink'
import type { Transaction } from './transaction'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What a Spending rule tests: text in the payee's name, kept as you read it, or the other side's IBAN in capitals without spaces. */
export type SpendingRuleCondition = { readonly column: 'counterparty_contains'; readonly fragment: string } | { readonly column: 'counterparty_iban'; readonly iban: string }

/** What a rule into Between my accounts says of the money it files: cash taken out, into the cash account it names or, with none named, the one cash account of the row's currency. */
export interface RuleWithdrawal {
  readonly cashAccount: RecordId | null
}

/** Files a bank row with this payee under a category, and may link it to the record in another app its rows pay. */
export interface SpendingRule {
  readonly id: RecordId
  /** Ascending, and the first rule that holds decides the row. */
  readonly order: number
  readonly condition: SpendingRuleCondition
  readonly category: RecordId
  /** Set on a rule into Between my accounts that spots cash taken out, which then holds only for money out. */
  readonly withdrawal: RuleWithdrawal | null
  /** The loan in another app the rows pay, named with no due date, so each row links to the instalment it pays. The category then holds the interest. */
  readonly link: RowLink | null
}

/** Whether two conditions test the same thing, as stored. */
export function sameCondition(one: SpendingRuleCondition, other: SpendingRuleCondition): boolean {
  return one.column === 'counterparty_iban' ? other.column === 'counterparty_iban' && one.iban === other.iban : other.column === 'counterparty_contains' && one.fragment === other.fragment
}

/** What a rule made from a row tests, as Always for this payee does on a row: its IBAN, else its payee's name. Null for a row with neither. */
export function payeeCondition(row: Pick<Transaction, 'payee' | 'counterpartyIban'>): SpendingRuleCondition | null {
  if (row.counterpartyIban !== '') return { column: 'counterparty_iban', iban: row.counterpartyIban }
  return row.payee === '' ? null : { column: 'counterparty_contains', fragment: row.payee }
}
