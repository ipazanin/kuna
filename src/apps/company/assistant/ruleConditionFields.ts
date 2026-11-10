import { newCondition, withCondition } from '../rules/domain/ruleDraft'
import type { ConditionColumn, DraftCondition } from '../rules/domain/ruleDraft'
import type { StrictSchema } from '../../../shared/ai/domain/strictSchema'
import type { RuleCondition } from '../../../shared/categorising/domain/rule'
import { normaliseIban } from '../../../shared/text/fold'

/**
 * How the chat gives a condition. `text` and `iban` take text, "" to drop it and null to leave it. `direction` takes in, out or "".
 * `presence` takes yes, no or "". A `flag` holds or not, so yes adds it, no drops it and null leaves it.
 */
type ConditionInput = 'text' | 'iban' | 'direction' | 'presence' | 'flag'

interface RuleConditionField {
  readonly name: string
  readonly column: ConditionColumn
  readonly input: ConditionInput
  /** What the condition tests, as the start of the input's description. */
  readonly about: string
}

/** Each condition of a Company rule by the input name the chat's add-rule and change-rule give it, and the reader shows it under. */
export const RULE_CONDITION_FIELDS = [
  { name: 'payeeWords', column: 'counterparty_contains', input: 'text', about: "Words the other side's name must hold" },
  { name: 'descriptionWords', column: 'description_contains', input: 'text', about: 'Words the description must hold' },
  { name: 'descriptionStart', column: 'description_starts_with', input: 'text', about: 'Words the description must start with' },
  { name: 'iban', column: 'counterparty_iban', input: 'iban', about: "The other side's IBAN" },
  { name: 'ibanPresent', column: 'has_counterparty_iban', input: 'presence', about: 'yes when the other side must have an IBAN, no when it must have none' },
  { name: 'direction', column: 'direction', input: 'direction', about: 'in for money in, out for money out' },
  { name: 'ownAccount', column: 'counterparty_is_own', input: 'flag', about: "yes when the other side is one of the company's own accounts" },
  { name: 'client', column: 'counterparty_is_client', input: 'flag', about: 'yes when the other side is a client' },
  { name: 'card', column: 'is_card', input: 'flag', about: 'yes for a card purchase' },
  { name: 'foreignCurrency', column: 'foreign_currency', input: 'flag', about: 'yes for a payment in a foreign currency' },
  { name: 'domain', column: 'tx_domain', input: 'text', about: "The bank's domain code, such as PMNT" },
  { name: 'family', column: 'tx_family', input: 'text', about: "The bank's family code, such as RCDT" },
  { name: 'subFamily', column: 'tx_sub_family', input: 'text', about: "The bank's sub-family code, such as ESCT" },
  { name: 'purpose', column: 'purpose', input: 'text', about: "The payment's purpose code, such as SALA" },
  { name: 'revenueCode', column: 'revenue_code', input: 'text', about: 'The four-digit revenue code of a payment to the tax office, such as 1112' },
] as const satisfies readonly RuleConditionField[]

export type RuleConditionName = (typeof RULE_CONDITION_FIELDS)[number]['name']

/** A condition as the reader shows it, in the values the operations take: a flag as true or false, and "" for a condition the rule does not test. */
export type RuleConditionValues = { readonly [Name in RuleConditionName]: Extract<(typeof RULE_CONDITION_FIELDS)[number], { name: Name }>['input'] extends 'flag' ? boolean : string }

function schemaOf(field: RuleConditionField): StrictSchema {
  switch (field.input) {
    case 'text':
    case 'iban':
      return { type: ['string', 'null'], description: `${field.about}, "" for none, or null to leave it.` }
    case 'direction':
      return { type: ['string', 'null'], enum: ['in', 'out', '', null], description: `${field.about}, "" for either way, or null to leave it.` }
    case 'presence':
      return { type: ['string', 'null'], enum: ['yes', 'no', '', null], description: `${field.about}, "" for either, or null to leave it.` }
    case 'flag':
      return { type: ['string', 'null'], enum: ['yes', 'no', null], description: `${field.about}, no to stop testing it, or null to leave it.` }
  }
}

/** The inputs of the conditions, by name, for an operation's schema. */
export const RULE_CONDITION_INPUTS: Readonly<Record<RuleConditionName, StrictSchema>> = Object.fromEntries(RULE_CONDITION_FIELDS.map((field) => [field.name, schemaOf(field)])) as Record<
  RuleConditionName,
  StrictSchema
>

/** The value a step's input stores for its column, null to drop the condition, or undefined to leave it. A text field may hold a list of spellings, and the first is stored. */
function storedValue(field: RuleConditionField, given: string | readonly string[] | null): DraftCondition['value'] | null | undefined {
  if (given === null) return undefined
  const text = (Array.isArray(given) ? (given[0] ?? '') : given).trim()
  switch (field.input) {
    case 'text':
      return text === '' ? null : text
    case 'iban':
      return text === '' ? null : normaliseIban(text)
    case 'direction':
      return text === '' ? null : text === 'in' ? 'credit' : 'debit'
    case 'presence':
      return text === '' ? null : text === 'yes'
    case 'flag':
      return text === 'yes' ? newCondition(field.column).value : null
  }
}

/** The conditions with what a step's input gives for each, as the rule form would leave them. */
export function conditionsFromInput(conditions: readonly DraftCondition[], input: Readonly<Record<string, unknown>>): DraftCondition[] {
  return RULE_CONDITION_FIELDS.reduce<DraftCondition[]>(
    (kept, field) => {
      const value = storedValue(field, input[field.name] as string | readonly string[] | null)
      return value === undefined ? kept : withCondition(kept, field.column, value)
    },
    [...conditions],
  )
}

function shownValue(field: RuleConditionField, condition: RuleCondition | undefined): string | boolean {
  if (field.input === 'flag') return condition !== undefined
  if (condition === undefined) return ''
  if (condition.column === 'direction') return condition.direction === 'credit' ? 'in' : 'out'
  if (condition.column === 'has_counterparty_iban') return condition.present ? 'yes' : 'no'
  if (condition.column === 'counterparty_iban') return condition.iban
  if ('fragment' in condition) return condition.fragment
  return 'code' in condition ? condition.code : ''
}

/** A rule's conditions by their input names, as the operations take them. */
export function ruleConditionValues(conditions: readonly RuleCondition[]): RuleConditionValues {
  return Object.fromEntries(
    RULE_CONDITION_FIELDS.map((field) => [
      field.name,
      shownValue(
        field,
        conditions.find((condition) => condition.column === field.column),
      ),
    ]),
  ) as RuleConditionValues
}
