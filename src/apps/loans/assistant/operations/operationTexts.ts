import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { moneyOf } from '../../../../shared/app/operationTexts'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { Money } from '../../../../shared/money/money'

/** A yearly rate as the bank writes it, which the screens' own rate parser reads. */
export const RATE: StrictSchema = { type: 'string', description: 'A yearly percent as the bank writes it, such as 3.18, with at most four decimals.' }
export const RATE_OR_NULL: StrictSchema = { type: ['string', 'null'], description: 'A yearly percent such as 3.18, or null to leave it.' }

/** The regular instalment a contract, plan, offer or rate notice prints, which only the card reads and the file never keeps. */
export const BANK_INSTALMENT: StrictSchema = {
  type: ['number', 'null'],
  description:
    'The regular instalment as the document prints it, in euros, principal and interest before any subsidy, from the due date the operation says, or null when it prints none. Never worked out.',
}

/** The printed instalment a step gives, above zero, or null for none. */
export function printedInstalmentOf(amount: number | null): Money | null {
  if (amount === null) return null
  const printed = moneyOf(amount)
  if (printed <= 0) throw new StepRefused('bankInstalment is above zero, or null.')
  return printed
}
