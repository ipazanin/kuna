import { ibanKey } from '../../workbook/domain/accountReading'
import { sameCondition } from '../../workbook/domain/spendingRule'
import type { SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import { isIban } from '../../../../shared/text/iban'

/** What a typed line asks a rule to test: the other side's IBAN when the line is one, else words in the payee's name. Null for a blank line. */
export function typedCondition(line: string): SpendingRuleCondition | null {
  const fragment = line.replace(/\s+/g, ' ').trim()
  if (fragment === '') return null
  return isIban(fragment) ? { column: 'counterparty_iban', iban: ibanKey(fragment) } : { column: 'counterparty_contains', fragment }
}

/** A condition for each line typed, with blank lines and repeats left out. */
export function typedConditions(text: string): readonly SpendingRuleCondition[] {
  return text
    .split('\n')
    .map(typedCondition)
    .filter((condition): condition is SpendingRuleCondition => condition !== null)
    .filter((condition, place, conditions) => conditions.findIndex((other) => sameCondition(other, condition)) === place)
}
