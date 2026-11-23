import { ibanKey } from './accountReading'
import { rowLinkOf, rowLinkText } from './rowLink'
import type { RowLink } from './rowLink'
import { flagOf, orderOf, requiredAccountMoney } from './fieldReading'
import { optionalReference } from './recordReference'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LABEL_RECORDS, RULE_RECORDS } from './spendingKinds'
import { AMOUNT_TESTS, CONDITION_TESTS, FLAG_TESTS, TEXT_TESTS, ruleProblem } from './spendingRule'
import type { ConditionTest, RuleWithdrawal, SpendingRule, SpendingRuleCondition } from './spendingRule'
import { words } from './words'
import { CONDITION_COLUMNS } from '../../../../shared/categorising/domain/rule'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { FieldValue } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { idsOf, idsText, ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { Account } from './account'
import { isTransferCategory } from './category'
import type { Category } from './category'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'

/** The fields a file from before conditions holds a rule's one test in, read as payee contains and IBAN is. */
const OLDER_TESTS = { counterparty_contains: 'payee_contains', counterparty_iban: 'iban_is' } as const

/** The field that holds a test, with `not_` before it for a test turned around. */
function columnOf(test: ConditionTest, not: boolean): string {
  return not ? `not_${test}` : test
}

/** A test's values, one to a line, since a payee or a regular expression may hold commas and bars. */
function linesOf(text: string): readonly string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

function currenciesOf(column: string, text: string): readonly CurrencyCode[] {
  return text
    .split(/[|,]/)
    .map((code) => code.trim())
    .filter((code) => code !== '')
    .map((code) => currencyCodeOf(code) ?? refuse(words.notARuleCurrency(column, code)))
}

const DAYS = /^(\d{1,2})\s*-\s*(\d{1,2})$/

/** The condition a filled field states. */
function conditionIn(fields: StoredFields, test: ConditionTest, not: boolean): SpendingRuleCondition {
  const column = columnOf(test, not)
  const text = textOf(fields[column])
  if ((TEXT_TESTS as readonly string[]).includes(test)) {
    const values = linesOf(text)
    return { test: test as (typeof TEXT_TESTS)[number], values: test === 'iban_is' ? values.map(ibanKey) : values, not }
  }
  if ((FLAG_TESTS as readonly string[]).includes(test)) return flagOf(fields, column) ? { test: test as (typeof FLAG_TESTS)[number], not } : refuse(words.notAFlag(column, text))
  if ((AMOUNT_TESTS as readonly string[]).includes(test)) {
    return { test: test as (typeof AMOUNT_TESTS)[number], amount: requiredAccountMoney(fields, column), not }
  }
  if (test === 'accounts') return { test, accounts: idsOf(fields[column], ACCOUNT_RECORDS), not }
  if (test === 'currencies') return { test, currencies: currenciesOf(column, text), not }
  const days = DAYS.exec(text)
  return days === null ? refuse(words.notDays(column, text)) : { test: 'days', days: { from: Number(days[1]), to: Number(days[2]) }, not }
}

/**
 * The conditions a stored rule states, one field per test, and a test of a file from before conditions read as the condition it
 * meant. Any of Company's condition columns Spending does not read is refused, so a rule never reads as wider than it is.
 */
function conditionsOf(fields: StoredFields): readonly SpendingRuleCondition[] {
  const read = new Set<string>([...CONDITION_TESTS, ...Object.keys(OLDER_TESTS)])
  const other = CONDITION_COLUMNS.find((column) => !read.has(column) && fields[column] !== undefined)
  if (other !== undefined) refuse(words.ruleOtherCondition(other))
  const older = Object.entries(OLDER_TESTS).flatMap(([column, test]): SpendingRuleCondition[] => {
    const text = textOf(fields[column])
    return text === '' ? [] : [{ test, values: [test === 'iban_is' ? ibanKey(text) : text], not: false }]
  })
  const stated = CONDITION_TESTS.flatMap((test) => [false, true].flatMap((not) => (fields[columnOf(test, not)] === undefined ? [] : [conditionIn(fields, test, not)])))
  return [...older, ...stated]
}

/** A withdrawal flag, with the cash account named only beside it. */
function withdrawalOf(fields: StoredFields): RuleWithdrawal | null {
  const cashAccount = optionalReference(fields, 'cash_account', ACCOUNT_RECORDS)
  if (!flagOf(fields, 'withdrawal')) return cashAccount === null ? null : refuse(words.cashAccountWithoutWithdrawal)
  return { cashAccount }
}

/** The loan a rule's rows pay, as a link with no due date, since each row pays its own instalment. */
function ruleLinkOf(fields: StoredFields): RowLink | null {
  if (fields.link === undefined) return null
  const text = textOf(fields.link)
  const link = rowLinkOf(text)
  return link === null || link.due !== null ? refuse(words.notARuleLink(text)) : link
}

function ruleOf(fields: StoredFields, id: RecordId | null): SpendingRule {
  const rule: SpendingRule = {
    id: ownId(id),
    order: orderOf(fields, 'order'),
    conditions: conditionsOf(fields),
    category: optionalReference(fields, 'category', CATEGORY_RECORDS),
    labels: idsOf(fields.labels, LABEL_RECORDS),
    stop: flagOf(fields, 'stop'),
    withdrawal: withdrawalOf(fields),
    link: ruleLinkOf(fields),
  }
  const problem = ruleProblem(rule)
  return problem === null ? rule : refuse(words.ruleProblem[problem])
}

/** The field a condition is stored in, with what it holds. */
function conditionField(condition: SpendingRuleCondition): readonly [string, FieldValue] {
  const column = columnOf(condition.test, condition.not)
  if ('values' in condition) return [column, condition.values.join('\n')]
  if ('amount' in condition) return [column, amountText(condition.amount)]
  if ('accounts' in condition) return [column, idsText(condition.accounts, ACCOUNT_RECORDS)]
  if ('currencies' in condition) return [column, condition.currencies.join(' | ')]
  if ('days' in condition) return [column, `${condition.days.from}-${condition.days.to}`]
  return [column, true]
}

export const RULE_CODEC: RecordCodec<SpendingRule> = withIdField(RULE_RECORDS, words.ruleLabel, ruleOf, (rule) =>
  filledFields({
    order: String(rule.order),
    ...Object.fromEntries(rule.conditions.map(conditionField)),
    category: rule.category === null ? null : keyOfRecordId(CATEGORY_RECORDS, rule.category),
    labels: rule.labels.length === 0 ? null : idsText(rule.labels, LABEL_RECORDS),
    stop: rule.stop ? true : null,
    withdrawal: rule.withdrawal === null ? null : true,
    cash_account: rule.withdrawal?.cashAccount == null ? null : keyOfRecordId(ACCOUNT_RECORDS, rule.withdrawal.cashAccount),
    link: rule.link === null ? null : rowLinkText(rule.link),
  }),
)

/**
 * Why a rule does not count: it names a category, a label or an account that does not count, it files into In a shared cost, or it spots a withdrawal off Between
 * my accounts or into an account that is not cash.
 */
export function readRules(read: RecordsRead<SpendingRule>, categories: readonly Category[], accounts: readonly Account[], labels: readonly Label[]): Reading<SpendingRule> {
  const categoryOf = new Map(categories.map((category) => [category.id, category]))
  const cash = new Set(accounts.filter((account) => account.kind === 'cash').map((account) => account.id))
  const accountIds = new Set(accounts.map((account) => account.id))
  const labelIds = new Set(labels.map((label) => label.id))
  const reading = readEach(read, ({ record: rule }) => {
    const category = rule.category === null ? null : categoryOf.get(rule.category)
    if (category === undefined) return [words.noCategory]
    if (category?.kind === 'shared-cost') return [words.ruleSharedCost]
    if (rule.labels.some((label) => !labelIds.has(label))) return [words.shortcutNoLabel]
    if (rule.conditions.some((condition) => 'accounts' in condition && condition.accounts.some((account) => !accountIds.has(account)))) return [words.noAccount]
    if (rule.withdrawal === null) return []
    if (category === null || !isTransferCategory(category)) return [words.withdrawalNotTransfer]
    return rule.withdrawal.cashAccount === null || cash.has(rule.withdrawal.cashAccount) ? [] : [words.withdrawalNotCash]
  })
  return { ...reading, facts: [...reading.facts].sort((earlier, later) => earlier.order - later.order) }
}
