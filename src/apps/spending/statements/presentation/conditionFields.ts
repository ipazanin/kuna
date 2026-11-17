import { ibanKey } from '../../workbook/domain/accountReading'
import { AMOUNT_TESTS, FLAG_TESTS, TEXT_TESTS } from '../../workbook/domain/spendingRule'
import type { ConditionTest, SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import { typedAccountAmount } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** One condition as the rule dialog types it, with a field for each kind of value, so changing the test keeps what was typed. */
export interface ConditionField {
  readonly key: number
  test: ConditionTest
  /** Values one to a line, for a test of text or IBANs. */
  lines: string
  amount: string
  accounts: RecordId[]
  currencies: CurrencyCode[]
  from: string
  to: string
  not: boolean
}

/** What a test's value is typed into. */
export type ConditionInput = 'lines' | 'none' | 'amount' | 'accounts' | 'currencies' | 'days'

export function inputOf(test: ConditionTest): ConditionInput {
  if ((TEXT_TESTS as readonly string[]).includes(test)) return 'lines'
  if ((FLAG_TESTS as readonly string[]).includes(test)) return 'none'
  if ((AMOUNT_TESTS as readonly string[]).includes(test)) return 'amount'
  return test === 'accounts' ? 'accounts' : test === 'currencies' ? 'currencies' : 'days'
}

let nextKey = 0

/** A blank condition, or the fields a condition fills. */
export function conditionField(condition: SpendingRuleCondition | null = null): ConditionField {
  nextKey += 1
  const field: ConditionField = { key: nextKey, test: 'payee_contains', lines: '', amount: '', accounts: [], currencies: [], from: '1', to: '31', not: false }
  if (condition === null) return field
  return {
    ...field,
    test: condition.test,
    not: condition.not,
    lines: 'values' in condition ? condition.values.join('\n') : '',
    amount: 'amount' in condition ? amountForTyping(condition.amount) : '',
    accounts: 'accounts' in condition ? [...condition.accounts] : [],
    currencies: 'currencies' in condition ? [...condition.currencies] : [],
    from: 'days' in condition ? String(condition.days.from) : field.from,
    to: 'days' in condition ? String(condition.days.to) : field.to,
  }
}

/** The condition the fields state, with blank lines left out, or null for an amount that does not read as one. */
export function conditionOfField(field: ConditionField): SpendingRuleCondition | null {
  const { test, not } = field
  switch (inputOf(test)) {
    case 'lines': {
      const values = field.lines
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line !== '')
      return { test: test as (typeof TEXT_TESTS)[number], values: test === 'iban_is' ? values.map(ibanKey) : values, not }
    }
    case 'none':
      return { test: test as (typeof FLAG_TESTS)[number], not }
    case 'amount': {
      const amount = typedAccountAmount(field.amount)
      return amount === null ? null : { test: test as (typeof AMOUNT_TESTS)[number], amount, not }
    }
    case 'accounts':
      return { test: 'accounts', accounts: field.accounts, not }
    case 'currencies':
      return { test: 'currencies', currencies: field.currencies, not }
    case 'days':
      return { test: 'days', days: { from: Number(field.from), to: Number(field.to) }, not }
  }
}
