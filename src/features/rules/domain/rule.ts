import { naturalOrder } from '../../../shared/text/naturalOrder'

/** `rule` files a row at full confidence. `review` writes `ai`, so the row waits on Needs review. */
export type RuleConfidence = 'rule' | 'review'

export type EntrySide = 'credit' | 'debit'

/**
 * One filled condition cell of a `rules` tab row. Text is held folded and an IBAN normalised, the
 * way the transaction side is, so a test is a plain comparison.
 */
export type RuleCondition =
  | { readonly column: 'direction'; readonly direction: EntrySide }
  | { readonly column: 'counterparty_iban'; readonly iban: string }
  | { readonly column: 'has_counterparty_iban'; readonly present: boolean }
  | { readonly column: 'counterparty_is_own' | 'counterparty_is_client' }
  | { readonly column: 'counterparty_contains' | 'description_contains' | 'description_starts_with'; readonly fragment: string }
  | { readonly column: 'tx_domain' | 'tx_family' | 'tx_sub_family' | 'purpose' | 'revenue_code'; readonly code: string }
  | { readonly column: 'is_card' | 'foreign_currency' }

/** One row of the `rules` tab. Every condition must hold, so OR is two rules with the same outcome. */
export interface Rule {
  readonly id: string
  /** Ascending, and the first enabled rule whose conditions all hold decides the row. */
  readonly order: number
  readonly enabled: boolean
  readonly conditions: readonly RuleCondition[]
  /** Lower case. Blank only on a `review` rule, whose rows then read `unknown`. */
  readonly category: string
  readonly confidence: RuleConfidence
  readonly note: string
}

/** The tab's condition columns, in the tab's order. */
export const CONDITION_COLUMNS = [
  'direction',
  'counterparty_iban',
  'has_counterparty_iban',
  'counterparty_is_own',
  'counterparty_is_client',
  'counterparty_contains',
  'description_contains',
  'description_starts_with',
  'tx_domain',
  'tx_family',
  'tx_sub_family',
  'purpose',
  'revenue_code',
  'is_card',
  'foreign_currency',
] as const

/** Every column of the `rules` tab in its seeded order. */
export const RULE_COLUMNS = ['rule', 'order', 'enabled', ...CONDITION_COLUMNS, 'category', 'confidence', 'note'] as const

/** The rules in the order they are tried: by order, then by id. */
export function inTryingOrder(rules: readonly Rule[]): Rule[] {
  return [...rules].sort((earlier, later) => earlier.order - later.order || naturalOrder(earlier.id.toLowerCase(), later.id.toLowerCase()))
}
