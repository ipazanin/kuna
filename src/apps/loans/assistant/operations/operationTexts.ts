import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { plainAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'

/** A yearly rate as the bank writes it, which the screens' own rate parser reads. */
export const RATE: StrictSchema = { type: 'string', description: 'A yearly percent as the bank writes it, such as 3.18, with at most four decimals.' }
export const RATE_OR_NULL: StrictSchema = { type: ['string', 'null'], description: 'A yearly percent such as 3.18, or null to leave it.' }

/** A choice from a closed list, or null to leave the field as it is. */
export function choiceOrNull(choices: readonly string[]): StrictSchema {
  return { type: ['string', 'null'], description: `${choices.join(', ')}, or null to leave it.` }
}

/** An amount in euros a step names, read as a Loans field reads it, so one below zero or with more than two decimals is refused. */
export function moneyOf(amount: number): Money {
  const money = typedAmount(String(amount))
  if (money === null) throw new StepRefused(`${amount} is not an amount in euros of zero or more, with at most two decimals.`)
  return money
}

/** An amount in euros as a Loans field holds it for typing, so the screens' own parsers read it and refuse what they refuse. Null is a blank field. */
export function amountText(amount: number | null): string {
  return amount === null ? '' : plainAmount(moneyOf(amount))
}

/** A whole number as a field holds it, or a blank field for null. */
export function countText(count: number | null): string {
  return count === null ? '' : String(count)
}

/** Refuses with what a form would say under each field that is wrong. */
export function refuseOnErrors(errors: Readonly<Record<string, string | null>>): void {
  const wrong = Object.entries(errors).flatMap(([field, error]) => (error === null ? [] : [`${field}: ${error.replace(/\.$/, '')}.`]))
  if (wrong.length > 0) throw new StepRefused(wrong.join(' '))
}
