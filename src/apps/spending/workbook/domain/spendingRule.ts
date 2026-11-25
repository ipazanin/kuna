import type { RowLink } from './rowLink'
import type { Transaction } from './transaction'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { stripAccents } from '../../../../shared/text/fold'

/** The tests that compare a row's text with values the rule lists, any of which may match. An IBAN is kept in capitals without spaces. */
export const TEXT_TESTS = ['payee_is', 'payee_contains', 'payee_starts_with', 'payee_matches', 'iban_is', 'description_contains', 'description_starts_with', 'description_matches'] as const
export type TextConditionTest = (typeof TEXT_TESTS)[number]

/** The tests that hold or not with nothing to compare. */
export const FLAG_TESTS = ['iban_none', 'money_in', 'money_out'] as const
export type FlagConditionTest = (typeof FLAG_TESTS)[number]

/** The tests of the amount's size without its sign, in the currency of the row's account. */
export const AMOUNT_TESTS = ['amount_at_least', 'amount_at_most'] as const
export type AmountConditionTest = (typeof AMOUNT_TESTS)[number]

/** Every test a condition can make, in the order a rule lists them. */
export const CONDITION_TESTS = [...TEXT_TESTS.slice(0, 5), 'iban_none', ...TEXT_TESTS.slice(5), 'money_in', 'money_out', ...AMOUNT_TESTS, 'accounts', 'days', 'currencies'] as const
export type ConditionTest = (typeof CONDITION_TESTS)[number]

/** The days of a month a row's day falls on, from and to, both counted. */
export interface MonthDays {
  readonly from: number
  readonly to: number
}

/** One thing a rule tests of a row. With `not`, it holds when the test does not. */
export type SpendingRuleCondition = { readonly not: boolean } & (
  | { readonly test: TextConditionTest; readonly values: readonly string[] }
  | { readonly test: FlagConditionTest }
  | { readonly test: AmountConditionTest; readonly amount: AccountMoney }
  | { readonly test: 'accounts'; readonly accounts: readonly RecordId[] }
  | { readonly test: 'days'; readonly days: MonthDays }
  | { readonly test: 'currencies'; readonly currencies: readonly CurrencyCode[] }
)

/** What a rule into Between my accounts says of the money it files: cash taken out, into the cash account it names or, with none named, the one cash account of the row's currency. */
export interface RuleWithdrawal {
  readonly cashAccount: RecordId | null
}

/**
 * Files a bank row whose every condition holds under a category, adds labels to it, or both, and may link it to the record in another
 * app its rows pay. Rules are tried by `order`. The first that holds and files decides the category, the first that holds and labels
 * decides the labels, and one with `stop` that holds ends the trying for that row.
 */
export interface SpendingRule {
  readonly id: RecordId
  /** Ascending, the priority the person sets by moving rules up and down. */
  readonly order: number
  readonly conditions: readonly SpendingRuleCondition[]
  readonly category: RecordId | null
  /** Added to the row, never taking off a label the row has. */
  readonly labels: readonly RecordId[]
  /** No rule after this one is tried for a row it holds for. */
  readonly stop: boolean
  /** Set on a rule into Between my accounts that spots cash taken out, which then holds only for money out. */
  readonly withdrawal: RuleWithdrawal | null
  /** The loan in another app the rows pay, named with no due date, so each row links to the instalment it pays. The category then holds the interest. */
  readonly link: RowLink | null
}

/** What a rule does and tests, without its place among the rules. */
export type RuleDraft = Omit<SpendingRule, 'id' | 'order'>

/** Why a rule cannot be kept as it stands. */
export type RuleProblem = 'no-condition' | 'repeated-test' | 'no-value' | 'not-a-pattern' | 'not-days' | 'no-outcome' | 'needs-category'

/** The first day and the last a month can have. */
const MONTH_DAYS = { first: 1, last: 31 } as const

/** Why one condition cannot be kept: it lists no value or a blank one, or holds a regular expression or days that are not ones. */
export function conditionProblem(condition: SpendingRuleCondition): RuleProblem | null {
  if ('values' in condition) {
    if (condition.values.length === 0 || condition.values.some((value) => value.trim() === '')) return 'no-value'
    return condition.test.endsWith('_matches') && condition.values.some((value) => rulePattern(value) === null) ? 'not-a-pattern' : null
  }
  if ('accounts' in condition) return condition.accounts.length === 0 ? 'no-value' : null
  if ('currencies' in condition) return condition.currencies.length === 0 ? 'no-value' : null
  if ('amount' in condition) return condition.amount < 0 ? 'no-value' : null
  if ('days' in condition) {
    const { from, to } = condition.days
    return [from, to].every((day) => Number.isInteger(day) && day >= MONTH_DAYS.first && day <= MONTH_DAYS.last) && from <= to ? null : 'not-days'
  }
  return null
}

/**
 * Why a rule cannot be kept: it tests nothing, makes one test twice the same way, lists no value or a blank one, holds a regular
 * expression that is not one or days that are not days of a month, does nothing, or spots cash or pays a loan with no category to file under.
 */
export function ruleProblem(rule: Pick<SpendingRule, 'conditions' | 'category' | 'labels' | 'withdrawal' | 'link'>): RuleProblem | null {
  if (rule.conditions.length === 0) return 'no-condition'
  const tests = rule.conditions.map((condition) => `${condition.not} ${condition.test}`)
  if (new Set(tests).size < tests.length) return 'repeated-test'
  const problem = rule.conditions.map(conditionProblem).find((found) => found !== null)
  if (problem !== undefined) return problem
  if (rule.category === null && rule.labels.length === 0) return 'no-outcome'
  return rule.category === null && (rule.withdrawal !== null || rule.link !== null) ? 'needs-category' : null
}

/** What a condition tests and against which values, the same text for two conditions that test the same. */
function conditionKey(condition: SpendingRuleCondition): string {
  const { not, test, ...against } = condition
  return JSON.stringify([not, test, Object.values(against)])
}

/** Whether two conditions test the same thing the same way, as stored. */
export function sameCondition(one: SpendingRuleCondition, other: SpendingRuleCondition): boolean {
  return conditionKey(one) === conditionKey(other)
}

/** The rule among `rules` with the same conditions, which a rule added with them joins, or undefined. */
export function ruleWithConditions(rules: readonly SpendingRule[], conditions: readonly SpendingRuleCondition[]): SpendingRule | undefined {
  return rules.find((rule) => sameConditions(rule.conditions, conditions))
}

/**
 * The rule that already has a draft's conditions, with what the draft adds. A draft with no category keeps the rule's category with
 * its cash and loan, one with no labels keeps the rule's labels, and Stop here stays on when either has it.
 */
export function withDraftAdded(held: SpendingRule, draft: RuleDraft): SpendingRule {
  const filing = draft.category === null ? { category: held.category, withdrawal: held.withdrawal, link: held.link } : { category: draft.category, withdrawal: draft.withdrawal, link: draft.link }
  return { ...held, ...filing, labels: draft.labels.length === 0 ? held.labels : draft.labels, stop: held.stop || draft.stop }
}

/** Whether two lists hold the same conditions, in any order. */
function sameConditions(one: readonly SpendingRuleCondition[], other: readonly SpendingRuleCondition[]): boolean {
  const keys = (conditions: readonly SpendingRuleCondition[]) => conditions.map(conditionKey).sort().join('\n')
  return one.length === other.length && keys(one) === keys(other)
}

/** What a rule made from a row tests, as Always for this payee does on a row: its IBAN, else its payee's name. Null for a row with neither. */
export function payeeCondition(row: Pick<Transaction, 'payee' | 'counterpartyIban'>): SpendingRuleCondition | null {
  if (row.counterpartyIban !== '') return { test: 'iban_is', values: [row.counterpartyIban], not: false }
  return row.payee === '' ? null : { test: 'payee_contains', values: [row.payee], not: false }
}

/**
 * A rule's regular expression as it tests folded text: its accents stripped and any case matching, since folded text has no
 * accents and is in capitals. Null when the text is not a regular expression.
 */
export function rulePattern(pattern: string): RegExp | null {
  try {
    return new RegExp(stripAccents(pattern), 'i')
  } catch {
    return null
  }
}

/** Whether folded text matches a pattern `rulePattern` made. Blank text matches none. */
export function foldedTextMatches(folded: string, pattern: RegExp): boolean {
  return folded !== '' && pattern.test(folded)
}
