import { TEXT, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { accountMoneyFromAmount } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { decimalOf } from '../../../../shared/storage/domain/storedFields'
import { fold } from '../../../../shared/text/fold'
import type { Account } from '../../workbook/domain/account'
import { ibanKey } from '../../workbook/domain/accountReading'
import { AMOUNT_TESTS, CONDITION_TESTS, FLAG_TESTS, TEXT_TESTS } from '../../workbook/domain/spendingRule'
import type { ConditionTest, RuleProblem, SpendingRuleCondition } from '../../workbook/domain/spendingRule'

/** A rule's conditions as the chat types them, each a test, its values and whether it is turned around. */
export const RULE_CONDITIONS: StrictSchema = {
  type: 'array',
  items: inputOf({ test: { type: 'string', enum: [...CONDITION_TESTS] }, values: { type: 'array', items: TEXT }, not: { type: 'boolean' } }),
}

/** How the chat's page reads a rule's conditions, which `conditionsOfStep` reads back. */
export const CONDITIONS_ABOUT =
  'conditions all hold for a rule to hold, and a condition holds when any of its values matches, or with not when none does. payee_* and description_* take words, *_matches a regular expression, iban_is IBANs, amount_at_least and amount_at_most one amount without its sign such as 25.00, accounts account names, days one span such as 1-15, currencies codes such as USD. iban_none, money_in and money_out take no values.'

const DAYS = /^(\d{1,2})\s*-\s*(\d{1,2})$/

/** One condition a step types, refused in a sentence when its values do not fit its test. */
function conditionOfStep(test: ConditionTest, values: readonly string[], not: boolean, accounts: readonly Account[]): SpendingRuleCondition {
  const typed = values.map((value) => value.trim()).filter((value) => value !== '')
  if ((FLAG_TESTS as readonly string[]).includes(test)) return { test: test as (typeof FLAG_TESTS)[number], not }
  if (typed.length === 0) throw new StepRefused(`${test} needs at least one value.`)
  if ((TEXT_TESTS as readonly string[]).includes(test)) return { test: test as (typeof TEXT_TESTS)[number], values: test === 'iban_is' ? typed.map(ibanKey) : typed, not }
  if ((AMOUNT_TESTS as readonly string[]).includes(test)) {
    const amount = decimalOf(typed[0]!)
    if (amount === null || amount < 0) throw new StepRefused(`${test} takes one amount of zero or more, such as 25.00.`)
    return { test: test as (typeof AMOUNT_TESTS)[number], amount: accountMoneyFromAmount(amount), not }
  }
  if (test === 'accounts') {
    const named = typed.map((name) => accounts.find((account) => fold(account.name) === fold(name)))
    if (named.some((account) => account === undefined)) throw new StepRefused('accounts takes the names of accounts in the file.')
    return { test, accounts: named.map((account) => account!.id), not }
  }
  if (test === 'currencies') {
    const codes = typed.map(currencyCodeOf)
    if (codes.some((code) => code === null)) throw new StepRefused('currencies takes three-letter codes such as EUR or USD.')
    return { test, currencies: codes.map((code) => code!), not }
  }
  const days = DAYS.exec(typed[0]!)
  if (days === null) throw new StepRefused('days takes one span of days of the month, such as 1-15.')
  return { test: 'days', days: { from: Number(days[1]), to: Number(days[2]) }, not }
}

/** The conditions a step types. */
export function conditionsOfStep(
  items: readonly { readonly test: string; readonly values: readonly string[]; readonly not: boolean }[],
  accounts: readonly Account[],
): readonly SpendingRuleCondition[] {
  return items.map(({ test, values, not }) => {
    const known = CONDITION_TESTS.find((candidate) => candidate === test)
    if (known === undefined) throw new StepRefused(`A condition's test is one of ${CONDITION_TESTS.join(', ')}.`)
    return conditionOfStep(known, values, not, accounts)
  })
}

/** Why a rule a step drafts cannot be kept, for the model to fix. */
export const RULE_PROBLEMS: Readonly<Record<RuleProblem, string>> = {
  'no-condition': 'A rule needs at least one condition.',
  'repeated-test': 'A rule makes each test once, and once more with not. Put the values of one test in one condition.',
  'no-value': 'Each condition but iban_none, money_in and money_out lists a value that is not blank.',
  'not-a-pattern': 'A *_matches value is not a regular expression.',
  'not-days': 'days is a span of days of the month, the first not after the second, such as 1-15.',
  'no-outcome': 'A rule files a category, adds a label, or both.',
  'needs-category': 'A rule that spots cash taken out or pays a loan files into a category.',
}
