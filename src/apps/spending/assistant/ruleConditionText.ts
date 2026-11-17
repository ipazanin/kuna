import type { SpendingRuleCondition } from '../workbook/domain/spendingRule'
import { plainAmount } from '../../../shared/money/money'

/** A condition as the chat reads it, in the shape a step types it, such as `not payee_contains: Airport`. */
export function conditionText(condition: SpendingRuleCondition, accountName: (id: string) => string): string {
  const values =
    'values' in condition
      ? condition.values
      : 'amount' in condition
        ? [plainAmount(condition.amount)]
        : 'accounts' in condition
          ? condition.accounts.map(accountName)
          : 'currencies' in condition
            ? condition.currencies
            : 'days' in condition
              ? [`${condition.days.from}-${condition.days.to}`]
              : []
  return `${condition.not ? 'not ' : ''}${condition.test}${values.length === 0 ? '' : `: ${values.join(' | ')}`}`
}
